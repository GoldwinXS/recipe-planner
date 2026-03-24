from django.urls import path

from .views import (
    OllamaModelsView,
    RecipeDetailView,
    RecipeFetchUrlView,
    RecipeFillMacrosView,
    RecipeGenerateView,
    RecipeListCreateView,
    RecipeRemixView,
    RecipeSaveGeneratedView,
    TagListView,
)

urlpatterns = [
    # Named action routes must precede the <int:pk> capture to avoid ambiguity.
    path("recipes/generate/", RecipeGenerateView.as_view(), name="recipe-generate"),
    path("recipes/save-generated/", RecipeSaveGeneratedView.as_view(), name="recipe-save-generated"),
    path("recipes/fetch-url/", RecipeFetchUrlView.as_view(), name="recipe-fetch-url"),
    path("recipes/", RecipeListCreateView.as_view(), name="recipe-list"),
    path("recipes/<int:pk>/", RecipeDetailView.as_view(), name="recipe-detail"),
    path("recipes/<int:pk>/fill-macros/", RecipeFillMacrosView.as_view(), name="recipe-fill-macros"),
    path("recipes/<int:pk>/remix/", RecipeRemixView.as_view(), name="recipe-remix"),
    path("tags/", TagListView.as_view(), name="tag-list"),
    path("ai/ollama-models/", OllamaModelsView.as_view(), name="ollama-models"),
]
