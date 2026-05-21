"""Audit log service — every mutating call lands here."""
from __future__ import annotations

import logging
from typing import Any

from flask import has_request_context, request

from ..extensions import db
from ..models.audit import AuditLog

logger = logging.getLogger(__name__)


def record(
    *,
    user_id: int | None,
    role: str | None,
    action: str,
    entity_type: str | None = None,
    entity_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    source_channel: str | None = None,
) -> None:
    """Persist a single audit entry. Never raises — failures are logged."""
    try:
        ip = ua = req_id = None
        if has_request_context():
            ip = request.headers.get("X-Forwarded-For", request.remote_addr)
            ua = request.headers.get("User-Agent")
            req_id = request.environ.get("request_id")
        entry = AuditLog(
            user_id=user_id,
            role=role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=_jsonable(old_value),
            new_value=_jsonable(new_value),
            ip=ip,
            user_agent=ua,
            source_channel=source_channel,
            request_id=req_id,
        )
        db.session.add(entry)
        # Caller is expected to commit; we flush here to surface FK errors early
        db.session.flush()
    except Exception:
        logger.exception("audit-record-failed", extra={"action": action})


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items() if not k.startswith("_")}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if hasattr(value, "value"):  # enum
        return value.value
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)
