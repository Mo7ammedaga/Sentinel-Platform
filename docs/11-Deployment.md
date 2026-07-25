# 11 - Deployment

## Purpose

This document defines the deployment architecture of Sentinel Platform.

Its purpose is to ensure that the platform can be deployed, maintained, and scaled consistently across different environments.

---

# Deployment Objectives

The deployment architecture should provide:

- Reliability
- Security
- Scalability
- Maintainability
- Consistency

---

# Deployment Environment

Sentinel Platform is divided into four deployable components:

- Frontend
- Backend
- AI Engine
- Database

Each component can be deployed independently.

---

# Frontend

Technology:

- React
- TypeScript
- Tailwind CSS

Responsibilities:

- User Interface
- User Interaction
- API Communication
- Live Dashboard Updates

---

# Backend

Technology:

- Flask
- SQLAlchemy
- Flask-SocketIO

Responsibilities:

- Business Logic
- Authentication
- API Services
- Event Processing

---

# AI Engine

Technology:

- Python
- Scikit-Learn

Responsibilities:

- Behavioral Analysis
- Anomaly Detection
- Risk Score Calculation
- Explainable AI Results

---

# Database

Technology:

- PostgreSQL

Responsibilities:

- Store business data
- Store Events
- Store AI Analysis
- Store Alerts
- Store user information

---

# Communication

The platform components communicate as follows:

Frontend

↓

REST API

↓

Backend

↓

Database

↓

Event Pipeline

↓

AI Engine

↓

Security Dashboard

Live updates are delivered using Socket.IO.

---

# Deployment Principles

The deployment should be:

- Secure
- Reproducible
- Easy to update
- Easy to monitor
- Easy to scale

---

# Docker

Docker is used to provide a consistent deployment environment.

Benefits include:

- Environment consistency
- Easier deployment
- Simplified dependency management

---

# Future Deployment

Future versions may include:

- Load balancing
- Multiple application servers
- CI/CD pipeline
- Container orchestration

The deployment architecture should support these improvements without major redesign.

---

# Production Deployment (Render) — current, actual setup

Cloud deployment happened before this document was updated to say so. As
actually run today:

- **Backend** — Render Web Service. Build: `pip install -r requirements.txt`.
  Start: `sh entrypoint.sh` (runs `flask db upgrade`, then gunicorn with the
  gevent-websocket worker — see `backend/entrypoint.sh`).
- **Database** — a Render-managed PostgreSQL instance, connected via
  `DATABASE_URL`.
- **Frontend** — Render Static Site, built from `frontend/` with
  `REACT_APP_API_URL` pointed at the backend service's URL.

## Required environment variables (backend Web Service)

Set these in the Render service's Environment tab — there is no
`render.yaml` in this repo, so they are not version-controlled and must be
set by hand per environment:

| Variable | Required | Notes |
|---|---|---|
| `SENTINEL_ENVIRONMENT` | yes | `production` |
| `DATABASE_URL` | yes | provided by Render's Postgres add-on |
| `SECRET_KEY`, `JWT_SECRET_KEY` | yes | app refuses to start with the built-in dev defaults in production |
| `CORS_ORIGINS` | yes | the frontend Static Site's URL |
| `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` | yes | bootstrap admin account, ensured by `flask seed-admin` on every startup; fails startup without these in production if the account doesn't exist yet — see the root README's "Getting started" section |

A fresh database gets its schema from `flask db upgrade` and its bootstrap
admin account from `flask seed-admin` — both run automatically in
`entrypoint.sh` on every startup, in that order, before the server starts.
There is no separate seed script to run and no manual database step
required beyond setting the environment variables above before the first
deploy.

`flask seed-admin` is deliberately **not** a migration: a migration runs at
most once per database, so if it ran before `DEFAULT_ADMIN_PASSWORD` was
correctly configured — or the intended admin email changes on a later
deploy — there is no clean way to make it run again without editing
migration history, which is unsafe once applied to a real database. This is
exactly what happened during this project's first Render deployment
(migration `48b247de5e75` seeded the dev-fallback account before the real
credentials were set, then never ran again). `flask seed-admin` is
idempotent by checking whether `DEFAULT_ADMIN_EMAIL` already exists as a
user — not by tracking its own execution — so it reacts correctly to
changed environment variables on every future deploy.

---

# Status

Approved

Version 1.0