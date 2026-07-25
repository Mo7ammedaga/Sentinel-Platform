"""Security domain business logic.

Orchestrates the AI analysis pipeline and the alert -> investigation ->
incident-response workflow. Routes call these functions; they never talk to
the AI engine or models directly.
"""
import os
import uuid
from datetime import datetime, timedelta

from flask import current_app
from sqlalchemy import func, case, or_
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models import (
    Event, AIAnalysis, Alert, Investigation, IncidentAction, IncidentEvidence,
    RiskScore, User,
)
from app.ai import analyze_user_events, MODEL_VERSION, MIN_HISTORY
from app.services.notification_service import notify
from app.utils.constants import (
    AlertStatus, InvestigationState, IncidentSeverity, IncidentActionType, Roles,
)


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
    db.session.flush()
    db.session.add(IncidentAction(
        investigation_id=investigation.id, actor_id=analyst_id,
        action_type=IncidentActionType.STATUS_CHANGE,
        description='Investigation opened'))
    db.session.commit()
    return investigation, None


def transition_investigation(investigation_id, actor_id, new_state, notes=None,
                             resolution_summary=None):
    """Move an investigation through its workflow. Confirming a real threat
    (state='confirmed') does NOT close the alert or the case — it opens the
    incident-response phase (Confirmed -> Containing -> Resolved) on the same
    record. Only False Positive and Closed are terminal.
    """
    if new_state not in InvestigationState.ALL:
        return None, f'Invalid state: {new_state}'
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    if inv.state in InvestigationState.TERMINAL:
        return None, f'Investigation is already {inv.state} and cannot be reopened'
    if (new_state == InvestigationState.CLOSED and inv.confirmed_at
            and not (resolution_summary or inv.resolution_summary)):
        return None, 'A resolution summary is required before closing a confirmed incident'

    old_state = inv.state
    inv.state = new_state
    if notes is not None:
        inv.notes = notes
    if resolution_summary is not None:
        inv.resolution_summary = resolution_summary

    now = datetime.utcnow()
    if new_state == InvestigationState.CONFIRMED and inv.confirmed_at is None:
        inv.confirmed_at = now
    if new_state == InvestigationState.RESOLVED and inv.resolved_at is None:
        inv.resolved_at = now
    if new_state in InvestigationState.TERMINAL:
        inv.closed_at = now
        alert = Alert.query.get(inv.alert_id)
        if alert:
            alert.status = AlertStatus.CLOSED

    description = f'Status changed: {old_state} -> {new_state}'
    if notes:
        description += f' — {notes}'
    db.session.add(IncidentAction(
        investigation_id=inv.id, actor_id=actor_id,
        action_type=IncidentActionType.STATUS_CHANGE, description=description))
    db.session.commit()
    return inv, None


def set_severity(investigation_id, severity):
    """Analyst-assigned incident severity — separate from the AI's alert
    severity, and only meaningful once a threat is confirmed."""
    if severity not in IncidentSeverity.ALL:
        return None, f'Invalid severity: {severity}'
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    inv.severity = severity
    db.session.commit()
    return inv, None


def escalate_investigation(investigation_id, actor_id, target_user_id, note=None):
    """Hand a confirmed incident to an administrator. Notifies the target;
    never acts on their behalf (constitution: a human decides what happens next)."""
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    target = User.query.get(target_user_id)
    if target is None or target.organization_id != inv.organization_id:
        return None, 'Target user not found'
    if target.role != Roles.ADMIN:
        return None, 'Incidents can only be escalated to an administrator'

    inv.escalated_to_id = target.id
    inv.escalated_at = datetime.utcnow()
    inv.escalation_note = note
    description = f'Escalated to {target.get_full_name()}'
    if note:
        description += f': {note}'
    db.session.add(IncidentAction(
        investigation_id=inv.id, actor_id=actor_id,
        action_type=IncidentActionType.ESCALATION, description=description))
    notify(target.id, 'incident_escalated', f'Incident #{inv.id} escalated to you',
          body=note or f'An analyst escalated confirmed incident #{inv.id} for your review.',
          link='/incidents')
    db.session.commit()
    return inv, None


def add_incident_action(investigation_id, actor_id, action_type, description):
    if action_type not in IncidentActionType.ANALYST_LOGGABLE:
        return None, f'Invalid action_type: {action_type}'
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    action = IncidentAction(investigation_id=inv.id, actor_id=actor_id,
                            action_type=action_type, description=description)
    db.session.add(action)
    db.session.commit()
    return action, None


def list_incident_actions(investigation_id):
    return (IncidentAction.query.filter_by(investigation_id=investigation_id)
            .order_by(IncidentAction.created_at.asc()).all())


# --- Evidence: REAL disk storage, same discipline as workspace files --------
def _evidence_dir():
    base = current_app.config.get('UPLOAD_FOLDER') or os.path.join(
        current_app.instance_path, 'uploads')
    path = os.path.join(base, 'evidence')
    os.makedirs(path, exist_ok=True)
    return path


