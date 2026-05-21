"""Notifications API."""
from __future__ import annotations

from flask import Blueprint, jsonify
from flask_jwt_extended import current_user
from sqlalchemy import select

from ..errors import NotFound
from ..extensions import db
from ..models.notification import Notification, NotificationStatus
from ..rbac import require_permission
from ..utils.pagination import paginate
from ..utils.time_utils import utcnow

notifications_bp = Blueprint("notifications", __name__)


@notifications_bp.get("/")
@require_permission("notifications:read", "notifications:read:self")
def list_notifications():
    stmt = select(Notification).where(Notification.user_id == current_user.id).order_by(Notification.created_at.desc())
    page = paginate(db.session, stmt)
    def _ser(n):
        return {
            "id": n.id, "channel": n.channel.value, "template_code": n.template_code,
            "subject": n.subject, "body": n.body, "payload": n.payload,
            "status": n.status.value, "sent_at": n.sent_at.isoformat() if n.sent_at else None,
            "read_at": n.read_at.isoformat() if n.read_at else None,
            "created_at": n.created_at.isoformat(),
        }
    return jsonify(page.to_dict(item_serializer=_ser)), 200


@notifications_bp.post("/<int:notification_id>/read")
@require_permission("notifications:read", "notifications:read:self")
def mark_read(notification_id: int):
    n = db.session.get(Notification, notification_id)
    if n is None or n.user_id != current_user.id:
        raise NotFound()
    n.read_at = utcnow()
    n.status = NotificationStatus.READ
    db.session.commit()
    return jsonify({"status": "ok"})
