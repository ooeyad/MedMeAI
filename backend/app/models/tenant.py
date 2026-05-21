"""Tenant — the top-level organisation owning clinics, doctors, patients.

A MedMeAI install can host many medical centers / hospital networks (each
is a Tenant). Below a Tenant sit Clinics, then Branches. Users and clinical
data are scoped to a single Tenant.

`TenantSettings` holds the configurable surface a clinic admin can edit
without code changes — branding, default working hours, languages,
notification template overrides, feature flags.
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class Tenant(TimestampMixin, db.Model):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    settings: Mapped["TenantSettings | None"] = relationship(
        back_populates="tenant", uselist=False, cascade="all,delete"
    )


class TenantSettings(TimestampMixin, db.Model):
    __tablename__ = "tenant_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(512))
    favicon_url: Mapped[str | None] = mapped_column(String(512))
    primary_color: Mapped[str | None] = mapped_column(String(16))   # CSS hex e.g. "#0d9488"
    accent_color: Mapped[str | None] = mapped_column(String(16))
    tagline: Mapped[str | None] = mapped_column(String(255))

    # Defaults
    default_timezone: Mapped[str] = mapped_column(String(64), default="Asia/Amman", nullable=False)
    default_language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    supported_languages: Mapped[list | None] = mapped_column(JSONB)   # ["en", "ar"]
    currency: Mapped[str] = mapped_column(String(8), default="JOD", nullable=False)
    appointment_slot_minutes_default: Mapped[int] = mapped_column(default=30, nullable=False)
    working_hours_default: Mapped[dict | None] = mapped_column(JSONB)  # {"monday": {"open":"09:00","close":"17:00"}, ...}

    # Notification template overrides — {code: {subject, body}, ...}
    notification_templates: Mapped[dict | None] = mapped_column(JSONB)

    # Feature flags
    features: Mapped[dict | None] = mapped_column(JSONB)
    # Example shape:
    # {
    #   "telemedicine": true,
    #   "ai_assistant": true,
    #   "patient_self_registration": true,
    #   "require_kyc_before_booking": false,
    #   "show_branding_in_emails": true
    # }

    # Contact / public-facing info
    support_email: Mapped[str | None] = mapped_column(String(255))
    support_phone: Mapped[str | None] = mapped_column(String(64))
    website_url: Mapped[str | None] = mapped_column(String(512))
    public_address: Mapped[str | None] = mapped_column(Text)

    tenant: Mapped[Tenant] = relationship(back_populates="settings")
