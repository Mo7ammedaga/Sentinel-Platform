"""A single application error type so every failure maps to one JSON shape."""


class ApiError(Exception):
    """Raise anywhere to return a consistent error response.

    The centralized handler (app/middleware/error_handler.py) turns this into
    {"error": message, "details": ...} with the given HTTP status.
    """
    def __init__(self, message, status=400, details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details
