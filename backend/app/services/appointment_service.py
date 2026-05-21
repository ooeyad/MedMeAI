"""Appointment service: full lifecycle + search/inquiry."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload, selectinload

from ..errors import (
    AppointmentConflict,
    AppointmentOutsideHours,
    InvalidStateTransition,
    NotFound,
    ValidationFailed,
)
from ..extensions import db
from ..models.appointment import (
    ALLOWED_TRANSITIONS,
    Appointment,
    AppointmentStatus,
    AppointmentStatusHistory,
    AppointmentType,
    SourceChannel,
)
from ..models.doctor import Doctor, DoctorLeave, DoctorSchedule
from ..models.patient import Patient
from ..utils.tenant_scope import scope_query, tenant_id_for_new_row
from ..utils.time_utils import utcnow
from . import audit_service, notification_service


# ---------------------------------------------------------------------------
# Search / inquiry
# ---------------------------------------------------------------------------
def list_appointments(
    *,
    q: str | None = None,
    status: str | None = None,
    statuses: list[str] | None = None,
    doctor_id: int | None = None,
    branch_id: int | None = None,
    patient_id: int | None = None,
    phone: str | None = None,
    national_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    appointment_type: str | None = None,
    appointment_types: list[str] | None = None,
    source_channel: str | None = None,
    specialty_id: int | None = None,
    sort: str | None = None,
):
    stmt = (
        scope_query(select(Appointment), Appointment)
        .options(
            # Eager-load relationships the AppointmentSchema dumps — avoids N+1.
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.branch),
        )
    )

    # Single status filter (back-compat) OR multi-status list (OR-match)
    if status and not statuses:
        statuses = [status]
    if statuses:
        stmt = stmt.where(Appointment.status.in_(statuses))

    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if branch_id:
        stmt = stmt.where(Appointment.branch_id == branch_id)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)

    if phone or national_id or q:
        stmt = stmt.join(Patient)
        if phone:
            stmt = stmt.where(Patient.phone == phone)
        if national_id:
            stmt = stmt.where(Patient.national_id == national_id)
        if q:
            like = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Patient.full_name_en.ilike(like),
                    Patient.full_name_ar.ilike(like),
                    Patient.code.ilike(like),
                    Appointment.code.ilike(like),
                    Patient.phone.ilike(like),
                    Appointment.reason.ilike(like),
                )
            )

    if date_from:
        stmt = stmt.where(Appointment.starts_at >= date_from)
    if date_to:
        stmt = stmt.where(Appointment.starts_at <= date_to)

    if appointment_type and not appointment_types:
        appointment_types = [appointment_type]
    if appointment_types:
        stmt = stmt.where(Appointment.appointment_type.in_(appointment_types))

    if source_channel:
        stmt = stmt.where(Appointment.source_channel == source_channel)

    if specialty_id:
        stmt = stmt.where(Appointment.specialty_id == specialty_id)

    # Sorting (default: most recent first)
    sort = (sort or "").lower()
    if sort == "starts_asc":
        stmt = stmt.order_by(Appointment.starts_at.asc())
    elif sort == "created_desc":
        stmt = stmt.order_by(Appointment.created_at.desc())
    elif sort == "created_asc":
        stmt = stmt.order_by(Appointment.created_at.asc())
    else:
        # starts_desc default
        stmt = stmt.order_by(Appointment.starts_at.desc())

    return stmt


def get(appointment_id: int) -> Appointment:
    appt = db.session.get(Appointment, appointment_id)
    if appt is None:
        raise NotFound("Appointment not found")
    return appt


# ---------------------------------------------------------------------------
# Booking
# ---------------------------------------------------------------------------
def create_appointment(
    *,
    patient_id: int,
    doctor_id: int,
    branch_id: int,
    starts_at: datetime,
    duration_minutes: int | None = None,
    appointment_type: AppointmentType = AppointmentType.NEW_CONSULTATION,
    reason: str | None = None,
    symptoms: str | None = None,
    notes: str | None = None,
    room_id: int | None = None,
    specialty_id: int | None = None,
    source_channel: SourceChannel = SourceChannel.WEB,
    created_by_user_id: int | None = None,
    insurance_snapshot: dict | None = None,
    allow_overbook: bool = False,
) -> Appointment:
    if starts_at.tzinfo is None:
        # Naive datetimes from the web wizard / external callers are clinic
        # local time. Convert to UTC for storage.
        from .doctor_service import CLINIC_TZ
        starts_at = starts_at.replace(tzinfo=CLINIC_TZ).astimezone(timezone.utc)
    else:
        starts_at = starts_at.astimezone(timezone.utc)

    patient = db.session.get(Patient, patient_id)
    if patient is None:
        raise NotFound("Patient not found")
    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None:
        raise NotFound("Doctor not found")

    duration = duration_minutes or doctor.appointment_duration_minutes
    ends_at = starts_at + timedelta(minutes=duration)

    if not allow_overbook:
        _validate_no_conflict(doctor_id=doctor_id, starts_at=starts_at, ends_at=ends_at)
        _validate_doctor_available(doctor=doctor, starts_at=starts_at, ends_at=ends_at, branch_id=branch_id)

    code = _generate_code(starts_at)
    # Derive tenant_id from the patient (most reliable cross-tenant guarantee).
    tenant_id = patient.tenant_id or tenant_id_for_new_row()
    appt = Appointment(
        code=code,
        tenant_id=tenant_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        branch_id=branch_id,
        room_id=room_id,
        specialty_id=specialty_id,
        appointment_type=appointment_type,
        status=AppointmentStatus.REQUESTED,
        starts_at=starts_at,
        ends_at=ends_at,
        duration_minutes=duration,
        reason=reason,
        symptoms=symptoms,
        notes=notes,
        source_channel=source_channel,
        created_by_user_id=created_by_user_id,
        insurance_snapshot=insurance_snapshot,
    )
    db.session.add(appt)
    db.session.flush()

    db.session.add(
        AppointmentStatusHistory(
            appointment_id=appt.id,
            from_status=None,
            to_status=AppointmentStatus.REQUESTED,
            actor_user_id=created_by_user_id,
            at=utcnow(),
        )
    )
    audit_service.record(
        user_id=created_by_user_id, role=None, action="appointment.create",
        entity_type="appointment", entity_id=appt.id,
        new_value={
            "code": appt.code, "patient_id": patient_id, "doctor_id": doctor_id,
            "branch_id": branch_id, "starts_at": starts_at.isoformat(),
        },
        source_channel=source_channel.value,
    )
    db.session.commit()

    # Fire and forget notification
    notification_service.send_appointment_booked(appt)
    return appt


# ---------------------------------------------------------------------------
# Lifecycle transitions
# ---------------------------------------------------------------------------
def transition(
    appointment_id: int,
    to_status: AppointmentStatus,
    *,
    actor_user_id: int | None,
    reason: str | None = None,
    source_channel: str = "api",
) -> Appointment:
    appt = get(appointment_id)
    allowed = ALLOWED_TRANSITIONS.get(appt.status, set())
    if to_status not in allowed:
        raise InvalidStateTransition(
            f"Cannot transition appointment from {appt.status.value} to {to_status.value}"
        )
    old_status = appt.status
    appt.status = to_status

    db.session.add(
        AppointmentStatusHistory(
            appointment_id=appt.id,
            from_status=old_status,
            to_status=to_status,
            actor_user_id=actor_user_id,
            reason=reason,
            at=utcnow(),
        )
    )
    audit_service.record(
        user_id=actor_user_id, role=None,
        action=f"appointment.transition.{to_status.value}",
        entity_type="appointment", entity_id=appt.id,
        old_value={"status": old_status.value}, new_value={"status": to_status.value, "reason": reason},
        source_channel=source_channel,
    )
    db.session.commit()

    if to_status == AppointmentStatus.CONFIRMED:
        notification_service.send_appointment_confirmed(appt)
    elif to_status == AppointmentStatus.CANCELLED:
        notification_service.send_appointment_cancelled(appt, reason=reason)
    elif to_status == AppointmentStatus.COMPLETED:
        # Auto-create the billing invoice. Failure shouldn't roll back the
        # transition — log and continue.
        try:
            from . import billing_service
            billing_service.create_invoice_for_appointment(appt.id, actor_user_id=actor_user_id)
        except Exception:  # pragma: no cover - defensive
            import logging
            logging.getLogger(__name__).exception("auto-invoice-failed")
    return appt


def reschedule(
    appointment_id: int,
    *,
    new_starts_at: datetime,
    new_doctor_id: int | None = None,
    new_branch_id: int | None = None,
    actor_user_id: int | None,
    source_channel: str = "api",
    reason: str | None = None,
) -> Appointment:
    original = get(appointment_id)
    if original.status in {AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW}:
        raise InvalidStateTransition("Cannot reschedule a finalised appointment")

    new_appt = create_appointment(
        patient_id=original.patient_id,
        doctor_id=new_doctor_id or original.doctor_id,
        branch_id=new_branch_id or original.branch_id,
        starts_at=new_starts_at,
        duration_minutes=original.duration_minutes,
        appointment_type=original.appointment_type,
        reason=original.reason,
        symptoms=original.symptoms,
        notes=(original.notes or "") + (f"\nRescheduled from {original.code}"),
        room_id=original.room_id,
        specialty_id=original.specialty_id,
        source_channel=SourceChannel(source_channel) if source_channel in {c.value for c in SourceChannel} else SourceChannel.WEB,
        created_by_user_id=actor_user_id,
        insurance_snapshot=original.insurance_snapshot,
    )

    old_status = original.status
    original.status = AppointmentStatus.RESCHEDULED
    db.session.add(
        AppointmentStatusHistory(
            appointment_id=original.id,
            from_status=old_status,
            to_status=AppointmentStatus.RESCHEDULED,
            actor_user_id=actor_user_id,
            reason=f"Rescheduled to {new_appt.code}: {reason or ''}",
            at=utcnow(),
        )
    )
    db.session.commit()
    notification_service.send_appointment_rescheduled(original, new_appt)
    return new_appt


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def _validate_no_conflict(*, doctor_id: int, starts_at: datetime, ends_at: datetime) -> None:
    conflict = db.session.scalar(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.status.notin_(_TERMINAL),
            and_(
                Appointment.starts_at < ends_at,
                Appointment.ends_at > starts_at,
            ),
        ).limit(1)
    )
    if conflict is not None:
        raise AppointmentConflict(
            f"Doctor already has appointment {conflict.code} overlapping that time",
            details={"conflicting_appointment_code": conflict.code},
        )


def _validate_doctor_available(*, doctor: Doctor, starts_at: datetime, ends_at: datetime, branch_id: int) -> None:
    # The schedule's start_time / end_time are CLINIC LOCAL. starts_at is
    # stored UTC. Convert to clinic local for the comparison.
    from .doctor_service import CLINIC_TZ

    def _to_local(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(CLINIC_TZ)

    starts_local = _to_local(starts_at)
    ends_local = _to_local(ends_at)
    weekday = starts_local.weekday()

    schedule = db.session.scalar(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor.id,
            DoctorSchedule.branch_id == branch_id,
            DoctorSchedule.weekday == weekday,
            DoctorSchedule.is_active == True,
        )
    )
    if schedule is None:
        raise AppointmentOutsideHours("Doctor does not work at this branch on this weekday")
    if starts_local.time() < schedule.start_time or ends_local.time() > schedule.end_time:
        raise AppointmentOutsideHours("Outside doctor working hours")

    on_leave = db.session.scalar(
        select(DoctorLeave).where(
            DoctorLeave.doctor_id == doctor.id,
            DoctorLeave.date_from <= starts_local.date(),
            DoctorLeave.date_to >= starts_local.date(),
        )
    )
    if on_leave is not None:
        raise AppointmentOutsideHours("Doctor is on leave on this date")


_TERMINAL = (
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
    AppointmentStatus.REJECTED,
    AppointmentStatus.RESCHEDULED,
)


def _generate_code(starts_at: datetime) -> str:
    seq = (db.session.scalar(select(db.func.coalesce(db.func.max(Appointment.id), 0))) or 0) + 1
    return f"APT-{starts_at.strftime('%Y%m%d')}-{seq:05d}"


# ---------------------------------------------------------------------------
# Helpers used by AI tools
# ---------------------------------------------------------------------------
def find_next_appointment_for_doctor(doctor_id: int) -> Appointment | None:
    return db.session.scalar(
        select(Appointment)
        .where(
            Appointment.doctor_id == doctor_id,
            Appointment.starts_at >= utcnow(),
            Appointment.status.in_([
                AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.REQUESTED
            ])
        )
        .order_by(Appointment.starts_at.asc())
    )


def daily_summary(*, branch_id: int | None, doctor_id: int | None, day: datetime) -> dict[str, Any]:
    stmt = select(Appointment).where(
        Appointment.starts_at >= datetime.combine(day.date(), datetime.min.time(), tzinfo=timezone.utc),
        Appointment.starts_at < datetime.combine(day.date(), datetime.min.time(), tzinfo=timezone.utc) + timedelta(days=1),
    )
    if branch_id:
        stmt = stmt.where(Appointment.branch_id == branch_id)
    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    all_appts: list[Appointment] = list(db.session.scalars(stmt).all())

    # Active (actionable) ones — what the doctor actually has on the day.
    inactive = {"cancelled", "no_show", "rejected", "rescheduled"}
    active = [a for a in all_appts if a.status.value not in inactive]

    by_status: dict[str, int] = {}
    for a in active:
        by_status[a.status.value] = by_status.get(a.status.value, 0) + 1

    return {
        "total": len(active),
        "by_status": by_status,
        "appointment_codes": [a.code for a in active],
        "cancelled_count": sum(1 for a in all_appts if a.status.value == "cancelled"),
        "no_show_count": sum(1 for a in all_appts if a.status.value == "no_show"),
    }
