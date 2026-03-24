from django.contrib.auth.models import AbstractUser
from django.db import models


def _default_cooking_days():
    """Sunday only by default (index 6)."""
    return [6]


class User(AbstractUser):
    """
    Custom user model.

    Extends AbstractUser to allow future profile fields without a schema
    migration. Using email as a unique identifier alongside the default
    username field keeps compatibility with DRF Simple JWT out of the box.
    """

    email = models.EmailField(unique=True)

    # Nutrition goals (all optional)
    daily_calorie_goal = models.PositiveIntegerField(null=True, blank=True)
    daily_protein_g = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    daily_carbs_g = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    daily_fat_g = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    # Days of week the user preps/cooks: list of ints 0 (Mon) – 6 (Sun)
    cooking_days = models.JSONField(default=_default_cooking_days, blank=True)

    # Ephemeral demo accounts — created fresh on each "Try Demo" click, deleted on logout
    is_demo_temp = models.BooleanField(default=False)

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"

    def __str__(self) -> str:
        return self.username
