"""add kind enum + column to lab_orders

Revision ID: 0003_lab_order_kind
Revises: 0002_clinical
Create Date: 2026-05-17 00:00:00
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision = "0003_lab_order_kind"
down_revision = "0002_clinical"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    columns = {c["name"] for c in insp.get_columns("lab_orders")}
    if "kind" in columns:
        return

    # Postgres-only: create the enum type then add the column.
    if bind.dialect.name == "postgresql":
        op.execute("CREATE TYPE lab_order_kind AS ENUM ('lab', 'imaging', 'procedure', 'referral')")
        op.add_column(
            "lab_orders",
            sa.Column("kind", sa.Enum("lab", "imaging", "procedure", "referral", name="lab_order_kind", create_type=False), nullable=False, server_default="lab"),
        )
    else:
        op.add_column(
            "lab_orders",
            sa.Column("kind", sa.String(32), nullable=False, server_default="lab"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_column("lab_orders", "kind")
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS lab_order_kind")
