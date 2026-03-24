"""
Production settings.
"""

from .base import *  # noqa: F401, F403
from decouple import config  # noqa: F811

DEBUG = False

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------

# Tell Django it's behind an SSL-terminating reverse proxy (nginx).
# nginx must set "X-Forwarded-Proto: https" for this to work.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ---------------------------------------------------------------------------
# Static files — WhiteNoise serves Django admin/DRF static assets
# ---------------------------------------------------------------------------

MIDDLEWARE = ["whitenoise.middleware.WhiteNoiseMiddleware"] + MIDDLEWARE  # noqa: F405
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# ---------------------------------------------------------------------------
# CORS
# When frontend and backend are on different domains (e.g. Netlify + Render),
# set CORS_ALLOWED_ORIGINS to the frontend URL in your env file.
# When on the same domain behind nginx, leave it empty.
# ---------------------------------------------------------------------------

_cors_origins = config("CORS_ALLOWED_ORIGINS", default="")
CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins.split(",") if o.strip()]
CORS_ALLOW_CREDENTIALS = True

# Required for Django admin + DRF browsable API over HTTPS
_csrf_origins = config("CSRF_TRUSTED_ORIGINS", default="")
CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins.split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
