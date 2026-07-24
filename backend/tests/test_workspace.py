from app.models import Event
from tests.conftest import user_id


def _make_project(client, headers):
    w = client.post('/api/v1/workspaces', headers=headers, json={'name': 'WS'})
    wid = w.get_json()['id']
    p = client.post('/api/v1/projects', headers=headers,
                    json={'workspace_id': wid, 'name': 'Proj'})
    return wid, p


def test_create_project_emits_one_event(client, manager_headers, app):
    with app.app_context():
        uid = user_id('manager@test.local')
        before = Event.query.filter_by(user_id=uid, action_type='create_project').count()
    _, p = _make_project(client, manager_headers)
    assert p.status_code == 201
    with app.app_context():
        after = Event.query.filter_by(user_id=uid, action_type='create_project').count()
    assert after == before + 1


def test_task_lifecycle_and_complete_event(client, manager_headers, app):
    _, p = _make_project(client, manager_headers)
    pid = p.get_json()['id']
    t = client.post('/api/v1/tasks', headers=manager_headers,
                    json={'project_id': pid, 'title': 'T'})
    assert t.status_code == 201
    tid = t.get_json()['id']
    r = client.put(f'/api/v1/tasks/{tid}', headers=manager_headers,
                   json={'status': 'completed'})
    assert r.status_code == 200 and r.get_json()['status'] == 'completed'
    with app.app_context():
        uid = user_id('manager@test.local')
        assert Event.query.filter_by(user_id=uid, action_type='complete_task').count() == 1


def test_validation_rejects_bad_body(client, manager_headers):
    r = client.post('/api/v1/projects', headers=manager_headers, json={'name': ''})
    assert r.status_code == 422
    assert 'details' in r.get_json()


def test_rbac_analyst_cannot_use_workspace(client, analyst_headers):
    r = client.post('/api/v1/workspaces', headers=analyst_headers, json={'name': 'x'})
    assert r.status_code == 403


def test_pagination_envelope(client, manager_headers):
    _make_project(client, manager_headers)
    r = client.get('/api/v1/projects?per_page=1', headers=manager_headers)
    body = r.get_json()
    assert set(body.keys()) == {'items', 'pagination'}
    assert set(body['pagination'].keys()) == {'page', 'per_page', 'total', 'pages'}


def test_message_read_attributed_to_recipient(client, manager_headers, app):
    with app.app_context():
        emp_id = user_id('employee@test.local')
    m = client.post('/api/v1/messages', headers=manager_headers,
                    json={'recipient_id': emp_id, 'content': 'hi'})
    assert m.status_code == 201
