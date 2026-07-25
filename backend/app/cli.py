"""Custom Flask CLI commands, registered in create_app().

`flask seed-admin` runs from entrypoint.sh on every startup, right after
`flask db upgrade` — see app/services/bootstrap_service.py for why this
lives here instead of in a migration.
"""
import click

from app.services.bootstrap_service import ensure_default_admin


def register_cli(app):
    @app.cli.command('seed-admin')
    def seed_admin_command():
        """Idempotent: create the bootstrap admin account if it doesn't
        exist yet. Safe to run on every startup."""
        is_production = not (app.debug or app.testing)
        _created, _email, message = ensure_default_admin(is_production)
        click.echo(message)
