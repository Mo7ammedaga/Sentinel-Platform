from datetime import datetime, timedelta

from flask import Blueprint, jsonify

from app.extensions import db, socketio
from app.models import Event, AIAnalysis
from app.ai import analyze_user_events, MODEL_VERSION
from app.events.websocket import emit_alert
from app.utils.auth import token_required
from app.utils.decorators import role_required
from app.utils.constants import SECURITY_ROLES

ai_bp = Blueprint('ai', __name__, url_prefix='/api/v1/ai')


@ai_bp.route('/analyze', methods=['POST'])
@token_required
@role_required(*SECURITY_ROLES)
def analyze_events():
    """Score the last 24h of activity against each user's OWN baseline.

    For every user with recent activity, load their full history, build their
    personal baseline, and score only their recent events against it. This is
    user-behavior analytics: "unusual for THIS user", not a global threshold.
    """
    cutoff = datetime.utcnow() - timedelta(hours=24)
    recent = Event.query.filter(Event.created_at >= cutoff).all()
    if not recent:
        return jsonify({'message': 'No recent events to analyze'}), 404

    user_ids = sorted({e.user_id for e in recent})
    scored = []
    for uid in user_ids:
        history = (Event.query.filter(Event.user_id == uid)
                   .order_by(Event.created_at.asc()).all())
        recent_idx = [i for i, e in enumerate(history) if e.created_at >= cutoff]
        for r in analyze_user_events(history, score_indices=recent_idx):
            r.event.status = r.status
            r.event.risk_score = r.risk_score
            scored.append(r)

    # Persist the analysis as an audit trail. Re-running replaces the prior
    # analysis for each event, so the table always holds the latest verdict
    # plus the exact feature vector that produced it.
    event_ids = [r.event.id for r in scored]
    if event_ids:
        AIAnalysis.query.filter(AIAnalysis.event_id.in_(event_ids)).delete(
            synchronize_session=False)
        db.session.commit()          # clear old rows before inserting new ones
    for r in scored:
        record = AIAnalysis(
            event_id=r.event.id, user_id=r.event.user_id,
            organization_id=r.event.organization_id,
            risk_score=r.risk_score, status=r.status, confidence=r.confidence,
            explanation=r.explanation, model_version=r.model_version,
            insufficient_data=r.insufficient_data)
        record.set_features(r.features)
        db.session.add(record)
    db.session.commit()

    anomalies = sorted((r for r in scored if r.status != 'normal'),
                       key=lambda r: r.risk_score, reverse=True)

    # Push each anomaly to the Security Dashboard in real time, to the room of
    # the organization it belongs to. This is the whole point of the WebSocket
    # layer: analysts see high-risk behaviour the moment it is scored.
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
        'model_version': MODEL_VERSION,
        'users_analyzed': len(user_ids),
        'events_scored': len(scored),
        'anomalies_detected': len(anomalies),
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
