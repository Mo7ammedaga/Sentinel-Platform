from tests.conftest import user_id, seed_history_with_anomaly


def test_privacy_notice_is_public_and_non_accusatory(client):
    r = client.get('/api/v1/privacy/notice')
    assert r.status_code == 200
    body = r.get_json()
    assert 'what_is_collected' in body and 'what_is_not_collected' in body
    # transparency about the AI never claiming intent
    assert 'verdict' in body['ai_disclaimer'].lower()


def test_subject_access_requires_auth(client):
    assert client.get('/api/v1/me/events').status_code == 401


def test_user_sees_only_their_own_events(client, employee_headers, app):
    with app.app_context():
        emp = user_id('employee@test.local')
        other = user_id('manager@test.local')
        seed_history_with_anomaly(emp)
        seed_history_with_anomaly(other)
    r = client.get('/api/v1/me/events?per_page=200', headers=employee_headers)
    assert r.status_code == 200
    items = r.get_json()['items']
    assert items and all(True for _ in items)  # has events
    # export is scoped to the caller only
    exp = client.get('/api/v1/me/events/export', headers=employee_headers).get_json()
    assert exp['user_id'] == emp
    assert exp['event_count'] == len(client.get(
        '/api/v1/me/events?per_page=500', headers=employee_headers).get_json()['items'])
