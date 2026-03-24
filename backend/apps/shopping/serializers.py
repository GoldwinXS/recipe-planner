from rest_framework import serializers

from .models import ShoppingListItem


class ShoppingListItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_category = serializers.CharField(
        source="ingredient.category", read_only=True
    )

    class Meta:
        model = ShoppingListItem
        fields = (
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_category",
            "quantity",
            "unit",
            "checked",
            "week_start",
        )
        read_only_fields = (
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_category",
            "quantity",
            "unit",
            "week_start",
        )
