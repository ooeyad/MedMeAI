"""Shared fixtures.

We deliberately do NOT call ``db.create_all()`` in unit-test fixtures: the
production schema uses Postgres-only types (ARRAY, JSONB) that SQLite cannot
materialize. Tests that require a real DB should spin up Postgres
themselves; the smoke/contract tests in this folder don't touch persistence.
"""
from __future__ import annotations

import os

import pytest

os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("TEST_DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

from app import create_app  # noqa: E402


@pytest.fixture()
def app():
    app = create_app("testing")
    with app.app_context():
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()
