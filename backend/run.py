from app import create_app
from app.extensions import socketio

# The app factory wires all extensions (db, migrate, socketio, cors) and
# registers blueprints + WebSocket handlers. run.py just launches it.
app = create_app()

if __name__ == '__main__':
    # The schema is provisioned by migrations (`flask db upgrade`) — NOT by
    # db.create_all(). This keeps a clean deploy fully reproducible.
    # allow_unsafe_werkzeug lets the Werkzeug dev server run under Flask-SocketIO
    # locally; do not use this server in production (use gunicorn + eventlet).
    socketio.run(app, debug=True, host='0.0.0.0', port=5000,
                 allow_unsafe_werkzeug=True)
