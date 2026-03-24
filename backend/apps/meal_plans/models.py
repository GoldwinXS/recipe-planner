from django.conf import settings
from django.db import models


class MealPlan(models.Model):
    """
    A weekly meal plan for a single user.

    ``week_start`` must be a Monday; this is enforced at the serializer level.
    The unique_together constraint prevents a user from having duplicate plans
    for the same week.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="meal_plans",
    )
    week_start = models.DateField()

    class Meta:
        db_table = "meal_plans"
        unique_together = ("user", "week_start")
        ordering = ["-week_start"]

    def __str__(self) -> str:
        return f"{self.user.username} — week of {self.week_start}"


class MealPlanEntry(models.Model):
    """
    A single recipe slot within a weekly meal plan.
    """

    class MealType(models.TextChoices):
        BREAKFAST = "breakfast", "Breakfast"
        LUNCH = "lunch", "Lunch"
        DINNER = "dinner", "Dinner"
        SNACK = "snack", "Snack"

    meal_plan = models.ForeignKey(
        MealPlan,
        on_delete=models.CASCADE,
        related_name="entries",
    )
    recipe = models.ForeignKey(
        "recipes.Recipe",
        on_delete=models.CASCADE,
        related_name="meal_plan_entries",
    )
    day = models.IntegerField(
        choices=[(i, i) for i in range(7)],
        help_text="0 = Monday, 6 = Sunday",
    )
    meal_type = models.CharField(
        max_length=10,
        choices=MealType.choices,
    )
    servings = models.DecimalField(max_digits=5, decimal_places=2)

    class StorageType(models.TextChoices):
        FRESH = "fresh", "Fresh (same day)"
        FRIDGE = "fridge", "Refrigerate"
        FREEZE = "freeze", "Freeze"

    storage = models.CharField(
        max_length=10,
        choices=StorageType.choices,
        default=StorageType.FRIDGE,
        blank=True,
    )

    class Meta:
        db_table = "meal_plan_entries"
        ordering = ["day", "meal_type"]

    def __str__(self) -> str:
        return (
            f"{self.meal_plan} — day {self.day} {self.meal_type} ({self.recipe.title})"
        )
