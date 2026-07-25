import os

from flask import Blueprint, request, jsonify, send_from_directory

from app.services import security_service
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import SECURITY_ROLES, InvestigationState
from app.utils.event_logger import EventLogger
from app.utils.api import current_user
from app.utils.validation import validate_body, validated_data
from app.schemas.security import SeverityUpdate, EscalateRequest, IncidentActionCreate

security_bp = Blueprint('security', __name__, url_prefix='/api/v1/security')


@security_bp.route('/alerts', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_alerts():
    """List AI-raised alerts, newest first, with WHO triggered them. Optional
    ?status= filter."""
    org = current_user().organization_id
    alerts = security_service.list_alerts(org, status=request.args.get('status'))
    return jsonify({'alerts': alerts, 'count': len(alerts)}), 200


@security_bp.route('/high-risk-users', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def high_risk_users():
    """Users ranked by current aggregate risk."""
    org = current_user().organization_id
    return jsonify({'users': security_service.high_risk_users(org)}), 200


@security_bp.route('/baseline-coverage', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def baseline_coverage():
    """Per-user event counts vs the AI's minimum baseline — explains why some
    users never appear in Alerts (not enough history yet, not necessarily
    'normal')."""
    org = current_user().organization_id
    return jsonify({'users': security_service.baseline_coverage(org)}), 200


@security_bp.route('/model-performance', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def model_performance():
    """The analyst feedback loop: confirmed vs false-positive verdicts,
    grouped by the model version that raised each alert."""
    org = current_user().organization_id
    return jsonify(security_service.model_performance(org)), 200


@security_bp.route('/risk-trend', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def risk_trend():
    """Daily average risk + critical/suspicious counts over the last N days."""
    org = current_user().organization_id
    days = request.args.get('days', 14, type=int)
    return jsonify({'days': days, 'trend': security_service.risk_trend(org, days)}), 200


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


@security_bp.route('/investigations/<int:investigation_id>', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def get_investigation(investigation_id):
    """Full case file: alert, subject user, escalation, and the complete
    incident action/evidence audit trail — the Incident Response view."""
    detail, error = security_service.get_investigation_detail(investigation_id)
    if error:
        return jsonify({'error': error}), 404
    return jsonify(detail), 200


@security_bp.route('/investigations/<int:investigation_id>', methods=['PATCH'])
@token_required
@role_required(*SECURITY_ROLES)
def update_investigation(investigation_id):
    """Move an investigation through its workflow (the analyst decides).
    Confirming a real threat does not close the case — it opens the
    incident-response phase on this same record."""
    data = request.get_json(silent=True) or {}
    new_state = data.get('state')
    if not new_state:
        return jsonify({'error': 'state is required',
                        'valid_states': list(InvestigationState.ALL)}), 400

    investigation, error = security_service.transition_investigation(
        investigation_id, request.user_id, new_state, notes=data.get('notes'),
        resolution_summary=data.get('resolution_summary'))
    if error:
        code = 404 if error == 'Investigation not found' else 400
        return jsonify({'error': error}), code

    EventLogger.log_event(
        user_id=request.user_id, organization_id=investigation.organization_id,
        action_type='update_investigation', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Investigation {investigation_id} -> {new_state}')

    return jsonify(investigation.to_dict()), 200


@security_bp.route('/incidents', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_incidents():
    """Confirmed cases only — the SOC's case-management view. Optional
    ?state= (e.g. containing, resolved, closed)."""
    org = current_user().organization_id
    incidents = security_service.list_incidents(org, state=request.args.get('state'))
    return jsonify({'incidents': incidents, 'count': len(incidents)}), 200


@security_bp.route('/investigations/<int:investigation_id>/severity', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
@validate_body(SeverityUpdate)
def set_severity(investigation_id):
    inv, error = security_service.set_severity(
        investigation_id, validated_data()['severity'])
    if error:
        return jsonify({'error': error}), 404 if error == 'Investigation not found' else 400
    EventLogger.log_event(
        user_id=request.user_id, organization_id=inv.organization_id,
        action_type='set_incident_severity', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Set incident {investigation_id} severity to {inv.severity}')
    return jsonify(inv.to_dict()), 200


@security_bp.route('/investigations/<int:investigation_id>/escalate', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
@validate_body(EscalateRequest)
def escalate_investigation(investigation_id):
    data = validated_data()
    inv, error = security_service.escalate_investigation(
        investigation_id, request.user_id, data['to_user_id'], data.get('note'))
    if error:
        code = 404 if error in ('Investigation not found', 'Target user not found') else 400
        return jsonify({'error': error}), code
    EventLogger.log_event(
        user_id=request.user_id, organization_id=inv.organization_id,
        action_type='escalate_investigation', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Escalated investigation {investigation_id} to user {data["to_user_id"]}')
    return jsonify(inv.to_dict()), 200


@security_bp.route('/investigations/<int:investigation_id>/actions', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
@validate_body(IncidentActionCreate)
def add_incident_action(investigation_id):
    data = validated_data()
    action, error = security_service.add_incident_action(
        investigation_id, request.user_id, data['action_type'], data['description'])
    if error:
        code = 404 if error == 'Investigation not found' else 400
        return jsonify({'error': error}), code
    EventLogger.log_event(
        user_id=request.user_id, organization_id=current_user().organization_id,
        action_type='add_incident_action', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Logged {data["action_type"]} action on investigation {investigation_id}')
    return jsonify(action.to_dict()), 201


@security_bp.route('/investigations/<int:investigation_id>/actions', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_incident_actions(investigation_id):
    actions = security_service.list_incident_actions(investigation_id)
    return jsonify({'actions': [a.to_dict() for a in actions]}), 200


@security_bp.route('/investigations/<int:investigation_id>/evidence', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
def upload_evidence(investigation_id):
    """multipart/form-data: 'file' (the real bytes) + optional 'description'."""
    upload = request.files.get('file')
    if upload is None or not upload.filename:
        return jsonify({'error': 'file is required'}), 400
    ev, error = security_service.upload_evidence(
        request.user_id, investigation_id, upload, request.form.get('description'))
    if error:
        code = 404 if error == 'Investigation not found' else 400
        return jsonify({'error': error}), code
    EventLogger.log_event(
        user_id=request.user_id, organization_id=current_user().organization_id,
        action_type='upload_evidence', resource_type='investigation',
        resource_id=investigation_id,
        description=f'Attached evidence "{ev.filename}" to investigation {investigation_id}')
    return jsonify(ev.to_dict()), 201


@security_bp.route('/investigations/<int:investigation_id>/evidence', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_evidence(investigation_id):
    evidence = security_service.list_evidence(investigation_id)
    return jsonify({'evidence': [e.to_dict() for e in evidence]}), 200


@security_bp.route('/evidence/<int:evidence_id>/download', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def download_evidence(evidence_id):
    """Streams the ACTUAL evidence bytes back (not just metadata)."""
    ev, disk_path, error = security_service.get_evidence_for_download(evidence_id)
    if error:
        return jsonify({'error': error}), 404
    directory, stored_name = os.path.split(disk_path)
    return send_from_directory(directory, stored_name, as_attachment=True,
                               download_name=ev.filename)


@security_bp.route('/admins', methods=['GET'])
@token_required
@role_required(*SECURITY_ROLES)
def list_admins():
    """Administrators in the analyst's org — the only valid escalation targets."""
    org = current_user().organization_id
    admins = security_service.list_org_admins(org, exclude_user_id=request.user_id)
    return jsonify({'admins': admins}), 200
