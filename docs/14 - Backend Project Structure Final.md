# 14 - Backend Project Structure Final

## Purpose

This document defines the final backend structure of Sentinel Platform after all implementation phases are complete.

The backend is organized into logical folders, each with a specific responsibility.

---

# Design Philosophy

**Scalability First**

The backend structure is designed to support the growth of Sentinel Platform without architectural changes.

Each folder can expand independently without affecting others.

---

# Final Backend Structure

> **Status note:** the tree below is the structure as actually implemented,
> which consolidated several of this document's originally-planned
> per-entity files (e.g. one `models/workspace.py` holds `Workspace`,
> `Project`, `Task`, `File`, `Note`, `Message` together; one
> `routes/workspace.py` blueprint serves all of them) rather than splitting
> every entity into its own file. The **pattern** described in "Folder
> Responsibilities" below — routes stay thin, services hold business logic,
> models are the schema, everything cross-cutting lives in `utils/` — is
> unchanged and still exactly how the code is organized; only the exact
> file-per-file granularity differs from the original plan.

```
Sentinel-Platform/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── extensions.py
│   │   │
│   │   ├── routes/
│   │   │   ├── admin.py            (role assignment, retention purge)
│   │   │   ├── ai.py                (POST /ai/analyze)
│   │   │   ├── auth.py              (register/login/refresh/profile/sessions)
│   │   │   ├── dashboard.py
│   │   │   ├── notifications.py
│   │   │   ├── privacy.py           (monitoring notice, my-events export)
│   │   │   ├── security.py          (alerts, investigations, incident response)
│   │   │   └── workspace.py         (workspaces/projects/tasks/files/notes/messages)
│   │   │
│   │   ├── models/
│   │   │   ├── user.py, user_session.py
│   │   │   ├── workspace.py         (Workspace, Project, Task, File, Note, Message)
│   │   │   ├── event.py, ai_analysis.py
│   │   │   ├── alert.py, investigation.py
│   │   │   ├── incident_action.py, incident_evidence.py
│   │   │   ├── risk_score.py, notification.py
│   │   │
│   │   ├── schemas/                 (pydantic request validation)
│   │   │   ├── auth.py, security.py, workspace.py
│   │   │
│   │   ├── services/
│   │   │   ├── workspace_service.py
│   │   │   ├── security_service.py  (analysis, alerts, incident response)
│   │   │   ├── notification_service.py, privacy_service.py
│   │   │   ├── profile_service.py, session_service.py
│   │   │
│   │   ├── utils/
│   │   │   ├── api.py, auth.py, constants.py
│   │   │   ├── decorators.py, errors.py
│   │   │   ├── event_logger.py, validation.py
│   │   │
│   │   ├── middleware/
│   │   │   ├── error_handler.py, security.py
│   │   │
│   │   ├── events/                  (WebSocket, not "websockets/")
│   │   │   └── websocket.py
│   │   │
│   │   └── ai/
│   │       ├── analyzer.py
│   │       └── feature_extractor.py
│   │
│   ├── migrations/versions/         (7 migrations; see docs/07)
│   ├── scripts/dev_behavior_generator.py   (deterministic dev/demo data)
│   ├── tests/                       (71 tests across 13 files)
│   ├── Dockerfile, .dockerignore, entrypoint.sh
│   ├── .env.example, .gitignore, pytest.ini
│   ├── run.py, requirements.txt
│
├── frontend/                        (React 19 + TypeScript, see docs/09)
│
├── docs/                            (01-15, see docs/README context in root README.md)
│
├── .github/workflows/ci.yml
├── docker-compose.yml
├── LICENSE, README.md, PROJECT_CONTEXT.md
└── .gitignore
```

There is no top-level `ai-engine/` folder — the AI engine lives inside
`backend/app/ai/`, sharing the same process and database session as the rest
of the backend rather than running as a separate service. This was a
deliberate simplification: at this scale, a separate service would add
deployment complexity (a second process, a second set of DB credentials,
inter-service auth) without a benefit — the AI engine is a pure function of
data already in the same database.

