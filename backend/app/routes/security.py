from flask import Blueprint, request, jsonify

from app.services import security_service
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import SECURITY_ROLES, InvestigationState
from app.utils.event_logger import EventLogger
from app.utils.api import current_user

security_bp = Blueprint('security', __name__, url_prefix='/api/v1/security')


@security_bp.route('/alerts', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_alerts():
    """List AI-raised alerts, newest first, with WHO triggered them. Optional
    ?status= filter."""
    alerts = security_service.list_alerts(status=request.args.get('status'))
    return jsonify({'alerts': alerts, 'count': len(alerts)}), 200


@security_bp.route('/high-risk-users', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def high_risk_users():
    """Users ranked by current aggregate risk."""
    return jsonify({'users': security_service.high_risk_users()}), 200


@security_bp.route('/baseline-coverage', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def baseline_coverage():
    """Per-user event counts vs the AI's minimum baseline — explains why some
    users never appear in Alerts (not enough history yet, not necessarily
    'normal')."""
    org = current_user().organization_id
    return jsonify({'users': security_service.baseline_coverage(org)}), 200


@security_bp.route('/alerts/<int:alert_id>/investigations', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
def open_investigation(alert_id):
    """Open an investigation on an alert (the analyst takes ownership).

    Idempotent: re-requesting while one is already in progress returns the
    SAME investigation rather than spawning a duplicate (200, not 201 —
    nothing new was necessarily created)."""
    investigation, error = security_service.open_investigation(
        alert_id, request.user_id)
    if error:
        return jsonify({'error': error}), 404

    # The analyst's own action is audited too (constitution: analyst actions
    # leave a trace).
    EventLogger.log_event(
        user_id=request.user_id, organization_id=investigation.organization_id,
        action_type='open_investigation', resource_type='alert',
        resource_id=alert_id,
        description=f'Analyst opened investigation on alert {alert_id}')

    return jsonify(investigation.to_dict()), 200


@security_bp.route('/investigations/<int:investigation_id>', methods=['PATCH'])
@token_required
@role_required(*SECURITY_ROLES)
def update_investigation(investigation_id):
    """Move an investigation through its workflow (the analyst decides)."""
    data = request.get_json(silent=True) or {}
    new_state = data.get('state')
    if not new_state:
        return jsonify({'error': 'state is required',
                        'valid_states': list(InvestigationState.ALL)}), 400

    investigation, error = security_service.transition_investigation(
        investigation_id, new_state, notes=data.get('notes'))
    if error:
        code = 400 if error.startswith('Invalid') else 404
        return jsonify({'error': error}), code

    EventLogger.log_event(
        user_id=request.user_id, organization_id=investigation.organization_id,
        action_type='update_investigation', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Investigation {investigation_id} -> {new_state}')

    return jsonify(investigation.to_dict()), 200
