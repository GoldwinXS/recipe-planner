from django.db import models


class Ingredient(models.Model):
    """
    A pantry-level ingredient with optional nutritional metadata.

    Ingredients are global (not per-user) so that the same entry can be
    referenced from any recipe without duplication.
    """

    class Category(models.TextChoices):
        PROTEIN = "protein", "Protein"
        CARB = "carb", "Carbohydrate"
        VEGETABLE = "vegetable", "Vegetable"
        DAIRY = "dairy", "Dairy"
        SPICE = "spice", "Spice"
        OTHER = "other", "Other"

    class DefaultUnit(models.TextChoices):
        GRAM = "g", "Grams"
        MILLILITER = "ml", "Millilitres"
        CUP = "cup", "Cup"
        TEASPOON = "tsp", "Teaspoon"
        TABLESPOON = "tbsp", "Tablespoon"
        PIECE = "piece", "Piece"

    name = models.CharField(max_length=255, unique=True)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    default_unit = models.CharField(
        max_length=10,
        choices=DefaultUnit.choices,
        default=DefaultUnit.GRAM,
    )
    calories_per_100g = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    protein_g = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    carbs_g = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    fat_g = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )

    class Meta:
        db_table = "ingredients"
        verbose_name = "Ingredient"
        verbose_name_plural = "Ingredients"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
