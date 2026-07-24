from datetime import datetime, timedelta

from app.extensions import db
from app.models import Event, Alert
from tests.conftest import user_id, ORG


def _event(uid, days_old):
    return Event(user_id=uid, organization_id=ORG, action_type='login',
                 resource_type='user',
                 created_at=datetime.utcnow() - timedelta(days=days_old))


def test_purge_removes_old_but_preserves_alerted(client, admin_headers, app):
    with app.app_context():
        uid = user_id('employee@test.local')
        old = _event(uid, 120)
        recent = _event(uid, 5)
        old_alerted = _event(uid, 120)
        db.session.add_all([old, recent, old_alerted])
        db.session.commit()
        db.session.add(Alert(event_id=old_alerted.id, user_id=uid,
                             organization_id=ORG, severity='critical',
                             risk_score=90.0))
        db.session.commit()
        old_id, recent_id, alerted_id = old.id, recent.id, old_alerted.id

    r = client.post('/api/v1/admin/retention/purge?days=90', headers=admin_headers)
    assert r.status_code == 200
    assert r.get_json()['purged'] >= 1

    with app.app_context():
        assert Event.query.get(old_id) is None            # purged (old, no alert)
        assert Event.query.get(recent_id) is not None      # too recent to purge
        assert Event.query.get(alerted_id) is not None     # preserved: has an alert


def test_retention_is_admin_only(client, analyst_headers, manager_headers):
    assert client.post('/api/v1/admin/retention/purge',
                       headers=analyst_headers).status_code == 403
    assert client.post('/api/v1/admin/retention/purge',
                       headers=manager_headers).status_code == 403
