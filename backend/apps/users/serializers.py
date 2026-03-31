from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Handles new user registration with password confirmation."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True,
        required=True,
        style={"input_type": "password"},
    )

    class Meta:
        model = User
        fields = ("id", "username", "email", "password", "password_confirm")
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of a user."""

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "date_joined",
            "daily_calorie_goal", "daily_protein_g", "daily_carbs_g", "daily_fat_g",
            "cooking_days", "is_demo_temp", "ai_instructions",
        )
        read_only_fields = fields


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /api/auth/me/ — update username, password, and nutrition goals."""

    current_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "date_joined",
            "current_password", "new_password",
            "daily_calorie_goal", "daily_protein_g", "daily_carbs_g", "daily_fat_g",
            "cooking_days", "ai_instructions",
        )
        read_only_fields = ("id", "email", "date_joined")

    def validate(self, attrs):
        new_password = attrs.get("new_password", "")
        current_password = attrs.get("current_password", "")
        if new_password:
            if not current_password:
                raise serializers.ValidationError(
                    {"current_password": "Current password is required to set a new password."}
                )
            if not self.instance.check_password(current_password):
                raise serializers.ValidationError({"current_password": "Incorrect password."})
            validate_password(new_password)
        return attrs

    def update(self, instance, validated_data):
        validated_data.pop("current_password", None)
        new_password = validated_data.pop("new_password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if new_password:
            instance.set_password(new_password)
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds basic user info (including is_demo_temp) to the token claims and response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["is_demo_temp"] = user.is_demo_temp
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
