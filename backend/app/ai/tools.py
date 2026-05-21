"""Tool registry for the AI agent.

Each tool is a small Python function that:
* Receives an `actor` (the User model instance running the conversation).
* Validates the user's permission to do the operation.
* Calls the existing service layer (no SQL here, no business logic duplication).
* Returns a JSON-serialisable dict.

A `manifest()` function exposes the tool's JSON schema (used by LLM providers
that support function calling). The dispatcher in `agent.py` invokes these
tools and logs every call to `ai_tool_calls`.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable

from sqlalchemy import select

from ..errors import DomainError, Forbidden
from ..extensions import db
from ..models.appointment import Appointment, AppointmentStatus
from ..models.user import User
from ..rbac import Role
from ..services import (
    appointment_service,
    doctor_service,
    insurance_service,
    patient_service,
    report_service,
)
from ..services.appointment_service import find_next_appointment_for_doctor

logger = logging.getLogger(__name__)


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    fn: Callable[[User, dict], Any]
    roles: set[Role]
    destructive: bool = False


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------
def _create_patient(actor: User, args: dict) -> dict:
    """Register a brand-new patient. Use this when a search comes back empty and
    the user wants to proceed with someone we haven't seen before. Only the
    English name is strictly required; phone helps a lot for future lookup."""
    if not args.get("full_name_en"):
        return {"error": "full_name_en is required"}
    data: dict[str, Any] = {}
    for f in (
        "full_name_en", "full_name_ar", "phone", "alternative_phone", "email",
        "national_id", "passport_number", "gender", "nationality", "marital_status",
        "address", "city", "country", "blood_type",
    ):
        if args.get(f) is not None:
            data[f] = args[f]
    if args.get("date_of_birth"):
        try:
            from datetime import date as _date
            data["date_of_birth"] = _date.fromisoformat(args["date_of_birth"])
        except Exception:
            pass
    patient = patient_service.create_patient(data, actor_user_id=actor.id, source_channel="ai")
    return {
        "id": patient.id,
        "code": patient.code,
        "name": patient.full_name_en,
        "phone": patient.phone,
        "kyc_status": patient.kyc_status.value,
        "message": "Patient created. KYC starts as 'pending'.",
    }


def _search_patient(actor: User, args: dict) -> dict:
    q, phone, national_id = args.get("q"), args.get("phone"), args.get("national_id")
    stmt = patient_service.list_patients(q=q, phone=phone, national_id=national_id, kyc_status=None)
    rows = db.session.scalars(stmt.limit(10)).all()
    return {
        "results": [
            {
                "id": p.id, "code": p.code, "name": p.full_name_en, "phone": p.phone,
                "national_id": p.national_id, "kyc_status": p.kyc_status.value,
            }
            for p in rows
        ]
    }


def _search_doctor(actor: User, args: dict) -> dict:
    """Find doctors by name or specialty. Always use this BEFORE find_available_slots
    or create_appointment so we have a real doctor_id (and not a hallucinated one)."""
    q = args.get("q") or args.get("name") or args.get("query")
    specialty = args.get("specialty")
    stmt = doctor_service.list_doctors(q=q, specialty_id=None, branch_id=args.get("branch_id"))
    rows = db.session.scalars(stmt.limit(15)).all()
    out = []
    for d in rows:
        name = d.user.full_name if d.user else ""
        specs = [s.name for s in (d.specialties or [])]
        if specialty and not any(specialty.lower() in s.lower() for s in specs):
            continue
        out.append({
            "id": d.id,
            "name": name,
            "specialties": specs,
            "branch_ids": [b.id for b in (d.branches or [])],
            "is_active": d.is_active,
            "consultation_fee": float(d.consultation_fee) if d.consultation_fee else None,
            "appointment_duration_minutes": d.appointment_duration_minutes,
        })
    return {"results": out}


def _list_branches(actor: User, args: dict) -> dict:
    from ..models.branch import Branch
    from sqlalchemy import select
    rows = db.session.scalars(select(Branch).where(Branch.is_active == True)).all()
    return {
        "results": [
            {"id": b.id, "name": b.name, "name_ar": b.name_ar, "city": b.city, "phone": b.phone}
            for b in rows
        ]
    }


def _get_patient_profile(actor: User, args: dict) -> dict:
    pid = int(args["patient_id"])
    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient or actor.patient.id != pid:
            raise Forbidden("Patients can only view their own profile")
    p = patient_service.get(pid)
    return {
        "id": p.id, "code": p.code,
        "name_en": p.full_name_en, "name_ar": p.full_name_ar,
        "phone": p.phone, "email": p.email,
        "dob": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "gender": p.gender, "blood_type": p.blood_type,
        "allergies": p.allergies, "chronic_diseases": p.chronic_diseases,
        "current_medications": p.current_medications,
        "kyc_status": p.kyc_status.value,
    }


_TEMPORAL_WORDS = {"today", "tomorrow", "yesterday", "now", "this week", "next week"}


def _search_appointments(actor: User, args: dict) -> dict:
    filters = {k: v for k, v in args.items() if k in {
        "q", "status", "doctor_id", "branch_id", "patient_id", "phone", "national_id",
    }}

    # Be tolerant if the LLM put a date/keyword into `q` instead of `date_from`/`date_to`.
    raw_q = (filters.get("q") or "").strip().lower() if filters.get("q") else ""
    if raw_q in _TEMPORAL_WORDS:
        args.setdefault("date_from", raw_q)
        args.setdefault("date_to", raw_q)
        filters.pop("q", None)
    elif raw_q:
        # Maybe an ISO date snuck into q
        parsed = _parse_date(raw_q)
        if parsed:
            args.setdefault("date_from", parsed.isoformat())
            args.setdefault("date_to", parsed.isoformat())
            filters.pop("q", None)

    if "date_from" in args:
        filters["date_from"] = _to_dt(args["date_from"], start=True)
    if "date_to" in args:
        filters["date_to"] = _to_dt(args["date_to"], start=False)

    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient:
            return {"results": []}
        filters["patient_id"] = actor.patient.id
    if Role.DOCTOR.value in actor.role_codes and actor.doctor:
        filters.setdefault("doctor_id", actor.doctor.id)

    stmt = appointment_service.list_appointments(**filters)
    rows = db.session.scalars(stmt.limit(40)).all()

    # When the caller is asking about future/today appointments, hide
    # cancelled / no-show / rejected / rescheduled unless they opted in.
    include_inactive = bool(args.get("include_inactive", False))
    is_forward_looking = bool(filters.get("date_from"))
    explicit_status = bool(filters.get("status"))
    if is_forward_looking and not include_inactive and not explicit_status:
        rows = [a for a in rows if a.status.value not in _INACTIVE_STATUSES]

    return {
        "results": [_appointment_with_names(a) for a in rows[:20]],
        "filtered_out_inactive": is_forward_looking and not include_inactive and not explicit_status,
        "instructions_for_assistant": (
            "Each appointment includes `doctor.name` and `patient.name` — use those when the "
            "user asks who the appointment is with. Don't say you can't find the doctor."
        ),
    }


def _find_available_slots(actor: User, args: dict) -> dict:
    doctor_id = int(args["doctor_id"])
    today = date.today()
    target_from = _parse_date(args.get("date_from") or args.get("date") or today.isoformat()) or today
    target_to = _parse_date(args.get("date_to") or target_from.isoformat()) or target_from
    branch_id = args.get("branch_id")
    if branch_id is not None:
        try:
            branch_id = int(branch_id)
        except (TypeError, ValueError):
            branch_id = None
    slots = doctor_service.compute_availability(
        doctor_id=doctor_id, date_from=target_from, date_to=target_to,
        duration_minutes=args.get("duration_minutes"), branch_id=branch_id,
    )
    # Dedupe across branches when no branch_id given — collapse same (date,start)
    # entries so the LLM gets one slot per time instead of two.
    seen: set[tuple[str, str]] = set()
    unique: list[dict] = []
    for s in slots:
        key = (s["date"], s["start"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)

    # Surface the doctor's appointment duration so the LLM can explain why a
    # requested time doesn't fit (e.g. 90-min appointments only start at
    # 9:00, 10:30, 12:00, …).
    doctor = doctor_service.get(doctor_id)
    duration_minutes = (
        int(args.get("duration_minutes"))
        if args.get("duration_minutes")
        else doctor.appointment_duration_minutes
    )

    # If the caller provided a `requested_start` (HH:MM or HH:MM:SS form), look
    # for a matching slot and tell the assistant explicitly whether it's open.
    # This stops the model from saying "11am isn't open" while ALSO listing
    # 11:00 as a nearby slot — a real bug we hit in production.
    requested_start_raw = args.get("requested_start") or args.get("requested_time")
    requested_match: dict | None = None
    if requested_start_raw:
        norm = str(requested_start_raw).strip()
        # Strip am/pm and normalise to HH:MM:SS
        norm = _normalize_to_hhmmss(norm)
        if norm:
            for s in unique:
                if s.get("start") == norm:
                    requested_match = s
                    break

    response: dict = {
        "slots": unique[:60],
        "count": len(unique),
        "doctor_id": doctor_id,
        "doctor_name": doctor.user.full_name if doctor.user else None,
        "appointment_duration_minutes": duration_minutes,
        "date_from": target_from.isoformat(),
        "date_to": target_to.isoformat(),
    }

    if requested_start_raw:
        response["requested_start"] = requested_start_raw
        response["requested_start_normalized"] = norm if requested_start_raw else None
        response["requested_start_available"] = requested_match is not None
        if requested_match:
            response["requested_slot"] = requested_match
            response["instructions_for_assistant"] = (
                f"The user's requested time ({requested_start_raw}) IS AVAILABLE. "
                f"Use `requested_slot.starts_at` directly to book it via "
                f"create_appointment. Do NOT say it 'isn't open'. Confirm with the "
                f"user briefly (e.g. 'Yes, {requested_start_raw} with "
                f"{doctor.user.full_name if doctor.user else 'the doctor'} is open — "
                f"shall I book it?') then book."
            )
        else:
            response["instructions_for_assistant"] = (
                f"The user's requested time ({requested_start_raw}) is NOT in the "
                f"slot list. This doctor uses {duration_minutes}-minute appointments. "
                f"Reply: 'That time isn't open. Closest open: <list 2-3 from slots>.' "
                f"Do not contradict yourself by listing the requested time as nearby."
            )
    else:
        response["instructions_for_assistant"] = (
            f"Each entry is an available slot. If the user's requested time matches an "
            f"entry's `start`, that time IS available — call create_appointment using its "
            f"`starts_at`. Time formats: '11am' = '11:00:00'. "
            f"This doctor's appointments are {duration_minutes} minutes long. "
            f"For a 90-min doctor, slots start at 9:00, 10:30, 12:00, … . "
            f"If the user asks for a time that doesn't appear in `slots`, explain "
            f"and suggest the closest 2-3 entries — do NOT say 'not available' "
            f"without context, and NEVER list the requested time as a 'nearby' slot."
        )

    return response


def _normalize_to_hhmmss(text: str) -> str | None:
    """Convert '11am', '3pm', '9:30 AM', '15:00', '15:00:00' → 'HH:MM:SS'."""
    import re as _re
    s = text.strip().lower().replace(" ", "")
    # 12h with am/pm
    m = _re.match(r"^(\d{1,2})(?::(\d{2}))?(am|pm)$", s)
    if m:
        h = int(m.group(1))
        mm = int(m.group(2) or 0)
        ampm = m.group(3)
        if ampm == "pm" and h < 12:
            h += 12
        if ampm == "am" and h == 12:
            h = 0
        return f"{h:02d}:{mm:02d}:00"
    # 24h HH:MM(:SS)?
    m = _re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", s)
    if m:
        return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}:{int(m.group(3) or 0):02d}"
    return None


def _create_appointment(actor: User, args: dict) -> dict:
    from ..models.appointment import AppointmentType, SourceChannel
    starts_at = _to_dt(args["starts_at"], start=True)
    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient or actor.patient.id != int(args["patient_id"]):
            raise Forbidden("Patients can only book for themselves")
    appt = appointment_service.create_appointment(
        patient_id=int(args["patient_id"]),
        doctor_id=int(args["doctor_id"]),
        branch_id=int(args["branch_id"]),
        starts_at=starts_at,
        duration_minutes=args.get("duration_minutes"),
        appointment_type=AppointmentType(args.get("appointment_type", AppointmentType.NEW_CONSULTATION.value)),
        reason=args.get("reason"), notes=args.get("notes"),
        created_by_user_id=actor.id,
        source_channel=SourceChannel.AI,
    )
    return {"id": appt.id, "code": appt.code, "status": appt.status.value, "starts_at": appt.starts_at.isoformat()}


def _reschedule_appointment(actor: User, args: dict) -> dict:
    appt = appointment_service.reschedule(
        appointment_id=int(args["appointment_id"]),
        new_starts_at=_to_dt(args["new_starts_at"], start=True),
        new_doctor_id=args.get("new_doctor_id"),
        new_branch_id=args.get("new_branch_id"),
        actor_user_id=actor.id, source_channel="ai", reason=args.get("reason"),
    )
    return {"id": appt.id, "code": appt.code, "starts_at": appt.starts_at.isoformat()}


def _cancel_appointment(actor: User, args: dict) -> dict:
    appt = appointment_service.transition(
        int(args["appointment_id"]), AppointmentStatus.CANCELLED,
        actor_user_id=actor.id, reason=args.get("reason"), source_channel="ai",
    )
    return {"id": appt.id, "code": appt.code, "status": appt.status.value}


def _check_insurance_acceptance(actor: User, args: dict) -> dict:
    pid = int(args["patient_id"])
    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient or actor.patient.id != pid:
            raise Forbidden()
    return insurance_service.check_acceptance(patient_id=pid, doctor_id=int(args["doctor_id"]))


def _summarize_patient_history(actor: User, args: dict) -> dict:
    pid = int(args["patient_id"])
    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient or actor.patient.id != pid:
            raise Forbidden()
    p = patient_service.get(pid)
    past = db.session.scalars(
        select(Appointment).where(Appointment.patient_id == pid).order_by(Appointment.starts_at.desc()).limit(5)
    ).all()
    return {
        "patient": {
            "id": p.id, "name": p.full_name_en, "dob": p.date_of_birth.isoformat() if p.date_of_birth else None,
            "allergies": p.allergies, "chronic_diseases": p.chronic_diseases,
            "current_medications": p.current_medications,
            "history_summary": p.medical_history_summary,
        },
        "recent_appointments": [
            {"code": a.code, "starts_at": a.starts_at.isoformat(),
             "status": a.status.value, "reason": a.reason}
            for a in past
        ],
    }


def _doctor_schedule_today(actor: User, args: dict) -> dict:
    if Role.DOCTOR.value not in actor.role_codes or actor.doctor is None:
        raise Forbidden("Only doctors can use this tool")
    return appointment_service.daily_summary(branch_id=None, doctor_id=actor.doctor.id, day=datetime.now(timezone.utc))


_INACTIVE_STATUSES = {"cancelled", "no_show", "rejected", "rescheduled"}


def _appointment_with_names(a) -> dict:
    """Serialize an Appointment row with doctor + patient display info inline so
    the LLM doesn't need a second tool call to answer 'with which doctor?'."""
    doctor_info = {"id": a.doctor_id, "name": None}
    try:
        if a.doctor and a.doctor.user:
            specs = [s.name for s in (a.doctor.specialties or [])]
            doctor_info = {
                "id": a.doctor_id,
                "name": a.doctor.user.full_name,
                "specialties": specs,
                "primary_specialty": specs[0] if specs else None,
            }
    except Exception:
        pass

    patient_info = {"id": a.patient_id, "name": None}
    try:
        if a.patient:
            patient_info = {
                "id": a.patient_id,
                "name": a.patient.full_name_en or a.patient.full_name_ar,
                "code": a.patient.code,
            }
    except Exception:
        pass

    return {
        "id": a.id, "code": a.code, "status": a.status.value,
        "starts_at": a.starts_at.isoformat(), "ends_at": a.ends_at.isoformat(),
        "patient_id": a.patient_id, "doctor_id": a.doctor_id, "branch_id": a.branch_id,
        "doctor": doctor_info,
        "patient": patient_info,
        "reason": a.reason,
    }