---

# Folder Responsibilities

## 1. app/__init__.py

**Responsibility:** Application Factory

Contains the `create_app()` function that creates and configures the Flask application.

This is the entry point for the entire backend.

**Responsibilities:**
- Create Flask application instance
- Load configuration
- Initialize extensions
- Register blueprints
- Set up error handlers
- Set up middleware

**Must never:**
- Contain business logic
- Import models directly
- Initialize extensions (that's in extensions.py)

---

## 2. app/config.py

**Responsibility:** Configuration Management

Defines configuration classes for different environments.

**Contains:**
- Base configuration
- Development configuration
- Testing configuration
- Production configuration

**File size:** ~100 lines

**Example:**
```python
class Config:
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
```

---

## 3. app/extensions.py

**Responsibility:** Extension Initialization

Initializes all Flask extensions before application creation.

**Contains (actual):** SQLAlchemy, SocketIO, Limiter only — see
`docs/13 - Flask Extensions Architecture.md` for why Migrate/CORS/JWT are
handled differently (constructed inline in `create_app()`, or, for JWT, not
an extension object at all).

**File size:** ~20 lines

**Example (actual):**
```python
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_limiter import Limiter

db = SQLAlchemy()
socketio = SocketIO()
limiter = Limiter(key_func=get_remote_address, storage_uri=...)
```

**Why separate file?**
Prevents circular imports. Models import db, db imported in __init__.py.

---

## 4. app/routes/

**Responsibility:** API Endpoints

Each module has one route file.

**Files:**
- `auth.py` - Authentication endpoints (login, register, logout)
- `users.py` - User profile endpoints
- `workspaces.py` - Workspace management
- `projects.py` - Project management
- `tasks.py` - Task management
- `files.py` - File upload/download
- `notes.py` - Note management
- `messages.py` - Team chat
- `notifications.py` - Notification endpoints
- `events.py` - Event collection (AI Engine feeds)
- `security.py` - Security Dashboard APIs

**File size:** 50-200 lines per route

**Pattern:**
```python
from flask import Blueprint

bp = Blueprint('users', __name__, url_prefix='/api/v1/users')

@bp.route('/profile', methods=['GET'])
def get_profile():
    # Implementation
```

**Responsibility of Routes:**
- Parse HTTP requests
- Call services
- Return JSON responses
- Handle HTTP status codes

**Must never:**
- Contain database logic (use models)
- Contain business logic (use services)
- Query database directly

---

## 5. app/models/

**Responsibility:** Database Models

Each entity has one model file.

**Files:**
- `user.py` - User table
- `workspace.py` - Workspace table
- `project.py` - Project table
- `task.py` - Task table
- `file.py` - File table
- `note.py` - Note table
- `message.py` - Message table
- `notification.py` - Notification table
- `event.py` - Security event table
- `alert.py` - Alert table
- `risk_score.py` - AI risk score table
- `role.py` - User role table

**File size:** 50-150 lines per model

**Pattern:**
```python
from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True)
    
    # Relationships
    projects = db.relationship('Project', backref='owner')
```

**Responsibility of Models:**
- Define database schema
- Define relationships
- Define database constraints
- Provide query methods

**Must never:**
- Contain business logic
- Perform API operations
- Handle HTTP requests

---

## 6. app/services/

**Responsibility:** Business Logic

Each module has one service file.

**Files:**
- `auth_service.py` - Login, registration, token refresh
- `user_service.py` - User operations
- `workspace_service.py` - Workspace operations
- `project_service.py` - Project operations
- `task_service.py` - Task operations
- `file_service.py` - File upload/download
- `event_service.py` - Event collection and validation
- `notification_service.py` - Notification sending
- `security_service.py` - Security analysis

**File size:** 100-300 lines per service

**Pattern:**
```python
from app.extensions import db
from app.models import User

class AuthService:
    @staticmethod
    def login(email, password):
        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            token = create_access_token(user.id)
            return token
        return None
```

**Responsibility of Services:**
- Implement business logic
- Coordinate database operations
- Perform calculations
- Handle complex workflows
- Validate business rules

**Relationship to Routes:**
Routes call services, services use models.

---

## 7. app/utils/

**Responsibility:** Utilities and Helpers

Contains reusable code.

**Files:**
- `decorators.py` - Custom decorators (@login_required, @admin_only)
- `validators.py` - Input validation
- `helpers.py` - Utility functions
- `constants.py` - Application constants

**File size:** 20-100 lines per file

**Examples:**

`decorators.py`:
```python
def admin_only(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        # Check if user is admin
        return f(*args, **kwargs)
    return decorated
```

`validators.py`:
```python
def validate_email(email):
    # Email validation logic
    return True
```

`constants.py`:
```python
ROLES = {
    'EMPLOYEE': 'employee',
    'MANAGER': 'manager',
    'SECURITY_ANALYST': 'security_analyst',
    'ADMIN': 'admin'
}
```

---

## 8. app/middleware/

**Responsibility:** Request/Response Processing

Middleware intercepts requests and responses.

**Files:**
- `auth_middleware.py` - JWT validation
- `error_handler.py` - Exception handling
- `logging_middleware.py` - Request/response logging

**Pattern:**
```python
@app.before_request
def before_request():
    # Runs before every request

@app.after_request
def after_request(response):
    # Runs after every response
    return response
```

**Responsibility of Middleware:**
- Validate authentication
- Log requests
- Handle errors
- Add headers
- Rate limiting (future)

---

## 9. app/websockets/

**Responsibility:** Real-Time Communication

Handles Socket.IO connections and events.

**Files:**
- `events.py` - Define socket events
- `handlers.py` - Handle socket events
- `namespaces.py` - Socket.IO namespaces

**Pattern:**
```python
from flask_socketio import emit

@socketio.on('connect')
def handle_connect():
    emit('response', {'data': 'Connected'})

@socketio.on('event_alert')
def handle_alert(data):
    socketio.emit('notification', data)
```

**Responsibility of WebSockets:**
- Handle real-time events
- Push live updates to frontend
- Manage user connections
- Send alerts immediately

**Used by:**
- Live event stream
- Security alerts
- Notifications
- Dashboard updates

---

## 10. app/ai/

**Responsibility:** AI Engine Integration

Handles communication with AI Engine.

**Files:**
- `analyzer.py` - Send events to AI, receive analysis
- `feature_extractor.py` - Extract features from events
- `models.py` - AI model interfaces

**Pattern:**
```python
class EventAnalyzer:
    @staticmethod
    def analyze_event(event):
        # Send to AI Engine
        result = send_to_ai_engine(event)
        # Store result
        return result
```

**Responsibility of AI Module:**
- Receive events
- Extract features
- Send to AI Engine
- Receive analysis results
- Store risk scores
- Generate alerts

---

## 11. migrations/

**Responsibility:** Database Schema Changes

Managed by Flask-Migrate.

**Contents:**
- `versions/` - Migration files (auto-generated)
- `env.py` - Migration configuration
- `alembic.ini` - Alembic settings

**Workflow:**
```
1. Create/modify model
2. Generate migration: flask db migrate
3. Review migration file
4. Apply migration: flask db upgrade
5. Commit to git
```

**Must never:**
- Manually edit migration files (let Alembic generate them)

---

## 12. tests/

**Responsibility:** Automated Testing

**Files:**
- `conftest.py` - Pytest configuration and fixtures
- `test_auth.py` - Authentication tests
- `test_users.py` - User endpoint tests
- `test_workspaces.py` - Workspace tests
- `test_projects.py` - Project tests
- `test_tasks.py` - Task tests
- `test_events.py` - Event tests
- `test_security.py` - Security tests
- `fixtures/` - Test data

**Test Structure:**
```python
def test_user_login():
    # Arrange
    user = create_test_user()
    
    # Act
    response = client.post('/api/v1/auth/login', json={...})
    
    # Assert
    assert response.status_code == 200
```

**Coverage:**
- All routes
- All services
- All business logic
- Edge cases
- Error conditions

---

## 13. .env.example

**Responsibility:** Environment Variable Template

Shows what `.env` should contain.

**Committed to git:** YES

**Example:**
```
SENTINEL_ENVIRONMENT=development
SENTINEL_DATABASE_URL=postgresql://user:password@localhost:5432/sentinel
SENTINEL_SECRET_KEY=dev-secret-key
SENTINEL_JWT_SECRET=dev-jwt-secret
```

Developers copy to `.env` and fill in local values.

---

## 14. .gitignore

**Responsibility:** Prevent Committing Secrets

**Contents:**
```
venv/
__pycache__/
*.pyc
.env
.env.local
.DS_Store
.idea/
instance/
```

`.env` is never committed. Only `.env.example` is committed.

---

## 15. run.py

**Responsibility:** Application Entry Point

```python
from app import create_app
from app.config import DevelopmentConfig

app = create_app(DevelopmentConfig)

if __name__ == '__main__':
    app.run(debug=True)
```

**Usage:**
```bash
python run.py
```

---

## 16. requirements.txt

**Responsibility:** Dependency Management

Lists all Python packages and versions.

**Actual current pins** (`backend/requirements.txt`):
```
Flask==3.1.3
Flask-SQLAlchemy==3.0.5
Flask-Migrate==4.0.5
PyJWT==2.13.0
flask-socketio==5.6.1
flask-cors==6.0.5
flask-limiter==4.1.1
python-dotenv==1.0.0
psycopg2-binary==2.9.12
scikit-learn==1.9.0
```

**Generated by:**
```bash
pip freeze > requirements.txt
```

---

# Data Flow Through Backend

## User Creates a Task

```
1. Frontend → HTTP POST /api/v1/tasks
2. routes/tasks.py → Creates request handler
3. services/task_service.py → Contains business logic
4. models/task.py → Database model
5. extensions.db → SQLAlchemy ORM executes
6. PostgreSQL → Stores data
7. Event → Task created event generated
8. services/event_service.py → Validates event
9. ai/analyzer.py → Sends to AI Engine
10. websockets/events.py → Emits to Security Dashboard
11. routes/tasks.py → Returns JSON response
12. Frontend → Updates UI
```

---

## Security Analyst Views Live Events

```
1. Frontend connects via Socket.IO
2. websockets/handlers.py → Handles connection
3. Security Dashboard loads
4. Frontend → Request via HTTP GET /api/v1/security/events
5. routes/security.py → Fetches events
6. services/security_service.py → Queries database
7. models/event.py + models/risk_score.py → Database query
8. PostgreSQL → Returns events with risk scores
9. routes/security.py → Returns JSON
10. Frontend → Displays events
11. ai/analyzer.py → Processes new events continuously
12. websockets/events.py → Emits updates
13. Frontend → Receives live updates via Socket.IO
```

---

# Module Organization

Each module is independent but communicates through defined interfaces.

## Module: Projects

**Route:** `routes/projects.py`
- POST /api/v1/projects
- GET /api/v1/projects
- PUT /api/v1/projects/{id}
- DELETE /api/v1/projects/{id}

**Service:** `services/project_service.py`
- create_project()
- get_project()
- update_project()
- delete_project()

**Model:** `models/project.py`
- Project table
- Relationships

**Event:** When project is created, modified, or deleted
- Event generated automatically
- Sent to event_service
- Forwarded to AI Engine

**Notification:** When project changes
- Notification sent to team members
- Via notification_service
- Pushed via WebSocket

---

# Scalability Considerations

This structure supports:

**Adding New Modules:**
```
1. Create routes/new_module.py
2. Create services/new_module_service.py
3. Create models/new_module.py
4. Implement logic
5. Module automatically integrated
```

**Adding New Features:**
- Routes → Services → Models hierarchy
- No need to modify existing code
- Clear separation of concerns

**Handling High Load:**
- Database connection pooling (config.py)
- Caching layer (future: app/cache/)
- Background jobs (future: app/jobs/)
- Rate limiting (future: app/rate_limit/)

**Adding New Modules Later:**
```
app/cache/
app/jobs/
app/rate_limit/
app/search/
app/reporting/
```

No architectural changes required.

---

# Import Hierarchy

**Never create circular imports.**

Correct import direction:

```
Routes → Services → Models ← Extensions
         ↓
     Utils / Helpers
```

**Routes imports:**
```python
from app.services import UserService
from app.utils.decorators import login_required
```

**Services imports:**
```python
from app.models import User
from app.extensions import db
```

**Models imports:**
```python
from app.extensions import db
```

**NOT allowed:**
- Routes importing Models directly
- Models importing Services
- Any circular imports

---

# File Naming Conventions

**Files:** lowercase_with_underscores
- `auth_service.py`
- `project_route.py`
- `error_handler.py`

**Classes:** PascalCase
- `AuthService`
- `ProjectRoute`
- `ErrorHandler`

**Functions/Methods:** lowercase_with_underscores
- `get_user_by_id()`
- `validate_email()`
- `create_project()`

**Constants:** UPPERCASE
- `MAX_FILE_SIZE`
- `DEFAULT_PAGE_SIZE`

---

# Development Workflow

**Starting Development:**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with local database URL
python run.py
```

**Creating New Feature:**
```bash
1. Create routes/new_feature.py
2. Create services/new_feature_service.py
3. Create models/new_feature.py
4. Create tests/test_new_feature.py
5. Implement and test
6. Commit to git
```

**Database Changes:**
```bash
# Modify model
# Then:
flask db migrate -m "Add new column"
# Review migrations/versions/xxx.py
flask db upgrade
# Then commit
```

---

# Testing Workflow

**Run all tests:**
```bash
pytest
```

**Run specific test file:**
```bash
pytest tests/test_auth.py
```

**Run with coverage:**
```bash
pytest --cov=app
```

**Testing structure follows backend structure:**
- `test_auth.py` tests routes/auth.py
- `test_users.py` tests routes/users.py
- etc.

---

# Performance Considerations

**Database Indexes:**
- User emails (unique, indexed)
- Event timestamps (indexed)
- User IDs (foreign keys, indexed)

**Query Optimization:**
- Eager loading with `db.relationships`
- Avoid N+1 queries
- Use database constraints

**Caching:**
- User profile data
- Workspace configuration
- Security rules

**Background Jobs:**
- AI analysis (async)
- Report generation
- Cleanup tasks

---

# Security Considerations

**Authentication:**
- JWT tokens required for all protected routes
- Token expiration (15 minutes)
- Refresh token mechanism (7 days)

**Authorization:**
- Role-based access control (RBAC)
- @admin_only decorator
- Workspace membership checks

**Data Protection:**
- Passwords hashed with Werkzeug
- Sensitive data encrypted at rest
- HTTPS enforced in production

**Input Validation:**
- All inputs validated in services
- SQL injection prevention (SQLAlchemy)
- XSS prevention (JSON responses)

---

# Summary

The backend structure provides:

✅ Clear separation of concerns
✅ Scalability for new modules
✅ Testability at every layer
✅ Security at each level
✅ Performance optimization points
✅ Easy maintenance and debugging

Each file has a single responsibility.
Each folder has a clear purpose.
Each layer has defined interfaces.

---

# Status

Approved

Version 1.0