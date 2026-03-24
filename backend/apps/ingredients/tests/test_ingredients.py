import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.ingredients.models import Ingredient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def sample_ingredient(db):
    return Ingredient.objects.create(
        name="Chicken Breast",
        category="protein",
        default_unit="g",
        calories_per_100g=165,
        protein_g=31,
        carbs_g=0,
        fat_g=3.6,
    )


@pytest.mark.django_db
class TestIngredientList:
    def test_authenticated_user_can_list_ingredients(self, auth_client, sample_ingredient):
        url = reverse("ingredient-list")
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        names = [item["name"] for item in response.data["results"]]
        assert "Chicken Breast" in names

    def test_unauthenticated_request_returns_401(self, api_client):
        url = reverse("ingredient-list")
        response = api_client.get(url)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_search_filter_returns_matching_ingredients(self, auth_client):
        Ingredient.objects.create(name="Garlic", category="spice", default_unit="piece")
        Ingredient.objects.create(name="Garlic Powder", category="spice", default_unit="tsp")
        Ingredient.objects.create(name="Onion", category="vegetable", default_unit="piece")

        url = reverse("ingredient-list")
        response = auth_client.get(url, {"search": "garlic"})

        assert response.status_code == status.HTTP_200_OK
        names = [item["name"] for item in response.data["results"]]
        assert "Garlic" in names
        assert "Garlic Powder" in names
        assert "Onion" not in names

    def test_search_is_case_insensitive(self, auth_client):
        Ingredient.objects.create(name="Olive Oil", category="other", default_unit="tbsp")

        url = reverse("ingredient-list")
        response = auth_client.get(url, {"search": "OLIVE"})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 1


@pytest.mark.django_db
class TestIngredientCreate:
    def test_authenticated_user_can_create_ingredient(self, auth_client):
        url = reverse("ingredient-list")
        payload = {
            "name": "Brown Rice",
            "category": "carb",
            "default_unit": "g",
            "calories_per_100g": "112.00",
            "protein_g": "2.60",
            "carbs_g": "23.50",
            "fat_g": "0.90",
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Brown Rice"
        assert response.data["category"] == "carb"
        assert Ingredient.objects.filter(name="Brown Rice").exists()

    def test_create_ingredient_without_nutrition_info(self, auth_client):
        url = reverse("ingredient-list")
        payload = {
            "name": "Mystery Spice",
            "category": "spice",
            "default_unit": "tsp",
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["calories_per_100g"] is None

    def test_create_duplicate_ingredient_returns_400(self, auth_client, sample_ingredient):
        url = reverse("ingredient-list")
        payload = {
            "name": "Chicken Breast",
            "category": "protein",
            "default_unit": "g",
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_create_ingredient(self, api_client):
        url = reverse("ingredient-list")
        payload = {"name": "Secret Ingredient", "category": "other", "default_unit": "g"}
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
