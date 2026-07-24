def test_register_creates_employee_and_logs_in(client):
    r = client.post('/api/v1/auth/register', json={
        'email': 'New.Person@example.com', 'password': 'strongpass1',
        'first_name': 'New', 'last_name': 'Person'})
    assert r.status_code == 201
    body = r.get_json()
    assert body['user']['role'] == 'employee'          # forced, never elevated
    assert body['access_token'] and body['refresh_token']
    # email is normalized to lowercase
    assert body['user']['email'] == 'new.person@example.com'
    # the new account can log in
    assert client.post('/api/v1/auth/login', json={
        'email': 'new.person@example.com', 'password': 'strongpass1'}).status_code == 200


def test_register_cannot_self_assign_role(client):
    r = client.post('/api/v1/auth/register', json={
        'email': 'sneaky@example.com', 'password': 'strongpass1',
        'first_name': 'S', 'last_name': 'N', 'role': 'admin'})
    assert r.status_code == 201
    assert r.get_json()['user']['role'] == 'employee'   # 'role' in body is ignored


def test_register_rejects_duplicate_email(client):
    payload = {'email': 'dup@example.com', 'password': 'strongpass1',
               'first_name': 'D', 'last_name': 'U'}
    assert client.post('/api/v1/auth/register', json=payload).status_code == 201
    assert client.post('/api/v1/auth/register', json=payload).status_code == 409


def test_register_validates_input(client):
    weak = client.post('/api/v1/auth/register', json={
        'email': 'a@b.com', 'password': 'short', 'first_name': 'A', 'last_name': 'B'})
    assert weak.status_code == 422
    bad_email = client.post('/api/v1/auth/register', json={
        'email': 'not-an-email', 'password': 'strongpass1',
        'first_name': 'A', 'last_name': 'B'})
    assert bad_email.status_code == 422


def test_admin_can_assign_roles(client, admin_headers):
    reg = client.post('/api/v1/auth/register', json={
        'email': 'promote@example.com', 'password': 'strongpass1',
        'first_name': 'P', 'last_name': 'R'}).get_json()
    uid = reg['user']['id']
    r = client.patch(f'/api/v1/admin/users/{uid}/role',
                     headers=admin_headers, json={'role': 'analyst'})
    assert r.status_code == 200 and r.get_json()['role'] == 'analyst'
    # invalid role rejected
    assert client.patch(f'/api/v1/admin/users/{uid}/role',
                        headers=admin_headers, json={'role': 'king'}).status_code == 422


def test_role_management_is_admin_only(client, analyst_headers):
    assert client.get('/api/v1/admin/users', headers=analyst_headers).status_code == 403
    assert client.patch('/api/v1/admin/users/1/role',
                        headers=analyst_headers, json={'role': 'admin'}).status_code == 403


def test_admin_cannot_change_own_role(client, admin_headers, app):
    from tests.conftest import user_id
    with app.app_context():
        me = user_id('admin@test.local')
    r = client.patch(f'/api/v1/admin/users/{me}/role',
                     headers=admin_headers, json={'role': 'employee'})
    assert r.status_code == 400
