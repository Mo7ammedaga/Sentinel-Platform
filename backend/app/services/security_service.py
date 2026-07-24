"""Security domain business logic.

Orchestrates the AI analysis pipeline and the alert -> investigation workflow.
Routes call these functions; they never talk to the AI engine or models directly.
"""
from datetime import datetime

from app.extensions import db
from app.models import (
    Event, AIAnalysis, Alert, Investigation, RiskScore, User,
)
from app.ai import analyze_user_events, MODEL_VERSION
from app.utils.constants import AlertStatus, InvestigationState


def run_analysis(cutoff):
    """Score every user's recent events against their own baseline, persist the
    analysis, raise/refresh alerts for anomalies, and update per-user risk.

    Returns (summary: dict, anomalies: list[UserBaselineResult] sorted desc).
    """
    recent = Event.query.filter(Event.created_at >= cutoff).all()
    if not recent:
        return {'model_version': MODEL_VERSION, 'users_analyzed': 0,
                'events_scored': 0, 'anomalies_detected': 0}, []

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

    analysis_by_event = _persist_analysis(scored)
    anomalies = [r for r in scored if r.status != 'normal']
    _raise_alerts(anomalies, analysis_by_event)
    _update_risk_scores(user_ids)
    db.session.commit()

    summary = {
        'model_version': MODEL_VERSION,
        'users_analyzed': len(user_ids),
        'events_scored': len(scored),
        'anomalies_detected': len(anomalies),
    }
    return summary, sorted(anomalies, key=lambda r: r.risk_score, reverse=True)


def _persist_analysis(scored):
    """Replace prior AIAnalysis rows for these events, insert the fresh ones.
    Returns {event_id: AIAnalysis} so alerts can link to the analysis."""
    event_ids = [r.event.id for r in scored]
    if event_ids:
        AIAnalysis.query.filter(AIAnalysis.event_id.in_(event_ids)).delete(
            synchronize_session=False)
        db.session.commit()
    by_event = {}
    for r in scored:
        rec = AIAnalysis(
            event_id=r.event.id, user_id=r.event.user_id,
            organization_id=r.event.organization_id,
            risk_score=r.risk_score, status=r.status, confidence=r.confidence,
            explanation=r.explanation, model_version=r.model_version,
            insufficient_data=r.insufficient_data)
        rec.set_features(r.features)
        db.session.add(rec)
        by_event[r.event.id] = rec
    db.session.commit()          # assign ids for linking
    return by_event


def _raise_alerts(anomalies, analysis_by_event):
    """One alert per anomalous event (upsert by event_id). Never downgrades the
    status of an alert an analyst is already working.

    no_autoflush: the lookup/relationship reloads below must not autoflush a
    half-built Alert (severity is NOT NULL and is set further down)."""
    with db.session.no_autoflush:
        for r in anomalies:
            alert = Alert.query.filter_by(event_id=r.event.id).first()
            if alert is None:
                alert = Alert(event_id=r.event.id, user_id=r.event.user_id,
                              organization_id=r.event.organization_id,
                              status=AlertStatus.OPEN)
                db.session.add(alert)
            alert.severity = r.status
            alert.risk_score = r.risk_score
            alert.title = f'{r.status.title()} activity: {r.event.action_type}'
            alert.explanation = r.explanation
            analysis = analysis_by_event.get(r.event.id)
            alert.ai_analysis_id = analysis.id if analysis else None


def _update_risk_scores(user_ids):
    """Roll up each user's OPEN alerts into their current risk level."""
    for uid in user_ids:
        open_alerts = (Alert.query.filter_by(user_id=uid)
                       .filter(Alert.status != AlertStatus.CLOSED).all())
        current = max((a.risk_score for a in open_alerts), default=0.0)

        rs = RiskScore.query.filter_by(user_id=uid).first()
        if rs is None:
            user = User.query.get(uid)
            rs = RiskScore(user_id=uid, organization_id=user.organization_id)
            db.session.add(rs)
        rs.current_score = current
        rs.open_alerts = len(open_alerts)
        if open_alerts:
            rs.last_flagged_at = datetime.utcnow()


# --- Investigation workflow (analyst-driven) --------------------------------
def open_investigation(alert_id, analyst_id):
    alert = Alert.query.get(alert_id)
    if alert is None:
        return None, 'Alert not found'
    investigation = Investigation(
        alert_id=alert.id, analyst_id=analyst_id,
        organization_id=alert.organization_id,
        state=InvestigationState.INVESTIGATING)
    alert.status = AlertStatus.INVESTIGATING
    db.session.add(investigation)
    db.session.commit()
    return investigation, None


def transition_investigation(investigation_id, new_state, notes=None):
    if new_state not in InvestigationState.ALL:
        return None, f'Invalid state: {new_state}'
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    inv.state = new_state
    if notes is not None:
        inv.notes = notes
    if new_state in InvestigationState.TERMINAL:
        inv.closed_at = datetime.utcnow()
        alert = Alert.query.get(inv.alert_id)
        if alert:
            alert.status = AlertStatus.CLOSED
    db.session.commit()
    return inv, None


def high_risk_users(limit=20):
    """Users ranked by current risk — powers the 'High-Risk Users' view."""
    rows = (RiskScore.query.filter(RiskScore.current_score > 0)
            .order_by(RiskScore.current_score.desc()).limit(limit).all())
    result = []
    for rs in rows:
        user = User.query.get(rs.user_id)
        result.append({
            'user_id': rs.user_id,
            'email': user.email if user else None,
            'name': user.get_full_name() if user else None,
            'current_score': rs.current_score,
            'open_alerts': rs.open_alerts,
            'last_flagged_at': rs.last_flagged_at.isoformat() if rs.last_flagged_at else None,
        })
    return result
