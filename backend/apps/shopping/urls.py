from django.urls import path
from .views import ShoppingListCheckView, ShoppingListView

urlpatterns = [
    path(
        "shopping/<str:week_start>/",
        ShoppingListView.as_view(),
        name="shopping-list",
    ),
    path(
        "shopping/<str:week_start>/items/<int:pk>/toggle/",
        ShoppingListCheckView.as_view(),
        name="shopping-list-check",
    ),
]
