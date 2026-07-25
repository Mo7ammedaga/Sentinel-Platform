# 13 - Flask Extensions Architecture

## Purpose

This document defines the Flask extensions used by Sentinel Platform and explains how they are initialized and integrated into the application.

Extensions are third-party libraries that add functionality to Flask. They must be initialized properly and in the correct order.

---

# What is an Extension?

An extension is a reusable Flask library that adds specific functionality.

Examples:

- SQLAlchemy: Database communication
- Flask-Migrate: Database migrations
- PyJWT: Authentication with JWT (hand-rolled, not Flask-JWT-Extended — see Extension 3 below)
- Flask-SocketIO: Real-time WebSocket communication
- Flask-CORS: Cross-Origin Resource Sharing
- Flask-Limiter: Rate limiting (see Extension 6 below)

Extensions are NOT created inside `run.py`. They are initialized in `extensions.py` and used throughout the application.

---

# Why extensions.py Exists

`extensions.py` is a separate file that serves one purpose:

**Initialize all extensions before the application is created.**

This prevents circular imports and ensures extensions are available throughout the application.

## Problem It Solves

If we initialize extensions inside `app/__init__.py`, we create a circular dependency:

```
app/__init__.py imports extensions
extensions imports database models
models import app
↑ CIRCULAR IMPORT
```

Solution: Put extension initialization in `extensions.py`, then import from there.

---

# Extensions Used by Sentinel Platform

Sentinel Platform uses six core extensions/libraries:

1. **SQLAlchemy** - Database ORM
2. **Flask-Migrate** - Database migrations
3. **PyJWT** - JWT authentication (not Flask-JWT-Extended)
4. **Flask-SocketIO** - Real-time WebSocket communication
5. **Flask-CORS** - Cross-origin requests
6. **Flask-Limiter** - Rate limiting

Additional utilities:

6. **Werkzeug** - Password hashing (included with Flask)

---

# Extension 1: SQLAlchemy

## Purpose

SQLAlchemy allows us to interact with PostgreSQL using Python objects instead of raw SQL.

We write Python code, SQLAlchemy generates SQL.

## Why SQLAlchemy?

- Object-Relational Mapping (ORM)
- No need to write raw SQL
- Prevents SQL injection attacks
- Supports database migrations
- Works with SQLAlchemy-Utils for extra functionality

## Package Name

```
Flask-SQLAlchemy
```

## Initialization

```python
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
```

No application context required.

## Usage in create_app()

```python
db.init_app(app)
```

Connect extension to application instance.

## When is SQLAlchemy Used?

- Define database models
- Query the database
- Create/update/delete records
- Database migrations

## Database Connection

SQLAlchemy connects to PostgreSQL using the connection string from config:

```
postgresql://user:password@host:port/database
```

---

# Extension 2: Flask-Migrate

## Purpose

Flask-Migrate manages database schema changes safely.

When we add a new table or column, Flask-Migrate creates a migration file that tracks the change.

## Why Flask-Migrate?

- Track schema changes in version control
- Rollback changes if needed
- Apply migrations in specific order
- Share migrations across team members
- Deploy schema changes safely

## Package Name

```
Flask-Migrate
```

## Initialization

```python
from flask_migrate import Migrate

migrate = Migrate()
```

## Usage in create_app()

```python
migrate.init_app(app, db)
```

Connect migration system to application and database.

## When is Flask-Migrate Used?

- Create new database tables
- Add columns to existing tables
- Remove columns
- Modify column types
- Create indexes
- Drop tables

## Migration Workflow

1. Create/modify model in Python
2. Generate migration file
3. Review migration file
4. Apply migration to database
5. Commit migration to git

---

# Extension 3: JWT Authentication (PyJWT, not Flask-JWT-Extended)

