from flask import Flask
from flask_cors import CORS
from flask_migrate import Migrate

from app.config import DevelopmentConfig
from app.extensions import db, socketio

def create_app(config_class=DevelopmentConfig):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Allow any origin to call the API in development. `CORS(app)` alone picks up
    # CORS_ORIGINS from config and restricts to localhost:3000, which blocks the
    # file:// dashboard (Origin: null). Tighten this per-environment for production.
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    db.init_app(app)
    Migrate(app, db)
    socketio.init_app(app, cors_allowed_origins="*")

    # Register real-time WebSocket handlers on the shared socketio instance.
    from app.events.websocket import register_websocket_events
    register_websocket_events(socketio)

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
