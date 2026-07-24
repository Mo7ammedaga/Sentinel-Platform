from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Extensions are initialized here WITHOUT an app, then bound to the app inside
# create_app() via init_app(). This keeps them importable everywhere (models,
# routes, services) without circular imports. See docs/13 - Flask Extensions.
db = SQLAlchemy()
socketio = SocketIO()

# Rate limiting, keyed by client IP. In-memory storage is fine for a single
# dev/process; production should point RATELIMIT_STORAGE_URI at Redis.
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
