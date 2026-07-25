import io

from app.models import Alert
from tests.conftest import user_id, seed_history_with_anomaly


def test_analyze_raises_alerts_and_risk(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    r = client.post('/api/v1/ai/analyze', headers=analyst_headers)
    assert r.status_code == 200
    assert r.get_json()['anomalies_detected'] >= 1

    alerts = client.get('/api/v1/security/alerts', headers=analyst_headers).get_json()
    assert alerts['count'] >= 1
    hr = client.get('/api/v1/security/high-risk-users', headers=analyst_headers).get_json()
    assert len(hr['users']) >= 1


def test_baseline_coverage_shows_insufficient_history(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))  # >= 50 events
    r = client.get('/api/v1/security/baseline-coverage', headers=analyst_headers)
    assert r.status_code == 200
    users = r.get_json()['users']
    by_role = {u['role']: u for u in users}
    assert by_role['employee']['ready'] is True          # has enough history
    assert by_role['manager']['ready'] is False           # no events seeded
    assert by_role['manager']['event_count'] == 0
    assert by_role['manager']['required'] == 50


def test_security_endpoints_are_analyst_only(client, employee_headers):
    assert client.get('/api/v1/security/alerts', headers=employee_headers).status_code == 403
    assert client.post('/api/v1/ai/analyze', headers=employee_headers).status_code == 403


def test_confirming_opens_incident_response_without_closing(client, analyst_headers, app):
    """Confirming a real threat starts the response phase — it must NOT close
    the case or the alert. Only a terminal verdict (false_positive/closed) does."""
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alerts = client.get('/api/v1/security/alerts', headers=analyst_headers).get_json()['alerts']
    alert_id = alerts[0]['id']

    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    assert inv['state'] == 'investigating'

    up = client.patch(f"/api/v1/security/investigations/{inv['id']}",
                      headers=analyst_headers,
                      json={'state': 'confirmed', 'notes': 'reviewed'})
    body = up.get_json()
    assert up.status_code == 200 and body['state'] == 'confirmed'
    assert body['confirmed_at'] is not None
    assert body['closed_at'] is None                # case stays open

    with app.app_context():
        assert Alert.query.get(alert_id).status == 'investigating'  # not closed


def test_closing_confirmed_incident_requires_resolution_summary(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']
    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    client.patch(f"/api/v1/security/investigations/{inv['id']}",
                headers=analyst_headers, json={'state': 'confirmed'})

    blocked = client.patch(f"/api/v1/security/investigations/{inv['id']}",
                           headers=analyst_headers, json={'state': 'closed'})
    assert blocked.status_code == 400

    closed = client.patch(f"/api/v1/security/investigations/{inv['id']}",
                          headers=analyst_headers,
                          json={'state': 'closed', 'resolution_summary': 'Access revoked, user retrained.'})
    assert closed.status_code == 200
    assert closed.get_json()['closed_at'] is not None

    with app.app_context():
        assert Alert.query.get(alert_id).status == 'closed'


def test_terminal_investigation_cannot_be_reopened(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']
    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    client.patch(f"/api/v1/security/investigations/{inv['id']}",
                headers=analyst_headers, json={'state': 'false_positive'})

    r = client.patch(f"/api/v1/security/investigations/{inv['id']}",
                     headers=analyst_headers, json={'state': 'investigating'})
    assert r.status_code == 400


def test_incident_response_workflow(client, analyst_headers, admin_headers, app):
    """Severity, escalation, containment/remediation actions and evidence all
    attach to the confirmed incident and show up in its case file."""
    with app.app_context():
        eid = user_id('employee@test.local')
        admin_id = user_id('admin@test.local')
        seed_history_with_anomaly(eid)
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']
    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    client.patch(f"/api/v1/security/investigations/{inv['id']}",
                headers=analyst_headers, json={'state': 'confirmed'})

    sev = client.post(f"/api/v1/security/investigations/{inv['id']}/severity",
                      headers=analyst_headers, json={'severity': 'high'})
    assert sev.status_code == 200 and sev.get_json()['severity'] == 'high'

    esc = client.post(f"/api/v1/security/investigations/{inv['id']}/escalate",
                      headers=analyst_headers,
                      json={'to_user_id': admin_id, 'note': 'Needs HR involvement'})
    assert esc.status_code == 200
    assert esc.get_json()['escalated_to_id'] == admin_id

    action = client.post(f"/api/v1/security/investigations/{inv['id']}/actions",
                         headers=analyst_headers,
                         json={'action_type': 'containment', 'description': 'Disabled account access'})
    assert action.status_code == 201

    bad_action = client.post(f"/api/v1/security/investigations/{inv['id']}/actions",
                             headers=analyst_headers,
                             json={'action_type': 'escalation', 'description': 'nope'})
    assert bad_action.status_code == 422   # not an analyst-loggable type

    ev = client.post(f"/api/v1/security/investigations/{inv['id']}/evidence",
                     headers=analyst_headers,
                     data={'file': (io.BytesIO(b'log excerpt'), 'evidence.txt'),
                           'description': 'Suspicious download log'},
                     content_type='multipart/form-data')
    assert ev.status_code == 201

    detail = client.get(f"/api/v1/security/investigations/{inv['id']}",
                        headers=analyst_headers).get_json()
    assert detail['severity'] == 'high'
    assert detail['escalated_to']['id'] == admin_id
    assert len(detail['evidence']) == 1
    action_types = [a['action_type'] for a in detail['actions']]
    assert 'containment' in action_types and 'escalation' in action_types and 'evidence' in action_types

    incidents = client.get('/api/v1/security/incidents', headers=analyst_headers).get_json()
    assert incidents['count'] >= 1

    admins = client.get('/api/v1/security/admins', headers=analyst_headers).get_json()
    assert any(a['id'] == admin_id for a in admins['admins'])

    non_admin_escalate = client.post(f"/api/v1/security/investigations/{inv['id']}/escalate",
                                     headers=analyst_headers,
                                     json={'to_user_id': eid})
    assert non_admin_escalate.status_code == 400


def test_opening_investigation_twice_does_not_duplicate(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']

    first = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                        headers=analyst_headers).get_json()
    second = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                         headers=analyst_headers).get_json()
    assert first['id'] == second['id']       # same investigation, not a duplicate

    with app.app_context():
        from app.models import Investigation
        assert Investigation.query.filter_by(alert_id=alert_id).count() == 1


def test_invalid_investigation_state_rejected(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']
    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    r = client.patch(f"/api/v1/security/investigations/{inv['id']}",
                     headers=analyst_headers, json={'state': 'banana'})
    assert r.status_code == 400
