import logging
from datetime import date

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.recipes.ai_service import AIParseError, AIUnavailableError, generate_prep_guide, suggest_meal_plan
from apps.recipes.models import Recipe

from .models import MealPlan, MealPlanEntry
from .serializers import (
    MealPlanEntryCreateSerializer,
    MealPlanSerializer,
)

logger = logging.getLogger(__name__)


class MealPlanListView(APIView):
    """
    GET /api/meal-plans/

    Returns all meal plans belonging to the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans = MealPlan.objects.filter(user=request.user).prefetch_related(
            "entries__recipe"
        )
        serializer = MealPlanSerializer(plans, many=True, context={"request": request})
        return Response(serializer.data)


class MealPlanDetailView(APIView):
    """
    GET  /api/meal-plans/{week_start}/   Retrieve (or auto-create) the plan for the week.
    """

    permission_classes = [IsAuthenticated]

    def _parse_week_start(self, week_start_str: str) -> date | None:
        try:
            return date.fromisoformat(week_start_str)
        except (ValueError, TypeError):
            return None

    def get(self, request, week_start: str):
        week_start_date = self._parse_week_start(week_start)
        if week_start_date is None:
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if week_start_date.weekday() != 0:
            return Response(
                {"detail": "week_start must be a Monday."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan, _ = MealPlan.objects.get_or_create(
            user=request.user,
            week_start=week_start_date,
        )
        # Reload with prefetch
        plan = MealPlan.objects.prefetch_related("entries__recipe").get(pk=plan.pk)
        serializer = MealPlanSerializer(plan, context={"request": request})
        return Response(serializer.data)


class MealPlanEntryListCreateView(APIView):
    """
    POST /api/meal-plans/{week_start}/entries/

    Adds a new entry to the meal plan for the given week.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, week_start: str):
        try:
            week_start_date = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = get_object_or_404(MealPlan, user=request.user, week_start=week_start_date)

        serializer = MealPlanEntryCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        entry = serializer.save(meal_plan=plan)
        return Response(
            MealPlanEntryCreateSerializer(entry).data,
            status=status.HTTP_201_CREATED,
        )


