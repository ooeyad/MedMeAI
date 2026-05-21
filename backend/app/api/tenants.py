"""Tenant + tenant settings API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..errors import Forbidden
from ..rbac import require_permission
from ..services import tenant_service

tenants_bp = Blueprint("tenants", __name__)


def _ser_tenant(t):
    return {
        "id": t.id, "slug": t.slug, "name": t.name, "name_ar": t.name_ar,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _ser_settings(s):
    return {
        "id": s.id, "tenant_id": s.tenant_id,
        "logo_url": s.logo_url, "favicon_url": s.favicon_url,
        "primary_color": s.primary_color, "accent_color": s.accent_color,
        "tagline": s.tagline,
        "default_timezone": s.default_timezone,
        "default_language": s.default_language,
        "supported_languages": s.supported_languages,
        "currency": s.currency,
        "appointment_slot_minutes_default": s.appointment_slot_minutes_default,
        "working_hours_default": s.working_hours_default,
        "notification_templates": s.notification_templates,
        "features": s.features,
        "support_email": s.support_email,
        "support_phone": s.support_phone,
        "website_url": s.website_url,
        "public_address": s.public_address,
    }


def _enforce_own_tenant(tenant_id: int) -> None:
    """Clinic admins can only act on their own tenant; super admins on any."""
    roles = {r.code for r in current_user.roles}
    if "super_admin" in roles:
        return
    if current_user.tenant_id != tenant_id:
        raise Forbidden("You can only manage your own tenant")


# ---------------------------------------------------------------------------
# Super admin: tenants CRUD
# ---------------------------------------------------------------------------
@tenants_bp.get("/")
@require_permission("users:read")   # super_admin and clinic_admin have this
def list_tenants():
    roles = {r.code for r in current_user.roles}
    if "super_admin" in roles:
        rows = tenant_service.list_tenants()
    elif current_user.tenant_id:
        rows = [tenant_service.get_tenant(current_user.tenant_id)]
    else:
        rows = []
    return jsonify({"data": [_ser_tenant(t) for t in rows]}), 200


@tenants_bp.post("/")
@require_permission("users:write")  # restrict to super_admin via role check below
def create_tenant():
    if "super_admin" not in {r.code for r in current_user.roles}:
        raise Forbidden("Only super admins can create tenants")
    body = request.get_json() or {}
    t = tenant_service.create_tenant(
        slug=body.get("slug"),
        name=body.get("name"),
        name_ar=body.get("name_ar"),
        actor_user_id=current_user.id,
    )
    return jsonify(_ser_tenant(t)), 201


@tenants_bp.get("/<int:tenant_id>")
@require_permission("users:read")
def get_tenant(tenant_id: int):
    _enforce_own_tenant(tenant_id)
    return jsonify(_ser_tenant(tenant_service.get_tenant(tenant_id))), 200


@tenants_bp.patch("/<int:tenant_id>")
@require_permission("users:write")
def update_tenant(tenant_id: int):
    _enforce_own_tenant(tenant_id)
    t = tenant_service.update_tenant(tenant_id, request.get_json() or {}, actor_user_id=current_user.id)
    return jsonify(_ser_tenant(t)), 200


# ---------------------------------------------------------------------------
# Tenant settings (clinic_admin for their own tenant; super_admin for any)
# ---------------------------------------------------------------------------
@tenants_bp.get("/<int:tenant_id>/settings")
@require_permission("users:read")
def get_settings(tenant_id: int):
    _enforce_own_tenant(tenant_id)
    return jsonify(_ser_settings(tenant_service.get_settings(tenant_id))), 200


@tenants_bp.put("/<int:tenant_id>/settings")
@require_permission("users:write")
def update_settings(tenant_id: int):
    _enforce_own_tenant(tenant_id)
    s = tenant_service.update_settings(
        tenant_id, request.get_json() or {}, actor_user_id=current_user.id,
    )
    return jsonify(_ser_settings(s)), 200


# ---------------------------------------------------------------------------
# Public-ish endpoint that any authenticated user can hit to learn about
# their own tenant (used by the web app to load branding on boot).
# ---------------------------------------------------------------------------
@tenants_bp.get("/me")
def me():
    """Return the calling user's tenant + (public) settings.

    No auth required — this is meant to be called by clients on boot to
    load branding before sign-in. Returns the default tenant if unauthenticated.
    """
    from flask_jwt_extended import verify_jwt_in_request
    tenant_id = None
    is_super = False
    try:
        verify_jwt_in_request(optional=True)
        if current_user is not None:
            is_super = "super_admin" in {r.code for r in current_user.roles}
            if current_user.tenant_id:
                tenant_id = current_user.tenant_id
    except Exception:
        tenant_id = None

    # Super-admin override via the same X-Tenant-Id header used everywhere
    # else — keeps branding in sync with the active tenant scope.
    if is_super:
        hdr = request.headers.get("X-Tenant-Id")
        if hdr:
            try:
                tenant_id = int(hdr)
            except ValueError:
                pass

    if tenant_id is None:
        t = tenant_service.get_by_slug("default")
        if t is None:
            return jsonify({"tenant": None, "settings": None}), 200
        tenant_id = t.id
    t = tenant_service.get_tenant(tenant_id)
    s = tenant_service.get_settings(tenant_id)
    return jsonify({"tenant": _ser_tenant(t), "settings": _ser_settings(s)}), 200
