from django.urls import path

from .views import (
    MealPlanDetailView,
    MealPlanEntryDeleteView,
    MealPlanEntryListCreateView,
    MealPlanListView,
    MealPlanPrepGuideView,
    MealPlanStatsView,
    MealPlanSuggestView,
)

urlpatterns = [
    path("meal-plans/", MealPlanListView.as_view(), name="meal-plan-list"),
    path("meal-plans/suggest/", MealPlanSuggestView.as_view(), name="meal-plan-suggest"),
    path(
        "meal-plans/<str:week_start>/",
        MealPlanDetailView.as_view(),
        name="meal-plan-detail",
    ),
    path(
        "meal-plans/<str:week_start>/entries/",
        MealPlanEntryListCreateView.as_view(),
        name="meal-plan-entry-list",
    ),
    path(
        "meal-plans/<str:week_start>/entries/<int:pk>/",
        MealPlanEntryDeleteView.as_view(),
        name="meal-plan-entry-delete",
    ),
    path(
        "meal-plans/<str:week_start>/stats/",
        MealPlanStatsView.as_view(),
        name="meal-plan-stats",
    ),
    path(
        "meal-plans/<str:week_start>/prep-guide/",
        MealPlanPrepGuideView.as_view(),
        name="meal-plan-prep-guide",
    ),
]
