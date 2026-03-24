"""
Tests for MealPlanStatsView — per-day macro totals, weekly averages, and user goals.
"""

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

User = get_user_model()

MONDAY = date(2025, 1, 6)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def meal_plan(db, user):
    return MealPlan.objects.create(user=user, week_start=MONDAY)


def _create_ingredient_with_macros(name, category="protein", unit="g", **macros):
    """Helper to create an ingredient with full nutritional data."""
    return Ingredient.objects.create(
        name=name,
        category=category,
        default_unit=unit,
        calories_per_100g=macros.get("cal", 165),
        protein_g=macros.get("protein", Decimal("31.0")),
        carbs_g=macros.get("carbs", Decimal("0.0")),
        fat_g=macros.get("fat", Decimal("3.6")),
    )


def _create_recipe_with_ingredients(user, title, servings, ingredients):
    """
    Create a recipe with linked ingredients.

    `ingredients` is a list of (Ingredient, quantity, unit) tuples.
    """
    recipe = Recipe.objects.create(
        user=user,
        title=title,
        servings=servings,
        prep_time_minutes=10,
        cook_time_minutes=20,
        instructions="Step 1: Cook.",
    )
    for ing, qty, unit in ingredients:
        RecipeIngredient.objects.create(
            recipe=recipe,
            ingredient=ing,
            quantity=qty,
            unit=unit,
        )
    return recipe


@pytest.mark.django_db
class TestMealPlanStatsEmpty:
    def test_stats_for_nonexistent_plan_returns_empty(self, auth_client):
        """If no plan exists for the week, return empty days/averages."""
        url = reverse("meal-plan-stats", kwargs={"week_start": "2025-02-03"})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["days"] == []
        assert resp.data["weekly_avg"] == {}
        assert resp.data["goals"] == {}

    def test_stats_for_plan_with_no_entries(self, auth_client, meal_plan):
        """A plan with zero entries should have 7 days, all zeroed out."""
        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        assert len(resp.data["days"]) == 7
        for day in resp.data["days"]:
            assert day["has_data"] is False
            assert day["calories"] == 0
            assert day["protein_g"] == 0
            assert day["carbs_g"] == 0
            assert day["fat_g"] == 0
        assert resp.data["weekly_avg"]["days_with_data"] == 0

    def test_unauthenticated_returns_401(self, api_client):
        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = api_client.get(url)
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMealPlanStatsWithMacros:
    def test_single_entry_gram_unit(self, auth_client, user, meal_plan):
        """
        One entry on day 0: 200g of chicken breast (165 cal/100g, 31g protein,
        0g carbs, 3.6g fat per 100g), recipe serves 4, entry = 4 servings (scale=1).

        Expected per 200g: calories=330, protein=62, carbs=0, fat=7.2
        """
        chicken = _create_ingredient_with_macros(
            "Chicken Breast", cal=165, protein=Decimal("31.0"),
            carbs=Decimal("0.0"), fat=Decimal("3.6"),
        )
        recipe = _create_recipe_with_ingredients(
            user, "Grilled Chicken", servings=4,
            ingredients=[(chicken, Decimal("200"), "g")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=recipe,
            day=0, meal_type="dinner", servings=Decimal("4.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        assert resp.status_code == status.HTTP_200_OK
        day0 = resp.data["days"][0]
        assert day0["has_data"] is True
        assert day0["calories"] == pytest.approx(330, abs=1)
        assert day0["protein_g"] == pytest.approx(62, abs=1)
        assert day0["fat_g"] == pytest.approx(7.2, abs=0.5)

    def test_serving_scale_applied(self, auth_client, user, meal_plan):
        """
        Recipe serves 4 but entry requests 2 servings -> scale = 0.5.
        200g chicken at scale 0.5 => 100g effective => 165 cal.
        """
        chicken = _create_ingredient_with_macros(
            "Chicken Thigh", cal=165, protein=Decimal("31.0"),
            carbs=Decimal("0.0"), fat=Decimal("3.6"),
        )
        recipe = _create_recipe_with_ingredients(
            user, "Half Chicken", servings=4,
            ingredients=[(chicken, Decimal("200"), "g")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=recipe,
            day=1, meal_type="lunch", servings=Decimal("2.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        day1 = resp.data["days"][1]
        assert day1["has_data"] is True
        assert day1["calories"] == pytest.approx(165, abs=1)

    def test_piece_unit_uses_piece_weights(self, auth_client, user, meal_plan):
        """
        2 eggs at 50g each = 100g.  At 155 cal/100g => 155 cal.
        """
        egg = _create_ingredient_with_macros(
            "Egg", category="protein", unit="piece",
            cal=155, protein=Decimal("12.6"), carbs=Decimal("1.1"), fat=Decimal("11.0"),
        )
        recipe = _create_recipe_with_ingredients(
            user, "Scrambled Eggs", servings=1,
            ingredients=[(egg, Decimal("2"), "piece")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=recipe,
            day=2, meal_type="breakfast", servings=Decimal("1.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        day2 = resp.data["days"][2]
        assert day2["has_data"] is True
        # 2 eggs * 50g/egg = 100g, 155 cal/100g * 100g/100 = 155 cal
        assert day2["calories"] == pytest.approx(155, abs=1)

    def test_unknown_unit_skipped(self, auth_client, user, meal_plan):
        """Ingredients with unsupported units are silently skipped."""
        weird = _create_ingredient_with_macros("Mystery Spice", cal=100, protein=Decimal("1.0"),
                                               carbs=Decimal("5.0"), fat=Decimal("0.5"))
        recipe = _create_recipe_with_ingredients(
            user, "Mystery Dish", servings=1,
            ingredients=[(weird, Decimal("1"), "pinch")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=recipe,
            day=3, meal_type="dinner", servings=Decimal("1.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        day3 = resp.data["days"][3]
        assert day3["has_data"] is False
        assert day3["calories"] == 0

    def test_ingredient_missing_macros_skipped(self, auth_client, user, meal_plan):
        """Ingredients with null macro fields are skipped."""
        no_macros = Ingredient.objects.create(
            name="Exotic Fruit", category="other", default_unit="g",
            calories_per_100g=None, protein_g=None, carbs_g=None, fat_g=None,
        )
        recipe = _create_recipe_with_ingredients(
            user, "Fruit Bowl", servings=1,
            ingredients=[(no_macros, Decimal("100"), "g")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=recipe,
            day=4, meal_type="snack", servings=Decimal("1.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        day4 = resp.data["days"][4]
        assert day4["has_data"] is False

    def test_multiple_entries_same_day_sum(self, auth_client, user, meal_plan):
        """Multiple entries on the same day should be summed."""
        chicken = _create_ingredient_with_macros(
            "Chicken Wing", cal=200, protein=Decimal("20.0"),
            carbs=Decimal("0.0"), fat=Decimal("13.0"),
        )
        rice = _create_ingredient_with_macros(
            "White Rice", category="carb", cal=130, protein=Decimal("2.7"),
            carbs=Decimal("28.0"), fat=Decimal("0.3"),
        )
        r1 = _create_recipe_with_ingredients(
            user, "Chicken Dinner", servings=1,
            ingredients=[(chicken, Decimal("100"), "g")],
        )
        r2 = _create_recipe_with_ingredients(
            user, "Rice Side", servings=1,
            ingredients=[(rice, Decimal("100"), "g")],
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=r1,
            day=5, meal_type="dinner", servings=Decimal("1.00"),
        )
        MealPlanEntry.objects.create(
            meal_plan=meal_plan, recipe=r2,
            day=5, meal_type="dinner", servings=Decimal("1.00"),
        )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        day5 = resp.data["days"][5]
        assert day5["has_data"] is True
        # 100g chicken (200cal) + 100g rice (130cal) = 330 cal
        assert day5["calories"] == pytest.approx(330, abs=1)
        assert day5["protein_g"] == pytest.approx(22.7, abs=0.5)


@pytest.mark.django_db
class TestMealPlanStatsWeeklyAvg:
    def test_weekly_average_across_days(self, auth_client, user, meal_plan):
        """Weekly avg divides only by days that have data."""
        chicken = _create_ingredient_with_macros(
            "Chicken Avg", cal=200, protein=Decimal("20.0"),
            carbs=Decimal("0.0"), fat=Decimal("10.0"),
        )
        recipe = _create_recipe_with_ingredients(
            user, "Chicken Simple", servings=1,
            ingredients=[(chicken, Decimal("100"), "g")],
        )
        # Add entries on days 0 and 1 only
        for day in (0, 1):
            MealPlanEntry.objects.create(
                meal_plan=meal_plan, recipe=recipe,
                day=day, meal_type="lunch", servings=Decimal("1.00"),
            )

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        avg = resp.data["weekly_avg"]
        assert avg["days_with_data"] == 2
        # Each day = 200 cal from 100g chicken; avg = 200
        assert avg["calories"] == pytest.approx(200, abs=1)
        assert avg["protein_g"] == pytest.approx(20, abs=0.5)


@pytest.mark.django_db
class TestMealPlanStatsGoals:
    def test_goals_included_from_user_profile(self, auth_client, user, meal_plan):
        """When user has macro goals set, they appear in the response."""
        user.daily_calorie_goal = 2200
        user.daily_protein_g = Decimal("165.0")
        user.daily_carbs_g = Decimal("220.0")
        user.daily_fat_g = Decimal("73.0")
        user.save()

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        goals = resp.data["goals"]
        assert goals["calories"] == 2200
        assert goals["protein_g"] == pytest.approx(165.0)
        assert goals["carbs_g"] == pytest.approx(220.0)
        assert goals["fat_g"] == pytest.approx(73.0)

    def test_goals_empty_when_not_set(self, auth_client, user, meal_plan):
        """Users without goals get an empty goals dict."""
        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        assert resp.data["goals"] == {}

    def test_partial_goals(self, auth_client, user, meal_plan):
        """Only set goals appear in the response."""
        user.daily_calorie_goal = 1800
        user.save()

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = auth_client.get(url)

        goals = resp.data["goals"]
        assert goals["calories"] == 1800
        assert "protein_g" not in goals
        assert "carbs_g" not in goals
        assert "fat_g" not in goals

    def test_other_user_cannot_see_stats(self, api_client, db, meal_plan):
        """A different authenticated user cannot see another user's stats."""
        other = User.objects.create_user(
            username="other", email="other@example.com", password="Pass123!",
        )
        api_client.force_authenticate(user=other)

        url = reverse("meal-plan-stats", kwargs={"week_start": str(MONDAY)})
        resp = api_client.get(url)

        # The other user has no plan for this week — should get empty response
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data["days"] == []
