from django.contrib import admin

from .models import Recipe, RecipeIngredient, Tag


class RecipeIngredientInline(admin.TabularInline):
    model = RecipeIngredient
    extra = 0
    autocomplete_fields = ["ingredient"]


@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "source", "servings", "created_at")
    list_filter = ("source", "tags")
    search_fields = ("title", "user__username")
    autocomplete_fields = ["tags"]
    inlines = [RecipeIngredientInline]
    ordering = ("-created_at",)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}
