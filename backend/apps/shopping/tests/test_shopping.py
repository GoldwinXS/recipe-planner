from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.ingredients.models import Ingredient
from apps.meal_plans.models import MealPlan, MealPlanEntry
from apps.recipes.models import Recipe, RecipeIngredient
from apps.shopping.models import ShoppingListItem

User = get_user_model()

MONDAY = date(2025, 1, 6)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="shopper",
        email="shopper@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def flour(db):
    return Ingredient.objects.create(name="Flour", category="carb", default_unit="g")


@pytest.fixture
def eggs(db):
    return Ingredient.objects.create(name="Eggs", category="protein", default_unit="piece")


@pytest.fixture
def recipe(db, user, flour, eggs):
    r = Recipe.objects.create(
        user=user,
        title="Pancakes",
        description="Fluffy pancakes",
        servings=4,
        prep_time_minutes=10,
        cook_time_minutes=15,
        instructions="Mix and cook.",
    )
    RecipeIngredient.objects.create(recipe=r, ingredient=flour, quantity=Decimal("200"), unit="g")
    RecipeIngredient.objects.create(recipe=r, ingredient=eggs, quantity=Decimal("2"), unit="piece")
    return r


@pytest.fixture
def meal_plan(db, user):
    return MealPlan.objects.create(user=user, week_start=MONDAY)


@pytest.mark.django_db
class TestShoppingListAggregation:
    def test_shopping_list_aggregates_quantities_from_entries(
        self, auth_client, meal_plan, recipe
    ):
        # Add 2 servings of a 4-serving recipe → 50% scale
        MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=0,
            meal_type="breakfast",
            servings=Decimal("2"),
        )
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        items = {item["ingredient_name"]: item for item in response.data}

        # 200g flour * (2/4) = 100g
        assert "Flour" in items
        assert Decimal(items["Flour"]["quantity"]) == Decimal("100.000")

        # 2 eggs * (2/4) = 1 egg
        assert "Eggs" in items
        assert Decimal(items["Eggs"]["quantity"]) == Decimal("1.000")

    def test_same_ingredient_quantities_are_summed_across_entries(
        self, auth_client, meal_plan, recipe
    ):
        # Add the same recipe twice (two different meal slots)
        MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=0,
            meal_type="breakfast",
            servings=Decimal("4"),
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=1,
            meal_type="breakfast",
            servings=Decimal("4"),
        )
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        items = {item["ingredient_name"]: item for item in response.data}

        # 200g * (4/4) + 200g * (4/4) = 400g
        assert Decimal(items["Flour"]["quantity"]) == Decimal("400.000")

    def test_checked_state_preserved_on_reaggregation(
        self, auth_client, meal_plan, recipe, flour
    ):
        MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=2,
            meal_type="lunch",
            servings=Decimal("4"),
        )
        # First aggregation
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        auth_client.get(url)

        # Mark flour as checked
        flour_item = ShoppingListItem.objects.get(
            user__username="shopper", ingredient=flour, week_start=MONDAY
        )
        flour_item.checked = True
        flour_item.save()

        # Re-aggregate (same meal plan — no changes)
        response = auth_client.get(url)
        items = {item["ingredient_name"]: item for item in response.data}

        assert items["Flour"]["checked"] is True

    def test_empty_meal_plan_returns_empty_list(self, auth_client, meal_plan):
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_unauthenticated_returns_401(self, api_client):
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestShoppingListCheck:
    def test_check_toggles_item_checked_state(self, auth_client, user, flour):
        item = ShoppingListItem.objects.create(
            user=user,
            ingredient=flour,
            quantity=Decimal("100"),
            unit="g",
            checked=False,
            week_start=MONDAY,
        )
        url = reverse("shopping-list-check", kwargs={"week_start": str(MONDAY), "pk": item.pk})
        response = auth_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["checked"] is True

        # Toggle again
        response = auth_client.post(url)
        assert response.data["checked"] is False

    def test_cannot_check_another_users_item(self, api_client, db, user, flour):
        other_user = User.objects.create_user(
            username="other", email="other3@example.com", password="Pass123!"
        )
        item = ShoppingListItem.objects.create(
            user=other_user,
            ingredient=flour,
            quantity=Decimal("50"),
            unit="g",
            checked=False,
            week_start=MONDAY,
        )
        api_client.force_authenticate(user=user)
        url = reverse("shopping-list-check", kwargs={"week_start": str(MONDAY), "pk": item.pk})
        response = api_client.post(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestShoppingListDelete:
    def test_delete_clears_all_items_for_week(self, auth_client, user, flour, eggs):
        ShoppingListItem.objects.create(
            user=user, ingredient=flour, quantity=200, unit="g", week_start=MONDAY
        )
        ShoppingListItem.objects.create(
            user=user, ingredient=eggs, quantity=4, unit="piece", week_start=MONDAY
        )
        url = reverse("shopping-list", kwargs={"week_start": str(MONDAY)})
        response = auth_client.delete(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["deleted"] == 2
        assert ShoppingListItem.objects.filter(user=user, week_start=MONDAY).count() == 0
