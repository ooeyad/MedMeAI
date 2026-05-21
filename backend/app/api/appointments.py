"""Appointments API."""
from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..errors import Forbidden, ValidationFailed
from ..extensions import db
from ..models.appointment import AppointmentStatus, AppointmentType, SourceChannel
from ..rbac import require_permission
from ..schemas.appointment import (
    AppointmentCreateSchema,
    AppointmentInquirySchema,
    AppointmentRescheduleSchema,
    AppointmentSchema,
    AppointmentTransitionSchema,
)
from ..services import appointment_service, doctor_service
from ..utils.pagination import paginate

appointments_bp = Blueprint("appointments", __name__)

_schema = AppointmentSchema()
_create_schema = AppointmentCreateSchema()
_reschedule_schema = AppointmentRescheduleSchema()
_transition_schema = AppointmentTransitionSchema()
_inquiry_schema = AppointmentInquirySchema()


def _scope_to_self(stmt):
    """Patients and doctors can only see their own appointments."""
    if current_user.has_role("patient"):
        if not current_user.patient:
            raise Forbidden("No patient profile linked to user")
        return stmt.where_clauses if False else stmt  # patient_id will be set later
    return stmt


@appointments_bp.get("/")
@require_permission("appointments:read", "appointments:read:self")
def list_appointments():
    filters = _inquiry_schema.load(request.args)

    # Multi-value filters via repeated keys, bracketed form, or CSV.
    def _multi(name: str) -> list[str] | None:
        out: list[str] = []
        out.extend(request.args.getlist(name))
        out.extend(request.args.getlist(f"{name}[]"))
        csv = request.args.get(f"{name}_csv")
        if csv:
            out.extend(csv.split(","))
        out = [v.strip() for v in out if v and v.strip()]
        return out or None

    statuses = _multi("statuses")
    types = _multi("appointment_types")
    if statuses:
        filters["statuses"] = statuses
    if types:
        filters["appointment_types"] = types

    # Force-scope to the calling user. We OVERRIDE any caller-provided value
    # — a doctor can't ask to see another doctor's appointments, and a patient
    # can't ask for someone else's. (setdefault used to be wrong here because
    # the schema fills the key with None, which setdefault treats as "set".)
    if current_user.has_role("patient"):
        if not current_user.patient:
            raise Forbidden("No patient profile linked to user")
        filters["patient_id"] = current_user.patient.id
    elif current_user.has_role("doctor"):
        if not current_user.doctor:
            raise Forbidden("No doctor profile linked to user")
        filters["doctor_id"] = current_user.doctor.id

    stmt = appointment_service.list_appointments(**filters)
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_schema.dump)), 200


@appointments_bp.post("/")
@require_permission("appointments:write", "appointments:write:self")
def create_appointment():
    data = _create_schema.load(request.get_json() or {})
    if current_user.has_role("patient"):
        if not current_user.patient or current_user.patient.id != data["patient_id"]:
            raise Forbidden("Patients can only book for themselves")
    appt = appointment_service.create_appointment(
        patient_id=data["patient_id"],
        doctor_id=data["doctor_id"],
        branch_id=data["branch_id"],
        starts_at=data["starts_at"],
        duration_minutes=data.get("duration_minutes"),
        appointment_type=AppointmentType(data.get("appointment_type", AppointmentType.NEW_CONSULTATION.value)),
        reason=data.get("reason"),
        symptoms=data.get("symptoms"),
        notes=data.get("notes"),
        room_id=data.get("room_id"),
        specialty_id=data.get("specialty_id"),
        source_channel=SourceChannel(data.get("source_channel", SourceChannel.WEB.value)),
        created_by_user_id=current_user.id,
        insurance_snapshot=data.get("insurance_snapshot"),
        allow_overbook=data.get("allow_overbook", False) and not current_user.has_role("patient"),
    )
    return jsonify(_schema.dump(appt)), 201


@appointments_bp.get("/<int:appointment_id>")
@require_permission("appointments:read", "appointments:read:self")
def get_appointment(appointment_id: int):
    appt = appointment_service.get(appointment_id)
    _check_owner_or_role(appt)
    body = _schema.dump(appt)
    body["status_history"] = [
        {"from": h.from_status.value if h.from_status else None, "to": h.to_status.value,
         "at": h.at.isoformat(), "actor_user_id": h.actor_user_id, "reason": h.reason}
        for h in appt.status_history
    ]
    return jsonify(body), 200


