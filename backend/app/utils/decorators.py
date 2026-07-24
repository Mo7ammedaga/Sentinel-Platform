"""Route decorators for access control.

Role-based access control (RBAC): the constitution requires that roles are not
just stored but ENFORCED. `@role_required` runs AFTER `@token_required` (which
authenticates the request and sets `request.user_role`) and checks the role.

    @bp.route('/secret')
    @token_required
    @role_required(Roles.ANALYST, Roles.ADMIN)
    def secret(): ...
"""
from functools import wraps

from flask import request, jsonify


def role_required(*allowed_roles):
    """Allow the request only if the authenticated user's role is permitted."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            role = getattr(request, 'user_role', None)
            if role not in allowed_roles:
                return jsonify({
                    'error': 'Forbidden: you do not have access to this resource',
                    'required_roles': list(allowed_roles),
                    'your_role': role,
                }), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator
