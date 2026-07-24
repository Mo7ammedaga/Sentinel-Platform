"""Privacy / compliance logic (Phase E — because real people are monitored).

Covers transparency (what is collected) and subject access (a user can see and
export their own event history). Retention/purging (E3) is intentionally left as
a documented follow-up: it must cascade AIAnalysis and preserve anything under
an open Alert/Investigation, which is a policy decision of its own.
"""
from app.models import Event

RETENTION_DAYS = 90

MONITORING_NOTICE = {
    'purpose': ("Detect behaviour that is unusual relative to each user's own "
                "baseline, to protect the organization from insider threats."),
    'what_is_collected': [
        'Authentication events (login, failed login, logout).',
        'Workspace actions: create/update/delete of projects, tasks, notes.',
        'File activity: upload, download, delete (metadata, not file contents).',
        'Messaging metadata: sender, recipient, timestamp (not analyzed content).',
        'Technical context: IP address, user agent, timestamp.',
    ],
    'what_is_not_collected': [
        'Passwords are stored only as bcrypt hashes — never in events.',
        'No keystroke logging, screen capture, or access to personal accounts.',
        'Message and file contents are not used as AI features.',
    ],
    'ai_disclaimer': ("The AI flags behaviour that is UNUSUAL for a user; it does "
                      "not determine intent or guilt. A human analyst reviews every "
                      "alert and makes the decision. A score is never a verdict."),
    'your_rights': [
        'View your own event history: GET /api/v1/me/events',
        'Export your own event history: GET /api/v1/me/events/export',
    ],
    'retention_days': RETENTION_DAYS,
}


def _serialize(e):
    return {
        'id': e.id,
        'action_type': e.action_type,
        'resource_type': e.resource_type,
        'resource_id': e.resource_id,
        'description': e.description,
        'ip_address': e.ip_address,
        'status': e.status,
        'risk_score': e.risk_score,
        'created_at': e.created_at.isoformat() if e.created_at else None,
    }


def own_events_query(user_id):
    return Event.query.filter_by(user_id=user_id).order_by(Event.created_at.desc())


def export_own_events(user_id):
    events = own_events_query(user_id).all()
    return {
        'user_id': user_id,
        'event_count': len(events),
        'events': [_serialize(e) for e in events],
    }
