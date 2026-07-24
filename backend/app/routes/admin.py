"""Administrative endpoints (System Administrator only)."""
from flask import Blueprint, request, jsonify

from app.extensions import db
from app.models import User
from app.services import privacy_service
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import Roles
from app.utils.event_logger import EventLogger
from app.utils.api import current_user
from app.utils.validation import validate_body, validated_data
from app.schemas.auth import RoleUpdate

admin_bp = Blueprint('admin', __name__, url_prefix='/api/v1/admin')


@admin_bp.route('/users', methods=['GET'])
@token_required
@role_required(Roles.ADMIN)
def list_users():
    """List users in the admin's organization (for role management)."""
    org = current_user().organization_id
    users = (User.query.filter_by(organization_id=org)
             .order_by(User.created_at.desc()).all())
    return jsonify({'users': [
        {'id': u.id, 'email': u.email, 'name': u.get_full_name(),
         'role': u.role, 'is_active': u.is_active} for u in users]}), 200


@admin_bp.route('/users/<int:user_id>/role', methods=['PATCH'])
@token_required
@role_required(Roles.ADMIN)
@validate_body(RoleUpdate)
def set_user_role(user_id):
    """Assign a role to a user (this is how someone becomes analyst/manager/admin)."""
    if user_id == request.user_id:
        return jsonify({'error': 'Cannot change your own role'}), 400
    user = User.query.get(user_id)
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    new_role = validated_data()['role']
    user.role = new_role
    db.session.commit()
    EventLogger.log_event(
        user_id=request.user_id, organization_id=current_user().organization_id,
        action_type='set_user_role', resource_type='user', resource_id=user_id,
        description=f'Set user {user_id} role to {new_role}')
    return jsonify({'id': user.id, 'email': user.email, 'role': user.role}), 200


@admin_bp.route('/retention/purge', methods=['POST'])
@token_required
@role_required(Roles.ADMIN)
def purge_events():
    """Apply the data-retention policy: purge old, non-alerted event telemetry."""
    days = request.args.get('days', privacy_service.RETENTION_DAYS, type=int)
    purged = privacy_service.purge_old_events(days)
    EventLogger.log_event(
        user_id=request.user_id, organization_id=current_user().organization_id,
        action_type='retention_purge', resource_type='event',
        description=f'Purged {purged} events older than {days} days')
    return jsonify({'purged': purged, 'older_than_days': days}), 200
