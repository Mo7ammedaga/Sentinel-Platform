"""Profile update, password change, and avatar upload/serve."""
import io


def test_get_profile_includes_bio_and_avatar_url(client, manager_headers):
    r = client.get('/api/v1/auth/profile', headers=manager_headers)
    assert r.status_code == 200
    user = r.get_json()['user']
    assert 'bio' in user and 'avatar_url' in user
    assert user['avatar_url'] is None      # no avatar uploaded yet


def test_update_profile_name_and_bio(client, manager_headers):
    r = client.patch('/api/v1/auth/profile', headers=manager_headers,
                     json={'first_name': 'Renamed', 'bio': 'Hello team.'})
    assert r.status_code == 200
    user = r.get_json()['user']
    assert user['first_name'] == 'Renamed'
    assert user['bio'] == 'Hello team.'
    # email/role are not editable via this endpoint
    assert user['role'] == 'manager'


def test_update_profile_rejects_empty_name(client, manager_headers):
    r = client.patch('/api/v1/auth/profile', headers=manager_headers,
                     json={'first_name': ''})
    assert r.status_code == 422


def test_change_password_flow(client, manager_headers, app):
    wrong = client.post('/api/v1/auth/change-password', headers=manager_headers,
                        json={'current_password': 'nope', 'new_password': 'newpass123'})
    assert wrong.status_code == 400

    ok = client.post('/api/v1/auth/change-password', headers=manager_headers,
                     json={'current_password': 'pass1234', 'new_password': 'newpass123'})
    assert ok.status_code == 200

    # old password no longer works, new one does
    bad_login = client.post('/api/v1/auth/login',
                            json={'email': 'manager@test.local', 'password': 'pass1234'})
    assert bad_login.status_code == 401
    good_login = client.post('/api/v1/auth/login',
                             json={'email': 'manager@test.local', 'password': 'newpass123'})
    assert good_login.status_code == 200


def test_change_password_too_short_rejected(client, manager_headers):
    r = client.post('/api/v1/auth/change-password', headers=manager_headers,
                    json={'current_password': 'pass1234', 'new_password': 'short'})
    assert r.status_code == 422


def test_avatar_upload_and_serve_roundtrip(client, manager_headers):
    png_bytes = b'\x89PNG\r\n\x1a\nfake-but-fine-for-a-test'
    up = client.post('/api/v1/auth/avatar', headers=manager_headers,
                     data={'file': (io.BytesIO(png_bytes), 'me.png', 'image/png')},
                     content_type='multipart/form-data')
    assert up.status_code == 200
    user = up.get_json()['user']
    assert user['avatar_url'] == f"/api/v1/auth/avatar/{user['id']}"

    # Serving requires NO auth header (plain <img src> must work).
    served = client.get(user['avatar_url'])
    assert served.status_code == 200
    assert served.data == png_bytes


def test_avatar_upload_rejects_non_image(client, manager_headers):
    r = client.post('/api/v1/auth/avatar', headers=manager_headers,
                    data={'file': (io.BytesIO(b'not an image'), 'x.txt', 'text/plain')},
                    content_type='multipart/form-data')
    assert r.status_code == 400


def test_avatar_for_user_without_one_is_404(client, manager_headers, app):
    from tests.conftest import user_id
    with app.app_context():
        uid = user_id('employee@test.local')
    assert client.get(f'/api/v1/auth/avatar/{uid}').status_code == 404
