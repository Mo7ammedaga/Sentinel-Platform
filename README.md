# Sentinel Platform

An AI-powered **User Behavior Analytics (UBA) and insider-threat detection**
platform. Employees do real work in a collaborative workspace; every meaningful
action becomes an immutable **Event**; the **AI Engine** analyzes each event
against that user's *own* historical baseline, produces an explainable **risk
score**, and surfaces **alerts** to security analysts who investigate and decide.

> The AI flags behaviour that is **unusual for a user** — never "malicious." A
> human analyst makes every decision. A score is a signal, not a verdict.

```
Employee action → Event → AI Engine (per-user baseline) → Risk + Explanation
                                   → Alert → Investigation → Analyst verdict
```

---

## Architecture

Four components (see `docs/`):

| Component | Stack |
|-----------|-------|
| **Backend API** | Flask, SQLAlchemy, Flask-Migrate, Flask-SocketIO, JWT (PyJWT), bcrypt, pydantic |
| **AI Engine** | scikit-learn (Isolation Forest), per-user baseline features |
| **Frontend** | React + TypeScript + Tailwind (CRA), React Router, Socket.IO client |
| **Database** | PostgreSQL (prod) · SQLite (dev) |
| **Deploy** | Docker + docker-compose, gunicorn + gevent-websocket |

Backend layering (`docs/13`, `docs/14`): **routes (thin) → services (business
logic) → models ← extensions**. Cross-cutting: RBAC decorators, pydantic
validation, centralized error handling, pagination, real-time WebSocket alerts.

### The AI Engine (the product)
- Every feature is a deterministic value derived from the `events` table — no
  randomness. Temporal, velocity, behavioural-drift, new-IP / new-device, and
  "outside this user's own active hours" (5/95 percentile of their history).
- Isolation Forest **per user**; risk = a robust z-score against that user's own
  score distribution, so a well-behaved user gets nothing flagged.
- Users with < 50 events return `insufficient_data` (no baseline yet).
- Each score carries a **confidence**, a **human-readable explanation**, a
  **model version**, and a persisted **feature vector** (`AIAnalysis`) — the
  "why" is retrievable for audit, never regenerated.

---

## Getting started (development)

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # fill in local values
export FLASK_APP=run.py
flask db upgrade                     # provision the full schema (migration-driven)
python run.py                        # http://localhost:5000

# Optional: generate deterministic dev history for the AI
python scripts/dev_behavior_generator.py --seed 42 --scenario bulk_download

# Frontend
cd ../frontend
npm install
npm start                            # http://localhost:3000
```

### Tests
```bash
cd backend && pytest                 # 29 tests; coverage: pytest --cov=app
```

### Production-like (Docker)
```bash
docker compose up --build            # backend :5000 + PostgreSQL 16
```

---

## API overview (`/api/v1`)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/profile` |
| AI | `POST /ai/analyze` (analyst/admin) |
| Dashboard | `GET /dashboard/stats`, `/recent-events`, `/users/<id>/activity` |
| Security | `GET /security/alerts`, `/high-risk-users`; `POST /security/alerts/<id>/investigations`; `PATCH /security/investigations/<id>` |
| Workspace | CRUD for `workspaces`, `projects`, `tasks`, `files`, `notes`, `messages` (each mutation emits one Event) |
| Privacy | `GET /privacy/notice`; `GET /me/events`, `/me/events/export` |
| Admin | `POST /admin/retention/purge` |

All errors share one shape `{error, details?}`; list endpoints return
`{items, pagination}`.

## Roles (least privilege — `docs/04`)
- **Employee / Manager** — workspace only.
- **Security Analyst** — Security Dashboard, AI, investigations.
- **System Administrator** — everything, incl. retention.

## Human safety
See `docs/15`. Transparency notice, subject-access/export, analyst-action
auditing, retention with evidence-preservation, and a strict "no automated
consequence — a human decides" principle.

---

## Documentation
`docs/01`–`docs/15` — vision, architecture, database, API, frontend, deployment,
backend config/extensions/structure, and human-review/compliance. Living
implementation status is in `PROJECT_CONTEXT.md`.