class MealPlanSuggestView(APIView):
    """
    POST /api/meal-plans/suggest/

    Uses AI to suggest a weekly meal plan from the user's recipes.
    Body: { "preferences": "...", "days": 7, "provider": "claude", ... }
    Returns: { "suggestions": [{"day": 0, "meal_type": "dinner", "recipe_id": 5}, ...] }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        preferences = request.data.get("preferences", "")
        days = min(int(request.data.get("days", 7)), 28)
        provider = request.data.get("provider", "claude")
        ollama_url = request.data.get("ollama_url", "")
        model = request.data.get("model", "")
        api_key = request.data.get("api_key", "")
        api_base = request.data.get("api_base", "")

        # Fetch user's recipes with macro data
        recipes_qs = Recipe.objects.filter(user=request.user).prefetch_related(
            "tags", "recipe_ingredients__ingredient"
        )
        if not recipes_qs.exists():
            return Response(
                {"detail": "You have no recipes. Add some recipes to your cookbook first."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.recipes.serializers import UNIT_TO_GRAMS, PIECE_WEIGHTS_G

        def _recipe_macros(recipe):
            servings = recipe.servings or 1
            totals = {'calories': 0.0, 'protein_g': 0.0, 'carbs_g': 0.0, 'fat_g': 0.0}
            tracked, total = 0, 0
            for ri in recipe.recipe_ingredients.all():
                total += 1
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
            if tracked == 0:
                return None
            per_serving = {k: round(v / servings, 1) for k, v in totals.items()}
            per_serving['complete'] = tracked == total and total > 0
            return per_serving

        recipes = []
        for r in recipes_qs:
            macros = _recipe_macros(r)
            recipes.append({
                "id": r.id,
                "title": r.title,
                "tags": [t.name for t in r.tags.all()],
                "macros": macros,
            })

        # Build macro goals from user profile
        u = request.user
        macro_goals = {}
        if u.daily_calorie_goal:
            macro_goals['calories'] = u.daily_calorie_goal
        if u.daily_protein_g:
            macro_goals['protein_g'] = float(u.daily_protein_g)
        if u.daily_carbs_g:
            macro_goals['carbs_g'] = float(u.daily_carbs_g)
        if u.daily_fat_g:
            macro_goals['fat_g'] = float(u.daily_fat_g)

        cooking_days = u.cooking_days if u.cooking_days else [6]

        try:
            result = suggest_meal_plan(
                recipes,
                preferences=preferences,
                days=days,
                cooking_days=cooking_days,
                macro_goals=macro_goals or None,
                provider=provider,
                ollama_url=ollama_url,
                model=model,
                api_key=api_key,
                api_base=api_base,
            )
        except AIUnavailableError as exc:
            logger.warning("AI unavailable for meal plan suggest: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except AIParseError as exc:
            logger.warning("AI parse error for meal plan suggest: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        # Validate recipe IDs exist for this user; pass through week and storage fields
        valid_ids = {r["id"] for r in recipes}
        valid_storage = {"fresh", "fridge", "freeze"}
        weeks = max(1, (days + 6) // 7)
        suggestions = []
        for s in result.get("suggestions", []):
            if not isinstance(s, dict):
                continue
            if s.get("recipe_id") not in valid_ids:
                continue
            if s.get("meal_type") not in ("breakfast", "lunch", "dinner", "snack"):
                continue
            if not (isinstance(s.get("day"), int) and 0 <= s["day"] < 7):
                continue
            week = s.get("week", 0)
            if not (isinstance(week, int) and 0 <= week < weeks):
                continue
            storage = s.get("storage", "fridge")
            if storage not in valid_storage:
                storage = "fridge"
            suggestions.append({
                "week": week,
                "day": s["day"],
                "meal_type": s["meal_type"],
                "recipe_id": s["recipe_id"],
                "storage": storage,
            })

        return Response({"suggestions": suggestions}, status=status.HTTP_200_OK)


class MealPlanEntryDeleteView(APIView):
    """
    DELETE /api/meal-plans/{week_start}/entries/{id}/
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request, week_start: str, pk: int):
        try:
            week_start_date = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            return Response(
                {"detail": "Invalid date format."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry = get_object_or_404(
            MealPlanEntry,
            pk=pk,
            meal_plan__user=request.user,
            meal_plan__week_start=week_start_date,
        )
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MealPlanStatsView(APIView):
    """
    GET /api/meal-plans/{week_start}/stats/

    Returns per-day macro totals and weekly averages for the meal plan.
    Macros are only calculated for ingredients that have full nutritional data.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, week_start: str):
        try:
            week_start_date = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid date format."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.recipes.serializers import UNIT_TO_GRAMS, PIECE_WEIGHTS_G

        try:
            plan = MealPlan.objects.prefetch_related(
                "entries__recipe__recipe_ingredients__ingredient"
            ).get(user=request.user, week_start=week_start_date)
        except MealPlan.DoesNotExist:
            return Response({"days": [], "weekly_avg": {}, "goals": {}})

        day_totals = {
            i: {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "has_data": False}
            for i in range(7)
        }

        for entry in plan.entries.all():
            recipe = entry.recipe
            scale = float(entry.servings) / float(recipe.servings or 1)
            for ri in recipe.recipe_ingredients.all():
                ing = ri.ingredient
                unit_lower = ri.unit.lower()
                factor = UNIT_TO_GRAMS.get(unit_lower)
                if factor is None and unit_lower in ('piece', 'pieces', 'each', 'whole'):
                    factor = PIECE_WEIGHTS_G.get(ing.name.lower())
                if factor is None:
                    continue
                if any(getattr(ing, f) is None for f in ("calories_per_100g", "protein_g", "carbs_g", "fat_g")):
                    continue
                qty_g = float(ri.quantity) * factor * scale
                day_totals[entry.day]["calories"] += float(ing.calories_per_100g) * qty_g / 100
                day_totals[entry.day]["protein_g"] += float(ing.protein_g) * qty_g / 100
                day_totals[entry.day]["carbs_g"] += float(ing.carbs_g) * qty_g / 100
                day_totals[entry.day]["fat_g"] += float(ing.fat_g) * qty_g / 100
                day_totals[entry.day]["has_data"] = True

        days_result = [
            {
                "day": i,
                "has_data": d["has_data"],
                "calories": round(d["calories"], 1),
                "protein_g": round(d["protein_g"], 1),
                "carbs_g": round(d["carbs_g"], 1),
                "fat_g": round(d["fat_g"], 1),
            }
            for i, d in day_totals.items()
        ]

        days_with_data = [d for d in day_totals.values() if d["has_data"]]
        if days_with_data:
            n = len(days_with_data)
            weekly_avg = {
                "days_with_data": n,
                "calories": round(sum(d["calories"] for d in days_with_data) / n, 1),
                "protein_g": round(sum(d["protein_g"] for d in days_with_data) / n, 1),
                "carbs_g": round(sum(d["carbs_g"] for d in days_with_data) / n, 1),
                "fat_g": round(sum(d["fat_g"] for d in days_with_data) / n, 1),
            }
        else:
            weekly_avg = {"days_with_data": 0}

        u = request.user
        goals = {}
        if u.daily_calorie_goal:
            goals["calories"] = u.daily_calorie_goal
        if u.daily_protein_g:
            goals["protein_g"] = float(u.daily_protein_g)
        if u.daily_carbs_g:
            goals["carbs_g"] = float(u.daily_carbs_g)
        if u.daily_fat_g:
            goals["fat_g"] = float(u.daily_fat_g)

        return Response({"days": days_result, "weekly_avg": weekly_avg, "goals": goals})


class MealPlanPrepGuideView(APIView):
    """
    POST /api/meal-plans/{week_start}/prep-guide/

    Uses AI to generate a meal prep schedule for the week's cooking days.
    Body: { provider, ollama_url, model, api_key, api_base }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, week_start: str):
        try:
            week_start_date = date.fromisoformat(week_start)
        except (ValueError, TypeError):
            return Response({"detail": "Invalid date format."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = MealPlan.objects.prefetch_related(
                "entries__recipe"
            ).get(user=request.user, week_start=week_start_date)
        except MealPlan.DoesNotExist:
            return Response({"detail": "No meal plan for this week."}, status=status.HTTP_404_NOT_FOUND)

        provider = request.data.get("provider", "claude")
        ollama_url = request.data.get("ollama_url", "")
        model = request.data.get("model", "")
        api_key = request.data.get("api_key", "")
        api_base = request.data.get("api_base", "")

        u = request.user
        cooking_days = u.cooking_days if u.cooking_days else [6]
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        # Build a structured description of the week's plan
        lines = [f"Weekly meal plan for the week of {week_start_date.strftime('%B %d, %Y')}:\n"]
        for day_idx in range(7):
            is_cooking = day_idx in cooking_days
            suffix = "(COOKING DAY)" if is_cooking else "(non-cooking — leftovers)"
            label = f"{day_names[day_idx]} {suffix}"
            lines.append(label + ":")
            day_entries = [e for e in plan.entries.all() if e.day == day_idx]
            if day_entries:
                for entry in day_entries:
                    lines.append(
                        f"  {entry.meal_type.capitalize()}: {entry.recipe.title} "
                        f"({entry.servings} serving{'s' if entry.servings != 1 else ''}, "
                        f"prep {entry.recipe.prep_time_minutes}min + cook {entry.recipe.cook_time_minutes}min)"
                    )
            else:
                lines.append("  (no meals planned)")
            lines.append("")

        lines.append(f"Cooking days: {', '.join(day_names[d] for d in sorted(cooking_days) if 0 <= d <= 6)}")
        lines.append("\nFor each cooking day, provide a clear prep guide including:")
        lines.append("- What to cook fresh for that day")
        lines.append("- What to batch cook for upcoming leftover days")
        lines.append("- Storage tips for leftovers")
        lines.append("- Estimated total cooking time")
        lines.append("- One useful efficiency or flavour tip per task")

        meal_plan_text = "\n".join(lines)

        try:
            result = generate_prep_guide(
                meal_plan_text,
                provider=provider,
                ollama_url=ollama_url,
                model=model,
                api_key=api_key,
                api_base=api_base,
            )
        except AIUnavailableError as exc:
            logger.warning("AI unavailable for prep guide: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except AIParseError as exc:
            logger.warning("AI parse error for prep guide: %s", exc)
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        return Response(result, status=status.HTTP_200_OK)
