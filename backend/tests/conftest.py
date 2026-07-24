"""Pytest fixtures.

Each test gets a fresh app bound to a throwaway file-based SQLite DB (file, not
:memory:, so it survives across the multiple connections a request may use),
with three seeded users covering the roles we need.
"""
import os
import tempfile
from datetime import datetime, timedelta

import pytest

from app import create_app
from app.config import TestingConfig
from app.extensions import db as _db
from app.models import User, Event

PASSWORD = 'pass1234'
ORG = 'org_test'
SEED_USERS = [
    ('analyst@test.local', 'analyst'),
    ('employee@test.local', 'employee'),
    ('manager@test.local', 'manager'),
    ('admin@test.local', 'admin'),
]


def _seed_users():
    for email, role in SEED_USERS:
        u = User(email=email, first_name='T', last_name=role.title(),
                 role=role, organization_id=ORG)
        u.set_password(PASSWORD)
        _db.session.add(u)
    _db.session.commit()


@pytest.fixture
def app():
    fd, path = tempfile.mkstemp(suffix='.db')

    class Cfg(TestingConfig):
        SQLALCHEMY_DATABASE_URI = f'sqlite:///{path}'

    application = create_app(Cfg)
    with application.app_context():
        _db.create_all()
        _seed_users()
        yield application
        _db.session.remove()
        _db.drop_all()
    os.close(fd)
    os.unlink(path)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(app):
    return _db


def _token(client, email):
    r = client.post('/api/v1/auth/login', json={'email': email, 'password': PASSWORD})
    return r.get_json()['access_token']


@pytest.fixture
def analyst_headers(client):
    return {'Authorization': f'Bearer {_token(client, "analyst@test.local")}'}


@pytest.fixture
def employee_headers(client):
    return {'Authorization': f'Bearer {_token(client, "employee@test.local")}'}


@pytest.fixture
def manager_headers(client):
    return {'Authorization': f'Bearer {_token(client, "manager@test.local")}'}


@pytest.fixture
def admin_headers(client):
    return {'Authorization': f'Bearer {_token(client, "admin@test.local")}'}


def user_id(email):
    return User.query.filter_by(email=email).first().id


def seed_history_with_anomaly(uid):
    """~90 normal work-hours logins for a user + a clear anomaly in the last 24h.

    The anomaly is placed 2 hours ago (always inside the analyze window) and is
    made unambiguously unusual — a sensitive download burst from a new IP and a
    new device — so detection does not depend on the run's time of day.
    """
    now = datetime.utcnow()
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    events = []
    for d in range(30, 0, -1):
        day = midnight - timedelta(days=d)
        for i in range(3):
            events.append(Event(
                user_id=uid, organization_id=ORG, action_type='login',
                resource_type='user', ip_address='10.0.0.5',
                user_agent='UA', created_at=day.replace(hour=10 + i * 2)))
    # anomaly: 5 downloads ~2h ago, new IP + new device (within the 24h window)
    start = now - timedelta(hours=2)
    for i in range(5):
        events.append(Event(
            user_id=uid, organization_id=ORG, action_type='download_file',
            resource_type='file', ip_address='203.0.113.9',
            user_agent='NewDevice', created_at=start + timedelta(minutes=i)))
    _db.session.add_all(events)
    _db.session.commit()
