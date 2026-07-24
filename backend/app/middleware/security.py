"""Security response headers applied to every response.

Conservative defaults suitable for a JSON API. HSTS is only meaningful over
HTTPS, so it is added only in production.
"""


def register_security_headers(app):
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers.setdefault('Cache-Control', 'no-store')
        if not app.debug and not app.testing:
            response.headers['Strict-Transport-Security'] = \
                'max-age=31536000; includeSubDomains'
        return response
