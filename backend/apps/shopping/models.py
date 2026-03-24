from django.conf import settings
from django.db import models


class ShoppingListItem(models.Model):
    """
    An aggregated shopping-list entry for a specific week.

    Items are derived from the user's meal plan entries and stored/updated via
    the shopping list endpoint. The ``checked`` state is preserved across
    regeneration so users don't lose their progress.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shopping_list_items",
    )
    ingredient = models.ForeignKey(
        "ingredients.Ingredient",
        on_delete=models.CASCADE,
        related_name="shopping_list_items",
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=20)
    checked = models.BooleanField(default=False)
    week_start = models.DateField()

    class Meta:
        db_table = "shopping_list_items"
        ordering = ["ingredient__name"]

    def __str__(self) -> str:
        status = "✓" if self.checked else "○"
        return f"[{status}] {self.quantity} {self.unit} {self.ingredient.name}"
