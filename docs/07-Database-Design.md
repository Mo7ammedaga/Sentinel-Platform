# 07 - Database Design

## Purpose

This document defines the database structure of Sentinel Platform.

The database stores all business data, security events, AI analysis results, and user information.

The goal is to provide a scalable and organized foundation for the platform.

---

# Database System

Sentinel Platform uses:

PostgreSQL

The database is managed through SQLAlchemy ORM and Flask-Migrate.

---

# Database Groups

The database is divided into four logical groups:

1. User Data
2. Workspace Data
3. Security Data
4. AI Data

---

# User Data

The User Data group stores information related to platform users.

Main entities include:

- Users
- Roles
- User Profiles

Purpose:

- Authentication
- Authorization
- Profile management

---

# Workspace Data

Workspace Data stores information generated during daily work.

Main entities include:

- Projects
- Tasks
- Files
- Notes
- Messages
- Notifications

Purpose:

Support collaboration and productivity.

---

# Security Data

Security Data stores all security-related records.

Main entities include:

- Events
- Alerts
- Investigations

Purpose:

Monitor user activity and support security investigations.

---

# AI Data

The AI Data group stores information produced by the AI Engine.

Main entities include:

- AI Analysis
- Risk Scores
- Explanations

Purpose:

Support anomaly detection and historical analysis.

---

# Database Relationships

Users own Projects.

Projects contain Tasks.

Users upload Files.

Users create Notes.

Users send Messages.

Every user action generates an Event.

Each Event is analyzed by the AI Engine.

AI analysis produces Risk Scores and Alerts.

---

# Database Principles

The database should:

- Avoid duplicate data
- Maintain data integrity
- Support future expansion
- Store historical records
- Support efficient querying

---

# Future Expansion

Future versions may introduce additional entities, including:

- Organizations
- Teams
- API Clients
- Audit Logs
- Threat Intelligence

The database should support these additions without major redesign.

---

# Status

Approved

Version 1.0