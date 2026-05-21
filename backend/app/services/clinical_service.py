"""Clinical workflow: consultation notes, prescriptions, lab orders."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select

from ..errors import Forbidden, NotFound
from ..extensions import db
from ..models.appointment import Appointment
from ..models.clinical import (
    ConsultationNote,
    LabOrder,
    LabOrderKind,
    LabOrderPriority,
    LabOrderStatus,
    Prescription,
    PrescriptionStatus,
    Vitals,
)
from . import audit_service


def _get_appointment_for_doctor(appointment_id: int, *, doctor_id: int) -> Appointment:
    appt = db.session.get(Appointment, appointment_id)
    if appt is None:
        raise NotFound("Appointment not found")
    if appt.doctor_id != doctor_id:
        raise Forbidden("Appointment is not assigned to you")
    return appt


# ---------------------------------------------------------------------------
# Consultation note (single per appointment)
# ---------------------------------------------------------------------------
def get_note(appointment_id: int) -> ConsultationNote | None:
    return db.session.scalar(
        select(ConsultationNote).where(ConsultationNote.appointment_id == appointment_id)
    )


def upsert_note(
    appointment_id: int,
    *,
    doctor_id: int,
    data: dict[str, Any],
    actor_user_id: int,
) -> ConsultationNote:
    appt = _get_appointment_for_doctor(appointment_id, doctor_id=doctor_id)
    note = get_note(appointment_id)
    if note is None:
        note = ConsultationNote(appointment_id=appointment_id, doctor_id=doctor_id)
        db.session.add(note)
    for field in (
        "chief_complaint", "history_of_present_illness", "examination",
        "diagnosis", "icd10_codes", "treatment_plan",
        "follow_up_in_days", "private_notes",
    ):
        if field in data:
            setattr(note, field, data[field])
    audit_service.record(
        user_id=actor_user_id, role=None, action="consultation.note_saved",
        entity_type="appointment", entity_id=appt.id,
        new_value={k: v for k, v in data.items() if k != "private_notes"},
        source_channel="api",
    )
    db.session.commit()
    return note


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
def list_prescriptions(appointment_id: int) -> list[Prescription]:
    return db.session.scalars(
        select(Prescription).where(Prescription.appointment_id == appointment_id).order_by(Prescription.id)
    ).all()


def add_prescription(
    appointment_id: int,
    *,
    doctor_id: int,
    data: dict[str, Any],
    actor_user_id: int,
) -> Prescription:
    appt = _get_appointment_for_doctor(appointment_id, doctor_id=doctor_id)
    rx = Prescription(
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        prescribed_by_doctor_id=doctor_id,
        medication=data["medication"],
        dosage=data.get("dosage"),
        frequency=data.get("frequency"),
        route=data.get("route"),
        duration_days=data.get("duration_days"),
        quantity=data.get("quantity"),
        refills=data.get("refills", 0),
        instructions=data.get("instructions"),
    )
    db.session.add(rx)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="prescription.create",
        entity_type="prescription", entity_id=rx.id,
        new_value={"medication": rx.medication, "appointment_id": appt.id},
        source_channel="api",
    )
    db.session.commit()
    return rx


def update_prescription_status(prescription_id: int, *, status: PrescriptionStatus, actor_user_id: int) -> Prescription:
    rx = db.session.get(Prescription, prescription_id)
    if rx is None:
        raise NotFound("Prescription not found")
    rx.status = status
    if status == PrescriptionStatus.DISPENSED:
        from ..utils.time_utils import utcnow
        rx.dispensed_at = utcnow()
    db.session.commit()
    return rx


# ---------------------------------------------------------------------------
# Lab orders
# ---------------------------------------------------------------------------
def list_lab_orders(appointment_id: int) -> list[LabOrder]:
    return db.session.scalars(
        select(LabOrder).where(LabOrder.appointment_id == appointment_id).order_by(LabOrder.id)
    ).all()


def add_lab_order(
    appointment_id: int,
    *,
    doctor_id: int,
    data: dict[str, Any],
    actor_user_id: int,
) -> LabOrder:
    appt = _get_appointment_for_doctor(appointment_id, doctor_id=doctor_id)
    order = LabOrder(
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        ordered_by_doctor_id=doctor_id,
        kind=LabOrderKind(data.get("kind", "lab")),
        test_name=data["test_name"],
        test_code=data.get("test_code"),
        priority=LabOrderPriority(data.get("priority", "routine")),
        clinical_notes=data.get("clinical_notes"),
    )
    db.session.add(order)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="lab_order.create",
        entity_type="lab_order", entity_id=order.id,
        new_value={"test_name": order.test_name, "appointment_id": appt.id},
        source_channel="api",
    )
    db.session.commit()
    return order


def update_lab_order(
    order_id: int,
    *,
    status: LabOrderStatus | None = None,
    results: str | None = None,
    actor_user_id: int,
) -> LabOrder:
    order = db.session.get(LabOrder, order_id)
    if order is None:
        raise NotFound("Lab order not found")
    if status:
        order.status = status
        if status == LabOrderStatus.COMPLETED:
            from ..utils.time_utils import utcnow
            order.completed_at = utcnow()
    if results is not None:
        order.results = results
    db.session.commit()
    return order


# ---------------------------------------------------------------------------
# Vitals
# ---------------------------------------------------------------------------
def save_vitals(appointment_id: int, *, data: dict[str, Any], actor_user_id: int) -> Vitals:
    appt = db.session.get(Appointment, appointment_id)
    if appt is None:
        raise NotFound("Appointment not found")
    v = Vitals(
        appointment_id=appt.id,
        patient_id=appt.patient_id,
        recorded_by_user_id=actor_user_id,
        **{k: v for k, v in data.items() if k in {
            "weight_kg", "height_cm", "blood_pressure_systolic", "blood_pressure_diastolic",
            "heart_rate_bpm", "temperature_c", "respiratory_rate", "oxygen_saturation", "notes",
        }},
    )
    db.session.add(v)
    db.session.commit()
    return v


def latest_vitals(appointment_id: int) -> Vitals | None:
    return db.session.scalar(
        select(Vitals).where(Vitals.appointment_id == appointment_id).order_by(Vitals.id.desc())
    )
