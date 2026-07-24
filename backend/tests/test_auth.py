def test_login_success_returns_tokens(client):
    r = client.post('/api/v1/auth/login',
                    json={'email': 'analyst@test.local', 'password': 'pass1234'})
    assert r.status_code == 200
    body = r.get_json()
    assert body['access_token'] and body['refresh_token']
    assert body['user']['role'] == 'analyst'


def test_login_wrong_password(client):
    r = client.post('/api/v1/auth/login',
                    json={'email': 'analyst@test.local', 'password': 'nope'})
    assert r.status_code == 401


def test_login_unknown_email(client):
    r = client.post('/api/v1/auth/login',
                    json={'email': 'ghost@test.local', 'password': 'x'})
    assert r.status_code == 401


def test_protected_requires_token(client):
    assert client.get('/api/v1/auth/profile').status_code == 401


def test_refresh_flow(client):
    tokens = client.post('/api/v1/auth/login',
                         json={'email': 'analyst@test.local', 'password': 'pass1234'}).get_json()
    r = client.post('/api/v1/auth/refresh', json={'refresh_token': tokens['refresh_token']})
    assert r.status_code == 200
    new_access = r.get_json()['access_token']
    assert client.get('/api/v1/auth/profile',
                      headers={'Authorization': f'Bearer {new_access}'}).status_code == 200


def test_refresh_token_rejected_as_access(client):
    tokens = client.post('/api/v1/auth/login',
                         json={'email': 'analyst@test.local', 'password': 'pass1234'}).get_json()
    r = client.get('/api/v1/auth/profile',
                   headers={'Authorization': f"Bearer {tokens['refresh_token']}"})
    assert r.status_code == 401
