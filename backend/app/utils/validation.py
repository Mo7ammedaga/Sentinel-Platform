"""Request-body validation using pydantic v2.

Chosen over marshmallow: typed models, a fast Rust-backed core, structured
per-field errors, and no framework coupling (plain classes). The decorator
validates the JSON body against a schema and stashes the parsed model on
`request.validated`; on failure it raises ApiError(422) which the centralized
error handler formats.
"""
from functools import wraps

from flask import request
from pydantic import ValidationError

from app.utils.errors import ApiError


def _format_errors(exc: ValidationError):
    return [{
        'field': '.'.join(str(p) for p in err['loc']) or '(body)',
        'message': err['msg'],
    } for err in exc.errors()]


def validate_body(schema):
    """Validate request JSON against `schema` (a pydantic BaseModel)."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True) or {}
            try:
                request.validated = schema(**data)
            except ValidationError as exc:
                raise ApiError('Validation failed', status=422,
                               details=_format_errors(exc))
            return f(*args, **kwargs)
        return wrapper
    return decorator


def validated_data():
    """The parsed model as a dict of only the fields the client actually sent."""
    return request.validated.model_dump(exclude_unset=True)
