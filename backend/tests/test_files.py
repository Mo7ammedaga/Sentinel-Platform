"""Real file upload/download (actual bytes, not typed-in metadata)."""
import io

from app.models import Event
from tests.conftest import user_id


def _make_task(client, headers):
    wid = client.post('/api/v1/workspaces', headers=headers, json={'name': 'W'}).get_json()['id']
    pid = client.post('/api/v1/projects', headers=headers,
                      json={'workspace_id': wid, 'name': 'P'}).get_json()['id']
    return client.post('/api/v1/tasks', headers=headers,
                       json={'project_id': pid, 'title': 'T'}).get_json()['id']


def test_upload_and_download_roundtrip(client, manager_headers):
    tid = _make_task(client, manager_headers)
    content = b'these are the real bytes of my document'

    up = client.post('/api/v1/files',
                     data={'task_id': str(tid), 'file': (io.BytesIO(content), 'report.pdf')},
                     content_type='multipart/form-data', headers=manager_headers)
    assert up.status_code == 201
    body = up.get_json()
    assert body['filename'] == 'report.pdf'
    assert body['size_bytes'] == len(content)
    assert 'file_path' not in body           # internal storage detail never exposed
    fid = body['id']

    dl = client.get(f'/api/v1/files/{fid}/download', headers=manager_headers)
    assert dl.status_code == 200
    assert dl.data == content                 # exact bytes round-trip
    assert 'report.pdf' in dl.headers.get('Content-Disposition', '')


def test_upload_requires_task_and_file(client, manager_headers):
    tid = _make_task(client, manager_headers)
    no_file = client.post('/api/v1/files', data={'task_id': str(tid)},
                          content_type='multipart/form-data', headers=manager_headers)
    assert no_file.status_code == 400
    no_task = client.post('/api/v1/files',
                          data={'file': (io.BytesIO(b'x'), 'a.txt')},
                          content_type='multipart/form-data', headers=manager_headers)
    assert no_task.status_code == 400


def test_download_missing_file_is_404(client, manager_headers):
    r = client.get('/api/v1/files/999999/download', headers=manager_headers)
    assert r.status_code == 404


def test_delete_removes_file_from_disk_and_db(client, manager_headers):
    tid = _make_task(client, manager_headers)
    up = client.post('/api/v1/files',
                     data={'task_id': str(tid), 'file': (io.BytesIO(b'bye'), 'x.txt')},
                     content_type='multipart/form-data', headers=manager_headers)
    fid = up.get_json()['id']
    d = client.delete(f'/api/v1/files/{fid}', headers=manager_headers)
    assert d.status_code == 200
    assert client.get(f'/api/v1/files/{fid}/download', headers=manager_headers).status_code == 404


def test_deleting_task_cascades_to_its_files(client, manager_headers):
    """Regression: deleting a task must not orphan its files (real bytes on
    disk + rows referencing a task_id that no longer exists)."""
    tid = _make_task(client, manager_headers)
    up = client.post('/api/v1/files',
                     data={'task_id': str(tid), 'file': (io.BytesIO(b'x'), 'a.txt')},
                     content_type='multipart/form-data', headers=manager_headers)
    fid = up.get_json()['id']

    assert client.delete(f'/api/v1/tasks/{tid}', headers=manager_headers).status_code == 200
    assert client.get(f'/api/v1/files/{fid}/download', headers=manager_headers).status_code == 404


def test_upload_and_download_each_emit_one_event(client, manager_headers, app):
    tid = _make_task(client, manager_headers)
    with app.app_context():
        uid = user_id('manager@test.local')
        before_up = Event.query.filter_by(user_id=uid, action_type='upload_file').count()
        before_dl = Event.query.filter_by(user_id=uid, action_type='download_file').count()

    up = client.post('/api/v1/files',
                     data={'task_id': str(tid), 'file': (io.BytesIO(b'data'), 'f.txt')},
                     content_type='multipart/form-data', headers=manager_headers)
    fid = up.get_json()['id']
    client.get(f'/api/v1/files/{fid}/download', headers=manager_headers)

    with app.app_context():
        assert Event.query.filter_by(user_id=uid, action_type='upload_file').count() == before_up + 1
        assert Event.query.filter_by(user_id=uid, action_type='download_file').count() == before_dl + 1
