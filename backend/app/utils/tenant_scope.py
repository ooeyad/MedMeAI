"""Tenant scoping helpers.

Every query touching tenant-aware data goes through `scope_to_tenant` so
the right `WHERE tenant_id = ?` clause is injected. Super admins are
allowed to see all tenants by default, but the active tenant context
(an `X-Tenant-Id` header) can narrow them too.
"""
from __future__ import annotations

from typing import Any

from flask import g, has_request_context, request

from ..models.user import User


# ---------------------------------------------------------------------------
def active_tenant_id(user: User | None = None) -> int | None:
    """Return the tenant the current request should be scoped to.

    Priority:
    1. Explicit `X-Tenant-Id` header (super_admin only)
    2. Authenticated user's `tenant_id`
    3. None — only super_admin without an override sees this
    """
    if user is None:
        from flask_jwt_extended import current_user
        try:
            user = current_user
        except Exception:
            user = None

    if user is None:
        return None

    role_codes = {r.code for r in (user.roles or [])}
    is_super = "super_admin" in role_codes

    if is_super and has_request_context():
        hdr = request.headers.get("X-Tenant-Id")
        if hdr:
            try:
                return int(hdr)
            except ValueError:
                pass
        # If super_admin didn't override, fall back to their own tenant_id (if any)
        # so the dashboards aren't surprisingly empty.
        if user.tenant_id:
            return user.tenant_id
        return None

    return user.tenant_id


def is_super_admin(user: User | None = None) -> bool:
    if user is None:
        from flask_jwt_extended import current_user
        try:
            user = current_user
        except Exception:
            return False
    return "super_admin" in {r.code for r in (user.roles or [])}


# ---------------------------------------------------------------------------
def scope_query(stmt, model, *, user: User | None = None):
    """Apply a tenant filter to a SQLAlchemy select statement.

    - For non-super-admin users: ALWAYS scope to their tenant_id.
    - For super_admin: scope only if X-Tenant-Id header is present;
      otherwise return the unfiltered statement.
    """
    if user is None:
        from flask_jwt_extended import current_user
        try:
            user = current_user
        except Exception:
            user = None

    if not hasattr(model, "tenant_id"):
        return stmt

    if user is None:
        return stmt.where(model.tenant_id.is_(None))   # no-op for unauthenticated callers

    if is_super_admin(user):
        # Super admin: respect X-Tenant-Id if given
        if has_request_context():
            hdr = request.headers.get("X-Tenant-Id")
            if hdr:
                try:
                    return stmt.where(model.tenant_id == int(hdr))
                except ValueError:
                    pass
        return stmt   # full visibility

    tid = user.tenant_id
    if tid is None:
        # Edge case: regular user without tenant — return nothing.
        return stmt.where(model.tenant_id == -1)
    return stmt.where(model.tenant_id == tid)


def tenant_id_for_new_row(user: User | None = None) -> int | None:
    """Compute the tenant_id to use when inserting new tenant-scoped rows."""
    return active_tenant_id(user)