def upload_evidence(actor_id, investigation_id, upload, description=None):
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    if upload is None or not upload.filename:
        return None, 'No file provided'

    original_name = secure_filename(upload.filename) or 'evidence'
    ext = os.path.splitext(original_name)[1]
    stored_name = f'{uuid.uuid4().hex}{ext}'
    disk_path = os.path.join(_evidence_dir(), stored_name)
    upload.save(disk_path)
    size = os.path.getsize(disk_path)

    ev = IncidentEvidence(investigation_id=inv.id, filename=original_name,
                          file_path=stored_name, size_bytes=size,
                          description=description, uploaded_by=actor_id)
    db.session.add(ev)
    db.session.flush()
    db.session.add(IncidentAction(
        investigation_id=inv.id, actor_id=actor_id,
        action_type=IncidentActionType.EVIDENCE,
        description=f'Attached evidence "{original_name}"' + (f': {description}' if description else '')))
    db.session.commit()
    return ev, None


def list_evidence(investigation_id):
    return (IncidentEvidence.query.filter_by(investigation_id=investigation_id)
            .order_by(IncidentEvidence.created_at.desc()).all())


def get_evidence_for_download(evidence_id):
    ev = IncidentEvidence.query.get(evidence_id)
    if ev is None:
        return None, None, 'Evidence not found'
    disk_path = os.path.join(_evidence_dir(), ev.file_path)
    if not os.path.isfile(disk_path):
        return None, None, 'Evidence content not found on server'
    return ev, disk_path, None


def get_investigation_detail(investigation_id):
    """Full case file: the investigation, its alert, the subject user, the
    analyst, escalation target (if any), and the complete action + evidence
    audit trail — everything the Incident Response view needs in one call."""
    inv = Investigation.query.get(investigation_id)
    if inv is None:
        return None, 'Investigation not found'
    alert = Alert.query.get(inv.alert_id)
    subject = User.query.get(alert.user_id) if alert else None
    analyst = User.query.get(inv.analyst_id) if inv.analyst_id else None
    escalated_to = User.query.get(inv.escalated_to_id) if inv.escalated_to_id else None

    actions = list_incident_actions(inv.id)
    evidence = list_evidence(inv.id)
    actor_ids = {a.actor_id for a in actions} | {e.uploaded_by for e in evidence}
    actors = {u.id: u.get_full_name() for u in User.query.filter(User.id.in_(actor_ids)).all()} \
        if actor_ids else {}

    d = inv.to_dict()
    d['alert'] = alert.to_dict() if alert else None
    d['subject_user'] = ({'id': subject.id, 'name': subject.get_full_name(),
                          'email': subject.email} if subject else None)
    d['analyst'] = {'id': analyst.id, 'name': analyst.get_full_name()} if analyst else None
    d['escalated_to'] = ({'id': escalated_to.id, 'name': escalated_to.get_full_name()}
                         if escalated_to else None)
    d['actions'] = [{**a.to_dict(), 'actor_name': actors.get(a.actor_id)} for a in actions]
    d['evidence'] = [{**e.to_dict(), 'uploaded_by_name': actors.get(e.uploaded_by)} for e in evidence]
    return d, None


def list_incidents(org_id, state=None):
    """Confirmed cases only (an investigation that never reached a confirmed
    verdict isn't an incident) — the SOC's case-management view, distinct from
    the raw Alerts inbox."""
    query = Investigation.query.filter(
        Investigation.organization_id == org_id,
        Investigation.confirmed_at.isnot(None))
    if state:
        query = query.filter_by(state=state)
    incidents = query.order_by(Investigation.confirmed_at.desc()).all()

    result = []
    for inv in incidents:
        alert = Alert.query.get(inv.alert_id)
        subject = User.query.get(alert.user_id) if alert else None
        d = inv.to_dict()
        d['alert_title'] = alert.title if alert else None
        d['subject_user_id'] = subject.id if subject else None
        d['subject_name'] = subject.get_full_name() if subject else None
        result.append(d)
    return result


def list_org_admins(org_id, exclude_user_id=None):
    """Admins in the org — the only valid escalation targets."""
    q = User.query.filter_by(organization_id=org_id, role=Roles.ADMIN)
    if exclude_user_id:
        q = q.filter(User.id != exclude_user_id)
    return [{'id': u.id, 'name': u.get_full_name(), 'email': u.email} for u in q.all()]


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
    # A "confirmed" verdict is tracked via confirmed_at, not the current
    # state — a confirmed incident keeps moving (Containing -> Resolved ->
    # Closed), so matching on state == 'confirmed' alone would undercount
    # every incident that has since progressed past that first state.
    rows = (
        db.session.query(Investigation.confirmed_at, AIAnalysis.model_version)
        .join(Alert, Investigation.alert_id == Alert.id)
        .outerjoin(AIAnalysis, Alert.ai_analysis_id == AIAnalysis.id)
        .filter(Investigation.organization_id == org_id,
                or_(Investigation.confirmed_at.isnot(None),
                    Investigation.state == InvestigationState.FALSE_POSITIVE))
        .all()
    )
    by_version = {}
    for confirmed_at, version in rows:
        v = by_version.setdefault(version or 'unknown',
                                  {'confirmed': 0, 'false_positive': 0})
        key = 'confirmed' if confirmed_at is not None else 'false_positive'
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
