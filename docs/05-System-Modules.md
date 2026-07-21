# 05 - System Modules

## Purpose

This document defines the major modules of Sentinel Platform and explains the responsibility of each module.

Each module has a single responsibility and communicates with other modules through well-defined interfaces.

---

# System Modules

Sentinel Platform Version 1.0 consists of the following modules:

1. Authentication
2. Workspace
3. Projects
4. Tasks
5. File Management
6. Notes
7. Team Chat
8. Notifications
9. Search
10. Event Pipeline
11. AI Engine
12. Security Dashboard

---

# 1. Authentication

## Purpose

Responsible for user authentication and identity verification.

## Responsibilities

- Login
- Logout
- Registration
- Password Reset
- JWT Authentication
- Session Management

---

# 2. Workspace

## Purpose

The central environment where users perform their daily work.

The Workspace connects all business-related modules.

---

# 3. Projects

## Purpose

Manage projects inside the Workspace.

## Responsibilities

- Create projects
- Update projects
- Archive projects
- View project details

---

# 4. Tasks

## Purpose

Manage work tasks.

## Responsibilities

- Create tasks
- Assign tasks
- Update task status
- Complete tasks

---

# 5. File Management

## Purpose

Manage uploaded files.

## Responsibilities

- Upload files
- Download files
- Delete files
- Organize files

---

# 6. Notes

## Purpose

Allow users to create and manage personal or shared notes.

---

# 7. Team Chat

## Purpose

Provide communication between team members.

---

# 8. Notifications

## Purpose

Notify users about important events.

Examples include:

- Task assigned
- Project updated
- Security alert
- System notification

---

# 9. Search

## Purpose

Search across platform resources.

Search should support:

- Projects
- Tasks
- Files
- Notes

---

# 10. Event Pipeline

## Purpose

Collect every meaningful event generated inside the Workspace.

Examples:

- User Login
- File Upload
- Task Created
- Project Updated

The Event Pipeline forwards events to the AI Engine.

---

# 11. AI Engine

## Purpose

Analyze collected events.

## Responsibilities

- Behavioral analysis
- Risk scoring
- Anomaly detection
- Alert generation
- Explainable AI results

---

# 12. Security Dashboard

## Purpose

Provide security visibility for Security Analysts and System Administrators.

## Features

- Live Events
- Alerts
- High-Risk Users
- Analytics
- Investigations

---

# Module Relationship

Authentication provides access to the Workspace.

Workspace contains business modules.

Business modules generate Events.

Events are collected by the Event Pipeline.

The AI Engine analyzes Events.

Analysis results are displayed in the Security Dashboard.

---

# Design Principles

- Each module has one primary responsibility.
- Modules should remain independent whenever possible.
- Communication between modules should be clear and maintainable.
- New modules should be added without affecting existing modules.

---

# Status

Approved

Version 1.0