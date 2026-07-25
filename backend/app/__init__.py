import logging

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from app.config import get_config
from app.extensions import db, socketio, limiter


def _cors_origins(value):
    """Config CORS_ORIGINS -> value flask-cors accepts.

    '*' allows all (dev only). Empty -> [] (no cross-origin; safe production
    default until an allowlist is configured). Otherwise a comma-separated list.
    """
    if value == '*':
        return '*'
    if not value:
        return []
    return [o.strip() for o in value.split(',') if o.strip()]


def _configure_logging(app):
    level = getattr(logging, app.config.get('LOG_LEVEL', 'INFO').upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format='%(asctime)s %(levelname)s %(name)s: %(message)s',
    )
    app.logger.setLevel(level)


# The insecure code-level defaults from config.Config — never valid in production.
_INSECURE_DEFAULTS = {
    'dev-secret-key-change-in-production',
    'jwt-secret-key-change-in-production',
}


def _validate_production_config(app):
    """Refuse to start in production with default secrets (forgeable JWTs) or
    without a CORS allowlist. Fails fast with a clear message."""
    if app.config.get('DEBUG') or app.config.get('TESTING'):
        return
    problems = []
    if app.config.get('SECRET_KEY') in _INSECURE_DEFAULTS:
        problems.append('SECRET_KEY is the insecure default')
    if app.config.get('JWT_SECRET_KEY') in _INSECURE_DEFAULTS:
        problems.append('JWT_SECRET_KEY is the insecure default')
    if not app.config.get('CORS_ORIGINS'):
        problems.append('CORS_ORIGINS is empty (no allowlist)')
    if problems:
        raise RuntimeError(
            'Refusing to start in production: ' + '; '.join(problems) +
            '. Set these via environment variables.')


def create_app(config_class=None):
    app = Flask(__name__)
    app.config.from_object(config_class or get_config())
    _configure_logging(app)
    _validate_production_config(app)

    # Behind a reverse proxy (production), trust one hop of X-Forwarded-* so the
    # real client IP is used for rate limiting and event logging. Not enabled in
    # dev/test, where a client could otherwise spoof the header.
    if not app.debug and not app.testing:
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    # CORS is driven by config: '*' in development (the file:// dashboard sends
    # Origin: null); an explicit allowlist in production.
    origins = _cors_origins(app.config.get('CORS_ORIGINS', '*'))
    CORS(app, resources={r"/api/*": {"origins": origins}})
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app, cors_allowed_origins=origins)
    limiter.init_app(app)

    # Register real-time WebSocket handlers on the shared socketio instance.
    from app.events.websocket import register_websocket_events
    register_websocket_events(socketio)

    # Consistent JSON error responses across the whole API.
    from app.middleware.error_handler import register_error_handlers
    register_error_handlers(app)

    # Security response headers on every response.
    from app.middleware.security import register_security_headers
    register_security_headers(app)

    from app.routes.auth import auth_bp
    from app.routes.ai import ai_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.security import security_bp
    from app.routes.workspace import workspace_bp
    from app.routes.privacy import privacy_bp
    from app.routes.admin import admin_bp
    from app.routes.notifications import notifications_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(security_bp)
    app.register_blueprint(workspace_bp)
    app.register_blueprint(privacy_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(notifications_bp)

    from app.cli import register_cli
    register_cli(app)

    @app.route("/")
    def home():
        return {"message": "Welcome to Sentinel Platform API"}

    return app
