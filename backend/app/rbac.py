"""Role-based access control: permissions, role mappings, and decorators.

The matrix here is intentionally explicit. When unsure if a role should have a
permission, default to "no" — operators can add permissions per environment.
"""
from __future__ import annotations

from enum import Enum
from functools import wraps
from typing import Callable, Iterable

from flask import g
from flask_jwt_extended import current_user, verify_jwt_in_request

from .errors import Forbidden, Unauthorized


class Role(str, Enum):
    SUPER_ADMIN = "super_admin"
    CLINIC_ADMIN = "clinic_admin"
    SECRETARY = "secretary"
    DOCTOR = "doctor"
    NURSE = "nurse"
    INSURANCE_OFFICER = "insurance_officer"
    PATIENT = "patient"
    AUDITOR = "auditor"


# ----------------------------------------------------------------------------
# Permissions
# ----------------------------------------------------------------------------
# Naming convention: "<resource>:<verb>" with optional ":<scope>".
PERMISSIONS: dict[Role, set[str]] = {
    Role.SUPER_ADMIN: {"*"},  # wildcard
    Role.CLINIC_ADMIN: {
        "users:read", "users:write",
        "patients:read", "patients:write",
        "kyc:read", "kyc:write", "kyc:verify",
        "doctors:read", "doctors:write",
        "branches:read", "branches:write",
        "schedules:read", "schedules:write",
        "appointments:read", "appointments:write", "appointments:cancel",
        "insurance:read", "insurance:write", "insurance:approve",
        "documents:read", "documents:write",
        "notifications:read", "notifications:write",
        "reports:read",
        "audit:read",
        "ai:chat", "ai:tools:read",
    },
    Role.SECRETARY: {
        "patients:read", "patients:write",
        "kyc:read", "kyc:write",
        "doctors:read",
        "branches:read",
        "schedules:read",
        "appointments:read", "appointments:write", "appointments:cancel",
        "insurance:read", "insurance:write",
        "documents:read", "documents:write",
        "notifications:read",
        "reports:read",
        "ai:chat",
    },
    Role.DOCTOR: {
        "patients:read",
        "doctors:read:self", "doctors:write:self",
        "schedules:read:self", "schedules:write:self",
        "appointments:read:self", "appointments:write:self",
        "insurance:read",
        "documents:read", "documents:write:self",
        "notifications:read",
        "reports:read:self",
        "ai:chat",
    },
    Role.NURSE: {
        "patients:read",
        "doctors:read",
        "schedules:read",
        "appointments:read",
        "documents:read",
        "ai:chat",
    },
    Role.INSURANCE_OFFICER: {
        "patients:read",
        "insurance:read", "insurance:write", "insurance:approve",
        "kyc:read",
        "documents:read",
        "appointments:read",
        "reports:read",
        "ai:chat",
    },
    Role.PATIENT: {
        "patients:read:self", "patients:write:self",
        "kyc:read:self", "kyc:write:self",
        "doctors:read",
        "branches:read",
        "schedules:read",
        "appointments:read:self", "appointments:write:self", "appointments:cancel:self",
        "insurance:read:self", "insurance:write:self",
        "documents:read:self", "documents:write:self",
        "notifications:read:self",
        "ai:chat",
    },
    Role.AUDITOR: {
        "patients:read",
        "kyc:read",
        "doctors:read",
        "branches:read",
        "schedules:read",
        "appointments:read",
        "insurance:read",
        "documents:read",
        "notifications:read",
        "reports:read",
        "audit:read",
        "ai:tools:read",
    },
}


def has_permission(roles: Iterable[Role | str], permission: str) -> bool:
    role_set = {Role(r) if not isinstance(r, Role) else r for r in roles}
    needed_variants = _variants(permission)
    for role in role_set:
        allowed = PERMISSIONS.get(role, set())
        if "*" in allowed:
            return True
        if any(p in allowed for p in needed_variants):
            return True
    return False


def _variants(permission: str) -> set[str]:
    """Expand `appointments:write:self` -> {appointments:write:self, appointments:write, appointments:*}."""
    parts = permission.split(":")
    out = {permission}
    for i in range(len(parts) - 1, 0, -1):
        out.add(":".join(parts[:i] + ["*"]))
        out.add(":".join(parts[:i]))
    return out


# ----------------------------------------------------------------------------
# Decorators
# ----------------------------------------------------------------------------
def require_auth(fn: Callable) -> Callable:
    @wraps(fn)
    def _wrap(*args, **kwargs):
        verify_jwt_in_request()
        if current_user is None:
            raise Unauthorized("Authentication required")
        g.current_user = current_user
        return fn(*args, **kwargs)

    return _wrap


def require_permission(*perms: str):
    """Allow when the caller has ANY of the listed permissions."""

    def _decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def _wrap(*args, **kwargs):
            verify_jwt_in_request()
            if current_user is None:
                raise Unauthorized("Authentication required")
            user_roles = [r.code for r in current_user.roles]
            if not any(has_permission(user_roles, p) for p in perms):
                raise Forbidden(f"Missing permission: {' OR '.join(perms)}")
            g.current_user = current_user
            return fn(*args, **kwargs)

        return _wrap

    return _decorator


def ensure_branch_scope(user, branch_id: int | None) -> None:
    """Re-checked inside service layer for branch-scoped operations."""
    if branch_id is None:
        return
    role_codes = {r.code for r in user.roles}
    if "super_admin" in role_codes:
        return
    user_branch_ids = {b.id for b in (user.branches or [])}
    if user_branch_ids and branch_id not in user_branch_ids:
        raise Forbidden("Branch is outside your scope")
