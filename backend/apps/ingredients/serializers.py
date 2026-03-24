from rest_framework import serializers

from .models import Ingredient


class IngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ingredient
        fields = (
            "id",
            "name",
            "category",
            "default_unit",
            "calories_per_100g",
            "protein_g",
            "carbs_g",
            "fat_g",
        )
