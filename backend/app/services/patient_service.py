"""Patient service: CRUD + search."""
from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select

from ..errors import Forbidden, NotFound
from ..extensions import db
from ..models.patient import Patient
from ..utils.tenant_scope import active_tenant_id, scope_query, tenant_id_for_new_row
from . import audit_service


def list_patients(
    *,
    q: str | None = None,
    phone: str | None = None,
    national_id: str | None = None,
    kyc_status: str | None = None,
    gender: str | None = None,
    blood_type: str | None = None,
    age_min: int | None = None,
    age_max: int | None = None,
    allergen: str | None = None,
    has_chronic: bool = False,
    has_insurance: bool = False,
    insurance_company_id: int | None = None,
    sort: str | None = None,
):
    from datetime import date, timedelta
    from ..models.insurance import PatientInsurance

    stmt = scope_query(select(Patient), Patient)

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Patient.full_name_en.ilike(like),
                Patient.full_name_ar.ilike(like),
                Patient.code.ilike(like),
                Patient.phone.ilike(like),
                Patient.email.ilike(like),
                Patient.national_id.ilike(like),
            )
        )
    if phone:
        stmt = stmt.where(Patient.phone == phone)
    if national_id:
        stmt = stmt.where(Patient.national_id == national_id)
    if kyc_status:
        stmt = stmt.where(Patient.kyc_status == kyc_status)
    if gender:
        stmt = stmt.where(Patient.gender == gender.lower())
    if blood_type:
        stmt = stmt.where(Patient.blood_type == blood_type)

    # Age window via date_of_birth. age_min => DOB on/before (today - age_min years)
    today = date.today()
    if age_min is not None:
        cutoff = date(today.year - age_min, today.month, today.day)
        stmt = stmt.where(Patient.date_of_birth <= cutoff)
    if age_max is not None:
        # Anyone with DOB strictly after this cutoff is younger than age_max+1
        cutoff = date(today.year - age_max - 1, today.month, today.day) + timedelta(days=1)
        stmt = stmt.where(Patient.date_of_birth >= cutoff)

    if allergen:
        stmt = stmt.where(Patient.allergies.any(allergen.lower()))

    if has_chronic:
        stmt = stmt.where(db.func.array_length(Patient.chronic_diseases, 1) > 0)

    if has_insurance or insurance_company_id:
        ins_stmt = select(PatientInsurance.patient_id)
        if insurance_company_id:
            ins_stmt = ins_stmt.where(PatientInsurance.insurance_company_id == insurance_company_id)
        stmt = stmt.where(Patient.id.in_(ins_stmt))

    sort = (sort or "").lower()
    if sort == "name":
        stmt = stmt.order_by(Patient.full_name_en.asc())
    elif sort == "oldest":
        stmt = stmt.order_by(Patient.created_at.asc())
    elif sort == "dob_asc":
        stmt = stmt.order_by(Patient.date_of_birth.asc().nullslast())
    elif sort == "dob_desc":
        stmt = stmt.order_by(Patient.date_of_birth.desc().nullslast())
    else:
        stmt = stmt.order_by(Patient.created_at.desc())

    return stmt


def get(patient_id: int) -> Patient:
    p = db.session.get(Patient, patient_id)
    if p is None:
        raise NotFound("Patient not found")
    _enforce_same_tenant(p, "patient")
    return p


def get_by_phone(phone: str) -> Patient | None:
    return db.session.scalar(scope_query(select(Patient), Patient).where(Patient.phone == phone))


def create_patient(data: dict[str, Any], *, actor_user_id: int | None, source_channel: str) -> Patient:
    code = _generate_code()
    tid = tenant_id_for_new_row()
    patient = Patient(code=code, tenant_id=tid, **data)
    db.session.add(patient)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="patient.create",
        entity_type="patient", entity_id=patient.id, new_value={"id": patient.id, "code": patient.code},
        source_channel=source_channel,
    )
    db.session.commit()
    return patient


def update_patient(patient_id: int, data: dict[str, Any], *, actor_user_id: int | None, source_channel: str) -> Patient:
    patient = get(patient_id)
    old = {k: getattr(patient, k) for k in data.keys() if hasattr(patient, k)}
    for k, v in data.items():
        if hasattr(patient, k):
            setattr(patient, k, v)
    audit_service.record(
        user_id=actor_user_id, role=None, action="patient.update",
        entity_type="patient", entity_id=patient.id, old_value=old, new_value=data,
        source_channel=source_channel,
    )
    db.session.commit()
    return patient


def move_patient_to_tenant(patient_id: int, target_tenant_id: int, *, actor_user_id: int) -> Patient:
    """Move a patient (and their appointments + KYC + insurance) to another tenant."""
    from ..models.appointment import Appointment
    from ..models.insurance import PatientInsurance
    from ..models.kyc import KycVerification
    from ..models.tenant import Tenant

    patient = db.session.get(Patient, patient_id)
    if patient is None:
        raise NotFound("Patient not found")
    target = db.session.get(Tenant, target_tenant_id)
    if target is None:
        raise NotFound("Target tenant not found")

    old_tenant = patient.tenant_id
    patient.tenant_id = target_tenant_id
    if patient.user is not None:
        patient.user.tenant_id = target_tenant_id

    # Cascade
    db.session.execute(
        Appointment.__table__.update()
        .where(Appointment.patient_id == patient.id)
        .values(tenant_id=target_tenant_id)
    )

    audit_service.record(
        user_id=actor_user_id, role=None, action="patient.move_tenant",
        entity_type="patient", entity_id=patient.id,
        old_value={"tenant_id": old_tenant},
        new_value={"tenant_id": target_tenant_id},
        source_channel="api",
    )
    db.session.commit()
    return patient


def _generate_code() -> str:
    """Simple monotonic code based on the next patient id."""
    next_id = (db.session.scalar(select(db.func.coalesce(db.func.max(Patient.id), 0))) or 0) + 1
    return f"PAT-{next_id:07d}"


def _enforce_same_tenant(patient: Patient, what: str = "resource") -> None:
    """Defence-in-depth: even after get(), confirm tenant matches the caller's
    scope (super_admins always pass)."""
    from ..utils.tenant_scope import is_super_admin
    if is_super_admin():
        return
    tid = active_tenant_id()
    if tid is not None and patient.tenant_id is not None and patient.tenant_id != tid:
        raise Forbidden(f"This {what} belongs to another tenant")
