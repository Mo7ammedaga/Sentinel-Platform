"""seed default admin bootstrap account

Revision ID: 48b247de5e75
Revises: b53c0ee628e6
Create Date: 2026-07-25 23:04:52.470864

>>> SUPERSEDED — do not follow this pattern for future seed data <<<
This is exactly the "data seeding via migration" mistake it warns readers
about below, discovered the hard way: it ran successfully in production
before DEFAULT_ADMIN_PASSWORD was correctly configured, so it seeded
admin@sentinel.local with the dev-only fallback password. Because a
migration only ever runs once per database, setting the *real* credentials
afterwards and redeploying did nothing — the database was already past this
revision, so `flask db upgrade` had nothing left to do here, no matter what
the environment variables said.

The actual, current bootstrap mechanism is `flask seed-admin` (see
app/services/bootstrap_service.py and app/cli.py), run from entrypoint.sh on
every startup — after `flask db upgrade`, before the server starts. It is
idempotent by checking whether DEFAULT_ADMIN_EMAIL already exists as a row,
not by tracking migration state, so it correctly reacts to changed
credentials on any later deploy without needing a new migration or any edit
to migration history.

This migration is left completely unedited below (including its own
now-superseded reasoning) because it has already been applied to a real
production database — Alembic migrations must never be rewritten once
applied; only this docstring header was added, which has no effect on
already-migrated databases (Alembic does not check migration content, only
revision ids). It's a harmless no-op on every environment that already
reached this revision, and on any brand-new database it will still seed
admin@sentinel.local once, before `flask seed-admin` gets a chance to run —
which is fine: both are idempotent and keyed on the same email-exists check,
so they never conflict or double-create.
---

Every deployment target (a developer's laptop, CI, a fresh Render database)
provisions its schema the same way: `flask db upgrade`. Until this revision,
that step created tables but never any data — the only way to get an admin
account was to self-register (always role=employee) and then have an
existing admin promote you, which is impossible for the very first account
on a brand-new database. Locally this went unnoticed because the same
sentinel_dev.db file, with an admin account created by hand early in
development, has simply been reused ever since; a fresh production database
never had that manual step applied to it.

This migration seeds exactly ONE bootstrap admin, driven entirely by
environment variables (never a hardcoded password):

    DEFAULT_ADMIN_EMAIL     - defaults to admin@sentinel.local
    DEFAULT_ADMIN_PASSWORD  - REQUIRED when SENTINEL_ENVIRONMENT=production;
                              the migration raises and deployment fails
                              rather than silently create a guessable-password
                              admin account. In development/testing, falls
                              back to a clearly-fake default so `flask db
                              upgrade` keeps working out of the box.
    DEFAULT_ADMIN_FIRST_NAME / DEFAULT_ADMIN_LAST_NAME - default "System" / "Administrator"
    DEFAULT_ADMIN_ORG       - defaults to org_001 (matches DEFAULT_ORG in
                              app/routes/auth.py)

Idempotent: checks by email before inserting, so re-running `flask db
upgrade` on a database that already has this migration applied (the normal
case on every redeploy) does nothing — and even in the abnormal case of the
row being manually deleted and this migration somehow re-invoked, it will
not create a duplicate account for the same email.

There is no "default manager" seeded here on purpose: this system's own
workflow is self-register (always employee) -> an admin promotes via the
User Management page. Seeding a second, permanently-unused privileged
account into every production deployment would just be more standing attack
surface for no operational benefit — the bootstrap admin can create/promote
every other account it needs through the product itself.

Uses raw SQL (sa.table/sa.column), never the ORM model classes — migrations
must stay correct for the schema shape *at the time they ran*, independent
of how app/models/user.py evolves afterwards.
"""
import os

import bcrypt
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '48b247de5e75'
down_revision = 'b53c0ee628e6'
branch_labels = None
depends_on = None

# A clearly-fake, clearly-documented development-only fallback. Never used
# in production: see the RuntimeError below.
_DEV_ONLY_DEFAULT_PASSWORD = 'ChangeMe123!'

users = sa.table(
    'users',
    sa.column('organization_id', sa.String),
    sa.column('email', sa.String),
    sa.column('password_hash', sa.String),
    sa.column('first_name', sa.String),
    sa.column('last_name', sa.String),
    sa.column('role', sa.String),
    sa.column('is_active', sa.Boolean),
)


def upgrade():
    email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@sentinel.local').strip().lower()
    password = os.environ.get('DEFAULT_ADMIN_PASSWORD')
    environment = os.environ.get('SENTINEL_ENVIRONMENT', 'development').lower()

    if not password:
        if environment == 'production':
            raise RuntimeError(
                'DEFAULT_ADMIN_PASSWORD is required when SENTINEL_ENVIRONMENT=production '
                '(refusing to seed a bootstrap admin account with a guessable password). '
                'Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD in the deployment '
                'environment (e.g. the Render service\'s Environment tab) and redeploy.'
            )
        password = _DEV_ONLY_DEFAULT_PASSWORD

    first_name = os.environ.get('DEFAULT_ADMIN_FIRST_NAME', 'System')
    last_name = os.environ.get('DEFAULT_ADMIN_LAST_NAME', 'Administrator')
    org = os.environ.get('DEFAULT_ADMIN_ORG', 'org_001')

    conn = op.get_bind()
    exists = conn.execute(
        sa.text('SELECT 1 FROM users WHERE email = :email'), {'email': email}
    ).first()
    if exists:
        return  # already seeded (or an account with this email already exists) — no-op

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=10)).decode('utf-8')
    op.bulk_insert(users, [{
        'organization_id': org,
        'email': email,
        'password_hash': password_hash,
        'first_name': first_name,
        'last_name': last_name,
        'role': 'admin',
        'is_active': True,
    }])


def downgrade():
    email = os.environ.get('DEFAULT_ADMIN_EMAIL', 'admin@sentinel.local').strip().lower()
    conn = op.get_bind()
    conn.execute(sa.text('DELETE FROM users WHERE email = :email'), {'email': email})
