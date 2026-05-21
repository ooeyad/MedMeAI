"""Insurance service."""
from __future__ import annotations

from datetime import date

from sqlalchemy import select

from ..errors import InsuranceExpired, InsuranceNotAccepted, NotFound
from ..extensions import db
from ..models.doctor import Doctor, DoctorInsuranceNetwork
from ..models.insurance import (
    InsuranceApproval,
    InsuranceApprovalStatus,
    InsuranceCompany,
    PatientInsurance,
    PatientInsuranceStatus,
)
from ..models.patient import Patient
from ..utils.time_utils import utcnow
from . import audit_service


def get_companies():
    return db.session.scalars(select(InsuranceCompany).order_by(InsuranceCompany.name)).all()


def get_patient_insurance(patient_id: int) -> list[PatientInsurance]:
    return db.session.scalars(
        select(PatientInsurance).where(PatientInsurance.patient_id == patient_id)
    ).all()


_EDITABLE_INS_FIELDS = {
    "insurance_company_id", "policy_number", "member_number",
    "network_tier", "coverage_type", "expiry_date", "deductible",
    "copayment", "approval_required", "is_primary", "status", "notes",
}


def update_patient_insurance(insurance_id: int, data: dict, *, actor_user_id: int | None) -> PatientInsurance:
    ins = db.session.get(PatientInsurance, insurance_id)
    if ins is None:
        raise NotFound("Insurance record not found")
    old = {}
    for f in _EDITABLE_INS_FIELDS:
        if f in data:
            old[f] = getattr(ins, f)
            setattr(ins, f, data[f])
    audit_service.record(
        user_id=actor_user_id, role=None, action="insurance.update",
        entity_type="patient_insurance", entity_id=ins.id,
        old_value=old, new_value={k: v for k, v in data.items() if k in _EDITABLE_INS_FIELDS},
        source_channel="api",
    )
    db.session.commit()
    return ins


def delete_patient_insurance(insurance_id: int, *, actor_user_id: int | None) -> None:
    ins = db.session.get(PatientInsurance, insurance_id)
    if ins is None:
        raise NotFound("Insurance record not found")
    audit_service.record(
        user_id=actor_user_id, role=None, action="insurance.delete",
        entity_type="patient_insurance", entity_id=ins.id,
        old_value={"patient_id": ins.patient_id, "insurance_company_id": ins.insurance_company_id},
        source_channel="api",
    )
    db.session.delete(ins)
    db.session.commit()


def add_patient_insurance(patient_id: int, data: dict, *, actor_user_id: int | None) -> PatientInsurance:
    patient = db.session.get(Patient, patient_id)
    if patient is None:
        raise NotFound("Patient not found")
    ins = PatientInsurance(patient_id=patient_id, **data)
    db.session.add(ins)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="insurance.add",
        entity_type="patient_insurance", entity_id=ins.id,
        new_value={"insurance_company_id": ins.insurance_company_id, "member_number": "[REDACTED]"},
        source_channel="api",
    )
    db.session.commit()
    return ins


def check_acceptance(*, patient_id: int, doctor_id: int) -> dict:
    """Does the doctor accept any of the patient's insurance plans?"""
    patient_plans = get_patient_insurance(patient_id)
    if not patient_plans:
        return {"accepted": False, "reason": "no_insurance_on_file"}

    plans_by_company = {p.insurance_company_id: p for p in patient_plans}
    networks = db.session.scalars(
        select(DoctorInsuranceNetwork).where(
            DoctorInsuranceNetwork.doctor_id == doctor_id,
            DoctorInsuranceNetwork.accepts == True,
        )
    ).all()
    today = date.today()

    for net in networks:
        plan = plans_by_company.get(net.insurance_company_id)
        if plan is None:
            continue
        if plan.expiry_date and plan.expiry_date < today:
            return {
                "accepted": False, "reason": "insurance_expired",
                "company_id": net.insurance_company_id,
                "expiry_date": plan.expiry_date.isoformat(),
            }
        return {
            "accepted": True,
            "company_id": net.insurance_company_id,
            "network_tier": plan.network_tier,
            "copayment": float(plan.copayment) if plan.copayment is not None else None,
            "approval_required": plan.approval_required,
        }
    return {"accepted": False, "reason": "doctor_does_not_accept_patient_networks"}


def request_approval(*, appointment_id: int, patient_insurance_id: int, actor_user_id: int | None) -> InsuranceApproval:
    appr = InsuranceApproval(
        appointment_id=appointment_id,
        patient_insurance_id=patient_insurance_id,
        status=InsuranceApprovalStatus.SUBMITTED,
        submitted_by_user_id=actor_user_id,
        submitted_at=utcnow(),
    )
    db.session.add(appr)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="insurance.request_approval",
        entity_type="insurance_approval", entity_id=appr.id,
        new_value={"appointment_id": appointment_id}, source_channel="api",
    )
    db.session.commit()
    return appr


def decide_approval(approval_id: int, *, status: InsuranceApprovalStatus, notes: str | None, actor_user_id: int) -> InsuranceApproval:
    appr = db.session.get(InsuranceApproval, approval_id)
    if appr is None:
        raise NotFound("Insurance approval not found")
    appr.status = status
    appr.notes = notes
    appr.decided_by_user_id = actor_user_id
    appr.decided_at = utcnow()
    audit_service.record(
        user_id=actor_user_id, role=None,
        action=f"insurance.approval.{status.value}",
        entity_type="insurance_approval", entity_id=appr.id,
        new_value={"status": status.value, "notes": notes},
        source_channel="api",
    )
    db.session.commit()
    return appr
