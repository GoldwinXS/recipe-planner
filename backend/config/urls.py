"""
Root URL configuration for Recipe Planner.
"""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/", include("apps.recipes.urls")),
    path("api/", include("apps.ingredients.urls")),
    path("api/", include("apps.meal_plans.urls")),
    path("api/", include("apps.shopping.urls")),
]
