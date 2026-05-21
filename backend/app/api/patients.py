"""Patients API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..extensions import db
from ..rbac import require_auth, require_permission
from ..schemas.patient import PatientCreateSchema, PatientSchema, PatientUpdateSchema
from ..services import appointment_service, patient_service
from ..utils.pagination import paginate

patients_bp = Blueprint("patients", __name__)

_patient_schema = PatientSchema()
_create_schema = PatientCreateSchema()
_update_schema = PatientUpdateSchema(partial=True)


@patients_bp.get("/")
@require_permission("patients:read")
def list_patients():
    def _bool(name: str) -> bool:
        return (request.args.get(name) or "").lower() in {"1", "true", "yes", "on"}

    stmt = patient_service.list_patients(
        q=request.args.get("q"),
        phone=request.args.get("phone"),
        national_id=request.args.get("national_id"),
        kyc_status=request.args.get("kyc_status"),
        gender=request.args.get("gender"),
        blood_type=request.args.get("blood_type"),
        age_min=request.args.get("age_min", type=int),
        age_max=request.args.get("age_max", type=int),
        allergen=request.args.get("allergen"),
        has_chronic=_bool("has_chronic"),
        has_insurance=_bool("has_insurance"),
        insurance_company_id=request.args.get("insurance_company_id", type=int),
        sort=request.args.get("sort"),
    )
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_patient_schema.dump)), 200


@patients_bp.post("/")
@require_permission("patients:write")
def create_patient():
    data = _create_schema.load(request.get_json() or {})
    patient = patient_service.create_patient(
        data, actor_user_id=current_user.id, source_channel="api",
    )
    return jsonify(_patient_schema.dump(patient)), 201


@patients_bp.get("/<int:patient_id>")
@require_permission("patients:read", "patients:read:self")
def get_patient(patient_id: int):
    patient = patient_service.get(patient_id)
    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient.id):
        from ..errors import Forbidden
        raise Forbidden("You can only view your own profile")
    return jsonify(_patient_schema.dump(patient)), 200


@patients_bp.patch("/<int:patient_id>")
@require_permission("patients:write", "patients:write:self")
def update_patient(patient_id: int):
    data = _update_schema.load(request.get_json() or {})
    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient_id):
        from ..errors import Forbidden
        raise Forbidden("You can only edit your own profile")
    patient = patient_service.update_patient(
        patient_id, data, actor_user_id=current_user.id, source_channel="api",
    )
    return jsonify(_patient_schema.dump(patient)), 200


@patients_bp.post("/<int:patient_id>/move-tenant")
@require_permission("patients:write")
def move_patient_tenant(patient_id: int):
    from ..errors import Forbidden, ValidationFailed
    if "super_admin" not in {r.code for r in current_user.roles}:
        raise Forbidden("Only super admins can move data between tenants")
    body = request.get_json() or {}
    target = body.get("tenant_id")
    if not target:
        raise ValidationFailed("tenant_id is required")
    patient = patient_service.move_patient_to_tenant(
        patient_id, int(target), actor_user_id=current_user.id,
    )
    return jsonify(_patient_schema.dump(patient)), 200


@patients_bp.get("/<int:patient_id>/appointments")
@require_permission("appointments:read", "appointments:read:self")
def patient_appointments(patient_id: int):
    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient_id):
        from ..errors import Forbidden
        raise Forbidden("You can only view your own appointments")
    from ..schemas.appointment import AppointmentSchema
    stmt = appointment_service.list_appointments(patient_id=patient_id)
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=AppointmentSchema().dump)), 200


@patients_bp.get("/<int:patient_id>/timeline")
@require_permission("patients:read", "patients:read:self")
def patient_timeline(patient_id: int):
    """Lightweight combined timeline (appointments + KYC events)."""
    from ..models.appointment import Appointment
    from ..models.kyc import KycVerification
    from sqlalchemy import select

    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient_id):
        from ..errors import Forbidden
        raise Forbidden()
    appts = db.session.scalars(
        select(Appointment).where(Appointment.patient_id == patient_id).order_by(Appointment.starts_at.desc())
    ).all()
    kyc = db.session.scalars(
        select(KycVerification).where(KycVerification.patient_id == patient_id).order_by(KycVerification.id.desc())
    ).all()
    events = (
        [{"kind": "appointment", "at": a.starts_at.isoformat(), "code": a.code, "status": a.status.value} for a in appts]
        + [{"kind": "kyc", "at": k.created_at.isoformat(), "status": k.status.value} for k in kyc]
    )
    events.sort(key=lambda e: e["at"], reverse=True)
    return jsonify({"events": events}), 200
