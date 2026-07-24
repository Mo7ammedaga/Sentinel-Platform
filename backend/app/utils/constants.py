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
