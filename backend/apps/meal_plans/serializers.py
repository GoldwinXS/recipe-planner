from datetime import date

from rest_framework import serializers

from .models import MealPlan, MealPlanEntry


class _RecipeMinimalSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class MealPlanEntrySerializer(serializers.ModelSerializer):
    recipe = _RecipeMinimalSerializer(read_only=True)

    class Meta:
        model = MealPlanEntry
        fields = (
            "id",
            "recipe",
            "day",
            "meal_type",
            "servings",
            "storage",
        )


class MealPlanSerializer(serializers.ModelSerializer):
    entries = MealPlanEntrySerializer(many=True, read_only=True)
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())

    class Meta:
        model = MealPlan
        fields = ("id", "user", "week_start", "entries")
        read_only_fields = ("id", "entries")

    def validate_week_start(self, value: date) -> date:
        if value.weekday() != 0:
            raise serializers.ValidationError(
                "week_start must be a Monday (weekday index 0)."
            )
        return value

    def create(self, validated_data: dict) -> MealPlan:
        meal_plan, _ = MealPlan.objects.get_or_create(
            user=validated_data["user"],
            week_start=validated_data["week_start"],
        )
        return meal_plan


class MealPlanEntryCreateSerializer(serializers.ModelSerializer):
    """Used when adding a new entry to an existing MealPlan."""

    class Meta:
        model = MealPlanEntry
        fields = ("id", "recipe", "day", "meal_type", "servings", "storage")
        read_only_fields = ("id",)

    def validate_day(self, value: int) -> int:
        if value not in range(7):
            raise serializers.ValidationError("day must be between 0 and 6.")
        return value
