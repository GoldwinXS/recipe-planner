from django.contrib import admin

from .models import ShoppingListItem


@admin.register(ShoppingListItem)
class ShoppingListItemAdmin(admin.ModelAdmin):
    list_display = ("user", "ingredient", "quantity", "unit", "checked", "week_start")
    list_filter = ("checked", "week_start")
    search_fields = ("user__username", "ingredient__name")
    ordering = ("week_start", "ingredient__name")
