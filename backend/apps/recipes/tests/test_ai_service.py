"""
Tests for apps.recipes.ai_service — the AI provider abstraction layer.

All external API calls (Anthropic SDK, requests.post) are mocked so that
no network access or API keys are needed.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
import requests

from apps.recipes.ai_service import (
    AIParseError,
    AIUnavailableError,
    _call_openai_compat,
    _clean_json_text,
    _normalize_provider,
    _parse_json,
    _try_loads,
    fill_ingredient_macros,
    generate_recipe,
    remix_recipe,
    suggest_meal_plan,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_RECIPE = {
    "title": "Spaghetti Carbonara",
    "description": "Classic Roman pasta.",
    "servings": 4,
    "prep_time_minutes": 10,
    "cook_time_minutes": 15,
    "instructions": "Step 1: Cook pasta.\nStep 2: Mix eggs and cheese.",
    "ingredients": [
        {"name": "Spaghetti", "quantity": 400, "unit": "g", "notes": ""},
        {"name": "Egg", "quantity": 4, "unit": "piece", "notes": "large"},
    ],
    "tags": ["italian", "quick"],
}

VALID_MACROS = {
    "ingredients": [
        {"name": "chicken breast", "calories_per_100g": 165, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.6},
    ]
}

VALID_SUGGESTIONS = {
    "suggestions": [
        {"week": 0, "day": 0, "meal_type": "breakfast", "recipe_id": 1, "storage": "fresh"},
    ]
}


def _mock_anthropic_message(text: str) -> MagicMock:
    """Build a mock Anthropic messages.create() return value."""
    block = MagicMock()
    block.text = text
    msg = MagicMock()
    msg.content = [block]
    return msg


def _mock_openai_response(content: str, status_code: int = 200) -> MagicMock:
    """Build a mock requests.Response for an OpenAI-compatible endpoint."""
    resp = MagicMock(spec=requests.Response)
    resp.status_code = status_code
    resp.json.return_value = {
        "choices": [{"message": {"content": content}}],
    }
    resp.raise_for_status.return_value = None
    return resp


# ===================================================================
# _clean_json_text
# ===================================================================

class TestCleanJsonText:
    def test_removes_trailing_comma_before_brace(self):
        assert _clean_json_text('{"a": 1,}') == '{"a": 1}'

    def test_removes_trailing_comma_before_bracket(self):
        assert _clean_json_text('[1, 2, 3,]') == '[1, 2, 3]'

    def test_removes_trailing_comma_with_whitespace(self):
        """Regex ,\\s*([}\\]]) replaces comma + any whitespace + brace with just the brace."""
        result = _clean_json_text('{"a": 1 ,  }')
        # The regex matches `,  }` and replaces with `}`, so `{"a": 1 }`
        assert json.loads(result) == {"a": 1}

    def test_leaves_valid_json_unchanged(self):
        text = '{"a": 1, "b": [2, 3]}'
        assert _clean_json_text(text) == text

    def test_handles_nested_trailing_commas(self):
        text = '{"a": [1, 2,], "b": {"c": 3,},}'
        result = _clean_json_text(text)
        parsed = json.loads(result)
        assert parsed == {"a": [1, 2], "b": {"c": 3}}


# ===================================================================
# _try_loads
# ===================================================================

class TestTryLoads:
    def test_parses_valid_json(self):
        assert _try_loads('{"x": 1}') == {"x": 1}

    def test_parses_json_with_trailing_comma(self):
        result = _try_loads('{"x": 1,}')
        assert result == {"x": 1}

    def test_returns_none_on_total_garbage(self):
        assert _try_loads("not json at all") is None

    def test_parses_array(self):
        assert _try_loads("[1, 2, 3]") == [1, 2, 3]

    def test_returns_none_on_empty_string(self):
        assert _try_loads("") is None


# ===================================================================
# _parse_json
# ===================================================================

class TestParseJson:
    def test_direct_parse(self):
        assert _parse_json(json.dumps(VALID_RECIPE)) == VALID_RECIPE

    def test_strips_markdown_json_fence(self):
        raw = f"```json\n{json.dumps(VALID_RECIPE)}\n```"
        assert _parse_json(raw) == VALID_RECIPE

    def test_strips_plain_markdown_fence(self):
        raw = f"```\n{json.dumps(VALID_RECIPE)}\n```"
        assert _parse_json(raw) == VALID_RECIPE

    def test_handles_preamble_and_postamble(self):
        raw = f"Here is the recipe:\n{json.dumps(VALID_RECIPE)}\nHope you like it!"
        assert _parse_json(raw) == VALID_RECIPE

    def test_handles_json_in_fence_with_preamble_inside(self):
        inner = f"Sure, here you go:\n{json.dumps(VALID_RECIPE)}"
        raw = f"```json\n{inner}\n```"
        assert _parse_json(raw) == VALID_RECIPE

    def test_handles_trailing_comma_in_fenced_json(self):
        body = '{"title": "Test", "servings": 4,}'
        raw = f"```json\n{body}\n```"
        result = _parse_json(raw)
        assert result["title"] == "Test"

    def test_raises_ai_parse_error_on_unparseable(self):
        with pytest.raises(AIParseError, match="could not be parsed"):
            _parse_json("No JSON anywhere in this text whatsoever.")

    def test_handles_whitespace_around_json(self):
        raw = f"   \n  {json.dumps(VALID_RECIPE)}  \n  "
        assert _parse_json(raw) == VALID_RECIPE


# ===================================================================
# _normalize_provider
# ===================================================================

class TestNormalizeProvider:
    def test_browser_maps_to_claude(self):
        assert _normalize_provider("browser") == "claude"

    def test_claude_unchanged(self):
        assert _normalize_provider("claude") == "claude"

    def test_ollama_unchanged(self):
        assert _normalize_provider("ollama") == "ollama"

    def test_openai_compatible_unchanged(self):
        assert _normalize_provider("openai_compatible") == "openai_compatible"

    def test_unknown_provider_passes_through(self):
        assert _normalize_provider("mystery") == "mystery"


# ===================================================================
# generate_recipe — routing and error cases
# ===================================================================

class TestGenerateRecipe:
    @patch("apps.recipes.ai_service.generate_with_claude", return_value=VALID_RECIPE)
    def test_claude_provider_dispatches_to_claude(self, mock_claude):
        result = generate_recipe("make pasta", provider="claude")
        mock_claude.assert_called_once_with("make pasta", api_key="")
        assert result["title"] == "Spaghetti Carbonara"

    @patch("apps.recipes.ai_service.generate_with_claude", return_value=VALID_RECIPE)
    def test_browser_provider_dispatches_to_claude(self, mock_claude):
        result = generate_recipe("make pasta", provider="browser")
        mock_claude.assert_called_once_with("make pasta", api_key="")
        assert result["title"] == "Spaghetti Carbonara"

    @patch("apps.recipes.ai_service.generate_with_openai_compatible", return_value=VALID_RECIPE)
    def test_ollama_provider_dispatches_correctly(self, mock_compat):
        result = generate_recipe(
            "make pasta", provider="ollama",
            ollama_url="http://localhost:11434", model="llama3",
        )
        mock_compat.assert_called_once_with(
            "make pasta",
            base_url="http://localhost:11434",
            model="llama3",
            api_key="ollama",
            force_json=True,
            timeout=120,
        )
        assert result == VALID_RECIPE

    @patch("apps.recipes.ai_service.generate_with_openai_compatible", return_value=VALID_RECIPE)
    def test_openai_compatible_provider_dispatches_correctly(self, mock_compat):
        result = generate_recipe(
            "make pasta", provider="openai_compatible",
            api_base="https://api.openai.com", model="gpt-4o", api_key="sk-test",
        )
        mock_compat.assert_called_once_with(
            "make pasta",
            base_url="https://api.openai.com",
            model="gpt-4o",
            api_key="sk-test",
        )
        assert result == VALID_RECIPE

    def test_ollama_missing_url_raises(self):
        with pytest.raises(AIUnavailableError, match="URL is required"):
            generate_recipe("pasta", provider="ollama", model="llama3")

    def test_ollama_missing_model_raises(self):
        with pytest.raises(AIUnavailableError, match="model name is required"):
            generate_recipe("pasta", provider="ollama", ollama_url="http://localhost:11434")

    def test_openai_compatible_missing_base_raises(self):
        with pytest.raises(AIUnavailableError, match="base URL is required"):
            generate_recipe("pasta", provider="openai_compatible", model="gpt-4o")

    def test_openai_compatible_missing_model_raises(self):
        with pytest.raises(AIUnavailableError, match="Model name is required"):
            generate_recipe("pasta", provider="openai_compatible", api_base="https://api.openai.com")

    def test_unknown_provider_raises(self):
        with pytest.raises(AIUnavailableError, match="Unknown provider"):
            generate_recipe("pasta", provider="skynet")


# ===================================================================
# _call_openai_compat
# ===================================================================

class TestCallOpenaiCompat:
    BASE = "http://localhost:11434"
    MODEL = "llama3"

    @patch("apps.recipes.ai_service.requests.post")
    def test_successful_call_returns_content(self, mock_post):
        mock_post.return_value = _mock_openai_response("hello")
        result = _call_openai_compat("sys", "user", self.BASE, self.MODEL)
        assert result == "hello"

    @patch("apps.recipes.ai_service.requests.post")
    def test_appends_v1_if_missing(self, mock_post):
        mock_post.return_value = _mock_openai_response("ok")
        _call_openai_compat("sys", "user", "http://example.com", self.MODEL)
        url_called = mock_post.call_args[0][0]
        assert url_called == "http://example.com/v1/chat/completions"

    @patch("apps.recipes.ai_service.requests.post")
    def test_does_not_double_v1(self, mock_post):
        mock_post.return_value = _mock_openai_response("ok")
        _call_openai_compat("sys", "user", "http://example.com/v1", self.MODEL)
        url_called = mock_post.call_args[0][0]
        assert url_called == "http://example.com/v1/chat/completions"

    @patch("apps.recipes.ai_service.requests.post")
    def test_strips_trailing_slash(self, mock_post):
        mock_post.return_value = _mock_openai_response("ok")
        _call_openai_compat("sys", "user", "http://example.com/", self.MODEL)
        url_called = mock_post.call_args[0][0]
        assert url_called == "http://example.com/v1/chat/completions"

    @patch("apps.recipes.ai_service.requests.post")
    def test_force_json_sends_response_format(self, mock_post):
        mock_post.return_value = _mock_openai_response('{"a":1}')
        _call_openai_compat("sys", "user", self.BASE, self.MODEL, force_json=True)
        payload = mock_post.call_args[1]["json"]
        assert payload["response_format"] == {"type": "json_object"}

    @patch("apps.recipes.ai_service.requests.post")
    def test_no_force_json_omits_response_format(self, mock_post):
        mock_post.return_value = _mock_openai_response("text")
        _call_openai_compat("sys", "user", self.BASE, self.MODEL, force_json=False)
        payload = mock_post.call_args[1]["json"]
        assert "response_format" not in payload

    @patch("apps.recipes.ai_service.requests.post")
    def test_retries_without_json_mode_on_null_content(self, mock_post):
        """When json_mode returns null content, retry without it."""
        null_resp = _mock_openai_response(None)
        null_resp.json.return_value = {"choices": [{"message": {"content": None}}]}
        ok_resp = _mock_openai_response('{"result": true}')
        mock_post.side_effect = [null_resp, ok_resp]

        result = _call_openai_compat("sys", "user", self.BASE, self.MODEL, force_json=True)
        assert result == '{"result": true}'
        assert mock_post.call_count == 2
        # First call has response_format, second does not
        first_payload = mock_post.call_args_list[0][1]["json"]
        second_payload = mock_post.call_args_list[1][1]["json"]
        assert "response_format" in first_payload
        assert "response_format" not in second_payload

    @patch("apps.recipes.ai_service.requests.post")
    def test_raises_on_empty_content_without_force_json(self, mock_post):
        """If content is empty and force_json is False, no retry — raise AIParseError."""
        empty_resp = _mock_openai_response("")
        empty_resp.json.return_value = {"choices": [{"message": {"content": ""}}]}
        mock_post.return_value = empty_resp

        with pytest.raises(AIParseError, match="empty response"):
            _call_openai_compat("sys", "user", self.BASE, self.MODEL, force_json=False)

    @patch("apps.recipes.ai_service.requests.post")
    def test_connection_error_raises_unavailable(self, mock_post):
        mock_post.side_effect = requests.exceptions.ConnectionError("refused")
        with pytest.raises(AIUnavailableError, match="Could not connect"):
            _call_openai_compat("sys", "user", self.BASE, self.MODEL)

    @patch("apps.recipes.ai_service.requests.post")
    def test_timeout_raises_unavailable(self, mock_post):
        mock_post.side_effect = requests.exceptions.Timeout("timed out")
        with pytest.raises(AIUnavailableError, match="too long"):
            _call_openai_compat("sys", "user", self.BASE, self.MODEL)

    @patch("apps.recipes.ai_service.requests.post")
    def test_http_error_raises_unavailable(self, mock_post):
        err_resp = MagicMock()
        err_resp.status_code = 500
        mock_post.side_effect = requests.exceptions.HTTPError(response=err_resp)
        with pytest.raises(AIUnavailableError, match="error.*500"):
            _call_openai_compat("sys", "user", self.BASE, self.MODEL)

    @patch("apps.recipes.ai_service.requests.post")
    def test_unexpected_response_format_raises_parse_error(self, mock_post):
        resp = MagicMock(spec=requests.Response)
        resp.status_code = 200
        resp.raise_for_status.return_value = None
        resp.json.return_value = {"unexpected": "structure"}
        mock_post.return_value = resp

        with pytest.raises(AIParseError, match="Unexpected response format"):
            _call_openai_compat("sys", "user", self.BASE, self.MODEL)


# ===================================================================
# fill_ingredient_macros
# ===================================================================

class TestFillIngredientMacros:
    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_claude_provider(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_MACROS))
        MockClient.return_value.messages.create.return_value = mock_msg

        result = fill_ingredient_macros(["chicken breast"], provider="claude")
        assert result == VALID_MACROS

    @patch("apps.recipes.ai_service.settings")
    def test_claude_missing_api_key_raises(self, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = ""
        with pytest.raises(AIUnavailableError, match="ANTHROPIC_API_KEY"):
            fill_ingredient_macros(["flour"], provider="claude")

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_MACROS))
    def test_ollama_provider(self, mock_call):
        result = fill_ingredient_macros(
            ["chicken breast"], provider="ollama",
            ollama_url="http://localhost:11434", model="llama3",
        )
        assert result == VALID_MACROS
        mock_call.assert_called_once()
        _, kwargs = mock_call.call_args
        assert kwargs["api_key"] == "ollama"
        assert kwargs["timeout"] == 120

    def test_ollama_missing_url_raises(self):
        with pytest.raises(AIUnavailableError, match="Ollama URL and model"):
            fill_ingredient_macros(["flour"], provider="ollama", model="llama3")

    def test_ollama_missing_model_raises(self):
        with pytest.raises(AIUnavailableError, match="Ollama URL and model"):
            fill_ingredient_macros(["flour"], provider="ollama", ollama_url="http://localhost:11434")

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_MACROS))
    def test_openai_compatible_provider(self, mock_call):
        result = fill_ingredient_macros(
            ["chicken breast"], provider="openai_compatible",
            api_base="https://api.openai.com", model="gpt-4o", api_key="sk-test",
        )
        assert result == VALID_MACROS
        _, kwargs = mock_call.call_args
        assert kwargs["api_key"] == "sk-test"
        assert kwargs["timeout"] == 60

    def test_openai_compatible_missing_base_raises(self):
        with pytest.raises(AIUnavailableError, match="API base URL and model"):
            fill_ingredient_macros(["flour"], provider="openai_compatible", model="gpt-4o")

    def test_unknown_provider_raises(self):
        with pytest.raises(AIUnavailableError, match="Unknown provider"):
            fill_ingredient_macros(["flour"], provider="skynet")

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_browser_normalises_to_claude(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_MACROS))
        MockClient.return_value.messages.create.return_value = mock_msg

        result = fill_ingredient_macros(["chicken breast"], provider="browser")
        assert result == VALID_MACROS


# ===================================================================
# suggest_meal_plan
# ===================================================================

class TestSuggestMealPlan:
    RECIPES = [
        {"id": 1, "title": "Oatmeal", "tags": ["breakfast"], "macros": None},
        {
            "id": 2, "title": "Chicken Salad", "tags": ["lunch", "healthy"],
            "macros": {"complete": True, "calories": 450, "protein_g": 35, "carbs_g": 20, "fat_g": 15},
        },
    ]

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_claude_provider_builds_prompt_and_returns(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_SUGGESTIONS))
        MockClient.return_value.messages.create.return_value = mock_msg

        result = suggest_meal_plan(self.RECIPES, provider="claude")
        assert "suggestions" in result

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_SUGGESTIONS))
    def test_ollama_provider(self, mock_call):
        result = suggest_meal_plan(
            self.RECIPES, provider="ollama",
            ollama_url="http://localhost:11434", model="llama3",
        )
        assert "suggestions" in result

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_SUGGESTIONS))
    def test_openai_compatible_provider(self, mock_call):
        result = suggest_meal_plan(
            self.RECIPES, provider="openai_compatible",
            api_base="https://api.openai.com", model="gpt-4o",
        )
        assert "suggestions" in result

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_prompt_includes_cooking_days(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_SUGGESTIONS))
        MockClient.return_value.messages.create.return_value = mock_msg

        suggest_meal_plan(self.RECIPES, provider="claude", cooking_days=[0, 3])

        call_args = MockClient.return_value.messages.create.call_args
        user_prompt = call_args[1]["messages"][0]["content"]
        assert "Monday" in user_prompt
        assert "Thursday" in user_prompt

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_prompt_includes_macro_goals(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_SUGGESTIONS))
        MockClient.return_value.messages.create.return_value = mock_msg

        suggest_meal_plan(
            self.RECIPES, provider="claude",
            macro_goals={"calories": 2000, "protein_g": 150},
        )

        call_args = MockClient.return_value.messages.create.call_args
        user_prompt = call_args[1]["messages"][0]["content"]
        assert "2000 kcal" in user_prompt
        assert "150g protein" in user_prompt

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_multi_week_prompt_includes_week_range(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_SUGGESTIONS))
        MockClient.return_value.messages.create.return_value = mock_msg

        suggest_meal_plan(self.RECIPES, provider="claude", days=28)

        call_args = MockClient.return_value.messages.create.call_args
        user_prompt = call_args[1]["messages"][0]["content"]
        assert "4-week" in user_prompt
        assert "week 0" in user_prompt.lower()

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_prompt_includes_recipe_macros_when_available(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_SUGGESTIONS))
        MockClient.return_value.messages.create.return_value = mock_msg

        suggest_meal_plan(self.RECIPES, provider="claude")

        call_args = MockClient.return_value.messages.create.call_args
        user_prompt = call_args[1]["messages"][0]["content"]
        # Recipe 2 has macros — should appear in the prompt
        assert "450 kcal" in user_prompt
        assert "35g protein" in user_prompt

    def test_ollama_missing_params_raises(self):
        with pytest.raises(AIUnavailableError):
            suggest_meal_plan(self.RECIPES, provider="ollama")

    def test_unknown_provider_raises(self):
        with pytest.raises(AIUnavailableError, match="Unknown provider"):
            suggest_meal_plan(self.RECIPES, provider="skynet")

    @patch("apps.recipes.ai_service.settings")
    def test_claude_missing_api_key_raises(self, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = ""
        with pytest.raises(AIUnavailableError, match="ANTHROPIC_API_KEY"):
            suggest_meal_plan(self.RECIPES, provider="claude")


# ===================================================================
# remix_recipe
# ===================================================================

class TestRemixRecipe:
    RECIPE_TEXT = "Title: Spaghetti Carbonara\nIngredients: ..."
    INSTRUCTION = "Make it vegetarian"

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_claude_provider(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_RECIPE))
        MockClient.return_value.messages.create.return_value = mock_msg

        result = remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="claude")
        assert result["title"] == "Spaghetti Carbonara"

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_RECIPE))
    def test_ollama_provider(self, mock_call):
        result = remix_recipe(
            self.RECIPE_TEXT, self.INSTRUCTION,
            provider="ollama", ollama_url="http://localhost:11434", model="llama3",
        )
        assert result == VALID_RECIPE
        _, kwargs = mock_call.call_args
        assert kwargs["api_key"] == "ollama"
        assert kwargs["timeout"] == 120

    @patch("apps.recipes.ai_service._call_openai_compat", return_value=json.dumps(VALID_RECIPE))
    def test_openai_compatible_provider(self, mock_call):
        result = remix_recipe(
            self.RECIPE_TEXT, self.INSTRUCTION,
            provider="openai_compatible", api_base="https://api.openai.com",
            model="gpt-4o", api_key="sk-test",
        )
        assert result == VALID_RECIPE

    @patch("apps.recipes.ai_service.settings")
    def test_claude_missing_api_key_raises(self, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = ""
        with pytest.raises(AIUnavailableError, match="ANTHROPIC_API_KEY"):
            remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="claude")

    def test_ollama_missing_params_raises(self):
        with pytest.raises(AIUnavailableError, match="Ollama URL and model"):
            remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="ollama")

    def test_openai_compatible_missing_params_raises(self):
        with pytest.raises(AIUnavailableError, match="API base URL and model"):
            remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="openai_compatible")

    def test_unknown_provider_raises(self):
        with pytest.raises(AIUnavailableError, match="Unknown provider"):
            remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="skynet")

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_browser_normalises_to_claude(self, MockClient, mock_settings):
        mock_settings.ANTHROPIC_API_KEY = "test-key"
        mock_msg = _mock_anthropic_message(json.dumps(VALID_RECIPE))
        MockClient.return_value.messages.create.return_value = mock_msg

        result = remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="browser")
        assert result == VALID_RECIPE

    @patch("apps.recipes.ai_service.settings")
    @patch("anthropic.Anthropic")
    def test_claude_connection_error_raises_unavailable(self, MockClient, mock_settings):
        import anthropic as anthropic_lib

        mock_settings.ANTHROPIC_API_KEY = "test-key"
        MockClient.return_value.messages.create.side_effect = (
            anthropic_lib.APIConnectionError(request=MagicMock())
        )
        with pytest.raises(AIUnavailableError, match="Could not connect"):
            remix_recipe(self.RECIPE_TEXT, self.INSTRUCTION, provider="claude")