def _check_owner_or_role(appt) -> None:
    """Enforce per-role access to an appointment with helpful error messages."""
    from ..utils.tenant_scope import is_super_admin

    # Tenant check first — defence-in-depth
    if not is_super_admin() and current_user.tenant_id and appt.tenant_id \
            and current_user.tenant_id != appt.tenant_id:
        raise Forbidden(
            f"This appointment belongs to another tenant (#{appt.tenant_id})."
        )

    if current_user.has_role("patient"):
        if not current_user.patient:
            raise Forbidden("Your account has no patient profile linked.")
        if current_user.patient.id != appt.patient_id:
            raise Forbidden("You can only view your own appointments.")
    elif current_user.has_role("doctor"):
        if not current_user.doctor:
            raise Forbidden("Your account has no doctor profile linked.")
        if current_user.doctor.id != appt.doctor_id:
            raise Forbidden(
                f"This appointment is assigned to doctor #{appt.doctor_id}, "
                f"not you (doctor #{current_user.doctor.id})."
            )


def _transition_route(target: AppointmentStatus, endpoint_name: str):
    def _handler(appointment_id: int):
        data = _transition_schema.load(request.get_json() or {})
        appt = appointment_service.transition(
            appointment_id, target,
            actor_user_id=current_user.id,
            reason=data.get("reason"),
        )
        return jsonify(_schema.dump(appt)), 200
    _handler.__name__ = endpoint_name
    return require_permission("appointments:write", "appointments:write:self")(_handler)


appointments_bp.add_url_rule(
    "/<int:appointment_id>/confirm",
    view_func=_transition_route(AppointmentStatus.CONFIRMED, "confirm"),
    methods=["POST"], endpoint="confirm",
)
appointments_bp.add_url_rule(
    "/<int:appointment_id>/check-in",
    view_func=_transition_route(AppointmentStatus.CHECKED_IN, "check_in"),
    methods=["POST"], endpoint="check_in",
)
appointments_bp.add_url_rule(
    "/<int:appointment_id>/start",
    view_func=_transition_route(AppointmentStatus.IN_CONSULTATION, "start"),
    methods=["POST"], endpoint="start",
)
appointments_bp.add_url_rule(
    "/<int:appointment_id>/complete",
    view_func=_transition_route(AppointmentStatus.COMPLETED, "complete"),
    methods=["POST"], endpoint="complete",
)
appointments_bp.add_url_rule(
    "/<int:appointment_id>/no-show",
    view_func=_transition_route(AppointmentStatus.NO_SHOW, "no_show"),
    methods=["POST"], endpoint="no_show",
)


@appointments_bp.post("/<int:appointment_id>/cancel")
@require_permission("appointments:cancel", "appointments:cancel:self")
def cancel(appointment_id: int):
    data = _transition_schema.load(request.get_json() or {})
    appt = appointment_service.get(appointment_id)
    _check_owner_or_role(appt)
    appt = appointment_service.transition(
        appointment_id, AppointmentStatus.CANCELLED,
        actor_user_id=current_user.id, reason=data.get("reason"),
    )
    return jsonify(_schema.dump(appt)), 200


@appointments_bp.post("/<int:appointment_id>/reschedule")
@require_permission("appointments:write", "appointments:write:self")
def reschedule(appointment_id: int):
    data = _reschedule_schema.load(request.get_json() or {})
    appt = appointment_service.get(appointment_id)
    _check_owner_or_role(appt)
    new_appt = appointment_service.reschedule(
        appointment_id,
        new_starts_at=data["new_starts_at"],
        new_doctor_id=data.get("new_doctor_id"),
        new_branch_id=data.get("new_branch_id"),
        actor_user_id=current_user.id,
        source_channel="api",
        reason=data.get("reason"),
    )
    return jsonify(_schema.dump(new_appt)), 200


@appointments_bp.get("/availability")
@require_permission("appointments:read", "appointments:read:self")
def availability():
    from datetime import date
    doctor_id = request.args.get("doctor_id", type=int)
    if not doctor_id:
        raise ValidationFailed("doctor_id required")
    target = date.fromisoformat(request.args.get("date") or date.today().isoformat())
    duration = request.args.get("duration_minutes", type=int)
    slots = doctor_service.compute_availability(
        doctor_id=doctor_id, date_from=target, date_to=target, duration_minutes=duration,
    )
    return jsonify({"slots": slots}), 200


@appointments_bp.get("/inquire")
@require_permission("appointments:read", "appointments:read:self")
def inquire():
    """Unified inquiry endpoint used by the AI assistant and global search."""
    filters = _inquiry_schema.load(request.args)
    if current_user.has_role("patient"):
        filters["patient_id"] = current_user.patient.id if current_user.patient else 0
    elif current_user.has_role("doctor"):
        if current_user.doctor:
            filters["doctor_id"] = current_user.doctor.id
    stmt = appointment_service.list_appointments(**filters)
    page = paginate(db.session, stmt, default_page_size=10)
    return jsonify(page.to_dict(item_serializer=_schema.dump)), 200
