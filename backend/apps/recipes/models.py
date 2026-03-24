from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Tag(models.Model):
    """Flat taxonomy tag for categorising recipes (e.g. "vegan", "quick")."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)

    class Meta:
        db_table = "tags"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Recipe(models.Model):
    """
    A recipe belonging to a single user.

    Recipes are private to the user who created them — either manually or
    via Claude AI generation.
    """

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        CLAUDE = "claude", "Claude AI"
        OLLAMA = "ollama", "Ollama"
        OPENAI_COMPAT = "openai_compat", "OpenAI API"
        BROWSER = "browser", "Browser LLM"
        URL = "url", "From URL"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recipes",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    servings = models.PositiveIntegerField(default=4)
    prep_time_minutes = models.PositiveIntegerField(default=0)
    cook_time_minutes = models.PositiveIntegerField(default=0)
    instructions = models.TextField()
    source = models.CharField(
        max_length=20,
        choices=Source.choices,
        default=Source.MANUAL,
    )
    claude_prompt = models.TextField(null=True, blank=True)
    model_name = models.CharField(max_length=100, blank=True, default='')
    tags = models.ManyToManyField(Tag, blank=True, related_name="recipes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "recipes"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class RecipeIngredient(models.Model):
    """
    Junction model that links a Recipe to an Ingredient with quantity/unit.
    """

    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="recipe_ingredients",
    )
    ingredient = models.ForeignKey(
        "ingredients.Ingredient",
        on_delete=models.PROTECT,
        related_name="recipe_ingredients",
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3)
    unit = models.CharField(max_length=50)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "recipe_ingredients"

    def __str__(self) -> str:
        return f"{self.quantity} {self.unit} {self.ingredient.name}"
