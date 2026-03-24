from django.contrib import admin

from .models import Ingredient


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "default_unit", "calories_per_100g")
    list_filter = ("category",)
    search_fields = ("name",)
    ordering = ("name",)
