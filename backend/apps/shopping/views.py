import logging
from datetime import date
from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.meal_plans.models import MealPlan, MealPlanEntry

from .models import ShoppingListItem
from .serializers import ShoppingListItemSerializer

logger = logging.getLogger(__name__)


def _parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def _aggregate_shopping_list(user, week_start: date) -> None:
    """
    Build (or rebuild) the shopping list for ``week_start`` from the user's
    meal plan entries.

    Quantities are scaled by ``entry.servings / recipe.servings``.
    The ``checked`` state of existing items is preserved.
    """
    try:
        meal_plan = MealPlan.objects.get(user=user, week_start=week_start)
    except MealPlan.DoesNotExist:
        return

    entries = (
        MealPlanEntry.objects.filter(meal_plan=meal_plan)
        .select_related("recipe")
        .prefetch_related("recipe__recipe_ingredients__ingredient")
    )

    # Aggregate quantities per ingredient (using ingredient pk + unit as key)
    aggregated: dict[tuple[int, str], dict] = {}
    for entry in entries:
        recipe = entry.recipe
        if recipe.servings == 0:
            continue
        scale = Decimal(str(entry.servings)) / Decimal(str(recipe.servings))

        for ri in recipe.recipe_ingredients.all():
            key = (ri.ingredient_id, ri.unit)
            if key in aggregated:
                aggregated[key]["quantity"] += ri.quantity * scale
            else:
                aggregated[key] = {
                    "ingredient_id": ri.ingredient_id,
                    "quantity": ri.quantity * scale,
                    "unit": ri.unit,
                }

    # Persist with update_or_create so checked state is preserved
    seen_ids = set()
    for key, item_data in aggregated.items():
        obj, _ = ShoppingListItem.objects.update_or_create(
            user=user,
            ingredient_id=item_data["ingredient_id"],
            unit=item_data["unit"],
            week_start=week_start,
            defaults={"quantity": item_data["quantity"]},
        )
        seen_ids.add(obj.pk)

    # Remove items that are no longer part of the meal plan
    ShoppingListItem.objects.filter(
        user=user, week_start=week_start
    ).exclude(pk__in=seen_ids).delete()


class ShoppingListView(APIView):
    """
    GET    /api/shopping-list/{week_start}/
        Aggregate the shopping list from the meal plan and return items.

    DELETE /api/shopping-list/{week_start}/
        Clear all shopping list items for the week.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, week_start: str):
        week_start_date = _parse_date(week_start)
        if week_start_date is None:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _aggregate_shopping_list(request.user, week_start_date)

        items = ShoppingListItem.objects.filter(
            user=request.user, week_start=week_start_date
        ).select_related("ingredient")

        serializer = ShoppingListItemSerializer(items, many=True)
        return Response(serializer.data)

    def delete(self, request, week_start: str):
        week_start_date = _parse_date(week_start)
        if week_start_date is None:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = ShoppingListItem.objects.filter(
            user=request.user, week_start=week_start_date
        ).delete()

        return Response(
            {"deleted": deleted_count},
            status=status.HTTP_200_OK,
        )


class ShoppingListCheckView(APIView):
    """
    POST /api/shopping-list/{week_start}/check/{id}/

    Toggles the ``checked`` state of a shopping list item.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, week_start: str, pk: int):
        week_start_date = _parse_date(week_start)
        if week_start_date is None:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item = get_object_or_404(
            ShoppingListItem,
            pk=pk,
            user=request.user,
            week_start=week_start_date,
        )
        item.checked = not item.checked
        item.save(update_fields=["checked"])

        serializer = ShoppingListItemSerializer(item)
        return Response(serializer.data)
