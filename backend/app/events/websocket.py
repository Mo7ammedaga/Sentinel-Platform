import logging

from flask_socketio import emit, join_room
from flask import request

from app.models import User
from app.utils.auth import TokenManager

logger = logging.getLogger(__name__)


def _authenticated_user(data):
    """Verify the access token a client sent with a room-join request.

    Alerts and notifications are not public — without this, any client that
    can reach the Socket.IO endpoint could join an org/user room by supplying
    an arbitrary id, with no login at all, and receive live security alerts.
    Returns the User row, or None if the token is missing/invalid.
    """
    token = (data or {}).get('token')
    if not token:
        return None
    payload = TokenManager.verify_token(token)
    if not payload or payload.get('type') != 'access':
        return None
    return User.query.get(payload.get('user_id'))


def register_websocket_events(socketio):
    """Register WebSocket event handlers"""

    @socketio.on('connect')
    def handle_connect():
        logger.info("Client connected: %s", request.sid)
        emit('response', {'data': 'Connected to Sentinel Platform'})

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info("Client disconnected: %s", request.sid)

    @socketio.on('join_org')
    def on_join_org(data):
        user = _authenticated_user(data)
        if not user or user.organization_id != (data or {}).get('organization_id'):
            emit('alert', {'message': 'Unauthorized', 'status': 'error'})
            return
        join_room(f'org_{user.organization_id}')
        emit('alert', {'message': f'Joined org {user.organization_id}', 'status': 'success'})

    @socketio.on('join_user')
    def on_join_user(data):
        user = _authenticated_user(data)
        if not user or user.id != (data or {}).get('user_id'):
            emit('alert', {'message': 'Unauthorized', 'status': 'error'})
            return
        join_room(f'user_{user.id}')
        emit('alert', {'message': f'Joined user {user.id}', 'status': 'success'})

def emit_alert(socketio, alert_data, organization_id=None, user_id=None):
    if organization_id:
        socketio.emit('alert', alert_data, room=f'org_{organization_id}')
    if user_id:
        socketio.emit('alert', alert_data, room=f'user_{user_id}')
