from django.utils.text import slugify
from rest_framework import serializers

from apps.ingredients.models import Ingredient

from .models import Recipe, RecipeIngredient, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "slug")
        read_only_fields = ("id", "slug")


class RecipeIngredientReadSerializer(serializers.ModelSerializer):
    """Flat representation used in recipe read responses."""

    ingredient_id = serializers.IntegerField(source="ingredient.id", read_only=True)
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)

    class Meta:
        model = RecipeIngredient
        fields = ("id", "ingredient_id", "ingredient_name", "quantity", "unit", "notes")


class RecipeIngredientWriteSerializer(serializers.Serializer):
    """
    Accepts ingredient data for recipe create/update.

    The ingredient is resolved by name (case-insensitive) via get_or_create so
    that callers can reference existing ingredients or implicitly create new ones.
    """

    name = serializers.CharField(max_length=255)
    quantity = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit = serializers.CharField(max_length=50, allow_blank=True, default="")
    notes = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def to_internal_value(self, data):
        """Coerce AI-returned quantity strings (fractions, null) before validation."""
        qty = data.get('quantity')
        if qty is None or qty == '':
            data = {**data, 'quantity': 0}
        elif isinstance(qty, str):
            qty = qty.strip()
            if '/' in qty:
                try:
                    parts = qty.split(' ', 1)
                    if len(parts) == 2 and '/' in parts[1]:
                        # "1 1/2" mixed-number format
                        num, denom = parts[1].split('/', 1)
                        data = {**data, 'quantity': float(parts[0]) + float(num) / float(denom)}
                    else:
                        # "1/2" simple fraction
                        num, denom = qty.split('/', 1)
                        data = {**data, 'quantity': float(num) / float(denom)}
                except (ValueError, ZeroDivisionError):
                    data = {**data, 'quantity': 0}
        return super().to_internal_value(data)


UNIT_TO_GRAMS = {
    # Weight
    'g': 1, 'gram': 1, 'grams': 1,
    'kg': 1000, 'kilogram': 1000, 'kilograms': 1000,
    'oz': 28.35, 'ounce': 28.35, 'ounces': 28.35,
    'lb': 453.59, 'lbs': 453.59, 'pound': 453.59, 'pounds': 453.59,
    # Volume (approximate water/liquid density)
    'ml': 1, 'milliliter': 1, 'milliliters': 1, 'millilitre': 1, 'millilitres': 1,
    'l': 1000, 'liter': 1000, 'liters': 1000, 'litre': 1000, 'litres': 1000,
    'fl oz': 29.57, 'fl. oz': 29.57,
    'cup': 240, 'cups': 240,
    'tbsp': 15, 'tablespoon': 15, 'tablespoons': 15,
    'tsp': 5, 'teaspoon': 5, 'teaspoons': 5,
}

# Typical weight in grams for one "piece" of common whole-food ingredients.
# Used as a fallback when unit is "piece", "pieces", or "each".
PIECE_WEIGHTS_G = {
    'egg': 50, 'eggs': 50,
    'garlic': 3, 'garlic clove': 3, 'garlic cloves': 3,
    'onion': 150, 'onions': 150, 'yellow onion': 150, 'red onion': 150,
    'bell pepper': 130, 'bell peppers': 130, 'pepper': 130,
    'tomato': 123, 'tomatoes': 123,
    'potato': 170, 'potatoes': 170,
    'sweet potato': 130, 'sweet potatoes': 130,
    'apple': 182, 'apples': 182,
    'banana': 118, 'bananas': 118,
    'lemon': 84, 'lemons': 84,
    'lime': 67, 'limes': 67,
    'avocado': 150, 'avocados': 150,
    'carrot': 61, 'carrots': 61,
    'zucchini': 200, 'zucchinis': 200,
}


