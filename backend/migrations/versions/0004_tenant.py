"""tenancy: tenants + tenant_settings + backfill default tenant + add tenant_id to users/clinics

Revision ID: 0004_tenant
Revises: 0003_lab_order_kind
Create Date: 2026-05-17 12:00:00
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

from app.extensions import db
from app import models  # noqa: F401 — ensure metadata loaded


revision = "0004_tenant"
down_revision = "0003_lab_order_kind"
branch_labels = None
depends_on = None


_TABLES = ("tenants", "tenant_settings")


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    # 1. Create new tables (tenants + tenant_settings)
    for name in _TABLES:
        if not insp.has_table(name):
            db.metadata.tables[name].create(bind=bind, checkfirst=True)

    # 2. Backfill: ensure there's a default tenant row, capture its id
    default_tenant_id = bind.execute(sa.text(
        "SELECT id FROM tenants WHERE slug = 'default'"
    )).scalar()
    if default_tenant_id is None:
        bind.execute(sa.text(
            "INSERT INTO tenants (slug, name, is_active, created_at, updated_at) "
            "VALUES ('default', 'MedMe Health Network', TRUE, now(), now())"
        ))
        default_tenant_id = bind.execute(sa.text(
            "SELECT id FROM tenants WHERE slug = 'default'"
        )).scalar()

    # Default settings
    has_settings = bind.execute(sa.text(
        "SELECT 1 FROM tenant_settings WHERE tenant_id = :tid"
    ), {"tid": default_tenant_id}).scalar()
    if not has_settings:
        bind.execute(sa.text(
            "INSERT INTO tenant_settings (tenant_id, default_timezone, default_language, "
            "currency, appointment_slot_minutes_default, created_at, updated_at) "
            "VALUES (:tid, 'Asia/Amman', 'en', 'JOD', 30, now(), now())"
        ), {"tid": default_tenant_id})

    # 3. Add tenant_id columns to users + clinics
    user_cols = {c["name"] for c in insp.get_columns("users")}
    if "tenant_id" not in user_cols:
        op.add_column("users", sa.Column("tenant_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_users_tenant", "users", "tenants",
            ["tenant_id"], ["id"], ondelete="RESTRICT",
        )
        op.create_index("ix_users_tenant_id", "users", ["tenant_id"])
        bind.execute(sa.text("UPDATE users SET tenant_id = :tid WHERE tenant_id IS NULL"),
                     {"tid": default_tenant_id})

    clinic_cols = {c["name"] for c in insp.get_columns("clinics")}
    if "tenant_id" not in clinic_cols:
        op.add_column("clinics", sa.Column("tenant_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_clinics_tenant", "clinics", "tenants",
            ["tenant_id"], ["id"], ondelete="RESTRICT",
        )
        op.create_index("ix_clinics_tenant_id", "clinics", ["tenant_id"])
        bind.execute(sa.text("UPDATE clinics SET tenant_id = :tid WHERE tenant_id IS NULL"),
                     {"tid": default_tenant_id})


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for table, idx, fk in (
        ("clinics", "ix_clinics_tenant_id", "fk_clinics_tenant"),
        ("users", "ix_users_tenant_id", "fk_users_tenant"),
    ):
        if "tenant_id" in {c["name"] for c in insp.get_columns(table)}:
            try:
                op.drop_constraint(fk, table, type_="foreignkey")
            except Exception:
                pass
            try:
                op.drop_index(idx, table_name=table)
            except Exception:
                pass
            op.drop_column(table, "tenant_id")
    for name in reversed(_TABLES):
        if insp.has_table(name):
            db.metadata.tables[name].drop(bind=bind, checkfirst=True)
