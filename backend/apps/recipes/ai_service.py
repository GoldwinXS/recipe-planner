"""
AI provider abstraction for recipe generation.

Supports:
  - Claude (Anthropic SDK)
  - Any OpenAI-compatible API: Ollama, OpenAI, Groq, Together AI, etc.

All providers raise the same two exception types so callers don't need to
know which provider is in use.
"""

import json
import logging
import re

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a professional chef. When given a recipe request, respond ONLY with valid
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
}

In the instructions, always include the exact quantity and unit when first \
using an ingredient (e.g. "Add 2 cups flour" not just "Add flour")."""


class AIParseError(Exception):
    """The AI returned a response that could not be parsed as valid JSON."""


class AIUnavailableError(Exception):
    """The AI provider could not be reached or returned an error."""


def _normalize_provider(provider: str) -> str:
    """Map client-side-only providers (e.g. 'browser') to a server-side fallback."""
    if provider == "browser":
        return "claude"
    return provider


def _clean_json_text(text: str) -> str:
    """Remove trailing commas before ] or } which some models emit."""
    return re.sub(r",\s*([}\]])", r"\1", text)


def _try_loads(text: str):
    """Try json.loads, then retry after stripping trailing commas."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    try:
        return json.loads(_clean_json_text(text))
    except json.JSONDecodeError:
        return None


def _parse_json(raw: str) -> dict:
    """Extract and parse a JSON object from AI output. Raises AIParseError on failure."""
    text = raw.strip()

    # 1. Direct parse
    result = _try_loads(text)
    if result is not None:
        return result

    # 2. Strip markdown fences (```json ... ``` or ``` ... ```) then retry
    if "```" in text:
        stripped = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
        result = _try_loads(stripped)
        if result is not None:
            return result
        # Also look for outermost {} inside the stripped text
        start, end = stripped.find("{"), stripped.rfind("}")
        if start != -1 and end > start:
            result = _try_loads(stripped[start:end + 1])
            if result is not None:
                return result

    # 3. Find outermost {...} block in original text (handles preamble/postamble)
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        result = _try_loads(text[start:end + 1])
        if result is not None:
            return result

    logger.error("Failed to parse AI response as JSON: %s", text[:500])
    raise AIParseError(
        "The AI returned a response that could not be parsed as JSON. "
        "Try rephrasing your prompt."
    )


# ── Claude ────────────────────────────────────────────────────────────────────

def generate_with_claude(prompt: str, api_key: str = "") -> dict:
    import anthropic

    api_key = api_key or settings.ANTHROPIC_API_KEY
    if not api_key:
        raise AIUnavailableError(
            "No Anthropic API key found. Add your key in AI Provider Settings."
        )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIConnectionError as exc:
        raise AIUnavailableError("Could not connect to the Anthropic API.") from exc
    except anthropic.APIStatusError as exc:
        raise AIUnavailableError(
            f"Anthropic API error ({exc.status_code}): {exc.message}"
        ) from exc
    except anthropic.APIError as exc:
        raise AIUnavailableError(f"Anthropic API error: {exc}") from exc

    return _parse_json(message.content[0].text)


# ── OpenAI-compatible (Ollama, OpenAI, Groq, Together, …) ────────────────────

def _call_openai_compat(
    system_prompt: str,
    user_prompt: str,
    base_url: str,
    model: str,
    api_key: str = "none",
    force_json: bool = False,
    timeout: int = 60,
) -> str:
    """POST to an OpenAI-compatible /v1/chat/completions endpoint and return the text content."""
    base_url = base_url.rstrip("/")
    if not base_url.endswith("/v1"):
        base_url = f"{base_url}/v1"

    def _do_request(use_json_mode: bool) -> str | None:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 4096,
            "temperature": 0.7,
        }
        if use_json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            resp = requests.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                timeout=timeout,
            )
            resp.raise_for_status()
        except requests.exceptions.ConnectionError as exc:
            raise AIUnavailableError(
                f"Could not connect to {base_url}. "
                "If using Ollama locally inside Docker, try host.docker.internal instead of localhost."
            ) from exc
        except requests.exceptions.Timeout as exc:
            raise AIUnavailableError(
                "The AI server took too long to respond. Try a smaller/faster model."
            ) from exc
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else "unknown"
            raise AIUnavailableError(
                f"AI server returned an error ({code}). Check your API key and model name."
            ) from exc

        try:
            return resp.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise AIParseError("Unexpected response format from AI provider.") from exc

    content = _do_request(use_json_mode=force_json)

    # Some models return null/empty content when JSON mode is requested but unsupported.
    # Retry once without json_mode — the explicit system prompt should still produce JSON.
    if not content and force_json:
        logger.warning("AI returned null/empty content with json_mode; retrying without it.")
        content = _do_request(use_json_mode=False)

    if not content:
        raise AIParseError(
            "The AI returned an empty response. "
            "Try using a different model or rephrasing your prompt."
        )

    return content


