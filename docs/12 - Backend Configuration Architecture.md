# 12 - Backend Configuration Architecture

## Purpose

This document defines how Sentinel Platform's backend manages configuration across different environments.

Configuration is the foundation of a scalable backend. It allows the same codebase to run in Development, Testing, and Production environments without modifying code.

> **Status note:** this document's examples consistently use a `SENTINEL_*`
> prefix for every environment variable (`SENTINEL_DATABASE_URL`,
> `SENTINEL_SECRET_KEY`, `SENTINEL_JWT_SECRET`, `SENTINEL_CORS_ORIGINS`,
> `SENTINEL_LOG_LEVEL`, ...). The actual implementation only kept the prefix
> on `SENTINEL_ENVIRONMENT` — every other variable is unprefixed. The real,
> current names (see `backend/.env.example`) are: `DATABASE_URL`,
> `SECRET_KEY`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `LOG_LEVEL`,
> `SQLALCHEMY_ECHO`, `RATELIMIT_STORAGE_URI`. There are also no separate
> `SENTINEL_DEBUG` / `SENTINEL_TESTING` flags — one `SENTINEL_ENVIRONMENT`
> value (`development` / `testing` / `production`) selects the whole Config
> class (`app/config.py`: `DevelopmentConfig` / `TestingConfig` /
> `ProductionConfig`), and that class's own attributes set `DEBUG`/`TESTING`.
> The three-environment *shape* described below is accurate; only the exact
> variable names differ from what's shown in the examples.

---

# Configuration Objectives

The configuration system should provide:

- Environment-specific settings
- Secure secret management
- Database connection details
- Logging behavior
- Debug mode control
- Authentication settings
- API configuration
- AI Engine settings

---

# Configuration Principle

**One codebase, many environments.**

The same Flask application should run identically in Development, Testing, and Production with only configuration changes.

---

# Configuration Environments

Sentinel Platform supports three environments:

1. Development
2. Testing
3. Production

Each environment has different configuration requirements.

---

# Development Environment

## Purpose

Local development by engineers.

## Configuration Settings

| Setting | Value | Reason |
|---------|-------|--------|
| DEBUG | True | Show detailed error messages |
| TESTING | False | Use real database operations |
| Database | Local PostgreSQL or SQLite | Fast local testing |
| Secret Key | Simple test key | Not used in production |
| Logging Level | DEBUG | See all application activity |
| CORS | Allow all origins | Frontend runs on different port |
| JWT Expiry | Long (24 hours) | Fewer token refreshes during development |
| Email Service | Disabled | Prevent sending real emails |
| File Upload Path | Local filesystem | Store uploads locally |

## Database Configuration

Development uses a local PostgreSQL database.

Connection string example:

```
postgresql://user:password@localhost:5432/sentinel_dev
```

## Logging Configuration

Development logs to console with DEBUG level.

Engineers see all application activity immediately.

---

# Testing Environment

## Purpose

Automated testing and CI/CD pipelines.

## Configuration Settings

| Setting | Value | Reason |
|---------|-------|--------|
| DEBUG | False | Test production-like behavior |
| TESTING | True | Use test database |
| Database | In-memory SQLite or test PostgreSQL | Fast, isolated tests |
| Secret Key | Random test key | Never reused |
| Logging Level | WARNING | Only important messages |
| CORS | Restricted | Test security policies |
| JWT Expiry | Short (5 minutes) | Test token refresh logic |
| Email Service | Mock service | Capture emails without sending |
| File Upload Path | Temporary directory | Clean up after tests |

## Database Configuration

Testing uses a separate test database that is created and destroyed for each test run.

Connection string example:

```
postgresql://test_user:test_password@localhost:5432/sentinel_test
```

## Testing Principles

- Each test starts with a clean database
- No data persists between tests
- External services are mocked
- All operations are isolated

---

# Production Environment

## Purpose

Live system serving real users.

## Configuration Settings

| Setting | Value | Reason |
|---------|-------|--------|
| DEBUG | False | Hide error details from users |
| TESTING | False | Use real database |
| Database | Production PostgreSQL cluster | Replicated, backed up, monitored |
| Secret Key | Cryptographically strong | Generated at deployment time |
| Logging Level | INFO | Log important events only |
| CORS | Restricted to allowed domains | Security policy |
| JWT Expiry | Medium (15 minutes) | Balance security and usability |
| Email Service | Real SMTP service | Send actual notifications |
| File Upload Path | Cloud storage (S3, etc) | Scalable, reliable |
| HTTPS | Required | All communication encrypted |
| Rate Limiting | Enabled | Prevent abuse |
| Monitoring | Enabled | Track system health |

