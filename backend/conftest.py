"""
Root conftest.py for the backend test suite.

Sets required environment variables before Django settings are imported.
Tests use a fast in-memory SQLite database so no PostgreSQL instance is
needed to run the suite locally.
"""

import os

# Set env vars before Django/decouple attempts to read them.
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-api-key")
os.environ.setdefault("ALLOWED_HOSTS", "localhost,127.0.0.1")
