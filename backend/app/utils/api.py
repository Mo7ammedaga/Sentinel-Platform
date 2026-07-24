"""Small API helpers shared by routes: current user, pagination, validation.

Designed for a JSON/REST client (the future React frontend): list endpoints
return a consistent {items, pagination} envelope.
"""
from flask import request

from app.models import User


def current_user():
    """The authenticated user (token_required set request.user_id)."""
    return User.query.get(request.user_id)


def require_fields(data, *fields):
    """Return a list of missing required fields (empty if all present)."""
    data = data or {}
    return [f for f in fields if data.get(f) in (None, '')]


def paginate(query, default_per_page=20, max_per_page=100):
    """Paginate a query using ?page & ?per_page (clamped)."""
    page = request.args.get('page', 1, type=int) or 1
    per_page = request.args.get('per_page', default_per_page, type=int) or default_per_page
    page = max(page, 1)
    per_page = min(max(per_page, 1), max_per_page)
    return query.paginate(page=page, per_page=per_page, error_out=False)


def paginated(pagination, items):
    """Wrap serialized items with pagination metadata."""
    return {
        'items': items,
        'pagination': {
            'page': pagination.page,
            'per_page': pagination.per_page,
            'total': pagination.total,
            'pages': pagination.pages,
        },
    }
