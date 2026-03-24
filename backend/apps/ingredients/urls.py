from django.urls import path

from .views import IngredientListCreateView

urlpatterns = [
    path("ingredients/", IngredientListCreateView.as_view(), name="ingredient-list"),
]
