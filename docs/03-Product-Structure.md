# 03 - Product Structure

## Purpose

This document defines the overall structure of Sentinel Platform, its major components, and how they interact with each other.

It serves as the architectural foundation for the entire project.

---

# What is Sentinel Platform?

Sentinel Platform is an AI-powered cybersecurity platform that monitors, analyzes, and explains user behavior inside web applications in real time.

The platform combines a collaborative workspace with an intelligent security engine to detect suspicious activities while users perform their daily work.

---

# System Overview

Sentinel Platform consists of four main components:

1. Sentinel Workspace
2. Sentinel AI Engine
3. Security Dashboard
4. Sentinel API

Each component has a specific responsibility.

---

# 1. Sentinel Workspace

The Workspace is where users perform their daily activities.

Its purpose is productivity, not security.

Examples of features:

- Authentication
- Projects
- Tasks
- File Management
- Notes
- Team Chat
- Search
- Notifications

Every meaningful action performed inside the Workspace generates an Event.

---

# 2. Sentinel AI Engine

The AI Engine is responsible for analyzing user behavior.

Responsibilities:

- Receive events
- Analyze behavior
- Detect anomalies
- Calculate risk score
- Generate explanations
- Produce security alerts

The AI Engine works silently in the background.

---

# 3. Security Dashboard

The Security Dashboard is used by security teams.

Its purpose is monitoring and investigation.

Features include:

- Live Events
- Alerts
- High-Risk Users
- Analytics
- User Investigation
- Threat Timeline

---

# 4. Sentinel API

The API allows external systems to communicate with Sentinel Platform.

Future integrations may include:

- Other web applications
- Enterprise systems
- Third-party services

This allows Sentinel Platform to monitor more than its own Workspace.

---

# High-Level Workflow

User

↓

Uses Workspace

↓

Action Occurs

↓

Event Created

↓

Event Pipeline

↓

AI Engine

↓

Risk Analysis

↓

Database

↓

Security Dashboard

---

# Core Principle

Every meaningful user interaction becomes an Event.

Each Event is stored, analyzed, and made available for security monitoring.

---

# Design Philosophy

Workspace exists to help people work.

AI exists to protect the Workspace.

Security should operate in the background without interrupting normal users.

---

# Status

Approved

Version 1.0