## Database Configuration

Production uses a managed PostgreSQL cluster with:

- Automatic backups
- Replication for high availability
- Monitoring and alerts
- Connection pooling

Connection string example (from secrets):

```
postgresql://prod_user:SECURE_PASSWORD@db-cluster.prod.sentinel.com:5432/sentinel
```

## Security in Production

- No debugging information exposed
- All secrets from secure vaults
- HTTPS enforced
- Database encrypted at rest
- Regular security audits

---

# Environment Variables

Configuration is loaded from environment variables, not hardcoded.

## Environment Variable Naming Convention

```
SENTINEL_ENVIRONMENT=production
SENTINEL_DATABASE_URL=postgresql://...
SENTINEL_SECRET_KEY=...
SENTINEL_DEBUG=false
SENTINEL_TESTING=false
```

## Environment Variables Reference

| Variable | Development | Testing | Production |
|----------|-------------|---------|------------|
| SENTINEL_ENVIRONMENT | development | testing | production |
| SENTINEL_DEBUG | true | false | false |
| SENTINEL_TESTING | false | true | false |
| SENTINEL_DATABASE_URL | local sqlite | test postgres | prod postgres |
| SENTINEL_SECRET_KEY | dev-key | test-key | secure-random |
| SENTINEL_JWT_SECRET | dev-secret | test-secret | secure-random |
| SENTINEL_CORS_ORIGINS | http://localhost:3000 | http://test.local | https://sentinel.com |
| SENTINEL_LOG_LEVEL | DEBUG | WARNING | INFO |
| SENTINEL_MAIL_SERVER | (disabled) | (mock) | smtp.gmail.com |

---

# .env File

Development uses a `.env` file to load environment variables.

## .env Structure

```
# Environment
SENTINEL_ENVIRONMENT=development
SENTINEL_DEBUG=true
SENTINEL_TESTING=false

# Database
SENTINEL_DATABASE_URL=postgresql://localhost:5432/sentinel_dev

# Security
SENTINEL_SECRET_KEY=dev-secret-key-not-for-production
SENTINEL_JWT_SECRET=dev-jwt-secret

# Frontend
SENTINEL_CORS_ORIGINS=http://localhost:3000

# Logging
SENTINEL_LOG_LEVEL=DEBUG

# Email (disabled in development)
SENTINEL_MAIL_ENABLED=false
```

## .env.example

A `.env.example` file is committed to git showing the required variables.

Developers copy it to `.env` and fill in local values.

---

# .gitignore Rules

The `.env` file is never committed to git.

```
.env
.env.local
.env.*.local
.env.prod
```

Only `.env.example` is committed.

---

# Configuration Classes

Sentinel Platform uses configuration classes to organize settings.

## Class Structure

```
Config (Base)
├── DevelopmentConfig
├── TestingConfig
└── ProductionConfig
```

Each class inherits from base and overrides specific settings.

## Config Class Responsibilities

- Define configuration variables
- Set default values
- Specify environment-specific overrides
- Load from environment variables
- Validate configuration

---

# Flask Configuration Integration

The configuration class is passed to `create_app()`.

```python
from app import create_app
from app.config import DevelopmentConfig

app = create_app(config_class=DevelopmentConfig)
```

Flask automatically reads all uppercase variables from the config class.

---

# Secrets Management

Sensitive data (passwords, API keys, etc) is never hardcoded.

## Secret Storage

| Environment | Storage |
|-------------|---------|
| Development | .env file (local) |
| Testing | Environment variables (CI/CD) |
| Production | Secret vault (AWS Secrets Manager, Vault, etc) |

## Secrets Included

- Database password
- JWT secret key
- Application secret key
- SMTP password
- API keys
- Third-party credentials

---

# Configuration Validation

Configuration is validated on startup.

If a required setting is missing, the application exits with a clear error message.

## Validation Checks

- Database URL is valid
- Secret key is set
- Required environment variables exist
- Logging level is valid
- CORS configuration is valid

---

# Logging Configuration

Logging behavior depends on environment.

## Development

- Level: DEBUG
- Output: Console (stdout)
- Format: Human-readable with colors
- All events logged