def _my_appointments(actor: User, args: dict) -> dict:
    """Return the calling user's own appointments. Patients see their own,
    doctors see ones assigned to them. Filter by upcoming/past/all.

    Default behaviour for `when=upcoming|today`: exclude cancelled, no-show,
    rejected and rescheduled appointments — they're not actionable.
    """
    when = (args.get("when") or "upcoming").lower()
    include_inactive = bool(args.get("include_inactive", False))
    filters: dict = {}
    logger.info("my_appointments.called name=%s when=%s", actor.email, when)
    if Role.PATIENT.value in actor.role_codes:
        if not actor.patient:
            return {"results": [], "error": "no_patient_record_linked_to_user"}
        filters["patient_id"] = actor.patient.id
    elif Role.DOCTOR.value in actor.role_codes and actor.doctor:
        filters["doctor_id"] = actor.doctor.id
    else:
        return {"results": []}

    if when in ("upcoming", "future", "next"):
        filters["date_from"] = datetime.now(timezone.utc)
    elif when in ("today",):
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        filters["date_from"] = today
        filters["date_to"] = today + timedelta(days=1) - timedelta(seconds=1)
    elif when in ("past", "previous", "history"):
        filters["date_to"] = datetime.now(timezone.utc)

    stmt = appointment_service.list_appointments(**filters)
    rows = db.session.scalars(stmt.limit(40)).all()

    # Drop inactive appointments unless explicitly requested.
    if not include_inactive:
        rows = [a for a in rows if a.status.value not in _INACTIVE_STATUSES]

    return {
        "results": [_appointment_with_names(a) for a in rows[:20]],
        "filtered_out_inactive": not include_inactive,
        "instructions_for_assistant": (
            "Each appointment includes a `doctor` object with the doctor's full name and "
            "specialty, and a `patient` object with the patient's name. Use those directly "
            "when the user asks 'with which doctor?' or 'who is my appointment with' — do "
            "NOT claim you can't find the doctor."
        ),
    }


