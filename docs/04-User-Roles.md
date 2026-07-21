# 04 - User Roles

## Purpose

This document defines the user roles within Sentinel Platform, their responsibilities, and their permissions.

It ensures that every user has access only to the features required for their responsibilities.

---

# Access Control Principle

Sentinel Platform follows the **Principle of Least Privilege**.

Every user is granted only the permissions necessary to perform their job.

---

# User Roles

Version 1.0 includes four primary roles:

1. Employee
2. Manager
3. Security Analyst
4. System Administrator

---

# 1. Employee

## Description

The Employee is the standard user of Sentinel Workspace.

Employees use the platform to perform their daily work.

## Permissions

- Log in and log out
- Manage personal profile
- Create and manage personal projects (if permitted)
- Create, update, and complete tasks
- Upload and download files
- Create and edit notes
- Use team chat
- Search workspace content
- Receive notifications

## Restrictions

Employees cannot:

- Access the Security Dashboard
- View security investigations
- Manage users
- Change system settings
- Configure the AI Engine

---

# 2. Manager

## Description

Managers supervise teams and monitor project progress.

## Permissions

Managers inherit Employee permissions and can also:

- Create team projects
- Assign tasks to team members
- View team progress
- Manage team members
- Review team activity

## Restrictions

Managers cannot:

- Access system administration
- Configure security settings
- Modify AI Engine settings

---

# 3. Security Analyst

## Description

Security Analysts monitor user behavior and investigate security incidents using Sentinel AI.

## Permissions

- Access the Security Dashboard
- Monitor live events
- View AI alerts
- Investigate suspicious activities
- Review risk scores
- Search security events
- View security analytics

## Restrictions

Security Analysts cannot:

- Modify workspace projects
- Manage business tasks
- Manage users
- Change platform settings

---

# 4. System Administrator

## Description

The System Administrator manages the Sentinel Platform.

## Permissions

- Manage users
- Assign user roles
- Configure platform settings
- Manage security settings
- Manage API integrations
- View all platform data
- Access all dashboards

## Responsibilities

- Maintain system availability
- Configure platform services
- Manage access control
- Support organizational security policies

---

# Permission Matrix

| Permission |
 Employee | Manager | Security Analyst | System Administrator |
|------------|----------|---------|------------------|----------------------|
| Workspace Access | ✅ | ✅ | ✅ | ✅ |
| Projects         | ✅ | ✅ | ❌ | ✅ |
| Tasks            | ✅ | ✅ | ❌ | ✅ |
| Files            | ✅ | ✅ | ❌ | ✅ |
| Notes            | ✅ | ✅ | ❌ | ✅ |
| Team Chat        | ✅ | ✅ | ❌ | ✅ |
| Security Dashboard| ❌ | ❌ | ✅ | ✅ |
| AI Alerts         | ❌ | ❌ | ✅ | ✅ |
| Security Analytics| ❌ | ❌ | ✅ | ✅ |
| User Management  | ❌ | ❌ | ❌ | ✅ |
| System Settings  | ❌ | ❌ | ❌ | ✅ |
| API Management   | ❌ | ❌ | ❌ | ✅ |

---

# Future Expansion

The architecture supports adding new roles in future versions, including:

- Auditor
- HR
- Client
- Guest

No major architectural changes should be required to introduce additional roles.

---

# Status

Approved

Version 1.0