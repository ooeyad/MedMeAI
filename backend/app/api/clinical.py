"""Clinical (consultation, prescriptions, lab orders, vitals) API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..errors import Forbidden, ValidationFailed
from ..models.clinical import LabOrderStatus, PrescriptionStatus
from ..rbac import require_permission
from ..services import clinical_service

clinical_bp = Blueprint("clinical", __name__)


def _doctor_id_or_403() -> int:
    if not current_user.doctor:
        raise Forbidden("Doctor account required")
    return current_user.doctor.id


def _ser_note(n):
    if n is None:
        return None
    return {
        "appointment_id": n.appointment_id,
        "chief_complaint": n.chief_complaint,
        "history_of_present_illness": n.history_of_present_illness,
        "examination": n.examination,
        "diagnosis": n.diagnosis,
        "icd10_codes": n.icd10_codes,
        "treatment_plan": n.treatment_plan,
        "follow_up_in_days": n.follow_up_in_days,
        "private_notes": n.private_notes,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }


def _ser_rx(r):
    return {
        "id": r.id, "appointment_id": r.appointment_id, "patient_id": r.patient_id,
        "medication": r.medication, "dosage": r.dosage, "frequency": r.frequency,
        "route": r.route, "duration_days": r.duration_days, "quantity": r.quantity,
        "refills": r.refills, "instructions": r.instructions,
        "status": r.status.value,
        "dispensed_at": r.dispensed_at.isoformat() if r.dispensed_at else None,
        "created_at": r.created_at.isoformat(),
    }


def _ser_lab(o):
    return {
        "id": o.id, "appointment_id": o.appointment_id, "patient_id": o.patient_id,
        "kind": getattr(o.kind, "value", o.kind) if getattr(o, "kind", None) else "lab",
        "test_name": o.test_name, "test_code": o.test_code,
        "priority": o.priority.value, "status": o.status.value,
        "clinical_notes": o.clinical_notes, "results": o.results,
        "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        "created_at": o.created_at.isoformat(),
    }


def _ser_vitals(v):
    if v is None:
        return None
    return {
        "weight_kg": float(v.weight_kg) if v.weight_kg is not None else None,
        "height_cm": float(v.height_cm) if v.height_cm is not None else None,
        "blood_pressure_systolic": v.blood_pressure_systolic,
        "blood_pressure_diastolic": v.blood_pressure_diastolic,
        "heart_rate_bpm": v.heart_rate_bpm,
        "temperature_c": float(v.temperature_c) if v.temperature_c is not None else None,
        "respiratory_rate": v.respiratory_rate,
        "oxygen_saturation": v.oxygen_saturation,
        "notes": v.notes,
        "recorded_at": v.created_at.isoformat() if v.created_at else None,
    }


# ---------------------------------------------------------------------------
# Consultation note (one per appointment)
# ---------------------------------------------------------------------------
@clinical_bp.get("/appointments/<int:appointment_id>/note")
@require_permission("appointments:read", "appointments:read:self")
def get_note(appointment_id: int):
    note = clinical_service.get_note(appointment_id)
    return jsonify(_ser_note(note) or {"appointment_id": appointment_id}), 200


@clinical_bp.put("/appointments/<int:appointment_id>/note")
@require_permission("appointments:write:self")
def upsert_note(appointment_id: int):
    doctor_id = _doctor_id_or_403()
    note = clinical_service.upsert_note(
        appointment_id, doctor_id=doctor_id,
        data=request.get_json() or {}, actor_user_id=current_user.id,
    )
    return jsonify(_ser_note(note)), 200


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
@clinical_bp.get("/appointments/<int:appointment_id>/prescriptions")
@require_permission("appointments:read", "appointments:read:self")
def list_prescriptions(appointment_id: int):
    items = clinical_service.list_prescriptions(appointment_id)
    return jsonify({"data": [_ser_rx(r) for r in items]}), 200


@clinical_bp.post("/appointments/<int:appointment_id>/prescriptions")
@require_permission("appointments:write:self")
def add_prescription(appointment_id: int):
    doctor_id = _doctor_id_or_403()
    data = request.get_json() or {}
    if not data.get("medication"):
        raise ValidationFailed("medication is required")
    rx = clinical_service.add_prescription(
        appointment_id, doctor_id=doctor_id, data=data, actor_user_id=current_user.id,
    )
    return jsonify(_ser_rx(rx)), 201


@clinical_bp.post("/prescriptions/<int:prescription_id>/status")
@require_permission("appointments:write", "appointments:write:self")
def update_prescription_status_route(prescription_id: int):
    body = request.get_json() or {}
    new_status = body.get("status")
    if new_status not in {s.value for s in PrescriptionStatus}:
        raise ValidationFailed(f"status must be one of {[s.value for s in PrescriptionStatus]}")
    rx = clinical_service.update_prescription_status(
        prescription_id, status=PrescriptionStatus(new_status), actor_user_id=current_user.id,
    )
    return jsonify(_ser_rx(rx)), 200


# ---------------------------------------------------------------------------
# Lab orders
# ---------------------------------------------------------------------------
@clinical_bp.get("/appointments/<int:appointment_id>/lab-orders")
@require_permission("appointments:read", "appointments:read:self")
def list_lab_orders(appointment_id: int):
    items = clinical_service.list_lab_orders(appointment_id)
    return jsonify({"data": [_ser_lab(o) for o in items]}), 200


@clinical_bp.post("/appointments/<int:appointment_id>/lab-orders")
@require_permission("appointments:write:self")
def add_lab_order(appointment_id: int):
    doctor_id = _doctor_id_or_403()
    data = request.get_json() or {}
    if not data.get("test_name"):
        raise ValidationFailed("test_name is required")
    order = clinical_service.add_lab_order(
        appointment_id, doctor_id=doctor_id, data=data, actor_user_id=current_user.id,
    )
    return jsonify(_ser_lab(order)), 201


@clinical_bp.patch("/lab-orders/<int:order_id>")
@require_permission("appointments:write", "appointments:write:self")
def update_lab_order(order_id: int):
    body = request.get_json() or {}
    status = LabOrderStatus(body["status"]) if body.get("status") else None
    order = clinical_service.update_lab_order(
        order_id, status=status, results=body.get("results"), actor_user_id=current_user.id,
    )
    return jsonify(_ser_lab(order)), 200


# ---------------------------------------------------------------------------
# Vitals
# ---------------------------------------------------------------------------
@clinical_bp.get("/appointments/<int:appointment_id>/vitals")
@require_permission("appointments:read", "appointments:read:self")
def get_vitals(appointment_id: int):
    v = clinical_service.latest_vitals(appointment_id)
    return jsonify(_ser_vitals(v) or {"appointment_id": appointment_id}), 200


@clinical_bp.post("/appointments/<int:appointment_id>/vitals")
@require_permission("appointments:write", "appointments:write:self")
def save_vitals(appointment_id: int):
    v = clinical_service.save_vitals(
        appointment_id, data=request.get_json() or {}, actor_user_id=current_user.id,
    )
    return jsonify(_ser_vitals(v)), 201
