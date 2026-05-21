"""billing: catalog (items, price lists) + invoices + payments

Revision ID: 0006_billing
Revises: 0005_tenant_isolation
Create Date: 2026-05-17 14:00:00
"""
from alembic import op
from sqlalchemy import inspect

from app.extensions import db
from app import models  # noqa: F401


revision = "0006_billing"
down_revision = "0005_tenant_isolation"
branch_labels = None
depends_on = None


_TABLES = (
    "item_categories",
    "items",
    "price_lists",
    "price_list_entries",
    "invoices",
    "invoice_lines",
    "payments",
)


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for name in _TABLES:
        if not insp.has_table(name):
            db.metadata.tables[name].create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for name in reversed(_TABLES):
        if insp.has_table(name):
            db.metadata.tables[name].drop(bind=bind, checkfirst=True)