def _next_patient_or_appointment(actor: User, args: dict) -> dict:
    if Role.DOCTOR.value in actor.role_codes and actor.doctor:
        appt = find_next_appointment_for_doctor(actor.doctor.id)
        if appt is None:
            return {"next": None}
        return {
            "next": {
                "appointment_code": appt.code,
                "starts_at": appt.starts_at.isoformat(),
                "patient_id": appt.patient_id,
                "reason": appt.reason,
            }
        }
    if Role.PATIENT.value in actor.role_codes and actor.patient:
        stmt = appointment_service.list_appointments(
            patient_id=actor.patient.id,
            date_from=datetime.now(timezone.utc),
        )
        appt = db.session.scalars(stmt.limit(1)).first()
        return {"next": {"code": appt.code, "starts_at": appt.starts_at.isoformat()} if appt else None}
    return {"next": None}


def _report_overview(actor: User, args: dict) -> dict:
    return report_service.overview()


# ---------------------------------------------------------------------------
def _to_dt(value: str, start: bool) -> datetime:
    """Parse a wide variety of date/time strings into an aware UTC datetime.

    Inputs WITHOUT a timezone are interpreted as **clinic local time** (we
    read the clinic's tz lazily). This matches what a user means when they
    say "book at 10am" — they mean 10am in the clinic's timezone, not UTC.
    """
    if isinstance(value, datetime):
        dt = value
        was_date_only = False
    else:
        v = (value or "").strip().lower()
        was_date_only = False
        if v in ("today", "now"):
            dt = datetime.combine(date.today(), datetime.min.time())
            was_date_only = True
        elif v == "tomorrow":
            dt = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())
            was_date_only = True
        elif v == "yesterday":
            dt = datetime.combine(date.today() - timedelta(days=1), datetime.min.time())
            was_date_only = True
        else:
            iso_date_only = re.fullmatch(r"\s*\d{4}-\d{1,2}-\d{1,2}\s*", value)
            dt = _flex_parse_datetime(value)
            if dt is None:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if iso_date_only or (dt.hour == 0 and dt.minute == 0 and dt.second == 0 and ":" not in value):
                was_date_only = True

    if was_date_only and not start:
        dt += timedelta(days=1) - timedelta(seconds=1)
    if dt.tzinfo is None:
        # Treat naive input as clinic local time, then convert to UTC.
        from ..services.doctor_service import CLINIC_TZ
        dt = dt.replace(tzinfo=CLINIC_TZ).astimezone(timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return dt


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    v = value.strip().lower()
    if v in ("today", "now"):
        return date.today()
    if v == "tomorrow":
        return date.today() + timedelta(days=1)
    if v == "yesterday":
        return date.today() - timedelta(days=1)
    try:
        return date.fromisoformat(value)
    except ValueError:
        pass
    dt = _flex_parse_datetime(value)
    return dt.date() if dt else None


def _flex_parse_datetime(value: str) -> datetime | None:
    """Best-effort date parsing covering '20 may', 'May 20 2026', '20/05/2026', etc."""
    try:
        from dateutil import parser as du_parser
        # `default` anchors the year/month if the user only gave a day or month/day.
        default = datetime(date.today().year, date.today().month, 1)
        return du_parser.parse(value, default=default, fuzzy=True, dayfirst=False)
    except Exception:
        try:
            from dateutil import parser as du_parser
            default = datetime(date.today().year, date.today().month, 1)
            return du_parser.parse(value, default=default, fuzzy=True, dayfirst=True)
        except Exception:
            return None


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------
ALL_TOOLS: list[Tool] = [
    Tool(
        name="search_patient",
        description="Search for a patient by free text, phone, or national ID. Returns up to 10 matches.",
        parameters={
            "type": "object",
            "properties": {
                "q": {"type": "string"},
                "phone": {"type": "string"},
                "national_id": {"type": "string"},
            },
        },
        fn=_search_patient,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.DOCTOR, Role.INSURANCE_OFFICER, Role.NURSE, Role.AUDITOR},
    ),
    Tool(
        name="create_patient",
        description=(
            "Register a NEW patient. Call this only after search_patient came back empty AND the "
            "user has explicitly confirmed they want to create a new patient. Always ask for the "
            "patient's English name plus at least a phone number before calling — collect the "
            "other fields if the user mentions them."
        ),
        parameters={
            "type": "object",
            "properties": {
                "full_name_en": {"type": "string", "description": "Full name in English (required)"},
                "full_name_ar": {"type": "string", "description": "Full name in Arabic"},
                "phone": {"type": "string"},
                "alternative_phone": {"type": "string"},
                "email": {"type": "string"},
                "national_id": {"type": "string"},
                "passport_number": {"type": "string"},
                "date_of_birth": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "gender": {"type": "string", "enum": ["male", "female", "other"]},
                "nationality": {"type": "string"},
                "marital_status": {"type": "string"},
                "address": {"type": "string"},
                "city": {"type": "string"},
                "country": {"type": "string"},
                "blood_type": {"type": "string"},
            },
            "required": ["full_name_en"],
        },
        fn=_create_patient,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.DOCTOR},
    ),
    Tool(
        name="get_patient_profile",
        description="Return full patient profile.",
        parameters={"type": "object", "properties": {"patient_id": {"type": "integer"}}, "required": ["patient_id"]},
        fn=_get_patient_profile,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.DOCTOR, Role.PATIENT, Role.NURSE, Role.INSURANCE_OFFICER},
    ),
    Tool(
        name="search_doctor",
        description=(
            "Find doctors by name or specialty. ALWAYS call this BEFORE find_available_slots "
            "or create_appointment so you have a real doctor_id. Returns id, name, specialties, "
            "and the branch IDs the doctor practises at."
        ),
        parameters={
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Name or part of name"},
                "specialty": {"type": "string", "description": "Specialty filter, e.g. 'Cardiology'"},
                "branch_id": {"type": "integer"},
            },
        },
        fn=_search_doctor,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR, Role.NURSE, Role.INSURANCE_OFFICER},
    ),
    Tool(
        name="list_branches",
        description="List active clinic branches (id, name, city, phone). Use to discover branch_id when booking.",
        parameters={"type": "object", "properties": {}},
        fn=_list_branches,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR, Role.NURSE, Role.INSURANCE_OFFICER, Role.AUDITOR},
    ),
    Tool(
        name="my_appointments",
        description=(
            "List the calling user's own appointments — for patients, only their own; for "
            "doctors, the ones assigned to them. Use this when the user says 'my appointments', "
            "'my schedule', 'what's next', 'my upcoming visits'. Pass `when` = upcoming | past | all."
        ),
        parameters={
            "type": "object",
            "properties": {
                "when": {"type": "string", "enum": ["upcoming", "past", "all"]},
            },
        },
        fn=_my_appointments,
        roles={Role.PATIENT, Role.DOCTOR, Role.NURSE, Role.SECRETARY, Role.CLINIC_ADMIN, Role.SUPER_ADMIN},
    ),
    Tool(
        name="search_appointments",
        description=(
            "Search appointments. Filter by phone, patient_id, doctor_id, status, or date range. "
            "Dates should be ISO 8601 like '2026-05-20' or '2026-05-20T10:00:00'. "
            "The keywords 'today', 'tomorrow', 'yesterday' are also accepted."
        ),
        parameters={
            "type": "object",
            "properties": {
                "q": {"type": "string"}, "status": {"type": "string"},
                "phone": {"type": "string"}, "national_id": {"type": "string"},
                "doctor_id": {"type": "integer"}, "branch_id": {"type": "integer"},
                "patient_id": {"type": "integer"},
                "date_from": {"type": "string", "description": "ISO date or 'today'/'tomorrow'"},
                "date_to": {"type": "string", "description": "ISO date or 'today'/'tomorrow'"},
            },
        },
        fn=_search_appointments,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.DOCTOR, Role.PATIENT, Role.INSURANCE_OFFICER, Role.AUDITOR},
    ),
    Tool(
        name="find_available_slots",
        description=(
            "Return available appointment slots for a doctor in a date range. "
            "Always pass dates in ISO 8601 format ('2026-05-20'). If the user gives a relative "
            "date like 'tomorrow' or 'next Monday', resolve it to ISO before calling this tool. "
            "If only `date` is provided, the tool searches that single day. "
            "If the user requested a specific time (e.g. '11am'), pass it as `requested_start` "
            "and the tool will tell you whether that exact time is bookable — use this to avoid "
            "saying a time isn't open when it actually is."
        ),
        parameters={
            "type": "object",
            "properties": {
                "doctor_id": {"type": "integer"},
                "date_from": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "date_to": {"type": "string", "description": "ISO date YYYY-MM-DD"},
                "date": {"type": "string", "description": "ISO date YYYY-MM-DD (single day)"},
                "duration_minutes": {"type": "integer"},
                "requested_start": {
                    "type": "string",
                    "description": (
                        "Optional. The specific start time the user asked for. Accepts "
                        "'11am', '3pm', '9:30 AM', '15:00', or '15:00:00'. The tool will "
                        "set `requested_start_available: true/false` in the response so you "
                        "know immediately whether to confirm-and-book or offer alternatives."
                    ),
                },
            },
            "required": ["doctor_id"],
        },
        fn=_find_available_slots,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR},
    ),
    Tool(
        name="create_appointment",
        description=(
            "Book a new appointment. `starts_at` must be ISO 8601 datetime "
            "('2026-05-20T10:00:00'). The booking will fail if the slot conflicts or is "
            "outside the doctor's working hours — call find_available_slots first."
        ),
        parameters={
            "type": "object",
            "properties": {
                "patient_id": {"type": "integer"}, "doctor_id": {"type": "integer"},
                "branch_id": {"type": "integer"},
                "starts_at": {"type": "string", "description": "ISO 8601 datetime YYYY-MM-DDTHH:MM:SS"},
                "duration_minutes": {"type": "integer"},
                "appointment_type": {"type": "string"}, "reason": {"type": "string"},
                "notes": {"type": "string"},
            },
            "required": ["patient_id", "doctor_id", "branch_id", "starts_at"],
        },
        fn=_create_appointment,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR},
    ),
    Tool(
        name="reschedule_appointment",
        description="Reschedule an existing appointment.",
        parameters={
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"},
                "new_starts_at": {"type": "string"},
                "new_doctor_id": {"type": "integer"},
                "new_branch_id": {"type": "integer"},
                "reason": {"type": "string"},
            },
            "required": ["appointment_id", "new_starts_at"],
        },
        fn=_reschedule_appointment,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR},
        destructive=True,
    ),
    Tool(
        name="cancel_appointment",
        description="Cancel an appointment.",
        parameters={
            "type": "object",
            "properties": {
                "appointment_id": {"type": "integer"}, "reason": {"type": "string"},
            },
            "required": ["appointment_id"],
        },
        fn=_cancel_appointment,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.DOCTOR},
        destructive=True,
    ),
    Tool(
        name="check_insurance_acceptance",
        description="Check whether the patient's insurance plans are accepted by a doctor.",
        parameters={
            "type": "object",
            "properties": {"patient_id": {"type": "integer"}, "doctor_id": {"type": "integer"}},
            "required": ["patient_id", "doctor_id"],
        },
        fn=_check_insurance_acceptance,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.SECRETARY, Role.PATIENT, Role.INSURANCE_OFFICER, Role.DOCTOR},
    ),
    Tool(
        name="summarize_patient_history",
        description="Concise patient medical summary + last 5 visits.",
        parameters={
            "type": "object",
            "properties": {"patient_id": {"type": "integer"}},
            "required": ["patient_id"],
        },
        fn=_summarize_patient_history,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.DOCTOR, Role.NURSE, Role.PATIENT},
    ),
    Tool(
        name="doctor_schedule_today",
        description="Doctor's daily summary (counts by status + appointment codes).",
        parameters={"type": "object", "properties": {}},
        fn=_doctor_schedule_today,
        roles={Role.DOCTOR},
    ),
    Tool(
        name="next_patient_or_appointment",
        description="Doctor's next appointment, OR patient's next appointment.",
        parameters={"type": "object", "properties": {}},
        fn=_next_patient_or_appointment,
        roles={Role.DOCTOR, Role.PATIENT},
    ),
    Tool(
        name="report_overview",
        description="Aggregate dashboard counts and rates.",
        parameters={"type": "object", "properties": {}},
        fn=_report_overview,
        roles={Role.SUPER_ADMIN, Role.CLINIC_ADMIN, Role.AUDITOR, Role.INSURANCE_OFFICER},
    ),
]


def tools_for(user: User) -> list[Tool]:
    role_set = {Role(r) for r in user.role_codes if r in {role.value for role in Role}}
    return [t for t in ALL_TOOLS if t.roles & role_set]


def tool_by_name(name: str) -> Tool | None:
    for t in ALL_TOOLS:
        if t.name == name:
            return t
    return None