> **Implementation note:** the original design called for Flask-JWT-Extended.
> The actual implementation uses the plain **PyJWT** library directly, with a
> small hand-rolled `TokenManager` (`app/utils/auth.py`) and a `@token_required`
> decorator (`app/utils/decorators.py`) instead of a Flask extension object —
> there's no `jwt = JWTManager()` in `extensions.py`. The behaviour described
> below (stateless tokens, access/refresh split, role checks) is unchanged;
> only the mechanism is simpler than originally planned.

## Purpose

JWT-based authentication for user identity. When a user logs in, they receive
an access token and a refresh token. The access token is sent as
`Authorization: Bearer <token>` on every subsequent request to prove identity.

## Why JWT?

- Stateless authentication
- No session storage required
- Scalable across multiple servers
- Supports token expiration
- Supports role-based access

## Package Name

```
PyJWT
```

## Implementation

```python
# app/utils/auth.py
class TokenManager:
    @staticmethod
    def generate_token(user_id, user_email, role, sid=None) -> str:
        payload = {'user_id': user_id, 'email': user_email, 'role': role,
                   'type': 'access', 'iat': ..., 'exp': ...}
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')

# app/utils/decorators.py / app/utils/auth.py
@token_required   # verifies the Bearer token, attaches request.user_id
def some_route():
    ...
```

There is no extension object to register in `create_app()` — `jwt.encode` /
`jwt.decode` are called directly wherever a token is issued or verified.

## Configuration Required

```python
app.config['JWT_SECRET_KEY'] = 'your-secret-key'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(minutes=15)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=7)
```

These are set in config.py.

## When is JWT used?

- User login: Generate access token and refresh token
- Protect API endpoints: `@token_required` checks the token is valid
- Refresh expired tokens: `POST /auth/refresh`
- Get current user from token: `request.user_id` set by the decorator
- Restrict access by role: `@role_required(...)` reads the token's `role` claim

## Token Types

**Access Token**
- Short-lived (15 minutes)
- Used to access protected resources
- Expires quickly

**Refresh Token**
- Long-lived (7 days)
- Used to get a new access token
- Less frequently transmitted

---

# Extension 4: Flask-SocketIO

## Purpose

Flask-SocketIO enables real-time WebSocket communication between backend and frontend.

Instead of polling ("Is there new data? Is there new data?"), the backend pushes updates immediately.

## Why Socket.IO?

- Real-time bidirectional communication
- Fallback to HTTP long-polling if WebSocket unavailable
- Namespace support (different channels)
- Room support (group communications)
- Automatic reconnection
- Used for live events, alerts, notifications

## Package Name

```
Flask-SocketIO
```

## Installation Note

Flask-SocketIO requires `python-socketio` and `python-engineio`.

These are automatically installed with Flask-SocketIO.

## Initialization

```python
from flask_socketio import SocketIO

socketio = SocketIO()
```

## Usage in create_app()

```python
socketio = SocketIO(app, cors_allowed_origins="*")
```

Or with CORS configuration:

```python
socketio = SocketIO(
    app,
    cors_allowed_origins=app.config['CORS_ORIGINS'],
    async_mode='threading'
)
```

## When is Flask-SocketIO Used?

- Live event stream
- Security alerts
- Dashboard updates
- User notifications
- Chat messages
- Collaborative features

## Socket Events

Backends emits events to clients:

```python
socketio.emit('event_name', data, to=user_id)
```

Frontend listens to events:

```javascript
socket.on('event_name', function(data) {
  // Handle event
});
```

---

# Extension 5: Flask-CORS

## Purpose

Flask-CORS handles Cross-Origin Resource Sharing.

The frontend runs on `http://localhost:3000`. The backend runs on `http://localhost:5000`.

They are different origins. CORS allows the frontend to make requests to the backend.

## Why Flask-CORS?

- Allow frontend to communicate with backend
- Restrict requests to trusted origins only
- Support preflight requests
- Security protection against unauthorized requests

## Package Name

```
Flask-CORS
```

## Initialization

```python
from flask_cors import CORS

cors = CORS()
```

## Usage in create_app()

