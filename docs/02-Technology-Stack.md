# 02 - Technology Stack

## Purpose

This document defines the technologies used to build Sentinel Platform and explains why each technology was selected.

The technology stack should remain stable unless there is a strong architectural reason to change it.

---

# Architecture Overview

Sentinel Platform is divided into four main parts:

- Frontend
- Backend
- AI Engine
- Database

Each component has a specific responsibility.

---

# Frontend

## Framework

React

### Why React?

- Component-based architecture
- Fast development
- Large ecosystem
- Excellent community support
- Suitable for scalable applications

---

## Language

TypeScript

### Why TypeScript?

- Strong typing
- Fewer runtime errors
- Better developer experience
- Easier maintenance
- More reliable large projects

---

## Styling

Tailwind CSS

### Why Tailwind?

- Fast UI development
- Consistent design
- Easy customization
- Excellent performance

---

## Routing

React Router

Purpose:

- Navigation between pages
- Protected routes
- Nested layouts

---

## Real-Time Communication

Socket.IO Client

Purpose:

Receive live security events from the backend.

---

# Backend

## Framework

Flask

### Why Flask?

- Lightweight
- Flexible
- Easy AI integration
- Excellent Python ecosystem

---

## Database ORM

SQLAlchemy

Purpose:

Communicate with PostgreSQL using Python objects instead of raw SQL.

---

## Authentication

JWT (JSON Web Token)

Purpose:

Secure user authentication and API authorization.

---

## Database Migration

Flask-Migrate

Purpose:

Manage database schema changes safely.

---

## Real-Time Communication

Flask-SocketIO

Purpose:

Send live updates to the Security Dashboard.

---

# Database

## PostgreSQL

Why PostgreSQL?

- Reliable
- Secure
- Excellent performance
- ACID compliant
- Supports complex queries

---

# AI Engine

## Language

Python

Reason:

Python has the strongest AI ecosystem.

---

## Machine Learning

Scikit-Learn

Initial Model:

Isolation Forest

Purpose:

Detect anomalous user behavior.

---

# Version Control

Git

Purpose:

Track project history.

---

GitHub

Purpose:

Source code hosting and collaboration.

---

# Deployment

Docker

Purpose:

Create a consistent deployment environment.

---

# Technology Summary

| Layer | Technology |
|--------|------------|
| Frontend | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Flask |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Authentication | JWT |
| AI | Scikit-Learn |
| Realtime | Socket.IO |
| Version Control | Git & GitHub |
| Deployment | Docker |

---

# Status

Approved

Version 1.0