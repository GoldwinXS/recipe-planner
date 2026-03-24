import uuid
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .demo_seed import seed_demo_user
from .serializers import CustomTokenObtainPairSerializer, ProfileUpdateSerializer, RegisterSerializer, UserSerializer

User = get_user_model()

DEMO_TEMP_TTL_HOURS = 24


class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/

    Creates a new user account and returns the user object.
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/

    Returns JWT access and refresh tokens plus basic user info.
    """

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class RefreshTokenView(TokenRefreshView):
    """
    POST /api/auth/refresh/

    Accepts a refresh token and returns a new access token.
    """

    permission_classes = [AllowAny]


class ProfileView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/   Return the authenticated user's profile.
    PATCH /api/auth/me/   Update username, email, or password.
    DELETE /api/auth/me/  Delete account (only allowed for demo temp users).
    """

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "delete"]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return ProfileUpdateSerializer
        return UserSerializer

    def get_object(self):
        return self.request.user

    def delete(self, request, *args, **kwargs):
        user = request.user
        if not user.is_demo_temp:
            return Response(
                {"detail": "Account deletion is only available for demo accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DemoLoginView(APIView):
    """
    POST /api/auth/demo/

    Creates a fresh temporary demo user pre-seeded with starter recipes and a
    sample meal plan, then returns JWT tokens identical to the login endpoint.

    Old temp users (older than DEMO_TEMP_TTL_HOURS) are purged on each call.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        # Purge expired temp users
        cutoff = timezone.now() - timedelta(hours=DEMO_TEMP_TTL_HOURS)
        User.objects.filter(is_demo_temp=True, date_joined__lt=cutoff).delete()

        # Create a fresh temp user
        uid = uuid.uuid4().hex[:10]
        user = User.objects.create_user(
            username=f"demo_{uid}",
            email=f"demo_{uid}@demo.temp",
            password=uuid.uuid4().hex,  # random, inaccessible password
            is_demo_temp=True,
            daily_calorie_goal=2200,
            daily_protein_g=165,
            daily_carbs_g=220,
            daily_fat_g=73,
            cooking_days=[0, 3, 6],
        )

        # Seed starter content
        try:
            seed_demo_user(user)
        except Exception:
            user.delete()
            return Response(
                {"detail": "Failed to seed demo data. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Issue JWT tokens (embed is_demo_temp in claims)
        refresh = RefreshToken.for_user(user)
        refresh["is_demo_temp"] = True
        return Response(
            {
                "access":  str(refresh.access_token),
                "refresh": str(refresh),
                "user":    UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )
