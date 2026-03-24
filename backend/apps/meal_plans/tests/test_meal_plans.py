from datetime import date

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.meal_plans.models import MealPlan, MealPlanEntry
from apps.recipes.models import Recipe

User = get_user_model()

MONDAY = date(2025, 1, 6)   # A known Monday
TUESDAY = date(2025, 1, 7)  # Not a Monday


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="planner",
        email="planner@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def recipe(db, user):
    return Recipe.objects.create(
        user=user,
        title="Oatmeal",
        description="A healthy breakfast.",
        servings=2,
        prep_time_minutes=5,
        cook_time_minutes=10,
        instructions="Step 1: Cook oats.",
    )


@pytest.fixture
def meal_plan(db, user):
    return MealPlan.objects.create(user=user, week_start=MONDAY)


@pytest.mark.django_db
class TestMealPlanDetail:
    def test_get_creates_plan_if_not_exists(self, auth_client):
        url = reverse("meal-plan-detail", kwargs={"week_start": str(MONDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert MealPlan.objects.filter(week_start=MONDAY).exists()

    def test_get_returns_existing_plan(self, auth_client, meal_plan):
        url = reverse("meal-plan-detail", kwargs={"week_start": str(MONDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["week_start"] == str(MONDAY)

    def test_week_start_must_be_a_monday(self, auth_client):
        url = reverse("meal-plan-detail", kwargs={"week_start": str(TUESDAY)})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Monday" in response.data["detail"]

    def test_invalid_date_format_returns_400(self, auth_client):
        url = reverse("meal-plan-detail", kwargs={"week_start": "not-a-date"})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_returns_401(self, api_client):
        url = reverse("meal-plan-detail", kwargs={"week_start": str(MONDAY)})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMealPlanEntries:
    def test_add_entry_to_meal_plan(self, auth_client, meal_plan, recipe):
        url = reverse(
            "meal-plan-entry-list", kwargs={"week_start": str(MONDAY)}
        )
        payload = {
            "recipe": recipe.pk,
            "day": 0,
            "meal_type": "breakfast",
            "servings": "2.00",
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert MealPlanEntry.objects.filter(meal_plan=meal_plan, recipe=recipe).exists()

    def test_add_entry_to_nonexistent_plan_returns_404(self, auth_client, recipe):
        # No meal plan exists for this date yet, but we POST to entries which
        # requires the plan to exist first
        other_monday = date(2025, 3, 3)
        url = reverse(
            "meal-plan-entry-list", kwargs={"week_start": str(other_monday)}
        )
        payload = {
            "recipe": recipe.pk,
            "day": 1,
            "meal_type": "lunch",
            "servings": "1.00",
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_entry(self, auth_client, meal_plan, recipe):
        entry = MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=2,
            meal_type="dinner",
            servings=4,
        )
        url = reverse(
            "meal-plan-entry-delete",
            kwargs={"week_start": str(MONDAY), "pk": entry.pk},
        )
        response = auth_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not MealPlanEntry.objects.filter(pk=entry.pk).exists()

    def test_cannot_delete_another_users_entry(self, api_client, db, meal_plan, recipe):
        other_user = User.objects.create_user(
            username="intruder", email="intruder@example.com", password="Pass123!"
        )
        api_client.force_authenticate(user=other_user)

        entry = MealPlanEntry.objects.create(
            meal_plan=meal_plan,
            recipe=recipe,
            day=3,
            meal_type="snack",
            servings=1,
        )
        url = reverse(
            "meal-plan-entry-delete",
            kwargs={"week_start": str(MONDAY), "pk": entry.pk},
        )
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert MealPlanEntry.objects.filter(pk=entry.pk).exists()


@pytest.mark.django_db
class TestMealPlanList:
    def test_list_returns_only_users_plans(self, auth_client, meal_plan, db):
        other_user = User.objects.create_user(
            username="other", email="other2@example.com", password="Pass123!"
        )
        MealPlan.objects.create(user=other_user, week_start=date(2025, 2, 3))

        url = reverse("meal-plan-list")
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["week_start"] == str(MONDAY)
