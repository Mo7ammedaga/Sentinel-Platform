import logging

from flask_socketio import emit, join_room, leave_room
from flask import request

logger = logging.getLogger(__name__)


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
        org_id = data['organization_id']
        join_room(f'org_{org_id}')
        emit('alert', {'message': f'Joined org {org_id}', 'status': 'success'})
    
    @socketio.on('join_user')
    def on_join_user(data):
        user_id = data['user_id']
        join_room(f'user_{user_id}')
        emit('alert', {'message': f'Joined user {user_id}', 'status': 'success'})

def emit_alert(socketio, alert_data, organization_id=None, user_id=None):
    if organization_id:
        socketio.emit('alert', alert_data, room=f'org_{organization_id}')
    if user_id:
        socketio.emit('alert', alert_data, room=f'user_{user_id}')
