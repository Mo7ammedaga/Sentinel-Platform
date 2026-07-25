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


def test_investigation_workflow_closes_alert(client, analyst_headers, app):
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
    assert up.status_code == 200 and up.get_json()['state'] == 'confirmed'
    assert up.get_json()['closed_at'] is not None

    with app.app_context():
        assert Alert.query.get(alert_id).status == 'closed'


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