class RecipeSerializer(serializers.ModelSerializer):
    """
    Full recipe serializer supporting nested ingredient writes.

    On write operations the `ingredients` list is processed to create or update
    RecipeIngredient rows. Tags are resolved by name and created if absent.
    """

    ingredients = RecipeIngredientWriteSerializer(many=True, write_only=True, required=False)
    recipe_ingredients = RecipeIngredientReadSerializer(many=True, read_only=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        write_only=True,
        required=False,
    )
    tag_details = TagSerializer(many=True, read_only=True, source="tags")
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    macros_per_serving = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = (
            "id",
            "user",
            "user_id",
            "title",
            "description",
            "servings",
            "prep_time_minutes",
            "cook_time_minutes",
            "instructions",
            "source",
            "claude_prompt",
            "model_name",
            "ingredients",
            "recipe_ingredients",
            "tags",
            "tag_details",
            "macros_per_serving",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    # ------------------------------------------------------------------
    # Macros
    # ------------------------------------------------------------------

    def get_macros_per_serving(self, obj):
        servings = obj.servings or 1
        totals = {'calories': 0.0, 'protein_g': 0.0, 'carbs_g': 0.0, 'fat_g': 0.0}
        tracked = 0
        total_ris = 0

        for ri in obj.recipe_ingredients.all():
            total_ris += 1
            ing = ri.ingredient
            unit_lower = ri.unit.lower()
            factor = UNIT_TO_GRAMS.get(unit_lower)
            if factor is None and unit_lower in ('piece', 'pieces', 'each', 'whole'):
                factor = PIECE_WEIGHTS_G.get(ing.name.lower())
            if factor is None:
                continue
            if any(getattr(ing, f) is None for f in ('calories_per_100g', 'protein_g', 'carbs_g', 'fat_g')):
                continue
            qty_g = float(ri.quantity) * factor
            totals['calories'] += float(ing.calories_per_100g) * qty_g / 100
            totals['protein_g'] += float(ing.protein_g) * qty_g / 100
            totals['carbs_g'] += float(ing.carbs_g) * qty_g / 100
            totals['fat_g'] += float(ing.fat_g) * qty_g / 100
            tracked += 1

        per_serving = {k: round(v / servings, 1) for k, v in totals.items()}
        per_serving['tracked_ingredients'] = tracked
        per_serving['total_ingredients'] = total_ris
        per_serving['complete'] = tracked == total_ris and total_ris > 0
        return per_serving

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_tags(self, tag_names: list[str]) -> list[Tag]:
        tags = []
        for name in tag_names:
            name = name.strip()
            if not name:
                continue
            tag, _ = Tag.objects.get_or_create(
                slug=slugify(name),
                defaults={"name": name},
            )
            tags.append(tag)
        return tags

    def _save_ingredients(self, recipe: Recipe, ingredients_data: list[dict]) -> None:
        recipe.recipe_ingredients.all().delete()
        for item in ingredients_data:
            # Match case-insensitively; create with the supplied capitalisation if absent.
            existing = Ingredient.objects.filter(name__iexact=item["name"]).first()
            if existing:
                ingredient = existing
            else:
                ingredient = Ingredient.objects.create(name=item["name"])
            RecipeIngredient.objects.create(
                recipe=recipe,
                ingredient=ingredient,
                quantity=item["quantity"],
                unit=item["unit"],
                notes=item.get("notes", ""),
            )

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def create(self, validated_data: dict) -> Recipe:
        ingredients_data = validated_data.pop("ingredients", [])
        tag_names = validated_data.pop("tags", [])

        recipe = Recipe.objects.create(**validated_data)

        if ingredients_data:
            self._save_ingredients(recipe, ingredients_data)

        if tag_names:
            recipe.tags.set(self._resolve_tags(tag_names))

        return recipe

    def update(self, instance: Recipe, validated_data: dict) -> Recipe:
        ingredients_data = validated_data.pop("ingredients", None)
        tag_names = validated_data.pop("tags", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if ingredients_data is not None:
            self._save_ingredients(instance, ingredients_data)

        if tag_names is not None:
            instance.tags.set(self._resolve_tags(tag_names))

        return instance


class GeneratedRecipeSerializer(serializers.Serializer):
    """
    Validates the payload submitted to /api/recipes/save-generated/.

    The shape mirrors the JSON structure returned by Claude.
    """

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, default="")
    servings = serializers.IntegerField(min_value=1)
    prep_time_minutes = serializers.IntegerField(min_value=0)
    cook_time_minutes = serializers.IntegerField(min_value=0)
    instructions = serializers.CharField()
    ingredients = RecipeIngredientWriteSerializer(many=True)
    tags = serializers.ListField(
        child=serializers.CharField(max_length=100),
        required=False,
        default=list,
    )
    claude_prompt = serializers.CharField(required=False, allow_blank=True, default="")
    model_name = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    source = serializers.ChoiceField(
        choices=["manual", "claude", "ollama", "openai_compat", "browser", "url"],
        required=False,
        default="claude",
    )
