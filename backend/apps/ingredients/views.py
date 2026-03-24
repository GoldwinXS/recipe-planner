from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Ingredient
from .serializers import IngredientSerializer


class IngredientListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ingredients/          List all ingredients (supports ?search=)
    POST /api/ingredients/          Create a new ingredient
    """

    serializer_class = IngredientSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = Ingredient.objects.all()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset
