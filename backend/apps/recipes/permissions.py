from rest_framework.permissions import BasePermission, IsAuthenticated


class IsOwner(BasePermission):
    """
    Object-level permission that only allows the owner of an object to access it.

    The view must pass the object to has_object_permission via get_object().
    The object is expected to have a `user` attribute.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return obj.user == request.user
