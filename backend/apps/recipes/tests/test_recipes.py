import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.ingredients.models import Ingredient
from apps.recipes.models import Recipe, RecipeIngredient, Tag

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="chef",
        email="chef@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="otherchef",
        email="other@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def ingredient(db):
    return Ingredient.objects.create(
        name="Flour", category="carb", default_unit="g"
    )


@pytest.fixture
def recipe_payload(ingredient):
    return {
        "title": "Simple Pancakes",
        "description": "Fluffy pancakes",
        "servings": 4,
        "prep_time_minutes": 10,
        "cook_time_minutes": 15,
        "instructions": "Step 1: Mix.\nStep 2: Cook.",
        "ingredients": [
            {"name": "Flour", "quantity": "200.000", "unit": "g", "notes": "sifted"},
        ],
        "tags": ["breakfast", "quick"],
    }


@pytest.fixture
def recipe(db, user):
    r = Recipe.objects.create(
        user=user,
        title="Existing Recipe",
        description="Test",
        servings=2,
        prep_time_minutes=5,
        cook_time_minutes=10,
        instructions="Step 1: Do stuff.",
    )
    return r


@pytest.mark.django_db
class TestRecipeCreate:
    def test_user_can_create_recipe_with_nested_ingredients(
        self, auth_client, recipe_payload
    ):
        url = reverse("recipe-list")
        response = auth_client.post(url, recipe_payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Simple Pancakes"
        assert len(response.data["recipe_ingredients"]) == 1
        assert response.data["recipe_ingredients"][0]["ingredient_name"] == "Flour"
        assert len(response.data["tag_details"]) == 2

        db_recipe = Recipe.objects.get(pk=response.data["id"])
        assert db_recipe.recipe_ingredients.count() == 1
        assert db_recipe.tags.count() == 2

    def test_ingredient_created_if_not_exists(self, auth_client):
        url = reverse("recipe-list")
        payload = {
            "title": "Mystery Dish",
            "description": "",
            "servings": 1,
            "prep_time_minutes": 0,
            "cook_time_minutes": 0,
            "instructions": "Cook it.",
            "ingredients": [
                {"name": "Rare Herb", "quantity": "1.000", "unit": "tsp"}
            ],
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert Ingredient.objects.filter(name__iexact="Rare Herb").exists()

    def test_ingredient_matched_case_insensitively(self, auth_client, ingredient):
        url = reverse("recipe-list")
        payload = {
            "title": "Cake",
            "description": "",
            "servings": 8,
            "prep_time_minutes": 20,
            "cook_time_minutes": 40,
            "instructions": "Bake it.",
            "ingredients": [
                {"name": "flour", "quantity": "300.000", "unit": "g"}
            ],
        }
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        # The existing "Flour" ingredient should be reused, not a new one created
        assert Ingredient.objects.filter(name__iexact="flour").count() == 1

    def test_unauthenticated_cannot_create_recipe(self, api_client, recipe_payload):
        url = reverse("recipe-list")
        response = api_client.post(url, recipe_payload, format="json")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestRecipeList:
    def test_user_can_list_their_recipes(self, auth_client, recipe):
        url = reverse("recipe-list")
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data["results"]]
        assert recipe.id in ids

    def test_user_cannot_see_another_users_recipes(
        self, auth_client, other_user
    ):
        other_recipe = Recipe.objects.create(
            user=other_user,
            title="Private Recipe",
            description="",
            servings=2,
            prep_time_minutes=5,
            cook_time_minutes=5,
            instructions="Secret steps.",
        )
        url = reverse("recipe-list")
        response = auth_client.get(url)

        ids = [r["id"] for r in response.data["results"]]
        assert other_recipe.id not in ids


@pytest.mark.django_db
class TestRecipeDetail:
    def test_owner_can_retrieve_recipe(self, auth_client, recipe):
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == recipe.title

    def test_other_user_cannot_retrieve_recipe(self, api_client, other_user, recipe):
        api_client.force_authenticate(user=other_user)
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        response = api_client.get(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_owner_can_update_recipe(self, auth_client, recipe):
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        response = auth_client.patch(
            url, {"title": "Updated Title"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Updated Title"

    def test_owner_can_delete_recipe(self, auth_client, recipe):
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        response = auth_client.delete(url)

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Recipe.objects.filter(pk=recipe.pk).exists()

    def test_other_user_cannot_delete_recipe(self, api_client, other_user, recipe):
        api_client.force_authenticate(user=other_user)
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        response = api_client.delete(url)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert Recipe.objects.filter(pk=recipe.pk).exists()


@pytest.mark.django_db
class TestRecipeUpdate:
    def test_updating_ingredients_replaces_existing(self, auth_client, recipe, ingredient):
        # Add an initial ingredient
        RecipeIngredient.objects.create(
            recipe=recipe, ingredient=ingredient, quantity=100, unit="g"
        )
        url = reverse("recipe-detail", kwargs={"pk": recipe.pk})
        new_ingredient_name = "Butter"
        response = auth_client.put(
            url,
            {
                "title": recipe.title,
                "description": recipe.description,
                "servings": recipe.servings,
                "prep_time_minutes": recipe.prep_time_minutes,
                "cook_time_minutes": recipe.cook_time_minutes,
                "instructions": recipe.instructions,
                "ingredients": [
                    {"name": new_ingredient_name, "quantity": "50.000", "unit": "g"}
                ],
            },
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        names = [ri["ingredient_name"] for ri in response.data["recipe_ingredients"]]
        assert new_ingredient_name in names
        assert ingredient.name not in names
