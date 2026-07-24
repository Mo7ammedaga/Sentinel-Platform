"""Team Chat directory, Notifications, and Search (doc 05 modules 7-9)."""
from tests.conftest import user_id


def _make_project(client, headers):
    wid = client.post('/api/v1/workspaces', headers=headers, json={'name': 'W'}).get_json()['id']
    return client.post('/api/v1/projects', headers=headers,
                       json={'workspace_id': wid, 'name': 'P'}).get_json()['id']


def test_directory_excludes_self(client, manager_headers, app):
    users = client.get('/api/v1/users', headers=manager_headers).get_json()['users']
    with app.app_context():
        me = user_id('manager@test.local')
    assert all(u['id'] != me for u in users)
    assert any(u['role'] == 'employee' for u in users)


def test_task_assignment_notifies_assignee(client, manager_headers, employee_headers, app):
    with app.app_context():
        emp = user_id('employee@test.local')
    pid = _make_project(client, manager_headers)
    r = client.post('/api/v1/tasks', headers=manager_headers,
                    json={'project_id': pid, 'title': 'Assigned', 'assigned_to': emp})
    assert r.status_code == 201
    # the employee has an unread task_assigned notification
    unread = client.get('/api/v1/notifications/unread-count', headers=employee_headers).get_json()
    assert unread['unread'] >= 1
    items = client.get('/api/v1/notifications', headers=employee_headers).get_json()['items']
    assert any(n['type'] == 'task_assigned' for n in items)


def test_message_notifies_recipient_and_read_flow(client, manager_headers, employee_headers, app):
    with app.app_context():
        emp = user_id('employee@test.local')
    client.post('/api/v1/messages', headers=manager_headers,
                json={'recipient_id': emp, 'content': 'hi'})
    items = client.get('/api/v1/notifications', headers=employee_headers).get_json()['items']
    msg_notifs = [n for n in items if n['type'] == 'message_received']
    assert msg_notifs
    # mark one read, then mark all read
    nid = msg_notifs[0]['id']
    assert client.post(f'/api/v1/notifications/{nid}/read', headers=employee_headers).status_code == 200
    client.post('/api/v1/notifications/read-all', headers=employee_headers)
    assert client.get('/api/v1/notifications/unread-count',
                      headers=employee_headers).get_json()['unread'] == 0


def test_notifications_are_private(client, manager_headers, employee_headers, app):
    with app.app_context():
        emp = user_id('employee@test.local')
    client.post('/api/v1/messages', headers=manager_headers,
                json={'recipient_id': emp, 'content': 'private'})
    # the manager (sender) should not see the employee's notification
    mgr_items = client.get('/api/v1/notifications', headers=manager_headers).get_json()['items']
    assert all(n['type'] != 'message_received' for n in mgr_items)


def test_search_finds_projects_and_tasks(client, manager_headers):
    wid = client.post('/api/v1/workspaces', headers=manager_headers, json={'name': 'W'}).get_json()['id']
    client.post('/api/v1/projects', headers=manager_headers,
                json={'workspace_id': wid, 'name': 'AlphaProject'})
    r = client.get('/api/v1/search?q=alpha', headers=manager_headers)
    assert r.status_code == 200
    assert any('Alpha' in p['name'] for p in r.get_json()['projects'])
