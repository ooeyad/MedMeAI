"""Notification tasks."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import select

from ..extensions import db
from ..models.appointment import Appointment, AppointmentStatus
from ..models.notification import NotificationChannel
from ..services import notification_service


@shared_task
def sweep_reminders() -> int:
    """Send 24h-ahead reminders for confirmed appointments."""
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)
    appts = db.session.scalars(
        select(Appointment).where(
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.starts_at >= window_start,
            Appointment.starts_at <= window_end,
        )
    ).all()
    for appt in appts:
        notification_service.enqueue(
            user_id=appt.patient.user_id if appt.patient and appt.patient.user_id else None,
            channel=NotificationChannel.IN_APP,
            template_code="appointment_reminder",
            payload={"appointment_code": appt.code, "starts_at": appt.starts_at.isoformat()},
            body=f"Reminder: appointment {appt.code} tomorrow at {appt.starts_at.isoformat()}",
        )
    return len(appts)