def generate_with_openai_compatible(
    prompt: str,
    base_url: str,
    model: str,
    api_key: str = "none",
    force_json: bool = False,
    timeout: int = 60,
) -> dict:
    content = _call_openai_compat(
        SYSTEM_PROMPT, prompt, base_url, model, api_key,
        force_json=force_json, timeout=timeout,
    )
    return _parse_json(content)


# ── Macros lookup ─────────────────────────────────────────────────────────────

MACROS_SYSTEM_PROMPT = """\
You are a nutritionist. Return ONLY valid JSON with estimated average \
nutritional data per 100g for every ingredient listed. Use common \
whole-food forms (e.g. raw chicken breast, all-purpose flour, whole milk).

{
  "ingredients": [
    {"name": "chicken breast", "calories_per_100g": 165, "protein_g": 31.0, "carbs_g": 0.0, "fat_g": 3.6},
    {"name": "all-purpose flour", "calories_per_100g": 364, "protein_g": 10.3, "carbs_g": 76.3, "fat_g": 1.0}
  ]
}"""


def fill_ingredient_macros(
    ingredient_names: list,
    provider: str = "claude",
    ollama_url: str = "",
    model: str = "",
    api_key: str = "",
    api_base: str = "",
) -> dict:
    """Return a dict with an 'ingredients' list containing macro data."""
    provider = _normalize_provider(provider)
    prompt = "Provide nutritional data per 100g for: " + ", ".join(ingredient_names)

    if provider == "claude":
        import anthropic
        api_key_val = settings.ANTHROPIC_API_KEY
        if not api_key_val:
            raise AIUnavailableError("ANTHROPIC_API_KEY is not configured on the server.")
        try:
            client = anthropic.Anthropic(api_key=api_key_val)
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=2048,
                system=MACROS_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIConnectionError as exc:
            raise AIUnavailableError("Could not connect to the Anthropic API.") from exc
        except anthropic.APIStatusError as exc:
            raise AIUnavailableError(
                f"Anthropic API error ({exc.status_code}): {exc.message}"
            ) from exc
        except anthropic.APIError as exc:
            raise AIUnavailableError(f"Anthropic API error: {exc}") from exc
        return _parse_json(message.content[0].text)

    if provider == "ollama":
        if not ollama_url or not model:
            raise AIUnavailableError("Ollama URL and model are required.")
        base_url, is_ollama = ollama_url, True
    elif provider == "openai_compatible":
        if not api_base or not model:
            raise AIUnavailableError("API base URL and model are required.")
        base_url, is_ollama = api_base, False
    else:
        raise AIUnavailableError(f"Unknown provider: {provider!r}")

    content = _call_openai_compat(
        MACROS_SYSTEM_PROMPT,
        prompt,
        base_url,
        model,
        api_key=api_key or ("ollama" if is_ollama else "none"),
        force_json=True,
        timeout=120 if is_ollama else 60,
    )
    return _parse_json(content)


# ── Router ────────────────────────────────────────────────────────────────────

def generate_recipe(
    prompt: str,
    provider: str = "claude",
    ollama_url: str = "",
    model: str = "",
    api_key: str = "",
    api_base: str = "",
) -> dict:
    """
    Route to the appropriate AI provider and return a recipe dict.

    provider options: "claude" | "ollama" | "openai_compatible"
    """
    provider = _normalize_provider(provider)
    if provider == "claude":
        return generate_with_claude(prompt, api_key=api_key)

    if provider == "ollama":
        if not ollama_url:
            raise AIUnavailableError("Ollama server URL is required.")
        if not model:
            raise AIUnavailableError("Ollama model name is required.")
        return generate_with_openai_compatible(
            prompt,
            base_url=ollama_url,
            model=model,
            api_key="ollama",
            force_json=True,
            timeout=120,
        )

    if provider == "openai_compatible":
        if not api_base:
            raise AIUnavailableError("API base URL is required.")
        if not model:
            raise AIUnavailableError("Model name is required.")
        return generate_with_openai_compatible(
            prompt,
            base_url=api_base,
            model=model,
            api_key=api_key or "none",
        )

    raise AIUnavailableError(f"Unknown provider: {provider!r}")


