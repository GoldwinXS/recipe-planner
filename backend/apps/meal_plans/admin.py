from django.contrib import admin

from .models import MealPlan, MealPlanEntry


class MealPlanEntryInline(admin.TabularInline):
    model = MealPlanEntry
    extra = 0
    autocomplete_fields = ["recipe"]


@admin.register(MealPlan)
class MealPlanAdmin(admin.ModelAdmin):
    list_display = ("user", "week_start")
    list_filter = ("week_start",)
    search_fields = ("user__username",)
    inlines = [MealPlanEntryInline]
    ordering = ("-week_start",)
