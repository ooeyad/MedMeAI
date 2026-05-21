"""tenant isolation: add tenant_id to branches, patients, doctors, appointments

Revision ID: 0005_tenant_isolation
Revises: 0004_tenant
Create Date: 2026-05-17 13:00:00
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision = "0005_tenant_isolation"
down_revision = "0004_tenant"
branch_labels = None
depends_on = None


_TABLES = ("branches", "patients", "doctors", "appointments")


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    # Discover the default tenant id (created in 0004_tenant migration).
    default_tenant_id = bind.execute(sa.text(
        "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1"
    )).scalar()

    for table in _TABLES:
        if "tenant_id" in {c["name"] for c in insp.get_columns(table)}:
            continue
        op.add_column(table, sa.Column("tenant_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_tenant", table, "tenants",
            ["tenant_id"], ["id"], ondelete="RESTRICT",
        )
        op.create_index(f"ix_{table}_tenant_id", table, ["tenant_id"])

    # Backfill — chain via existing relationships first; fall back to default.
    # branches inherit tenant from clinics
    bind.execute(sa.text(
        "UPDATE branches b SET tenant_id = c.tenant_id "
        "FROM clinics c WHERE b.clinic_id = c.id AND b.tenant_id IS NULL"
    ))
    # doctors: pick the first associated branch's tenant
    bind.execute(sa.text(
        "UPDATE doctors d SET tenant_id = ("
        "  SELECT b.tenant_id FROM doctor_branches db "
        "  JOIN branches b ON b.id = db.branch_id "
        "  WHERE db.doctor_id = d.id LIMIT 1"
        ") WHERE d.tenant_id IS NULL"
    ))
    # patients: derive from the user's tenant (if any), else default
    bind.execute(sa.text(
        "UPDATE patients p SET tenant_id = u.tenant_id "
        "FROM users u WHERE p.user_id = u.id AND p.tenant_id IS NULL"
    ))
    # appointments: from branch
    bind.execute(sa.text(
        "UPDATE appointments a SET tenant_id = b.tenant_id "
        "FROM branches b WHERE a.branch_id = b.id AND a.tenant_id IS NULL"
    ))

    if default_tenant_id is not None:
        for table in _TABLES:
            bind.execute(sa.text(
                f"UPDATE {table} SET tenant_id = :tid WHERE tenant_id IS NULL"
            ), {"tid": default_tenant_id})


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for table in reversed(_TABLES):
        if "tenant_id" not in {c["name"] for c in insp.get_columns(table)}:
            continue
        try:
            op.drop_constraint(f"fk_{table}_tenant", table, type_="foreignkey")
        except Exception:
            pass
        try:
            op.drop_index(f"ix_{table}_tenant_id", table_name=table)
        except Exception:
            pass
        op.drop_column(table, "tenant_id")
