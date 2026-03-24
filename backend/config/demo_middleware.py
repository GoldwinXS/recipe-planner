"""
Middleware that makes the demo account read-only.

Any mutating request (POST, PUT, PATCH, DELETE) made by the demo user is
rejected with a 403 response that instructs the user to sign up.
"""
import json

from django.http import HttpResponse

DEMO_EMAIL = "demo@example.com"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class DemoAccountReadOnlyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method not in SAFE_METHODS
            and hasattr(request, "user")
            and request.user.is_authenticated
            and getattr(request.user, "email", "") == DEMO_EMAIL
        ):
            body = json.dumps(
                {
                    "detail": "This is a read-only demo account. "
                    "Create a free account to save your own recipes and plans.",
                    "demo": True,
                }
            )
            return HttpResponse(body, content_type="application/json", status=403)
        return self.get_response(request)
