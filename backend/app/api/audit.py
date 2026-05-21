"""Audit API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..extensions import db
from ..models.audit import AuditLog
from ..rbac import require_permission
from ..utils.pagination import paginate

audit_bp = Blueprint("audit", __name__)


@audit_bp.get("/")
@require_permission("audit:read")
def list_audit():
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if (uid := request.args.get("user_id", type=int)):
        stmt = stmt.where(AuditLog.user_id == uid)
    if (action := request.args.get("action")):
        stmt = stmt.where(AuditLog.action == action)
    if (entity_type := request.args.get("entity_type")):
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if (entity_id := request.args.get("entity_id", type=int)):
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    page = paginate(db.session, stmt)
    def ser(a):
        return {
            "id": a.id, "user_id": a.user_id, "role": a.role, "action": a.action,
            "entity_type": a.entity_type, "entity_id": a.entity_id,
            "old_value": a.old_value, "new_value": a.new_value,
            "ip": a.ip, "user_agent": a.user_agent, "source_channel": a.source_channel,
            "request_id": a.request_id, "at": a.at.isoformat(),
        }
    return jsonify(page.to_dict(item_serializer=ser)), 200
