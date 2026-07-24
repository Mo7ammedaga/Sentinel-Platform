"""Centralized error handling.

Every error the API returns has the same shape:
    {"error": "<message>", "details": <optional>}
so clients (and the future React frontend) can handle failures uniformly. This
replaces ad-hoc error returns scattered across routes.
"""
from flask import jsonify
from werkzeug.exceptions import HTTPException

from app.utils.errors import ApiError


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(exc: ApiError):
        body = {'error': exc.message}
        if exc.details is not None:
            body['details'] = exc.details
        return jsonify(body), exc.status

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        # 404 (unknown route), 405 (method not allowed), 400, etc.
        return jsonify({'error': exc.name, 'details': exc.description}), exc.code

    @app.errorhandler(Exception)
    def handle_uncaught(exc: Exception):
        # Log the full traceback server-side; never leak internals to clients.
        app.logger.exception('Unhandled exception')
        return jsonify({'error': 'Internal server error'}), 500
