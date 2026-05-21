"""Tenant + TenantSettings service."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from ..errors import Conflict, NotFound, ValidationFailed
from ..extensions import db
from ..models.tenant import Tenant, TenantSettings
from . import audit_service


# ---------------------------------------------------------------------------
# Tenant lifecycle (super_admin)
# ---------------------------------------------------------------------------
def list_tenants():
    return db.session.scalars(select(Tenant).order_by(Tenant.name)).all()


def get_tenant(tenant_id: int) -> Tenant:
    t = db.session.get(Tenant, tenant_id)
    if t is None:
        raise NotFound("Tenant not found")
    return t


def get_by_slug(slug: str) -> Tenant | None:
    return db.session.scalar(select(Tenant).where(Tenant.slug == slug))


def create_tenant(*, slug: str, name: str, name_ar: str | None = None, actor_user_id: int | None) -> Tenant:
    if not slug or not name:
        raise ValidationFailed("slug and name are required")
    if get_by_slug(slug) is not None:
        raise Conflict(f"Tenant with slug '{slug}' already exists")

    t = Tenant(slug=slug, name=name, name_ar=name_ar, is_active=True)
    db.session.add(t)
    db.session.flush()

    # Seed default settings
    db.session.add(TenantSettings(tenant_id=t.id))
    audit_service.record(
        user_id=actor_user_id, role=None, action="tenant.create",
        entity_type="tenant", entity_id=t.id,
        new_value={"slug": slug, "name": name},
        source_channel="api",
    )
    db.session.commit()
    return t


def update_tenant(tenant_id: int, data: dict[str, Any], *, actor_user_id: int | None) -> Tenant:
    t = get_tenant(tenant_id)
    for f in ("name", "name_ar", "is_active"):
        if f in data:
            setattr(t, f, data[f])
    audit_service.record(
        user_id=actor_user_id, role=None, action="tenant.update",
        entity_type="tenant", entity_id=t.id, new_value=data,
        source_channel="api",
    )
    db.session.commit()
    return t


# ---------------------------------------------------------------------------
# Tenant settings (clinic_admin)
# ---------------------------------------------------------------------------
def get_settings(tenant_id: int) -> TenantSettings:
    s = db.session.scalar(select(TenantSettings).where(TenantSettings.tenant_id == tenant_id))
    if s is None:
        # Auto-create empty settings if missing
        s = TenantSettings(tenant_id=tenant_id)
        db.session.add(s)
        db.session.commit()
    return s


_EDITABLE_FIELDS = {
    "logo_url", "favicon_url", "primary_color", "accent_color", "tagline",
    "default_timezone", "default_language", "supported_languages", "currency",
    "appointment_slot_minutes_default", "working_hours_default",
    "notification_templates", "features",
    "support_email", "support_phone", "website_url", "public_address",
}


def update_settings(tenant_id: int, data: dict[str, Any], *, actor_user_id: int | None) -> TenantSettings:
    s = get_settings(tenant_id)
    changed = {}
    for f in _EDITABLE_FIELDS:
        if f in data:
            setattr(s, f, data[f])
            changed[f] = data[f] if not isinstance(data[f], dict) else "<dict>"
    audit_service.record(
        user_id=actor_user_id, role=None, action="tenant.settings.update",
        entity_type="tenant_settings", entity_id=s.id, new_value=changed,
        source_channel="api",
    )
    db.session.commit()
    return s
