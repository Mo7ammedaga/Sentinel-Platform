#!/bin/sh
set -e

# Make deploys self-diagnosing: print exactly what commit is running and what
# migration state it found/left the database in, so "did my migration
# actually run" is answered by the deploy log itself, never a guess.
# RENDER_GIT_COMMIT is set automatically by Render for every deploy — see
# https://render.com/docs/environment-variables — and is empty outside
# Render (e.g. docker-compose), which is fine, it just won't print.
if [ -n "$RENDER_GIT_COMMIT" ]; then
    echo "=== Deploying commit: $RENDER_GIT_COMMIT ==="
fi

echo "=== Migration state before upgrade ==="
flask db current
echo "=== Target (head) ==="
flask db heads

# Provision the schema purely through migrations (no db.create_all()).
flask db upgrade

echo "=== Migration state after upgrade ==="
flask db current

# Idempotent by construction (checks whether DEFAULT_ADMIN_EMAIL already
# exists, not by migration state) — safe to run on every startup, unlike a
# migration which only ever runs once per database. See
# app/services/bootstrap_service.py for why this isn't a migration.
echo "=== Ensuring default admin account ==="
flask seed-admin

# Socket.IO requires a single worker unless a message queue (Redis) is used to
# coordinate multiple workers — that scale-out step is deferred until it's
# actually needed. The gevent-websocket worker handles both HTTP and
# WebSocket traffic.
exec gunicorn \
    -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    -w 1 \
    -b 0.0.0.0:5000 \
    --access-logfile - \
    run:app
