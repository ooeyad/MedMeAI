"""Notification service with pluggable channel backends."""
from __future__ import annotations

import json
import logging
from typing import Any

from flask import current_app

from ..extensions import db
from ..models.notification import Notification, NotificationChannel, NotificationStatus
from ..utils.time_utils import utcnow

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Channel adapters
# ---------------------------------------------------------------------------
class _ConsoleChannel:
    name = "console"

    def send(self, *, to: str | None, subject: str | None, body: str, payload: dict) -> str:
        logger.info("notification.console", extra={"to": to, "subject": subject, "body": body, "payload": payload})
        return "console-message-id"


def _channel(kind: NotificationChannel):
    # In production, swap on the per-channel backend env var.
    return _ConsoleChannel()


# ---------------------------------------------------------------------------
def enqueue(
    *,
    user_id: int | None,
    channel: NotificationChannel,
    template_code: str | None,
    payload: dict[str, Any],
    to_address: str | None = None,
    subject: str | None = None,
    body: str | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        channel=channel,
        template_code=template_code,
        payload=payload,
        to_address=to_address,
        subject=subject,
        body=body,
        status=NotificationStatus.PENDING,
    )
    db.session.add(n)
    db.session.flush()
    try:
        adapter = _channel(channel)
        provider_id = adapter.send(to=to_address, subject=subject, body=body or json.dumps(payload), payload=payload)
        n.status = NotificationStatus.SENT
        n.provider_message_id = provider_id
        n.sent_at = utcnow()
    except Exception as exc:  # pragma: no cover - defensive
        n.status = NotificationStatus.FAILED
        n.error = str(exc)
    db.session.commit()
    return n


# ---------------------------------------------------------------------------
# Domain helpers — called from service layer
# ---------------------------------------------------------------------------
def send_appointment_booked(appt):
    _safe(lambda: enqueue(
        user_id=appt.patient.user_id if appt.patient and appt.patient.user_id else None,
        channel=NotificationChannel.IN_APP,
        template_code="appointment_booked",
        payload={"appointment_code": appt.code, "starts_at": appt.starts_at.isoformat()},
        body=f"Appointment {appt.code} booked for {appt.starts_at.isoformat()}",
    ))


def send_appointment_confirmed(appt):
    _safe(lambda: enqueue(
        user_id=appt.patient.user_id if appt.patient and appt.patient.user_id else None,
        channel=NotificationChannel.IN_APP,
        template_code="appointment_confirmed",
        payload={"appointment_code": appt.code, "starts_at": appt.starts_at.isoformat()},
        body=f"Appointment {appt.code} confirmed",
    ))


def send_appointment_cancelled(appt, *, reason: str | None = None):
    _safe(lambda: enqueue(
        user_id=appt.patient.user_id if appt.patient and appt.patient.user_id else None,
        channel=NotificationChannel.IN_APP,
        template_code="appointment_cancelled",
        payload={"appointment_code": appt.code, "reason": reason},
        body=f"Appointment {appt.code} cancelled. {reason or ''}",
    ))


def send_appointment_rescheduled(old_appt, new_appt):
    _safe(lambda: enqueue(
        user_id=new_appt.patient.user_id if new_appt.patient and new_appt.patient.user_id else None,
        channel=NotificationChannel.IN_APP,
        template_code="appointment_rescheduled",
        payload={"from_code": old_appt.code, "to_code": new_appt.code, "new_starts_at": new_appt.starts_at.isoformat()},
        body=f"Appointment rescheduled from {old_appt.code} to {new_appt.code}",
    ))


def _safe(fn):
    try:
        return fn()
    except Exception:  # pragma: no cover
        logger.exception("notification-send-failed")
