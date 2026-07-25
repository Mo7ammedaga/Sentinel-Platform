"""Security domain business logic.

Orchestrates the AI analysis pipeline and the alert -> investigation workflow.
Routes call these functions; they never talk to the AI engine or models directly.
"""
from datetime import datetime, timedelta

from sqlalchemy import func, case

from app.extensions import db
from app.models import (
    Event, AIAnalysis, Alert, Investigation, RiskScore, User,
)
from app.ai import analyze_user_events, MODEL_VERSION, MIN_HISTORY
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


def list_alerts(status=None, limit=100):
    """Alerts newest-first, enriched with WHO triggered them — an analyst
    cannot investigate a bare user_id."""
    query = Alert.query
    if status:
        query = query.filter_by(status=status)
    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()

    user_ids = {a.user_id for a in alerts}
    users = {u.id: u for u in User.query.filter(User.id.in_(user_ids)).all()} if user_ids else {}

    result = []
    for a in alerts:
        d = a.to_dict()
        user = users.get(a.user_id)
        d['user_email'] = user.email if user else None
        d['user_name'] = user.get_full_name() if user else None
        result.append(d)
    return result


# --- Investigation workflow (analyst-driven) --------------------------------
def open_investigation(alert_id, analyst_id):
    alert = Alert.query.get(alert_id)
    if alert is None:
        return None, 'Alert not found'
    existing = Investigation.query.filter_by(
        alert_id=alert_id, state=InvestigationState.INVESTIGATING).first()
    if existing:
        return existing, None    # idempotent: don't spawn a duplicate
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


def baseline_coverage(org_id):
    """Per-user event counts vs the AI's minimum baseline (MIN_HISTORY).

    A user below the threshold NEVER produces an alert, no matter how they
    behave — analyze_user_events() forces 'insufficient_data' -> status
    'normal'. Without this, an analyst has no way to tell "this person is
    behaving normally" apart from "the AI hasn't seen enough of them yet" —
    they just see nothing in Alerts. Least-covered users first.
    """
    users = User.query.filter_by(organization_id=org_id).all()
    if not users:
        return []
    user_ids = [u.id for u in users]
    counts = dict(
        db.session.query(Event.user_id, db.func.count(Event.id))
        .filter(Event.user_id.in_(user_ids))
        .group_by(Event.user_id).all()
    )
    result = [{
        'user_id': u.id, 'email': u.email, 'name': u.get_full_name(),
        'role': u.role, 'event_count': counts.get(u.id, 0),
        'required': MIN_HISTORY, 'ready': counts.get(u.id, 0) >= MIN_HISTORY,
    } for u in users]
    result.sort(key=lambda r: r['event_count'])
    return result


def model_performance(org_id):
    """The analyst feedback loop, made visible: for every alert an analyst has
    reached a final verdict on (confirmed / false_positive), compare that
    verdict against the model version that raised it. This is how the AI's
    real-world accuracy is tracked over time -- an analyst's own investigation
    outcomes ARE the feedback; nothing new to log, we just surface it.
    """
    rows = (
        db.session.query(Investigation.state, AIAnalysis.model_version)
        .join(Alert, Investigation.alert_id == Alert.id)
        .outerjoin(AIAnalysis, Alert.ai_analysis_id == AIAnalysis.id)
        .filter(Investigation.organization_id == org_id,
                Investigation.state.in_(
                    [InvestigationState.CONFIRMED, InvestigationState.FALSE_POSITIVE]))
        .all()
    )
    by_version = {}
    for state, version in rows:
        v = by_version.setdefault(version or 'unknown',
                                  {'confirmed': 0, 'false_positive': 0})
        key = 'confirmed' if state == InvestigationState.CONFIRMED else 'false_positive'
        v[key] += 1

    by_model_version = []
    for version, counts in sorted(by_version.items()):
        total = counts['confirmed'] + counts['false_positive']
        by_model_version.append({
            'model_version': version,
            'confirmed': counts['confirmed'],
            'false_positive': counts['false_positive'],
            'total_reviewed': total,
            'confirmed_rate': round(counts['confirmed'] / total, 3) if total else None,
        })

    total_confirmed = sum(v['confirmed'] for v in by_version.values())
    total_fp = sum(v['false_positive'] for v in by_version.values())
    total = total_confirmed + total_fp
    overall = {
        'total_reviewed': total,
        'confirmed': total_confirmed,
        'false_positive': total_fp,
        'confirmed_rate': round(total_confirmed / total, 3) if total else None,
    }
    return {'overall': overall, 'by_model_version': by_model_version}


def risk_trend(org_id, days=14):
    """Daily risk trend: average AI risk score and critical/suspicious counts,
    bucketed by the day the EVENT happened (not when it was analyzed) so the
    chart reflects real behaviour timing, not when 'Run analysis' was clicked.
    """
    cutoff = datetime.utcnow() - timedelta(days=days)
    day = func.date(Event.created_at)
    rows = (
        db.session.query(
            day.label('day'),
            func.avg(AIAnalysis.risk_score).label('avg_risk'),
            func.sum(case((AIAnalysis.status == 'critical', 1), else_=0)).label('critical'),
            func.sum(case((AIAnalysis.status == 'suspicious', 1), else_=0)).label('suspicious'),
        )
        .join(Event, AIAnalysis.event_id == Event.id)
        .filter(AIAnalysis.organization_id == org_id, Event.created_at >= cutoff)
        .group_by(day)
        .order_by(day)
        .all()
    )
    return [{
        'date': str(r.day),
        'avg_risk': round(r.avg_risk, 1) if r.avg_risk is not None else 0,
        'critical': int(r.critical or 0),
        'suspicious': int(r.suspicious or 0),
    } for r in rows]


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
