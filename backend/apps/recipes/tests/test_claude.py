import json
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.recipes.claude_service import ClaudeParseError, ClaudeUnavailableError
from apps.recipes.models import Recipe, RecipeIngredient

User = get_user_model()

VALID_RECIPE_JSON = {
    "title": "Lemon Herb Chicken",
    "description": "A bright, flavourful chicken dish.",
    "servings": 4,
    "prep_time_minutes": 15,
    "cook_time_minutes": 25,
    "instructions": "Step 1: Marinate chicken.\nStep 2: Grill until cooked.",
    "ingredients": [
        {"name": "Chicken Breast", "quantity": 500, "unit": "g", "notes": "boneless"},
        {"name": "Lemon", "quantity": 2, "unit": "piece", "notes": ""},
    ],
    "tags": ["healthy", "quick"],
}


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="claude_tester",
        email="claude@example.com",
        password="StrongPass123!",
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


def _make_claude_response(text: str) -> MagicMock:
    """Build a mock Anthropic messages response."""
    mock_message = MagicMock()
    mock_content_block = MagicMock()
    mock_content_block.text = text
    mock_message.content = [mock_content_block]
    return mock_message


@pytest.mark.django_db
class TestRecipeGenerateEndpoint:
    def test_generate_returns_recipe_json_without_saving(self, auth_client):
        with patch(
            "apps.recipes.views.generate_recipe",
            return_value=VALID_RECIPE_JSON,
        ) as mock_generate:
            url = reverse("recipe-generate")
            response = auth_client.post(
                url, {"prompt": "lemon herb chicken"}, format="json"
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "Lemon Herb Chicken"
        mock_generate.assert_called_once_with("lemon herb chicken")
        # Nothing should have been persisted
        assert Recipe.objects.count() == 0

    def test_generate_without_prompt_returns_400(self, auth_client):
        url = reverse("recipe-generate")
        response = auth_client.post(url, {}, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_generate_returns_422_when_claude_parse_error(self, auth_client):
        with patch(
            "apps.recipes.views.generate_recipe",
            side_effect=ClaudeParseError("Bad JSON from Claude."),
        ):
            url = reverse("recipe-generate")
            response = auth_client.post(
                url, {"prompt": "broken recipe"}, format="json"
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_generate_returns_503_when_claude_unavailable(self, auth_client):
        with patch(
            "apps.recipes.views.generate_recipe",
            side_effect=ClaudeUnavailableError("API is down."),
        ):
            url = reverse("recipe-generate")
            response = auth_client.post(
                url, {"prompt": "chicken soup"}, format="json"
            )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_unauthenticated_cannot_generate(self, api_client):
        url = reverse("recipe-generate")
        response = api_client.post(url, {"prompt": "pasta"}, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestRecipeSaveGeneratedEndpoint:
    def test_save_generated_creates_recipe_and_ingredients(self, auth_client):
        url = reverse("recipe-save-generated")
        payload = {**VALID_RECIPE_JSON, "claude_prompt": "lemon herb chicken"}
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Lemon Herb Chicken"
        assert response.data["source"] == "claude"

        recipe = Recipe.objects.get(pk=response.data["id"])
        assert recipe.recipe_ingredients.count() == 2
        assert RecipeIngredient.objects.filter(
            recipe=recipe, ingredient__name__iexact="Chicken Breast"
        ).exists()
        assert RecipeIngredient.objects.filter(
            recipe=recipe, ingredient__name__iexact="Lemon"
        ).exists()
        assert recipe.tags.count() == 2

    def test_save_generated_with_invalid_payload_returns_400(self, auth_client):
        url = reverse("recipe-save-generated")
        payload = {"title": "Incomplete"}  # Missing required fields
        response = auth_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_cannot_save_generated(self, api_client):
        url = reverse("recipe-save-generated")
        response = api_client.post(url, VALID_RECIPE_JSON, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestClaudeServiceUnit:
    def test_generate_recipe_parses_valid_json(self):
        from apps.recipes.claude_service import generate_recipe

        mock_response = _make_claude_response(json.dumps(VALID_RECIPE_JSON))

        with patch("apps.recipes.claude_service.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = mock_response
            result = generate_recipe("lemon herb chicken")

        assert result["title"] == "Lemon Herb Chicken"
        assert len(result["ingredients"]) == 2

    def test_generate_recipe_raises_parse_error_on_bad_json(self):
        from apps.recipes.claude_service import generate_recipe

        mock_response = _make_claude_response("This is not JSON at all.")

        with patch("apps.recipes.claude_service.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.return_value = mock_response
            with pytest.raises(ClaudeParseError):
                generate_recipe("anything")

    def test_generate_recipe_raises_unavailable_on_connection_error(self):
        import anthropic as anthropic_lib

        from apps.recipes.claude_service import generate_recipe

        with patch("apps.recipes.claude_service.anthropic.Anthropic") as MockClient:
            MockClient.return_value.messages.create.side_effect = (
                anthropic_lib.APIConnectionError(request=MagicMock())
            )
            with pytest.raises(ClaudeUnavailableError):
                generate_recipe("anything")
