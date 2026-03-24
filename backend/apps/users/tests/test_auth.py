import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def existing_user(db):
    return User.objects.create_user(
        username="existinguser",
        email="existing@example.com",
        password="StrongPass123!",
    )


@pytest.mark.django_db
class TestRegisterEndpoint:
    def test_register_creates_user_and_returns_201(self, api_client):
        url = reverse("auth-register")
        payload = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["username"] == "newuser"
        assert response.data["email"] == "newuser@example.com"
        assert "password" not in response.data
        assert User.objects.filter(username="newuser").exists()

    def test_register_with_mismatched_passwords_returns_400(self, api_client):
        url = reverse("auth-register")
        payload = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "StrongPass123!",
            "password_confirm": "DifferentPass456!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "password_confirm" in response.data

    def test_register_with_duplicate_username_returns_400(self, api_client, existing_user):
        url = reverse("auth-register")
        payload = {
            "username": existing_user.username,
            "email": "other@example.com",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_with_duplicate_email_returns_400(self, api_client, existing_user):
        url = reverse("auth-register")
        payload = {
            "username": "brandnewuser",
            "email": existing_user.email,
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLoginEndpoint:
    def test_login_returns_access_and_refresh_tokens(self, api_client, existing_user):
        url = reverse("auth-login")
        payload = {
            "username": existing_user.username,
            "password": "StrongPass123!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert "user" in response.data
        assert response.data["user"]["username"] == existing_user.username

    def test_login_with_wrong_password_returns_401(self, api_client, existing_user):
        url = reverse("auth-login")
        payload = {
            "username": existing_user.username,
            "password": "WrongPassword999!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "access" not in response.data

    def test_login_with_nonexistent_user_returns_401(self, api_client):
        url = reverse("auth-login")
        payload = {
            "username": "ghostuser",
            "password": "SomePass123!",
        }
        response = api_client.post(url, payload, format="json")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestRefreshEndpoint:
    def test_refresh_returns_new_access_token(self, api_client, existing_user):
        login_url = reverse("auth-login")
        login_response = api_client.post(
            login_url,
            {"username": existing_user.username, "password": "StrongPass123!"},
            format="json",
        )
        refresh_token = login_response.data["refresh"]

        refresh_url = reverse("auth-refresh")
        response = api_client.post(
            refresh_url, {"refresh": refresh_token}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