## Testing

- Level: WARNING
- Output: Console or file
- Format: Minimal
- Only important events

## Production

- Level: INFO
- Output: Structured file logging
- Format: JSON (for log aggregation)
- Critical events only

---

# Database Configuration

Database settings are loaded from environment.

## Connection String Format

PostgreSQL:
```
postgresql://username:password@host:port/database
```

SQLite (development):
```
sqlite:///local/path/sentinel.db
```

## Connection Pooling

Production uses connection pooling to manage database connections efficiently.

Settings:
- Pool size: 20
- Max overflow: 10
- Pool timeout: 30 seconds
- Pool recycle: 3600 seconds

---

# JWT Configuration

JWT settings control authentication token behavior.

## Settings

| Setting | Development | Testing | Production |
|---------|-------------|---------|------------|
| Secret Key | dev-secret | test-secret | secure-random |
| Algorithm | HS256 | HS256 | HS256 |
| Access Token Expiry | 24 hours | 5 minutes | 15 minutes |
| Refresh Token Expiry | 7 days | 1 hour | 7 days |

## JWT Claims

Every token includes:
- user_id
- role
- issued_at
- expires_at

---

# Logging Configuration

The application logs to track system behavior.

## Log Levels

- DEBUG: Development information
- INFO: General informational messages
- WARNING: Warning messages
- ERROR: Error messages
- CRITICAL: Critical failures

## Log Handlers

Development: Console output
Testing: File output
Production: Structured file logging + external service

---

# Security Configuration

Security settings protect the application.

## Settings

| Setting | Value |
|---------|-------|
| HTTPS Enforced | Production only |
| Session Timeout | 30 minutes |
| Password Min Length | 12 characters |
| Password Requirements | Uppercase, lowercase, number, symbol |
| CORS Allowed Origins | Configured per environment |
| Rate Limiting | Enabled in production |
| Security Headers | Enabled in production |

---

# API Configuration

API settings configure endpoint behavior.

## Settings

| Setting | Value |
|---------|-------|
| API Version | /api/v1/ |
| Request Timeout | 30 seconds |
| Max JSON Size | 1MB |
| Max File Upload | 100MB |

---

# AI Engine Configuration

AI Engine settings control behavior analysis.

## Settings

| Setting | Development | Testing | Production |
|---------|-------------|---------|------------|
| Model | Isolation Forest | Test Model | Production Model |
| Feature Count | 10 | 10 | 50 |
| Contamination | 0.1 | 0.05 | 0.01 |
| Update Frequency | Manual | Manual | Daily |

---

# Feature Flags

Feature flags allow gradual rollout of new features.

## Flag Format

```python
FEATURE_NEW_DASHBOARD = False  # Not released yet
FEATURE_AI_ALERTS = True       # Released
```

Feature flags are set per environment.

---

# Configuration Load Order

Configuration is loaded in this order:

1. Base Config class
2. Environment-specific Config class
3. Environment variables (override class settings)
4. .env file (development only)
5. Validation

---

# Configuration File Structure

```
backend/
├── app/
│   ├── config.py          # Configuration classes
│   ├── __init__.py        # create_app() function
│   └── extensions.py
├── .env                   # Local dev variables (gitignored)
├── .env.example          # Example variables (committed)
├── .gitignore
└── requirements.txt
```

---

# Development Workflow

1. Engineer clones repository
2. Creates `.env` from `.env.example`
3. Fills in local database URL
4. Runs Flask app with DevelopmentConfig
5. Flask automatically reads from .env

---

# Testing Workflow

1. CI/CD pipeline starts
2. Sets SENTINEL_ENVIRONMENT=testing
3. TestingConfig is loaded
4. Test database is created
5. Tests run in isolation
6. Database is destroyed

---

# Production Deployment

1. Application is deployed
2. SENTINEL_ENVIRONMENT=production is set
3. ProductionConfig is loaded
4. Secrets are loaded from vault
5. Database connections are pooled
6. Monitoring is enabled
7. Application starts serving requests

---

# Configuration Best Practices

1. Never hardcode secrets
2. Use environment variables
3. Validate configuration on startup
4. Different config per environment
5. Log configuration issues clearly
6. Document all settings
7. Use .env.example as reference
8. Keep secrets in secure vaults
9. Rotate secrets regularly
10. Monitor configuration changes

---

# Status

Approved

Version 1.0