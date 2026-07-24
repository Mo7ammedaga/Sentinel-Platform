"""In-app notification endpoints (a user's own notifications)."""
from flask import Blueprint, request, jsonify

from app.services import notification_service
from app.utils.auth import token_required
from app.utils.api import paginate, paginated

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/v1/notifications')


@notifications_bp.route('', methods=['GET'])
@token_required
def list_notifications():
    page = paginate(notification_service.list_for(request.user_id))
    return jsonify(paginated(page, [n.to_dict() for n in page.items])), 200


@notifications_bp.route('/unread-count', methods=['GET'])
@token_required
def unread_count():
    return jsonify({'unread': notification_service.unread_count(request.user_id)}), 200


@notifications_bp.route('/<int:notification_id>/read', methods=['POST'])
@token_required
def read_notification(notification_id):
    n, error = notification_service.mark_read(request.user_id, notification_id)
    if error:
        return jsonify({'error': error}), 404
    return jsonify(n.to_dict()), 200


@notifications_bp.route('/read-all', methods=['POST'])
@token_required
def read_all():
    return jsonify({'marked': notification_service.mark_all_read(request.user_id)}), 200
