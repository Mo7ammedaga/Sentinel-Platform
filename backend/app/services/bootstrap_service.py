"""Application-startup bootstrap: ensure a default admin account exists.

Alembic migrations are for schema changes. They're a poor fit for "make
sure this row exists" concerns: a migration runs at most once per database
(tracked in alembic_version), so if it ran before the right environment
variables were configured — or a later deploy should create a *different*
default admin — there's no clean way to make it run again without editing
migration history, which is unsafe once a migration has been applied to a
real database (see migration 48b247de5e75's docstring for how this bit us).

This runs on every application startup instead (`flask seed-admin` in
entrypoint.sh, right after `flask db upgrade` and before the server starts).
It's idempotent by construction — keyed on whether DEFAULT_ADMIN_EMAIL
already exists as a user, not on migration state — so it's safe to run on
every deploy and every restart, forever, and it reacts correctly if the
configured admin email/password ever changes between deploys.
"""
import os

from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import User
from app.utils.constants import Roles

# Clearly-fake, clearly-documented development-only fallbacks. Never used in
# production — see the RuntimeError below.
DEV_ONLY_DEFAULT_EMAIL = 'admin@sentinel.local'
DEV_ONLY_DEFAULT_PASSWORD = 'ChangeMe123!'
DEV_ONLY_DEFAULT_ORG = 'org_001'


def ensure_default_admin(is_production):
    """Create the bootstrap admin if DEFAULT_ADMIN_EMAIL doesn't already
    exist as a user. Returns (created: bool, email: str, message: str).

    Safe to call every time the app starts: the existence check makes this
    a no-op once the account is there, regardless of how many times or how
    many processes run it.
    """
    email = os.environ.get('DEFAULT_ADMIN_EMAIL', DEV_ONLY_DEFAULT_EMAIL).strip().lower()

    if User.query.filter_by(email=email).first():
        return False, email, f'Bootstrap admin check: {email} already exists — nothing to do.'

    password = os.environ.get('DEFAULT_ADMIN_PASSWORD')
    if not password:
        if is_production:
            raise RuntimeError(
                f'DEFAULT_ADMIN_PASSWORD is required when SENTINEL_ENVIRONMENT=production '
                f'and no user with email {email} exists yet (refusing to create an admin '
                f'account with a guessable password). Set DEFAULT_ADMIN_EMAIL and '
                f'DEFAULT_ADMIN_PASSWORD in the deployment environment and restart.'
            )
        password = DEV_ONLY_DEFAULT_PASSWORD

    first_name = os.environ.get('DEFAULT_ADMIN_FIRST_NAME', 'System')
    last_name = os.environ.get('DEFAULT_ADMIN_LAST_NAME', 'Administrator')
    org = os.environ.get('DEFAULT_ADMIN_ORG', DEV_ONLY_DEFAULT_ORG)

    user = User(email=email, first_name=first_name, last_name=last_name,
                role=Roles.ADMIN, organization_id=org, is_active=True)
    user.set_password(password)
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        # Another process created the same account between our check and
        # this insert (e.g. concurrent startup with >1 worker). Not an
        # error — the account exists, which is all this function promises.
        db.session.rollback()
        return False, email, f'Bootstrap admin check: {email} was created concurrently — nothing to do.'

    return True, email, f'Bootstrap admin check: created {email}.'
