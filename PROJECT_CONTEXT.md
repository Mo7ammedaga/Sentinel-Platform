# Sentinel Platform — Project Context & Handoff

> ## ⚠️ Session Update — 2026-07-24 (Claude Code)
> Several items this doc lists as "current bug" / "technical debt" were **already
> fixed** in the 2026-07-24 session. Corrected status is inline below and
> summarized here:
> - **Dashboard stats `--` bug: FIXED.** Root cause was NOT an expired token. It
>   was two things: (1) nothing loaded `.env`, so the app used the fallback JWT
>   secret and rejected the token with 401; (2) `CORS(app)` restricted origins to
>   `localhost:3000` from config, blocking the `file://` dashboard. Fixes:
>   `load_dotenv()` in `config.py`, `CORS(app, resources={r"/api/*": {"origins": "*"}})`
>   in `__init__.py`, and `allow_unsafe_werkzeug=True` in `run.py` (server was
>   crashing on start).
> - **`np.random` in AI engine: FIXED.** `extract_features()` now uses
>   deterministic, event-derived features (hour, action_code, off_hours,
>   burst_count). The risk-score mapping was also **inverted** (anomalies scored
>   low) — corrected so anomalies score high; status is gated by the Isolation
>   Forest prediction.
> - **Seed data:** replaced the 11 flat test events with a realistic demo set via
>   `backend/seed_demo.py` (35 normal + 7 clear anomalies). After analysis:
>   ~4 critical, ~3 suspicious, rest normal.
> - **Still open (as of first session):** hardcoded JWT in the HTML; no tests; SQLite only.
>
> ## ⚠️ Session Update 2 — 2026-07-24 (autonomous, Phase A core complete)
> The AI Engine was rebuilt for real, per the constitution. Completed & verified:
> - **A0** `backend/scripts/dev_behavior_generator.py` — deterministic, seeded,
>   scenario-library dev-data tool (dev `@sentinel.test` accounts, production guard).
> - **A1** New `app/ai/` package (`feature_extractor.py`, `analyzer.py`). Per-user
>   baseline features (all real, no randomness): hour, weekend, 5-min/1-h velocity,
>   distinct actions, sensitive-action, new-IP, new-UA, gap, outside-baseline-hours
>   (5/95 percentile of the user's OWN hours — not hardcoded). Isolation Forest per
>   user; risk = robust z-score vs the user's own anomaly-score distribution.
> - **A2** `insufficient_data` guard (< 50 events → neutral, flagged).
> - **A3** Human-readable, baseline-relative explanation per scored event.
> - **A4** New `AIAnalysis` model + migration; persists risk/status/confidence/
>   explanation/model_version/feature_vector (audit trail; re-run is idempotent).
> - **A5** `EventLogger` wired into `/auth/login` (login + failed_login events).
> - **A6** `emit_alert` now fires: anomalies push live to the org room. `socketio`
>   moved to `extensions.py` (doc 13); `run.py`/`__init__.py` refactored accordingly.
> - **A9** `SQLALCHEMY_ECHO` env-driven, off by default.
> - Removed dead code: old `app/utils/ai_engine.py`, `seed_demo.py`.
> - **Remaining Phase A:** A8 (refresh-token endpoint). A7 (login page) needs the
>   frontend-direction decision. Then Phase B (RBAC, Alert/Investigation models, CRUD).
>
> ## ⚠️ Session Update 3 — 2026-07-24 (autonomous, Phase B: B3, B1, B2)
> - **B3 RBAC** committed 1fd59c0: `@role_required` + doc-04 matrix; security
>   endpoints are analyst/admin only.
> - **B1** committed 3625ceb: Alert / Investigation / RiskScore models (real
>   migration f213cefe9a15), `security_service`, security routes, analyst-action
>   auditing. Business logic moved out of routes into the service layer.
> - **B2** (this update): workspace CRUD. `app/services/workspace_service.py` +
>   `app/routes/workspace.py` (one blueprint, thin routes) covering
>   workspaces/projects/tasks/files/notes/messages. Design decisions:
>   * Every mutation emits EXACTLY ONE Event (create/update/delete/complete/
>     upload/download/send/read) via EventLogger — feeds the AI real behaviour.
>   * REST + `{items, pagination}` envelope (`app/utils/api.py`) for the future
>     React client. `?page`/`?per_page` (clamped). This satisfies **B6**.
>   * Workspace routes are employee/manager/admin only (WORKSPACE_ROLES); analysts
>     are security-only (doc 04).
>   * AI `is_sensitive_action` is now prefix-based (download*/delete*/export*) so
>     the new action taxonomy is recognized.
>   * Light validation (required fields -> 400). Full schema validation (B4) and
>     centralized error handlers (B5) are the next milestone.
> - **Interim note on multi-tenant:** listing is scoped where cheap (workspaces by
>   org, messages by participant); strict per-org filtering on child entities is a
>   follow-up (MVP is single-org).

## What This Is
AI-powered cybersecurity monitoring platform. Monitors employee behavior in a
workspace, generates an Event for every action, analyzes events with ML
(Isolation Forest) to produce a Risk Score, and surfaces results to Security
Analysts via a dashboard with real-time WebSocket alerts.

**Core flow:**
Employee Action → Event Generated → Event Pipeline → AI Engine → Risk Score →
Security Dashboard → Alert → Investigation

## Working Style (IMPORTANT — follow this)
The owner is learning software architecture, not just collecting code.

1. Explain the idea and WHY before any code
2. Explain the architectural decision, alternatives, and tradeoffs
3. Explain which files will be created and why each needs to exist
4. Write the code in small focused pieces, not huge dumps
5. Explain each section of code
6. Test and run
7. Confirm understanding before moving to the next step

Rules:
- One step at a time. Do not jump ahead to future phases.
- Warn if an architectural mistake is about to happen. Be honest, don't just agree.
- Every file and library must have a clear justification.
- Communication is Arabic + English mixed (Arabic narration, English for
  technical terms and code).
- Owner is NOT experienced with terminal/VS Code — give precise, complete commands.

## Environment
- OS: Ubuntu (Linux)
- Path: `~/Desktop/Sentinel-Platform`
- Python 3.12.3, venv at `backend/venv`
- Node/npm installed
- **Note:** heredoc (`cat > file << 'EOF'`) has been unreliable in this terminal —
  it truncates. Prefer writing files directly.

## Locked Architectural Decisions
1. Production-grade architecture — built for thousands of users, not a toy
2. Real users only — Email + Password + Role. No AI-generated users.
3. Four roles: System Administrator, Security Analyst, Manager, Employee
4. Seed data lives in the database during development, never hardcoded in app logic
   (a dedicated seed script that populates the DB is the sanctioned exception)
5. Multi-tenant by design; MVP uses ONE organization (`organization_id` in all tables)
6. API versioning: `/api/v1/`
7. Event-driven: every meaningful user action creates exactly one Event
8. AI Engine architecturally separated from business logic
9. Docs are vision, not rigid spec — adjustable during implementation

**Deferred (do not discuss until we reach that phase):**
Celery vs Redis vs RabbitMQ, ELK vs file logging, caching strategy,
message queue type, database sharding.

## Database Schema (SQLite dev, all tables created & migrated)
**users** — id, organization_id, email (unique), password_hash, first_name,
last_name, role (default 'employee'), is_active, created_at, updated_at
**workspaces** — id, organization_id, name, description, owner_id→users, is_active, timestamps
**projects** — id, workspace_id→workspaces, name, description, owner_id→users, is_active, timestamps
**tasks** — id, project_id→projects, title, description, assigned_to→users, status, priority, timestamps
**files** — id, task_id→tasks, filename, file_path, uploaded_by→users, created_at
**notes** — id, task_id→tasks, content, created_by→users, timestamps
**messages** — id, sender_id→users, recipient_id→users, content, is_read, created_at
**events** — id, user_id→users, organization_id, action_type, resource_type,
resource_id, description, ip_address, user_agent, status (normal/suspicious/critical),
risk_score (float 0-100), created_at

## Seed Data Currently in DB (updated 2026-07-24)
- 1 user: Mohammed Alagha, `mohammed.alagha@company.com`, role `analyst`, org `org_001`
- 1 workspace / 1 project / 1 task (unchanged)
- Events: reseeded by `backend/seed_demo.py` — 35 normal work-hours events + 7
  anomalies (1 off-hours login, 3 off-hours deletions, 3 late-night bulk
  downloads). Re-run: `python seed_demo.py` then POST `/api/v1/ai/analyze`.
  NOTE: these demo events are illustrative synthetic activity attached to the
  real user — not captured behavior. Fine for demoing the AI; not "real data".

## Working API Endpoints
| Method | Endpoint | Auth | Status |
|--------|----------|------|--------|
| GET | `/` | no | ✅ |
| POST | `/api/v1/auth/login` | no | ✅ returns JWT + user object |
| GET | `/api/v1/auth/profile` | JWT | ✅ |
| POST | `/api/v1/ai/analyze` | JWT | ✅ scores last 24h of events |
| GET | `/api/v1/dashboard/stats` | JWT | ✅ counts by status |
| GET | `/api/v1/dashboard/alerts` | JWT | ✅ critical + suspicious only |
| GET | `/api/v1/dashboard/users/<id>/activity` | JWT | ✅ 7-day timeline |

WebSocket events: `connect`, `disconnect`, `join_org`, `join_user`, `alert`

## Key Dependencies
Flask 3.1.3, Flask-SQLAlchemy 3.0.5, Flask-Migrate 4.0.5, flask-socketio 5.6.1,
flask-cors 6.0.5, bcrypt 5.0.0, PyJWT 2.13.0, scikit-learn 1.9.0, python-dotenv 1.0.0

## Phases Completed
1. ✅ Configuration System (+ `load_dotenv()` fix 2026-07-24)
2. ✅ Database Layer
3. ✅ Authentication (bcrypt, JWT, @token_required)
4. ✅ Workspace Models
5. ✅ Event Pipeline (Event model, EventLogger)
6. ✅ AI Engine — Isolation Forest, real deterministic features (fixed 2026-07-24)
7. ✅ Security Dashboard — stats/alerts/activity
8. ✅ WebSocket server (handlers exist; live push not yet wired)
9. ✅ Frontend — plain HTML dashboard works, stats now populate (fixed 2026-07-24)

## Known Technical Debt (updated 2026-07-24)

### 🔴 HIGH PRIORITY — Migration history is incomplete (schema not reproducible)
**Symptom:** A fresh clone running `flask db upgrade` creates only the `users`
table. Every other table (`workspaces`, `projects`, `tasks`, `files`, `notes`,
`messages`, `events`, `ai_analyses`) is absent from a clean migration run.
**Root cause:** `run.py`'s `db.create_all()` creates any missing tables at
startup from the models, so the tables "just appear" in dev even though no
migration was ever written for them. Alembic autogenerate then sees the tables
already present in the DB and emits nothing — so the gap is invisible until a
truly clean deploy. Only `users` has a real migration.
**Correct long-term fix (do BEFORE Phase C / production):** stop, rebuild the
migration baseline so the entire schema is created purely by `flask db upgrade`:
  1. On a scratch/empty database, `flask db migrate` to autogenerate a complete
     baseline covering all current models (or squash existing history).
  2. Remove the reliance on `db.create_all()` in `run.py` for provisioning.
  3. Verify `flask db upgrade` on an empty DB reproduces the full schema.
**Interim rule (in force now):** every NEW model/schema change is fully
migration-driven — generate and commit a real migration; never rely on
`create_all()` for new tables. (B1's Alert/Investigation/RiskScore follow this.)

### Other
- ✅ ~~`AIEngine.extract_features()` uses `np.random`~~ — FIXED (deterministic features)
- ⛔ `frontend-simple/index.html` has a hardcoded JWT — still needs a real login form
- ⛔ `frontend/` is an unused create-react-app scaffold — decide: delete or build on it
- ⛔ No unit/integration tests
- ⛔ No rate limiting on auth endpoints
- ⛔ No JWT refresh token flow (config exists, unused)
- ⛔ `emit_alert()` exists in websocket.py but is never called — real-time push is dead code
- ⛔ SQLite only; PostgreSQL not configured
- ⛔ No Docker setup
- ⛔ `app/services/` directory empty — business logic currently lives in routes

## Remaining Phases
10. Wire `emit_alert()` so high-risk events push live alerts (NEXT)
11. ✅ (done early) real DB-derived AI features
12. Testing — pytest, fixtures, API integration tests
13. Deployment — Docker, PostgreSQL, production WSGI (gunicorn + eventlet for SocketIO)

## How to Run
```bash
cd ~/Desktop/Sentinel-Platform/backend
source venv/bin/activate
lsof -ti:5000 | xargs -r kill -9   # if port busy
python run.py
```
Dashboard: open `frontend-simple/index.html` in browser.

## Immediate Next Task
Wire real-time alert emission (`emit_alert`) — the feature the whole WebSocket
layer exists for, currently dead code. Then decide frontend direction. Then tests.