```python
cors.init_app(app, resources={
    r"/api/*": {
        "origins": app.config['CORS_ORIGINS'],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

## Configuration

CORS settings come from config.py:

Development:
```python
CORS_ORIGINS = ["http://localhost:3000"]
```

Production:
```python
CORS_ORIGINS = ["https://sentinel.com", "https://app.sentinel.com"]
```

---

# Optional: Password Hashing

Sentinel Platform uses Werkzeug for password hashing.

Werkzeug is included with Flask, no separate installation needed.

## Purpose

Never store passwords as plain text. Hash them instead.

When a user logs in, hash their input and compare with stored hash.

## Usage

```python
from werkzeug.security import generate_password_hash, check_password_hash

# Hash a password
hashed = generate_password_hash(password)

# Check a password
if check_password_hash(hashed, input_password):
    # Password matches
```

---

# Extension Initialization Order

> **Status note:** only SQLAlchemy, SocketIO, and Limiter are pre-instantiated
> in `extensions.py`. Flask-Migrate and Flask-CORS are constructed directly
> inside `create_app()` (`app/__init__.py`) instead, since they need
> config values (`CORS_ORIGINS`) at construction time rather than a later
> `init_app()` call. JWT has no extension object at all — see Extension 3.
> The dependency *order* below is still correct; the mechanism differs.

## Initialization Sequence (as actually called in `create_app()`)

1. **SQLAlchemy** (`db.init_app(app)`) - Must be first, other pieces depend on it
2. **Flask-CORS** (`CORS(app, resources={...})`) - Needs `CORS_ORIGINS` from config
3. **Flask-Migrate** (`Migrate(app, db)`) - Depends on SQLAlchemy
4. **Flask-Limiter** (`limiter.init_app(app)`)
5. **Flask-SocketIO** (`socketio.init_app(app, ...)`) - Last, wraps the WSGI app
6. **JWT** - No init step; `jwt.encode`/`jwt.decode` are called directly wherever needed

---

# extensions.py Structure

```python
# app/extensions.py — only the pieces that need to exist BEFORE create_app()
# runs (imported by models/routes/services without a circular-import risk).
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_limiter import Limiter

db = SQLAlchemy()
socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address, storage_uri=...)
```

`Migrate(app, db)` and `CORS(app, ...)` are constructed inline inside
`create_app()` instead — they're only ever used once, at startup, so there's
no benefit to pre-instantiating them the way `db`/`socketio`/`limiter` are
(those three are imported directly by models/routes/services elsewhere).

This file contains ONLY initialization. No logic.

---

# Dependency Relationships

```
SQLAlchemy (base)
    ↓
Flask-CORS (needs config, constructed in create_app())
    ↓
Flask-Migrate (depends on SQLAlchemy)
    ↓
Flask-Limiter
    ↓
Flask-SocketIO (wraps the app last)

JWT: independent, no init step (see Extension 3)
```

---

# Integration with create_app()

The `create_app()` function initializes all extensions with the application.

```python
def create_app(config_class):
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config_class)
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    socketio.init_app(app, cors_allowed_origins=app.config['CORS_ORIGINS'])
    cors.init_app(app)
    
    # Register blueprints
    # ... other setup ...
    
    return app
```

Order matters. SQLAlchemy must initialize before Migrate.

---

# Using Extensions in Application Code

After initialization, extensions are available throughout the application.

## In Models

```python
from app.extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True)
```

## In Routes

```python
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db

bp = Blueprint('users', __name__, url_prefix='/api/v1/users')

@bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    current_user_id = get_jwt_identity()
    # ... get user data ...
```

## In Services

```python
from app.extensions import socketio

def notify_user(user_id, message):
    socketio.emit('notification', message, to=user_id)
