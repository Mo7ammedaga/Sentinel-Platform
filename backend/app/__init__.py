import logging

from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from app.config import DevelopmentConfig
from app.extensions import db, socketio


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


def create_app(config_class=DevelopmentConfig):
    app = Flask(__name__)
    app.config.from_object(config_class)
    _configure_logging(app)

    # CORS is driven by config: '*' in development (the file:// dashboard sends
    # Origin: null); an explicit allowlist in production.
    origins = _cors_origins(app.config.get('CORS_ORIGINS', '*'))
    CORS(app, resources={r"/api/*": {"origins": origins}})
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app, cors_allowed_origins=origins)

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
    app.register_blueprint(auth_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(security_bp)
    app.register_blueprint(workspace_bp)

    @app.route("/")
    def home():
        return {"message": "Welcome to Sentinel Platform API"}

    return app