# ── Recipe remix ──────────────────────────────────────────────────────────────

REMIX_SYSTEM_PROMPT = """\
You are a professional chef. You will be given an existing recipe \
and an instruction for how to modify it.
Return ONLY valid JSON in the same structure as the original — no preamble, no markdown, no explanation:

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
}

Always include exact quantities and units in the instructions when first using an ingredient."""


def remix_recipe(
    recipe_text: str,
    instruction: str,
    provider: str = "claude",
    ollama_url: str = "",
    model: str = "",
    api_key: str = "",
    api_base: str = "",
) -> dict:
    """Return a modified recipe dict based on the instruction."""
    provider = _normalize_provider(provider)
    prompt = (
        f"Here is the existing recipe:\n\n{recipe_text}\n\n"
        f"Modification instruction: {instruction}\n\n"
        "Apply the modification and return the complete updated recipe as JSON."
    )

    if provider == "claude":
        import anthropic
        api_key_val = settings.ANTHROPIC_API_KEY
        if not api_key_val:
            raise AIUnavailableError("ANTHROPIC_API_KEY is not configured on the server.")
        try:
            client = anthropic.Anthropic(api_key=api_key_val)
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                system=REMIX_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIConnectionError as exc:
            raise AIUnavailableError("Could not connect to the Anthropic API.") from exc
        except anthropic.APIStatusError as exc:
            raise AIUnavailableError(f"Anthropic API error ({exc.status_code}): {exc.message}") from exc
        except anthropic.APIError as exc:
            raise AIUnavailableError(f"Anthropic API error: {exc}") from exc
        return _parse_json(message.content[0].text)

    if provider == "ollama":
        if not ollama_url or not model:
            raise AIUnavailableError("Ollama URL and model are required.")
        base_url, is_ollama = ollama_url, True
    elif provider == "openai_compatible":
        if not api_base or not model:
            raise AIUnavailableError("API base URL and model are required.")
        base_url, is_ollama = api_base, False
    else:
        raise AIUnavailableError(f"Unknown provider for remix: {provider!r}")

    content = _call_openai_compat(
        REMIX_SYSTEM_PROMPT,
        prompt,
        base_url,
        model,
        api_key=api_key or ("ollama" if is_ollama else "none"),
        force_json=True,
        timeout=120 if is_ollama else 60,
    )
    return _parse_json(content)


# ── Meal plan suggestion ───────────────────────────────────────────────────────

MEAL_PLAN_SYSTEM_PROMPT = """\
You are a nutritionist and meal planning expert. Given a list of \
recipes, suggest a practical, realistic meal plan that minimises food \
waste, respects safe storage windows, and flags meals that need to be frozen.

Return ONLY valid JSON in this exact structure — no preamble, no markdown, no explanation:

{
  "suggestions": [
    {"week": 0, "day": 0, "meal_type": "breakfast", "recipe_id": 1, "storage": "fresh"},
    {"week": 0, "day": 0, "meal_type": "lunch",     "recipe_id": 2, "storage": "fridge"},
    {"week": 0, "day": 0, "meal_type": "dinner",    "recipe_id": 3, "storage": "freeze"}
  ]
}

Field rules:
- week: 0 for a single-week plan; 0–3 for a 4-week (monthly) plan
- day: 0 (Monday) through 6 (Sunday) within each week
- meal_type: one of breakfast, lunch, dinner, snack
- recipe_id: an integer from the provided list — never invent IDs
- storage (REQUIRED): one of:
    "fresh"  — cooked and eaten the same day; no advance prep needed
    "fridge" — cooked ahead on a cooking day and stored in the fridge; eaten within 4 days
    "freeze" — too long to refrigerate safely; MUST be frozen and defrosted before eating
               Use "freeze" whenever a leftover will be eaten 5 or more days after its cooking day

Planning rules:
- Plan 1 breakfast + 1 lunch + 1 dinner per day
- Aim for variety: avoid the same recipe more than twice per week unless the cookbook is small
- If cooking_days are provided, schedule NEW meals on those days; other days use leftovers
- On non-cooking days, assign a leftover from the nearest previous cooking day as lunch/dinner
- If macro goals are provided, select recipes that together come close to daily targets
- Balance nutrition: mix high-protein, high-carb, and vegetable-rich meals

Food safety & storage rules (CRITICAL — every suggestion must respect these):
- Cooked chicken, fish, beef: fridge for 3–4 days max → freeze anything scheduled 5+ days later
- Soups, stews, curries: fridge for 4–5 days → freeze if 6+ days later
- Cooked eggs / egg dishes: fridge for 3–4 days
- Cooked grains (rice, pasta): fridge for 3–5 days → freeze if 6+ days later
- Salads with dressing: 1–2 days; undressed greens: 3–5 days; never freeze salads
- Mark the LEFTOVER INSTANCE as "freeze", not the original cooking-day entry
- Schedule fresh/perishable items (fish, salads) early in the week to avoid needing to freeze"""