```

---

# Extension Configuration in config.py

Each extension has specific configuration.

## SQLAlchemy Configuration

```python
SQLALCHEMY_DATABASE_URI = os.environ.get('SENTINEL_DATABASE_URL')
SQLALCHEMY_TRACK_MODIFICATIONS = False
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 20,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
}
```

## JWT Configuration

```python
JWT_SECRET_KEY = os.environ.get('SENTINEL_JWT_SECRET')
JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
JWT_ALGORITHM = 'HS256'
```

## CORS Configuration

```python
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000')
```

## Socket.IO Configuration

Socket.IO reuses `CORS_ORIGINS` directly (`socketio.run(app, ...)` / the
`SocketIO()` instance in `extensions.py`) — there's no separate
`SOCKETIO_ASYNC_MODE` / `SOCKETIO_CORS_ALLOWED_ORIGINS` config pair.

## Extension 6: Flask-Limiter

Added after this document's original approval, for rate-limiting sensitive
endpoints (login, registration) against brute-force attempts. Initialized in
`extensions.py` alongside SQLAlchemy and SocketIO, keyed by client IP, with
in-memory storage in development and `RATELIMIT_STORAGE_URI` (e.g. Redis) in
production.

---

# Extension Error Handling

Each extension may raise specific errors.

## SQLAlchemy Errors

- IntegrityError: Constraint violation
- OperationalError: Database connection failed
- ProgrammingError: Invalid SQL

## JWT Errors

- JWTExtended: Invalid token
- ExpiredSignatureError: Token expired
- MissingTokenError: No token provided

## Socket.IO Errors

- ConnectionError: Connection failed
- NamespaceError: Invalid namespace

---

# Testing with Extensions

Extensions behave differently in testing.

## Testing Configuration

```python
class TestingConfig(Config):
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    TESTING = True
```

## Test Database Setup

```python
def test_client():
    app = create_app(TestingConfig)
    
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()
```

---

# Extension Versioning

Track extension versions in requirements.txt.

Actual current pins (`backend/requirements.txt`):

```
Flask==3.1.3
Flask-SQLAlchemy==3.0.5
Flask-Migrate==4.0.5
PyJWT==2.13.0
flask-socketio==5.6.1
flask-cors==6.0.5
flask-limiter==4.1.1
```

Pin versions to ensure consistency across environments.

---

# Future Extensions

Additional extensions may be added later:

- Flask-Caching: Application caching
- Flask-Limiter: Rate limiting
- Flask-RESTful: REST API helpers
- Flask-APScheduler: Background tasks
- Flask-DebugToolbar: Development debugging

Extension architecture supports adding these without major changes.

---

# Extension Best Practices

1. Initialize extensions in `extensions.py`
2. Never pass app instance to extension initialization in extensions.py
3. Call `init_app()` in `create_app()`
4. Keep initialization order consistent
5. Separate extension setup from business logic
6. Use `app.app_context()` when needed outside requests
7. Document extension configuration requirements
8. Test extensions with each environment config
9. Pin extension versions
10. Update extensions regularly

---

# Extension Troubleshooting

## "No application context"

Error occurs when using extensions outside request.

Solution: Use `app.app_context()`:

```python
with app.app_context():
    # Use extensions here
```

## "Circular import"

Extensions imported in models, models imported in extensions.

Solution: Initialize extensions in separate file.

## "Connection refused"

Database not running or URL incorrect.

Check config: `SQLALCHEMY_DATABASE_URI`

## "Token expired"

JWT token lifetime too short.

Adjust in config: `JWT_ACCESS_TOKEN_EXPIRES`

---

# Summary

Extensions provide critical functionality:

| Extension | Responsibility |
|-----------|-----------------|
| SQLAlchemy | Database communication |
| Flask-Migrate | Schema migrations |
| PyJWT | User authentication (hand-rolled, not Flask-JWT-Extended) |
| Flask-SocketIO | Real-time updates |
| Flask-CORS | Cross-origin requests |
| Flask-Limiter | Rate limiting |

SQLAlchemy, SocketIO, and Limiter are pre-instantiated in `extensions.py`;
Migrate and CORS are constructed inline in `create_app()`; JWT has no
extension object. See the initialization-order note above for why.

---

# Status

Approved

Version 1.0