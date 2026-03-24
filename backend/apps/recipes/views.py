import html as html_module
import json
import logging
import re

import requests
from bs4 import BeautifulSoup
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .ai_service import AIParseError, AIUnavailableError, fill_ingredient_macros, generate_recipe, remix_recipe
from .models import Recipe, Tag
from .permissions import IsOwner
from .serializers import (
    GeneratedRecipeSerializer,
    RecipeSerializer,
    TagSerializer,
)

logger = logging.getLogger(__name__)


class RecipeListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/recipes/   List the authenticated user's recipes.
    POST /api/recipes/   Create a new recipe.
    """

    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Recipe.objects.filter(user=self.request.user)
            .prefetch_related("recipe_ingredients__ingredient", "tags")
            .order_by("-created_at")
        )


class RecipeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/recipes/{id}/   Retrieve a recipe.
    PUT    /api/recipes/{id}/   Full update.
    PATCH  /api/recipes/{id}/   Partial update.
    DELETE /api/recipes/{id}/   Delete.
    """

    serializer_class = RecipeSerializer
    permission_classes = [IsOwner]

    def get_queryset(self):
        return (
            Recipe.objects.filter(user=self.request.user)
            .prefetch_related("recipe_ingredients__ingredient", "tags")
        )


class RecipeGenerateView(APIView):
    """
    POST /api/recipes/generate/

    Body: { "prompt": "a spicy vegan curry" }
    Returns the generated recipe JSON from Claude without persisting it.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        prompt = request.data.get("prompt", "").strip()
        if not prompt:
            return Response(
                {"detail": "A 'prompt' field is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        provider = request.data.get("provider", "claude")
        ollama_url = request.data.get("ollama_url", "")
        model = request.data.get("model", "")
        api_key = request.data.get("api_key", "")
        api_base = request.data.get("api_base", "")

        try:
            recipe_data = generate_recipe(
                prompt,
                provider=provider,
                ollama_url=ollama_url,
                model=model,
                api_key=api_key,
                api_base=api_base,
            )
        except AIUnavailableError as exc:
            logger.warning("AI unavailable: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AIParseError as exc:
            logger.warning("AI parse error: %s", exc)
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return Response(recipe_data, status=status.HTTP_200_OK)


class RecipeSaveGeneratedView(APIView):
    """
    POST /api/recipes/save-generated/

    Accepts a generated recipe dict (as returned by /generate/), validates it,
    saves it to the database as a Claude-sourced recipe, and returns the full
    recipe representation.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GeneratedRecipeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        recipe_serializer = RecipeSerializer(
            data={
                "title": data["title"],
                "description": data["description"],
                "servings": data["servings"],
                "prep_time_minutes": data["prep_time_minutes"],
                "cook_time_minutes": data["cook_time_minutes"],
                "instructions": data["instructions"],
                "source": data.get("source", "claude"),
                "claude_prompt": data.get("claude_prompt", ""),
                "ingredients": [
                    {
                        "name": ing["name"],
                        "quantity": ing["quantity"],
                        "unit": ing["unit"],
                        "notes": ing.get("notes", ""),
                    }
                    for ing in data["ingredients"]
                ],
                "tags": data.get("tags", []),
            },
            context={"request": request},
        )

        if not recipe_serializer.is_valid():
            return Response(recipe_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        recipe = recipe_serializer.save()
        # Reload with prefetches for the response
        recipe = (
            Recipe.objects.prefetch_related("recipe_ingredients__ingredient", "tags")
            .get(pk=recipe.pk)
        )
        return Response(
            RecipeSerializer(recipe, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


def _find_jsonld_recipe(soup):
    """Return the first schema.org Recipe object found in JSON-LD tags, or None."""
    for tag in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(tag.string or '{}')
        except (json.JSONDecodeError, TypeError):
            continue

        candidates = []
        if isinstance(data, list):
            candidates = data
        elif isinstance(data, dict):
            candidates = data.get('@graph', [data])

        for item in candidates:
            if not isinstance(item, dict):
                continue
            item_type = item.get('@type', '')
            if isinstance(item_type, list):
                item_type = ' '.join(item_type)
            if 'Recipe' in item_type:
                return item
    return None


def _parse_iso_duration(value):
    """Convert ISO 8601 duration (PT1H30M) to total minutes."""
    if not value:
        return 0
    hours = re.search(r'(\d+)H', str(value))
    mins = re.search(r'(\d+)M', str(value))
    return (int(hours.group(1)) * 60 if hours else 0) + (int(mins.group(1)) if mins else 0)


def _parse_yield(value):
    """Parse recipe yield ('makes 4 servings', '4', ['4 servings']) to an int."""
    if not value:
        return 4
    if isinstance(value, list):
        value = value[0]
    if isinstance(value, (int, float)):
        return int(value)
    m = re.search(r'\d+', str(value))
    return int(m.group()) if m else 4


def _parse_ingredient_string(s):
    """Parse '2 cups all-purpose flour, sifted' → {name, quantity, unit, notes}."""
    s = re.sub(r'^[-•*]\s*', '', s.strip())
    pattern = (
        r'^(\d+(?:\s+\d+/\d+)?|\d*/\d+|\d+\.?\d*)\s*'
        r'(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?'
        r'|g|grams?|kg|ml|l(?:iters?)?|pieces?|cloves?|pinch(?:es)?|bunches?'
        r'|slices?|cans?|packages?|stalks?|sprigs?|heads?|handfuls?|inches?)?\s*'
        r'(.+)'
    )
    m = re.match(pattern, s, re.IGNORECASE)
    if not m:
        return {'name': s, 'quantity': 1, 'unit': '', 'notes': ''}

    qty_str, unit, rest = m.group(1).strip(), (m.group(2) or '').lower(), m.group(3).strip()
    parts = qty_str.split()
    try:
        if len(parts) == 2:  # "1 1/2"
            n, d = parts[1].split('/')
            qty = float(parts[0]) + float(n) / float(d)
        elif '/' in qty_str:
            n, d = qty_str.split('/')
            qty = float(n) / float(d)
        else:
            qty = float(qty_str)
    except (ValueError, ZeroDivisionError):
        qty = 1

    comma = rest.find(',')
    name = rest[:comma].strip() if comma > -1 else rest
    notes = rest[comma + 1:].strip() if comma > -1 else ''
    return {'name': name, 'quantity': qty, 'unit': unit, 'notes': notes}


def _u(s):
    """Unescape HTML entities in a string."""
    return html_module.unescape(s) if isinstance(s, str) else s


def _structured_from_jsonld(data, source_url):
    """Convert a schema.org Recipe dict into our recipe format."""
    # Instructions: list of HowToStep dicts or plain strings
    raw_instructions = data.get('recipeInstructions', [])
    if isinstance(raw_instructions, str):
        steps_text = raw_instructions
    else:
        steps = []
        for i, step in enumerate(raw_instructions, 1):
            if isinstance(step, str):
                steps.append(f'Step {i}: {step.strip()}')
            elif isinstance(step, dict):
                text = step.get('text') or step.get('name') or ''
                steps.append(f'Step {i}: {text.strip()}')
        steps_text = '\n'.join(steps)

    def _parse_ing(raw):
        parsed = _parse_ingredient_string(_u(raw))
        parsed['name'] = _u(parsed['name'])
        return parsed

    ingredients = [
        _parse_ing(ing)
        for ing in data.get('recipeIngredient', [])
        if ing and ing.strip()
    ]

    keywords = data.get('keywords', '')
    if isinstance(keywords, list):
        tags = [k.strip().lower() for k in keywords if k.strip()]
    else:
        tags = [k.strip().lower() for k in str(keywords).split(',') if k.strip()]

    return {
        'title': _u(data.get('name', '')),
        'description': _u((data.get('description') or ''))[:500],
        'servings': _parse_yield(data.get('recipeYield')),
        'prep_time_minutes': _parse_iso_duration(data.get('prepTime')),
        'cook_time_minutes': _parse_iso_duration(data.get('cookTime')),
        'instructions': _u(steps_text),
        'ingredients': ingredients,
        'tags': tags[:10],
        'source_url': source_url,
    }


class RecipeFetchUrlView(APIView):
    """
    POST /api/recipes/fetch-url/
    Body: { "url": "https://..." }

    Returns:
      - `structured`: fully parsed recipe dict if JSON-LD schema.org data is found (no AI needed)
      - `text`: cleaned page text as fallback for AI parsing
      - `source_url`: the original URL
    """

    permission_classes = [IsAuthenticated]

    _STRIP_TAGS = ['script', 'style', 'nav', 'header', 'footer',
                   'aside', 'advertisement', 'iframe', 'noscript']

    def post(self, request):
        url = request.data.get('url', '').strip()
        if not url:
            return Response({'detail': 'A url field is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not url.startswith(('http://', 'https://')):
            return Response({'detail': 'URL must start with http:// or https://'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = requests.get(
                url,
                timeout=10,
                headers={
                    'User-Agent': (
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                        'AppleWebKit/537.36 (KHTML, like Gecko) '
                        'Chrome/120.0.0.0 Safari/537.36'
                    ),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            )
            resp.raise_for_status()
        except requests.exceptions.Timeout:
            return Response({'detail': 'The page took too long to load.'}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except requests.exceptions.HTTPError as exc:
            code = exc.response.status_code if exc.response is not None else 0
            if code == 403:
                return Response(
                    {'detail': 'This site blocked access (403). Sites like AllRecipes use bot protection. Try a different recipe site, or paste the recipe text directly.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({'detail': f'Could not fetch the page (HTTP {code}).'}, status=status.HTTP_400_BAD_REQUEST)
        except requests.exceptions.RequestException as exc:
            return Response({'detail': f'Could not fetch the URL: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

        soup = BeautifulSoup(resp.text, 'lxml')

        # ── Primary: schema.org JSON-LD (works on AllRecipes, SimplyRecipes, etc.) ──
        jsonld = _find_jsonld_recipe(soup)
        if jsonld:
            structured = _structured_from_jsonld(jsonld, url)
            return Response({'structured': structured, 'source_url': url})

        # ── Fallback: clean text for AI parsing ──
        for tag in soup(self._STRIP_TAGS):
            tag.decompose()

        recipe_containers = (
            soup.find_all(attrs={'class': lambda c: c and 'recipe' in c.lower()})
            or soup.find_all(['article', 'main'])
        )
        target = recipe_containers[0] if recipe_containers else soup.body or soup

        lines = [l.strip() for l in target.get_text(separator='\n').splitlines() if l.strip()]
        cleaned = html_module.unescape('\n'.join(lines))[:6000]

        return Response({'text': cleaned, 'source_url': url})


class OllamaModelsView(APIView):
    """
    POST /api/ai/ollama-models/
    Body: { "ollama_url": "http://host.docker.internal:11434" }
    Proxies to Ollama's /api/tags endpoint and returns available model names.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        base = request.data.get('ollama_url', '').strip().rstrip('/')
        if not base:
            return Response({'detail': 'ollama_url is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resp = requests.get(f'{base}/api/tags', timeout=5)
            resp.raise_for_status()
            models = [m['name'] for m in resp.json().get('models', [])]
            return Response({'models': models})
        except requests.exceptions.ConnectionError:
            return Response(
                {'detail': f'Cannot reach {base}. Is Ollama running?'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except requests.exceptions.Timeout:
            return Response(
                {'detail': 'Connection timed out.'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class RecipeFillMacrosView(APIView):
    """
    POST /api/recipes/{pk}/fill-macros/

    Uses AI to estimate nutritional data (per 100g) for any recipe ingredients
    that are missing macro information, then saves the values to the ingredient
    records and returns the updated recipe.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        recipe = get_object_or_404(Recipe, pk=pk, user=request.user)

        # Collect unique ingredients missing at least one macro field
        seen_ids = set()
        missing = []
        for ri in recipe.recipe_ingredients.select_related("ingredient").all():
            ing = ri.ingredient
            if ing.id in seen_ids:
                continue
            seen_ids.add(ing.id)
            if any(getattr(ing, f) is None for f in ("calories_per_100g", "protein_g", "carbs_g", "fat_g")):
                missing.append(ing)

        if not missing:
            # Nothing to fill — just return current recipe data
            recipe = Recipe.objects.prefetch_related("recipe_ingredients__ingredient", "tags").get(pk=pk)
            return Response(RecipeSerializer(recipe, context={"request": request}).data)

        provider = request.data.get("provider", "claude")
        ollama_url = request.data.get("ollama_url", "")
        model = request.data.get("model", "")
        api_key = request.data.get("api_key", "")
        api_base = request.data.get("api_base", "")

        try:
            result = fill_ingredient_macros(
                [ing.name for ing in missing],
                provider=provider,
                ollama_url=ollama_url,
                model=model,
                api_key=api_key,
                api_base=api_base,
            )
        except AIUnavailableError as exc:
            logger.warning("AI unavailable for macros: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except AIParseError as exc:
            logger.warning("AI parse error for macros: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Map returned data by lower-cased name, with partial-match fallback
        name_map = {item["name"].lower(): item for item in result.get("ingredients", [])}
        logger.info("fill-macros: AI returned names: %s", list(name_map.keys()))
        logger.info("fill-macros: ingredient names to match: %s", [ing.name.lower() for ing in missing])
        for ing in missing:
            key = ing.name.lower()
            data = name_map.get(key)
            if not data:
                # Partial match: find any AI name that contains or is contained by the stored name
                for ai_name, ai_data in name_map.items():
                    if key in ai_name or ai_name in key:
                        data = ai_data
                        logger.info("fill-macros: partial match '%s' → '%s'", key, ai_name)
                        break
            if not data:
                logger.warning("fill-macros: no match found for '%s'", ing.name)
                continue
            ing.calories_per_100g = data.get("calories_per_100g")
            ing.protein_g = data.get("protein_g")
            ing.carbs_g = data.get("carbs_g")
            ing.fat_g = data.get("fat_g")
            ing.save()

        recipe = Recipe.objects.prefetch_related("recipe_ingredients__ingredient", "tags").get(pk=pk)
        return Response(RecipeSerializer(recipe, context={"request": request}).data)


class RecipeRemixView(APIView):
    """
    POST /api/recipes/{pk}/remix/

    Uses AI to create a modified version of an existing recipe.
    Body: { "instruction": "make it vegan", "provider": "claude", ... }
    Returns: the modified recipe dict (not saved).
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        recipe = get_object_or_404(Recipe, pk=pk, user=request.user)

        instruction = request.data.get("instruction", "").strip()
        if not instruction:
            return Response({"detail": "An 'instruction' field is required."}, status=status.HTTP_400_BAD_REQUEST)

        provider = request.data.get("provider", "claude")
        ollama_url = request.data.get("ollama_url", "")
        model = request.data.get("model", "")
        api_key = request.data.get("api_key", "")
        api_base = request.data.get("api_base", "")

        # Build current recipe text for the AI
        recipe_qs = Recipe.objects.prefetch_related("recipe_ingredients__ingredient", "tags").get(pk=pk)
        ingredients_text = "\n".join(
            f"  - {float(ri.quantity)} {ri.unit} {ri.ingredient.name}" + (f" ({ri.notes})" if ri.notes else "")
            for ri in recipe_qs.recipe_ingredients.all()
        )
        tags_text = ", ".join(t.name for t in recipe_qs.tags.all())
        recipe_text = (
            f"Title: {recipe_qs.title}\n"
            f"Description: {recipe_qs.description}\n"
            f"Servings: {recipe_qs.servings}\n"
            f"Prep time: {recipe_qs.prep_time_minutes} min\n"
            f"Cook time: {recipe_qs.cook_time_minutes} min\n"
            f"Tags: {tags_text}\n"
            f"Ingredients:\n{ingredients_text}\n"
            f"Instructions:\n{recipe_qs.instructions}"
        )

        try:
            result = remix_recipe(
                recipe_text,
                instruction,
                provider=provider,
                ollama_url=ollama_url,
                model=model,
                api_key=api_key,
                api_base=api_base,
            )
        except AIUnavailableError as exc:
            logger.warning("AI unavailable for remix: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except AIParseError as exc:
            logger.warning("AI parse error for remix: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        return Response(result, status=status.HTTP_200_OK)


class TagListView(generics.ListAPIView):
    """
    GET /api/tags/   List all tags.
    """

    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]
    queryset = Tag.objects.all()
    pagination_class = None
