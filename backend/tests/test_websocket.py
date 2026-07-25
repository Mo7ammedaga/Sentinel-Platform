"""WebSocket room-join authorization.

join_org must require a valid access token and only allow joining the
caller's own organization's room — otherwise any client that can reach the
Socket.IO endpoint could join with a client-supplied organization_id and no
login at all, and receive every live security alert broadcast to that org.
"""
from app.extensions import socketio


def _token(headers):
    return headers['Authorization'].split(' ', 1)[1]


def test_join_org_without_token_is_rejected(app, analyst_headers):
    client = socketio.test_client(app)
    client.emit('join_org', {'organization_id': 'org_test'})
    assert client.get_received()[-1]['args'][0]['status'] == 'error'
    client.disconnect()


def test_join_org_with_wrong_org_is_rejected(app, analyst_headers):
    client = socketio.test_client(app)
    client.emit('join_org', {'organization_id': 'someone-elses-org',
                              'token': _token(analyst_headers)})
    assert client.get_received()[-1]['args'][0]['status'] == 'error'
    client.disconnect()


def test_join_org_with_valid_token_succeeds(app, analyst_headers):
    client = socketio.test_client(app)
    client.emit('join_org', {'organization_id': 'org_test',
                              'token': _token(analyst_headers)})
    assert client.get_received()[-1]['args'][0]['status'] == 'success'
    client.disconnect()


def test_join_user_requires_matching_user(app, analyst_headers, employee_headers):
    from tests.conftest import user_id

    client = socketio.test_client(app)
    client.emit('join_user', {'user_id': user_id('employee@test.local'),
                               'token': _token(analyst_headers)})
    assert client.get_received()[-1]['args'][0]['status'] == 'error'
    client.disconnect()

    client = socketio.test_client(app)
    client.emit('join_user', {'user_id': user_id('employee@test.local'),
                               'token': _token(employee_headers)})
    assert client.get_received()[-1]['args'][0]['status'] == 'success'
    client.disconnect()
