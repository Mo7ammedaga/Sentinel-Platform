"""Application-wide constants (roles, permissions).

Kept in one place so role strings are never hardcoded across the codebase.
Roles mirror doc 04 - User Roles.
"""


class Roles:
    EMPLOYEE = 'employee'
    MANAGER = 'manager'
    ANALYST = 'analyst'          # "Security Analyst" in the docs
    ADMIN = 'admin'              # "System Administrator" in the docs

    ALL = (EMPLOYEE, MANAGER, ANALYST, ADMIN)


# Roles permitted to use the Security Dashboard, AI alerts and security
# analytics (doc 04 permission matrix). Everyone else is workspace-only.
SECURITY_ROLES = (Roles.ANALYST, Roles.ADMIN)

# Roles permitted to use the Workspace (projects/tasks/files/notes/chat).
# Security Analysts are security-only and do not touch business data (doc 04).
WORKSPACE_ROLES = (Roles.EMPLOYEE, Roles.MANAGER, Roles.ADMIN)


class AlertStatus:
    """Lifecycle of an AI-raised alert (the container an analyst works from)."""
    OPEN = 'open'                 # raised by the AI, not yet acted on
    INVESTIGATING = 'investigating'
    CLOSED = 'closed'
    ALL = (OPEN, INVESTIGATING, CLOSED)


class InvestigationState:
    """Analyst-driven workflow states (constitution: the analyst decides)."""
    OPEN = 'open'
    ASSIGNED = 'assigned'
    INVESTIGATING = 'investigating'
    NEEDS_EVIDENCE = 'needs_evidence'
    FALSE_POSITIVE = 'false_positive'   # terminal — analyst's verdict
    CONFIRMED = 'confirmed'             # terminal — analyst's verdict
    CLOSED = 'closed'                   # terminal
    ALL = (OPEN, ASSIGNED, INVESTIGATING, NEEDS_EVIDENCE,
           FALSE_POSITIVE, CONFIRMED, CLOSED)
    TERMINAL = (FALSE_POSITIVE, CONFIRMED, CLOSED)

# Severities an anomaly can carry into an Alert (mirrors event.status).
ALERT_SEVERITIES = ('suspicious', 'critical')
