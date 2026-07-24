from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO

# Extensions are initialized here WITHOUT an app, then bound to the app inside
# create_app() via init_app(). This keeps them importable everywhere (models,
# routes, services) without circular imports. See docs/13 - Flask Extensions.
db = SQLAlchemy()
socketio = SocketIO()
