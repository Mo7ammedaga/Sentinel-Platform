from datetime import datetime, timedelta

from flask import Blueprint, jsonify

from app.extensions import socketio
from app.events.websocket import emit_alert
from app.models import User
from app.services.security_service import run_analysis
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import SECURITY_ROLES

ai_bp = Blueprint('ai', __name__, url_prefix='/api/v1/ai')


@ai_bp.route('/analyze', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
def analyze_events():
    """Score the last 24h of activity per-user, raise alerts, push live updates.

    Thin route: all business logic lives in security_service.run_analysis().
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    summary, anomalies = run_analysis(cutoff)

    if summary['users_analyzed'] == 0:
        return jsonify({'message': 'No recent events to analyze'}), 404

    # An analyst cannot investigate a bare user_id — resolve WHO for every
    # anomaly once, up front (avoids one query per alert).
    user_ids = {r.event.user_id for r in anomalies}
    users = {u.id: u for u in User.query.filter(User.id.in_(user_ids)).all()} if user_ids else {}

    def _alert_payload(r):
        user = users.get(r.event.user_id)
        return {
            'event_id': r.event.id,
            'user_id': r.event.user_id,
            'user_email': user.email if user else None,
            'user_name': user.get_full_name() if user else None,
            'action': r.event.action_type,
            'risk_score': r.risk_score,
            'status': r.status,
            'confidence': r.confidence,
            'explanation': r.explanation,
            'timestamp': r.event.created_at.isoformat(),
        }

    # Push each anomaly to its organization's room in real time.
    for r in anomalies:
        payload = _alert_payload(r)
        payload['message'] = (f'{r.status.title()} activity by '
                              f'{payload["user_name"] or "user " + str(r.event.user_id)}: '
                              f'{r.event.action_type}')
        emit_alert(socketio, payload, organization_id=r.event.organization_id)

    return jsonify({
        **summary,
        'alerts': [_alert_payload(r) for r in anomalies[:20]],
    }), 200
