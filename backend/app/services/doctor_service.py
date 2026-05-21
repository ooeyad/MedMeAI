"""Doctor service."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select

# Clinic timezone. In a fully multi-tenant build this lives on the Clinic
# row — for now we read a single default from env (Asia/Amman is what the
# seed configures).
import os as _os
CLINIC_TZ = ZoneInfo(_os.getenv("CLINIC_TIMEZONE", "Asia/Amman"))

from ..errors import Conflict, NotFound, ValidationFailed
from ..extensions import db
from ..models.appointment import Appointment, AppointmentStatus
from ..models.branch import Branch
from ..models.doctor import (
    Doctor,
    DoctorLeave,
    DoctorSchedule,
    DoctorScheduleException,
    Specialty,
)
from ..models.user import Role, User
from ..utils.security import generate_token, hash_password
from ..utils.tenant_scope import scope_query, tenant_id_for_new_row
from . import audit_service


def list_doctors(
    *,
    q: str | None = None,
    specialty_id: int | None = None,
    specialty_ids: list[int] | None = None,
    branch_id: int | None = None,
    language: str | None = None,
    online_only: bool = False,
    min_fee: float | None = None,
    max_fee: float | None = None,
    active_only: bool = False,
    accepts_insurance_id: int | None = None,
    sort: str | None = None,
):
    """List doctors with advanced filters. All filters AND together."""
    from ..models.user import User as _User
    from ..models.doctor import doctor_specialties, doctor_branches, DoctorInsuranceNetwork
    from sqlalchemy import and_

    stmt = scope_query(select(Doctor), Doctor).join(Doctor.user)

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(
            _User.full_name.ilike(like),
            _User.full_name_ar.ilike(like),
            Doctor.license_number.ilike(like),
        ))

    # Single specialty filter (kept for back-compat) OR list of specialties (OR-match)
    if specialty_id and not specialty_ids:
        specialty_ids = [specialty_id]
    if specialty_ids:
        stmt = stmt.join(doctor_specialties).where(
            doctor_specialties.c.specialty_id.in_(specialty_ids)
        ).distinct()

    if branch_id:
        stmt = stmt.join(doctor_branches).where(doctor_branches.c.branch_id == branch_id)

    if language:
        # Languages is an ARRAY(String); check membership case-insensitively.
        # SQLAlchemy's `.any()` works on Postgres ARRAY columns.
        stmt = stmt.where(Doctor.languages.any(language.lower()))

    if online_only:
        stmt = stmt.where(Doctor.online_appointments.is_(True))

    if min_fee is not None:
        stmt = stmt.where(Doctor.consultation_fee >= min_fee)
    if max_fee is not None:
        stmt = stmt.where(Doctor.consultation_fee <= max_fee)

    if active_only:
        stmt = stmt.where(Doctor.is_active.is_(True))

    if accepts_insurance_id:
        stmt = stmt.join(
            DoctorInsuranceNetwork,
            and_(
                DoctorInsuranceNetwork.doctor_id == Doctor.id,
                DoctorInsuranceNetwork.insurance_company_id == accepts_insurance_id,
                DoctorInsuranceNetwork.accepts.is_(True),
            ),
        )

    # Sorting
    sort = (sort or "").lower()
    if sort == "name":
        stmt = stmt.order_by(_User.full_name.asc())
    elif sort == "fee_asc":
        stmt = stmt.order_by(Doctor.consultation_fee.asc().nullslast())
    elif sort == "fee_desc":
        stmt = stmt.order_by(Doctor.consultation_fee.desc().nullslast())
    elif sort == "experience":
        stmt = stmt.order_by(Doctor.years_of_experience.desc().nullslast())
    else:
        stmt = stmt.order_by(Doctor.created_at.desc())

    return stmt


def get(doctor_id: int) -> Doctor:
    d = db.session.get(Doctor, doctor_id)
    if d is None:
        raise NotFound("Doctor not found")
    return d


def compute_availability(
    *,
    doctor_id: int,
    date_from: date,
    date_to: date,
    duration_minutes: int | None = None,
    branch_id: int | None = None,
) -> list[dict]:
    """Compute available slots for the doctor across the date range.

    If ``branch_id`` is supplied, slots are filtered to that branch's
    schedule only — otherwise slots from all branches the doctor practises
    at are returned (you'll typically want to pass branch_id).
    """
    doctor = get(doctor_id)
    duration = duration_minutes or doctor.appointment_duration_minutes
    out: list[dict] = []

    leaves = db.session.scalars(
        select(DoctorLeave).where(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.date_to >= date_from,
            DoctorLeave.date_from <= date_to,
        )
    ).all()
    leave_ranges = [(l.date_from, l.date_to) for l in leaves]

    exceptions = db.session.scalars(
        select(DoctorScheduleException).where(
            DoctorScheduleException.doctor_id == doctor_id,
            DoctorScheduleException.exception_date.between(date_from, date_to),
        )
    ).all()

    schedule_stmt = select(DoctorSchedule).where(
        DoctorSchedule.doctor_id == doctor_id,
        DoctorSchedule.is_active == True,
    )
    if branch_id is not None:
        schedule_stmt = schedule_stmt.where(DoctorSchedule.branch_id == branch_id)
    schedules = db.session.scalars(schedule_stmt).all()
    schedule_by_weekday: dict[int, list[DoctorSchedule]] = {}
    for s in schedules:
        schedule_by_weekday.setdefault(s.weekday, []).append(s)

    # Widen the SQL window by one day on each side so we catch any booking
    # that lives in the requested local day but is stored as UTC across the
    # midnight boundary.
    booked = db.session.scalars(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.starts_at >= datetime.combine(date_from - timedelta(days=1), time.min, tzinfo=timezone.utc),
            Appointment.starts_at <= datetime.combine(date_to + timedelta(days=1), time.max, tzinfo=timezone.utc),
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.REJECTED, AppointmentStatus.RESCHEDULED]),
        )
    ).all()
    # The schedule's start/end times are CLINIC LOCAL (e.g. 09:00 Amman),
    # but appointments are stored as UTC moments. Convert booked datetimes
    # into clinic-local naive datetimes so the comparison is apples-to-apples.
    def _to_clinic_naive(dt):
        if dt is None:
            return dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(CLINIC_TZ).replace(tzinfo=None)
    booked_ranges = [(_to_clinic_naive(a.starts_at), _to_clinic_naive(a.ends_at)) for a in booked]

    cur = date_from
    while cur <= date_to:
        if not _is_on_leave(cur, leave_ranges):
            for s in schedule_by_weekday.get(cur.weekday(), []):
                out.extend(_slots_for_day(cur, s, duration, booked_ranges))
        cur += timedelta(days=1)

    # Apply schedule exceptions (add or remove)
    for ex in exceptions:
        if ex.kind == "remove" and ex.start_time and ex.end_time:
            out = [
                slot
                for slot in out
                if not (slot["date"] == ex.exception_date.isoformat()
                        and ex.start_time <= time.fromisoformat(slot["start"]) < ex.end_time)
            ]
        elif ex.kind == "add" and ex.start_time and ex.end_time:
            out.extend(_synthetic_slots(ex.exception_date, ex.start_time, ex.end_time, duration, booked_ranges))

    return sorted(out, key=lambda s: (s["date"], s["start"]))


_UPDATABLE_DOCTOR_FIELDS = {
    "license_number", "years_of_experience", "languages",
    "consultation_fee", "appointment_duration_minutes",
    "max_appointments_per_day", "online_appointments",
    "bio", "profile_image_url", "is_active",
}

_UPDATABLE_USER_FIELDS = {"full_name", "full_name_ar", "phone", "email", "preferred_language"}


def update_doctor(doctor_id: int, data: dict, *, actor_user_id: int | None) -> Doctor:
    doctor = get(doctor_id)
    old = {}
    # Doctor row
    for f in _UPDATABLE_DOCTOR_FIELDS:
        if f in data:
            old[f] = getattr(doctor, f)
            setattr(doctor, f, data[f])
    # If the doctor's default appointment duration changed, propagate to schedule
    # rows so the slot grid actually reflects it (avoids stale gaps).
    if "appointment_duration_minutes" in data:
        new_dur = int(data["appointment_duration_minutes"])
        for s in (doctor.schedules or []):
            if s.slot_minutes != new_dur:
                old.setdefault("schedule_slot_minutes", {})[s.id] = s.slot_minutes
                s.slot_minutes = new_dur
    # User row
    if doctor.user is not None:
        for f in _UPDATABLE_USER_FIELDS:
            if f in data:
                old[f"user.{f}"] = getattr(doctor.user, f)
                setattr(doctor.user, f, data[f])
    # Specialties
    if "specialty_ids" in data:
        ids = data["specialty_ids"] or []
        specialties = db.session.scalars(select(Specialty).where(Specialty.id.in_(ids))).all() if ids else []
        old["specialty_ids"] = [s.id for s in (doctor.specialties or [])]
        doctor.specialties = specialties
    # Branches (only those in same tenant)
    if "branch_ids" in data:
        ids = data["branch_ids"] or []
        if ids:
            branch_stmt = select(Branch).where(Branch.id.in_(ids))
            if doctor.tenant_id is not None:
                branch_stmt = branch_stmt.where(
                    or_(Branch.tenant_id == doctor.tenant_id, Branch.tenant_id.is_(None))
                )
            branches = db.session.scalars(branch_stmt).all()
        else:
            branches = []
        old["branch_ids"] = [b.id for b in (doctor.branches or [])]
        doctor.branches = branches

    audit_service.record(
        user_id=actor_user_id, role=None, action="doctor.update",
        entity_type="doctor", entity_id=doctor.id,
        old_value=old, new_value={k: v for k, v in data.items() if k in (_UPDATABLE_DOCTOR_FIELDS | _UPDATABLE_USER_FIELDS | {"specialty_ids", "branch_ids"})},
        source_channel="api",
    )
    db.session.commit()
    return doctor


def move_doctor_to_tenant(doctor_id: int, target_tenant_id: int, *, actor_user_id: int) -> Doctor:
    """Move a doctor (and their user) to another tenant. Cascades to
    appointments. Branches in the old tenant are unassigned."""
    doctor = get(doctor_id)
    from ..models.tenant import Tenant
    target = db.session.get(Tenant, target_tenant_id)
    if target is None:
        raise NotFound("Target tenant not found")

    old_tenant = doctor.tenant_id
    doctor.tenant_id = target_tenant_id
    if doctor.user is not None:
        doctor.user.tenant_id = target_tenant_id

    # Detach branches that don't belong to the target tenant
    doctor.branches = [b for b in (doctor.branches or [])
                       if b.tenant_id == target_tenant_id or b.tenant_id is None]

    # Cascade to this doctor's appointments
    db.session.execute(
        Appointment.__table__.update()
        .where(Appointment.doctor_id == doctor.id)
        .values(tenant_id=target_tenant_id)
    )

    audit_service.record(
        user_id=actor_user_id, role=None, action="doctor.move_tenant",
        entity_type="doctor", entity_id=doctor.id,
        old_value={"tenant_id": old_tenant},
        new_value={"tenant_id": target_tenant_id},
        source_channel="api",
    )
    db.session.commit()
    return doctor


def create_doctor(data: dict, *, actor_user_id: int | None) -> dict:
    """Create a User + Doctor profile in one transaction.

    Returns a dict containing the new doctor + a one-time temporary password.
    In production the password would be delivered via the notification
    service rather than echoed back; we surface it here so the demo flow
    works without a real SMTP / SMS connector wired up.
    """
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise ValidationFailed("email is required")
    license_number = (data.get("license_number") or "").strip()
    if not license_number:
        raise ValidationFailed("license_number is required")
    full_name = (data.get("full_name") or "").strip()
    if not full_name:
        raise ValidationFailed("full_name is required")

    # Uniqueness checks
    if db.session.scalar(select(User).where(User.email == email)) is not None:
        raise Conflict(f"A user with email '{email}' already exists")
    if db.session.scalar(select(Doctor).where(Doctor.license_number == license_number)) is not None:
        raise Conflict(f"License '{license_number}' is already on file")

    tenant_id = tenant_id_for_new_row()
    # Roles
    doctor_role = db.session.scalar(select(Role).where(Role.code == "doctor"))
    if doctor_role is None:
        raise ValidationFailed("doctor role missing — run `flask seed run` first")

    # Generate a temporary password — 12 url-safe chars
    temp_password = generate_token(9)[:12]

    user = User(
        tenant_id=tenant_id,
        email=email,
        phone=data.get("phone"),
        full_name=full_name,
        full_name_ar=data.get("full_name_ar"),
        password_hash=hash_password(temp_password),
        is_active=True,
        preferred_language=data.get("preferred_language", "en"),
    )
    user.roles = [doctor_role]
    db.session.add(user)
    db.session.flush()

    doctor = Doctor(
        tenant_id=tenant_id,
        user_id=user.id,
        license_number=license_number,
        years_of_experience=data.get("years_of_experience"),
        languages=data.get("languages"),
        consultation_fee=data.get("consultation_fee"),
        appointment_duration_minutes=data.get("appointment_duration_minutes", 30),
        max_appointments_per_day=data.get("max_appointments_per_day"),
        online_appointments=bool(data.get("online_appointments", False)),
        bio=data.get("bio"),
        profile_image_url=data.get("profile_image_url"),
        is_active=True,
    )
    db.session.add(doctor)
    db.session.flush()

    # Specialties (optional)
    specialty_ids = data.get("specialty_ids") or []
    if specialty_ids:
        specialties = db.session.scalars(select(Specialty).where(Specialty.id.in_(specialty_ids))).all()
        doctor.specialties = specialties

    # Branches (optional) — only those in the same tenant
    branch_ids = data.get("branch_ids") or []
    if branch_ids:
        branch_stmt = select(Branch).where(Branch.id.in_(branch_ids))
        if tenant_id is not None:
            branch_stmt = branch_stmt.where(
                or_(Branch.tenant_id == tenant_id, Branch.tenant_id.is_(None))
            )
        branches = db.session.scalars(branch_stmt).all()
        doctor.branches = branches

    audit_service.record(
        user_id=actor_user_id, role=None, action="doctor.create",
        entity_type="doctor", entity_id=doctor.id,
        new_value={"email": email, "license_number": license_number, "user_id": user.id},
        source_channel="api",
    )
    db.session.commit()

    return {
        "id": doctor.id,
        "user_id": user.id,
        "email": email,
        "full_name": full_name,
        "license_number": license_number,
        "temporary_password": temp_password,
        "message": "Doctor account created. Share the temporary password securely; the doctor should change it on first login.",
    }


def _is_on_leave(d: date, leaves: list[tuple[date, date]]) -> bool:
    return any(f <= d <= t for f, t in leaves)


def _slots_for_day(day: date, schedule: DoctorSchedule, duration: int, booked: list[tuple[datetime, datetime]]):
    out: list[dict] = []
    cursor = datetime.combine(day, schedule.start_time)
    end = datetime.combine(day, schedule.end_time)
    step = timedelta(minutes=schedule.slot_minutes or duration)
    while cursor + timedelta(minutes=duration) <= end:
        slot_end = cursor + timedelta(minutes=duration)
        if not _conflicts_with_booked(cursor, slot_end, booked):
            out.append({
                "date": day.isoformat(),
                "start": cursor.time().isoformat(timespec="minutes"),
                "end": slot_end.time().isoformat(timespec="minutes"),
                "branch_id": schedule.branch_id,
                "starts_at": cursor.isoformat(),
                "ends_at": slot_end.isoformat(),
            })
        cursor += step
    return out


def _synthetic_slots(day, start_time, end_time, duration, booked):
    schedule = type("S", (), {"start_time": start_time, "end_time": end_time, "slot_minutes": duration, "branch_id": None})
    return _slots_for_day(day, schedule, duration, booked)


def _conflicts_with_booked(start: datetime, end: datetime, booked: list[tuple[datetime, datetime]]) -> bool:
    for bs, be in booked:
        if start < be and end > bs:
            return True
    return False
