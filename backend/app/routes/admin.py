"""Administrative endpoints (System Administrator only)."""
from flask import Blueprint, request, jsonify

from app.services import privacy_service
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import Roles
from app.utils.event_logger import EventLogger
from app.utils.api import current_user

admin_bp = Blueprint('admin', __name__, url_prefix='/api/v1/admin')


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
