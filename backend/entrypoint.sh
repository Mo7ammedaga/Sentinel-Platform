#!/bin/sh
set -e

# Provision the schema purely through migrations (no db.create_all()).
flask db upgrade

# Socket.IO requires a single worker unless a message queue (Redis) is used to
# coordinate multiple workers — that scale-out step is the deferred C9. The
# gevent-websocket worker handles both HTTP and WebSocket traffic.
exec gunicorn \
    -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    -w 1 \
    -b 0.0.0.0:5000 \
    --access-logfile - \
    run:app
