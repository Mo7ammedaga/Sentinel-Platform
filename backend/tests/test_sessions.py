"""Session / device management: listing, revocation, refresh enforcement."""
from app.utils.auth import TokenManager
from tests.conftest import user_id, PASSWORD


def _login(client, ua='TestAgent/1.0'):
    return client.post('/api/v1/auth/login',
                       headers={'User-Agent': ua},
                       json={'email': 'manager@test.local', 'password': PASSWORD})


def test_login_creates_a_listed_current_session(client):
    tokens = _login(client, ua='DeviceOne').get_json()
    headers = {'Authorization': f"Bearer {tokens['access_token']}"}

    r = client.get('/api/v1/auth/sessions', headers=headers)
    assert r.status_code == 200
    sessions = r.get_json()['sessions']
    assert len(sessions) == 1
    assert sessions[0]['is_current'] is True
    assert sessions[0]['device']   # non-empty device label


def test_register_also_creates_a_session(client):
    reg = client.post('/api/v1/auth/register', json={
        'email': 'newdevice@example.com', 'password': 'strongpass1',
        'first_name': 'N', 'last_name': 'D'}).get_json()
    headers = {'Authorization': f"Bearer {reg['access_token']}"}
    sessions = client.get('/api/v1/auth/sessions', headers=headers).get_json()['sessions']
    assert len(sessions) == 1


def test_multiple_logins_create_multiple_sessions(client):
    t1 = _login(client, ua='Laptop').get_json()
    t2 = _login(client, ua='Phone').get_json()
    headers = {'Authorization': f"Bearer {t2['access_token']}"}

    sessions = client.get('/api/v1/auth/sessions', headers=headers).get_json()['sessions']
    assert len(sessions) == 2
    # only the token used for THIS request is marked current
    current = [s for s in sessions if s['is_current']]
    assert len(current) == 1

    # sanity: the other token pair is unused here, but was captured to prove
    # two independent sessions really were created
    assert t1['refresh_token'] != t2['refresh_token']


def test_revoking_a_session_blocks_its_future_refresh(client):
    tokens = _login(client).get_json()
    headers = {'Authorization': f"Bearer {tokens['access_token']}"}
    session_id = client.get('/api/v1/auth/sessions',
                            headers=headers).get_json()['sessions'][0]['id']

    revoke = client.delete(f'/api/v1/auth/sessions/{session_id}', headers=headers)
    assert revoke.status_code == 200

    refreshed = client.post('/api/v1/auth/refresh',
                            json={'refresh_token': tokens['refresh_token']})
    assert refreshed.status_code == 401
    assert 'signed out' in refreshed.get_json()['error'].lower()


def test_cannot_revoke_someone_elses_session(client, employee_headers):
    tokens = _login(client).get_json()   # manager's session
    manager_headers = {'Authorization': f"Bearer {tokens['access_token']}"}
    session_id = client.get('/api/v1/auth/sessions',
                            headers=manager_headers).get_json()['sessions'][0]['id']

    r = client.delete(f'/api/v1/auth/sessions/{session_id}', headers=employee_headers)
    assert r.status_code == 404
    # still listed for the actual owner -> proves it was NOT revoked
    still_there = client.get('/api/v1/auth/sessions', headers=manager_headers).get_json()['sessions']
    assert any(s['id'] == session_id for s in still_there)


def test_logout_revokes_the_current_session(client):
    """Logout must be a real server-side sign-out — not just deleting tokens
    client-side — otherwise a leaked refresh token stays valid forever."""
    tokens = _login(client).get_json()
    headers = {'Authorization': f"Bearer {tokens['access_token']}"}

    out = client.post('/api/v1/auth/logout', headers=headers)
    assert out.status_code == 200

    refreshed = client.post('/api/v1/auth/refresh',
                            json={'refresh_token': tokens['refresh_token']})
    assert refreshed.status_code == 401


def test_logout_without_a_session_jti_is_a_safe_no_op(client, app):
    """A legacy access token with no sid must not error on logout."""
    with app.app_context():
        uid = user_id('manager@test.local')
        legacy_access = TokenManager.generate_token(uid, 'manager@test.local', 'manager')
    headers = {'Authorization': f'Bearer {legacy_access}'}
    r = client.post('/api/v1/auth/logout', headers=headers)
    assert r.status_code == 200


def test_refresh_still_works_for_tokens_issued_before_this_feature(client, app):
    """Backward compatibility: a refresh token with no 'jti' (as every token
    was, before session tracking existed) must keep working."""
    with app.app_context():
        uid = user_id('manager@test.local')
        legacy_refresh = TokenManager.generate_refresh_token(uid)  # no jti
    r = client.post('/api/v1/auth/refresh', json={'refresh_token': legacy_refresh})
    assert r.status_code == 200
    assert r.get_json()['access_token']
