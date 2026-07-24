FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FLASK_APP=run.py

WORKDIR /app

# psycopg2-binary ships prebuilt wheels, so no compiler toolchain is needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# entrypoint runs migrations, then starts the gevent-websocket gunicorn worker.
CMD ["sh", "entrypoint.sh"]
