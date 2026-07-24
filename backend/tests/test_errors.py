def test_unknown_route_is_consistent_404(client):
    r = client.get('/api/v1/does-not-exist')
    assert r.status_code == 404
    assert 'error' in r.get_json()


def test_method_not_allowed_is_405(client, manager_headers):
    r = client.patch('/api/v1/projects', headers=manager_headers)
    assert r.status_code == 405
    assert r.get_json()['error']


def test_validation_error_shape(client, manager_headers):
    r = client.post('/api/v1/tasks', headers=manager_headers,
                    json={'project_id': 1, 'title': 'T', 'priority': 'urgent'})
    assert r.status_code == 422
    body = r.get_json()
    assert body['error'] == 'Validation failed'
    assert body['details'][0]['field'] == 'priority'


def test_security_headers_present(client):
    r = client.get('/')
    assert r.headers['X-Content-Type-Options'] == 'nosniff'
    assert r.headers['X-Frame-Options'] == 'DENY'
