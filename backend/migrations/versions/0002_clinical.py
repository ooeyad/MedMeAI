"""clinical: prescriptions, lab orders, vitals, consultation notes

Revision ID: 0002_clinical
Revises: 0001_initial
Create Date: 2026-05-17 00:00:00
"""
from alembic import op
from sqlalchemy import inspect

from app.extensions import db
from app import models  # noqa: F401 — ensure all models imported


revision = "0002_clinical"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


_NEW_TABLES = ("prescriptions", "lab_orders", "vitals", "consultation_notes")


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for table_name in _NEW_TABLES:
        if insp.has_table(table_name):
            continue
        table = db.metadata.tables[table_name]
        table.create(bind=bind, checkfirst=True)


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    for table_name in reversed(_NEW_TABLES):
        if insp.has_table(table_name):
            db.metadata.tables[table_name].drop(bind=bind, checkfirst=True)
