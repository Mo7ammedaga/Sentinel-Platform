from datetime import datetime, timedelta

from flask import Blueprint, jsonify

from app.extensions import socketio
from app.events.websocket import emit_alert
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

    # Push each anomaly to its organization's room in real time.
    for r in anomalies:
        emit_alert(socketio, {
            'event_id': r.event.id,
            'user_id': r.event.user_id,
            'action': r.event.action_type,
            'risk_score': r.risk_score,
            'status': r.status,
            'confidence': r.confidence,
            'explanation': r.explanation,
            'message': f'{r.status.title()} activity: {r.event.action_type}',
            'timestamp': r.event.created_at.isoformat(),
        }, organization_id=r.event.organization_id)

    return jsonify({
        **summary,
        'alerts': [{
            'event_id': r.event.id,
            'user_id': r.event.user_id,
            'action': r.event.action_type,
            'risk_score': r.risk_score,
            'status': r.status,
            'confidence': r.confidence,
            'explanation': r.explanation,
            'timestamp': r.event.created_at.isoformat(),
        } for r in anomalies[:20]],
    }), 200