def suggest_meal_plan(
    recipes: list,
    preferences: str = "",
    days: int = 7,
    cooking_days: list = None,
    macro_goals: dict = None,
    provider: str = "claude",
    ollama_url: str = "",
    model: str = "",
    api_key: str = "",
    api_base: str = "",
    ai_instructions: str = "",
) -> dict:
    """Return a dict with a 'suggestions' list for the weekly meal plan."""
    # Build recipe list with macro info where available
    recipe_lines = []
    for r in recipes:
        line = f"- ID {r['id']}: {r['title']}"
        if r.get('tags'):
            line += f" [tags: {', '.join(r['tags'])}]"
        macros = r.get('macros')
        if macros and macros.get('complete'):
            line += (
                f" [~{macros['calories']} kcal, "
                f"{macros['protein_g']}g protein, "
                f"{macros['carbs_g']}g carbs, "
                f"{macros['fat_g']}g fat per serving]"
            )
        recipe_lines.append(line)

    weeks = max(1, (days + 6) // 7)
    total_entries = weeks * 7 * 3  # 3 meals/day
    plan_desc = f"{days}-day ({weeks}-week)" if weeks > 1 else "7-day"
    prompt_parts = [
        f"Plan a {plan_desc} meal plan ({total_entries} total entries: 1 breakfast + 1 lunch + 1 dinner per day) "
        f"using ONLY these recipes and their exact integer IDs:\n"
    ]
    prompt_parts.append("\n".join(recipe_lines))
    if weeks > 1:
        prompt_parts.append(
            f"\nThis is a {weeks}-week plan. Use week 0–{weeks - 1} in every suggestion. "
            "Vary recipes across weeks, not just within each week."
        )

    if cooking_days is not None:
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        cook_names = [day_names[d] for d in sorted(cooking_days) if 0 <= d <= 6]
        prompt_parts.append(f"\nCooking/prep days each week (new meals cooked here): {', '.join(cook_names)}")
        prompt_parts.append("On non-cooking days, reuse recipes from that week's cooking days as leftovers.")
        prompt_parts.append("Set storage='freeze' for any leftover eaten 5+ days after its cooking day.")

    if macro_goals:
        goal_parts = []
        if macro_goals.get('calories'):
            goal_parts.append(f"{macro_goals['calories']} kcal")
        if macro_goals.get('protein_g'):
            goal_parts.append(f"{macro_goals['protein_g']}g protein")
        if macro_goals.get('carbs_g'):
            goal_parts.append(f"{macro_goals['carbs_g']}g carbs")
        if macro_goals.get('fat_g'):
            goal_parts.append(f"{macro_goals['fat_g']}g fat")
        if goal_parts:
            prompt_parts.append(f"\nDaily macro targets: {', '.join(goal_parts)}")
            prompt_parts.append("Select recipes that together come close to these daily targets.")

    if preferences:
        prompt_parts.append(f"\nAdditional preferences: {preferences}")

    if ai_instructions:
        prompt_parts.append(f"\nPersistent dietary instructions (always follow): {ai_instructions}")

    prompt = "\n".join(prompt_parts)
    provider = _normalize_provider(provider)

    if provider == "claude":
        import anthropic
        api_key_val = settings.ANTHROPIC_API_KEY
        if not api_key_val:
            raise AIUnavailableError("ANTHROPIC_API_KEY is not configured on the server.")
        try:
            client = anthropic.Anthropic(api_key=api_key_val)
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=4096,
                system=MEAL_PLAN_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.APIConnectionError as exc:
            raise AIUnavailableError("Could not connect to the Anthropic API.") from exc
        except anthropic.APIStatusError as exc:
            raise AIUnavailableError(
                f"Anthropic API error ({exc.status_code}): {exc.message}"
            ) from exc
        except anthropic.APIError as exc:
            raise AIUnavailableError(f"Anthropic API error: {exc}") from exc
        return _parse_json(message.content[0].text)

    if provider == "ollama":
        if not ollama_url or not model:
            raise AIUnavailableError("Ollama URL and model are required.")
        base_url, is_ollama = ollama_url, True
    elif provider == "openai_compatible":
        if not api_base or not model:
            raise AIUnavailableError("API base URL and model are required.")
        base_url, is_ollama = api_base, False
    else:
        raise AIUnavailableError(f"Unknown provider for meal plan: {provider!r}")

    content = _call_openai_compat(
        MEAL_PLAN_SYSTEM_PROMPT,
        prompt,
        base_url,
        model,
        api_key=api_key or ("ollama" if is_ollama else "none"),
        force_json=True,
        timeout=120 if is_ollama else 60,
    )
    return _parse_json(content)


# ── Meal prep guide ────────────────────────────────────────────────────────────

PREP_GUIDE_SYSTEM_PROMPT = """\
You are a professional meal prep coach. Given a weekly meal plan and \
cooking days, create a practical, encouraging meal prep guide.

Return ONLY valid JSON in this exact structure — no preamble, no markdown, no explanation:

{
  "prep_days": [
    {
      "day": 0,
      "day_name": "Monday",
      "intro": "string — 1-2 sentence overview of what to focus on",
      "tasks": [
        {
          "title": "string — short task name",
          "detail": "string — what meals this covers, how to store leftovers",
          "duration_min": 30,
          "tip": "string or null — optional chef tip for efficiency or flavour"
        }
      ],
      "total_duration_min": 90
    }
  ],
  "shopping_tip": "string — when to shop and any broad preparation tips"
}

Only include cooking days (days where new meals are cooked) in prep_days. Be specific and actionable."""


def generate_prep_guide(
    meal_plan_text: str,
    provider: str = "claude",
    ollama_url: str = "",
    model: str = "",
    api_key: str = "",
    api_base: str = "",
) -> dict:
    """Return a structured meal prep guide dict for the week."""
    provider = _normalize_provider(provider)
    if provider == "claude":
        import anthropic
        api_key_val = settings.ANTHROPIC_API_KEY
        if not api_key_val:
            raise AIUnavailableError("ANTHROPIC_API_KEY is not configured on the server.")
        try:
            client = anthropic.Anthropic(api_key=api_key_val)
            message = client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=3000,
                system=PREP_GUIDE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": meal_plan_text}],
            )
        except anthropic.APIConnectionError as exc:
            raise AIUnavailableError("Could not connect to the Anthropic API.") from exc
        except anthropic.APIStatusError as exc:
            raise AIUnavailableError(f"Anthropic API error ({exc.status_code}): {exc.message}") from exc
        except anthropic.APIError as exc:
            raise AIUnavailableError(f"Anthropic API error: {exc}") from exc
        return _parse_json(message.content[0].text)

    if provider == "ollama":
        if not ollama_url or not model:
            raise AIUnavailableError("Ollama URL and model are required.")
        base_url, is_ollama = ollama_url, True
    elif provider == "openai_compatible":
        if not api_base or not model:
            raise AIUnavailableError("API base URL and model are required.")
        base_url, is_ollama = api_base, False
    else:
        raise AIUnavailableError(f"Unknown provider for prep guide: {provider!r}")

    content = _call_openai_compat(
        PREP_GUIDE_SYSTEM_PROMPT,
        meal_plan_text,
        base_url,
        model,
        api_key=api_key or ("ollama" if is_ollama else "none"),
        force_json=True,
        timeout=120 if is_ollama else 60,
    )
    return _parse_json(content)
