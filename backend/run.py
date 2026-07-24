from app import create_app
from app.extensions import db, socketio

# The app factory wires all extensions (db, migrate, socketio, cors) and
# registers blueprints + WebSocket handlers. run.py just launches it.
app = create_app()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    # allow_unsafe_werkzeug lets the Werkzeug dev server run under Flask-SocketIO
    # locally; do not use this server in production (use gunicorn + eventlet).
    socketio.run(app, debug=True, host='0.0.0.0', port=5000,
                 allow_unsafe_werkzeug=True)
