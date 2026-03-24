"""
Claude AI integration for recipe generation.

Wraps the Anthropic Python SDK and exposes a single public function,
``generate_recipe``, that calls claude-haiku-4-5-20251001 with a structured
system prompt and returns a validated Python dict.
"""

import json
import logging

import anthropic
from django.conf import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a professional chef. When given a recipe request, respond ONLY with valid
JSON in this exact structure — no preamble, no markdown, no explanation:

{
  "title": "string",
  "description": "string",
  "servings": 4,
  "prep_time_minutes": 10,
  "cook_time_minutes": 20,
  "instructions": "Step 1: ...\\nStep 2: ...",
  "ingredients": [
    { "name": "string", "quantity": 1.5, "unit": "cup", "notes": "optional" }
  ],
  "tags": ["string"]
}"""

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 2048


class ClaudeParseError(Exception):
    """Raised when Claude returns a response that cannot be parsed as JSON."""


class ClaudeUnavailableError(Exception):
    """Raised when the Anthropic API is unreachable or returns an API error."""


def generate_recipe(prompt: str) -> dict:
    """
    Send ``prompt`` to Claude and return the generated recipe as a dict.

    Raises:
        ClaudeUnavailableError: If the Anthropic API is unavailable or returns
            an API-level error.
        ClaudeParseError: If Claude's response cannot be parsed as valid JSON.
    """
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise ClaudeUnavailableError("ANTHROPIC_API_KEY is not configured.")

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIConnectionError as exc:
        logger.error("Anthropic API connection error: %s", exc)
        raise ClaudeUnavailableError(
            "Could not connect to the Anthropic API."
        ) from exc
    except anthropic.APIStatusError as exc:
        logger.error("Anthropic API status error %s: %s", exc.status_code, exc.message)
        raise ClaudeUnavailableError(
            f"Anthropic API returned an error: {exc.status_code}"
        ) from exc
    except anthropic.APIError as exc:
        logger.error("Anthropic API error: %s", exc)
        raise ClaudeUnavailableError("Anthropic API error occurred.") from exc

    raw_text = message.content[0].text.strip()

    try:
        recipe_data = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse Claude response as JSON: %s", raw_text[:500])
        raise ClaudeParseError(
            "Claude returned a response that could not be parsed as JSON."
        ) from exc

    return recipe_data
