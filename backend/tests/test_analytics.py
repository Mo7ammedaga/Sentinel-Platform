"""Analyst feedback loop (model-performance) and risk-trend analytics."""
from tests.conftest import user_id, seed_history_with_anomaly


def _confirm_one_alert(client, analyst_headers, state='confirmed'):
    client.post('/api/v1/ai/analyze', headers=analyst_headers)
    alert_id = client.get('/api/v1/security/alerts',
                          headers=analyst_headers).get_json()['alerts'][0]['id']
    inv = client.post(f'/api/v1/security/alerts/{alert_id}/investigations',
                      headers=analyst_headers).get_json()
    client.patch(f"/api/v1/security/investigations/{inv['id']}",
                headers=analyst_headers, json={'state': state})


def test_model_performance_starts_empty(client, analyst_headers):
    r = client.get('/api/v1/security/model-performance', headers=analyst_headers)
    assert r.status_code == 200
    body = r.get_json()
    assert body['overall']['total_reviewed'] == 0
    assert body['overall']['confirmed_rate'] is None


def test_model_performance_tracks_confirmed_verdict(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    _confirm_one_alert(client, analyst_headers, state='confirmed')

    r = client.get('/api/v1/security/model-performance', headers=analyst_headers)
    body = r.get_json()
    assert body['overall']['total_reviewed'] == 1
    assert body['overall']['confirmed'] == 1
    assert body['overall']['confirmed_rate'] == 1.0
    assert len(body['by_model_version']) == 1
    assert body['by_model_version'][0]['confirmed'] == 1


def test_model_performance_tracks_false_positive_verdict(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    _confirm_one_alert(client, analyst_headers, state='false_positive')

    body = client.get('/api/v1/security/model-performance',
                      headers=analyst_headers).get_json()
    assert body['overall']['false_positive'] == 1
    assert body['overall']['confirmed_rate'] == 0.0


def test_risk_trend_reflects_scored_events(client, analyst_headers, app):
    with app.app_context():
        seed_history_with_anomaly(user_id('employee@test.local'))
    client.post('/api/v1/ai/analyze', headers=analyst_headers)

    r = client.get('/api/v1/security/risk-trend?days=7', headers=analyst_headers)
    assert r.status_code == 200
    body = r.get_json()
    assert body['days'] == 7
    assert len(body['trend']) >= 1
    today = body['trend'][-1]
    assert today['critical'] + today['suspicious'] >= 1


def test_analytics_endpoints_are_analyst_only(client, employee_headers):
    assert client.get('/api/v1/security/model-performance',
                      headers=employee_headers).status_code == 403
    assert client.get('/api/v1/security/risk-trend',
                      headers=employee_headers).status_code == 403
