"""Aggregate reporting service for dashboards (tenant-scoped)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select

from ..extensions import db
from ..models.appointment import Appointment, AppointmentStatus
from ..models.doctor import Doctor
from ..models.insurance import InsuranceApproval, InsuranceApprovalStatus
from ..models.kyc import KycStatus, KycVerification
from ..models.patient import Patient
from ..models.user import User
from ..utils.tenant_scope import scope_query


def overview() -> dict:
    now = datetime.now(timezone.utc)
    last_30 = now - timedelta(days=30)

    total_appts = db.session.scalar(
        scope_query(select(func.count(Appointment.id)), Appointment)
    ) or 0
    total_appts_30 = db.session.scalar(
        scope_query(select(func.count(Appointment.id)), Appointment).where(
            Appointment.created_at >= last_30
        )
    ) or 0

    status_counts = dict(
        db.session.execute(
            scope_query(
                select(Appointment.status, func.count(Appointment.id)), Appointment
            ).group_by(Appointment.status)
        ).all()
    )
    status_counts = {k.value if hasattr(k, "value") else k: v for k, v in status_counts.items()}

    total = sum(status_counts.values()) or 1
    no_show_rate = status_counts.get("no_show", 0) / total
    cancellation_rate = status_counts.get("cancelled", 0) / total

    # InsuranceApproval doesn't have tenant_id directly — scope via its appointment.
    insurance_pending_stmt = (
        select(func.count(InsuranceApproval.id))
        .join(Appointment, Appointment.id == InsuranceApproval.appointment_id)
        .where(
            InsuranceApproval.status.in_(
                [InsuranceApprovalStatus.PENDING, InsuranceApprovalStatus.SUBMITTED]
            )
        )
    )
    insurance_pending = db.session.scalar(scope_query(insurance_pending_stmt, Appointment)) or 0

    new_patients_30 = db.session.scalar(
        scope_query(select(func.count(Patient.id)), Patient).where(
            Patient.created_at >= last_30
        )
    ) or 0

    kyc_breakdown = dict(
        db.session.execute(
            scope_query(
                select(Patient.kyc_status, func.count(Patient.id)), Patient
            ).group_by(Patient.kyc_status)
        ).all()
    )
    kyc_breakdown = {k.value if hasattr(k, "value") else k: v for k, v in kyc_breakdown.items()}

    return {
        "total_appointments": total_appts,
        "appointments_last_30_days": total_appts_30,
        "appointments_by_status": status_counts,
        "no_show_rate": round(no_show_rate, 4),
        "cancellation_rate": round(cancellation_rate, 4),
        "insurance_pending_approvals": insurance_pending,
        "new_patients_last_30_days": new_patients_30,
        "kyc_breakdown": kyc_breakdown,
    }


def doctor_utilization(date_from: datetime, date_to: datetime) -> list[dict]:
    stmt = (
        select(
            Doctor.id,
            User.full_name,
            func.count(Appointment.id),
            func.sum(
                func.coalesce(
                    func.extract("epoch", Appointment.ends_at - Appointment.starts_at),
                    0,
                )
            ),
        )
        .join(User, User.id == Doctor.user_id)
        .outerjoin(
            Appointment,
            (Appointment.doctor_id == Doctor.id)
            & (Appointment.starts_at >= date_from)
            & (Appointment.starts_at <= date_to)
            & (Appointment.status.in_([AppointmentStatus.COMPLETED, AppointmentStatus.IN_CONSULTATION])),
        )
        .group_by(Doctor.id, User.full_name)
        .order_by(func.count(Appointment.id).desc())
    )
    rows = db.session.execute(scope_query(stmt, Doctor)).all()
    return [
        {
            "doctor_id": did,
            "doctor_name": name,
            "appointments": int(count or 0),
            "total_seconds": int(secs or 0),
        }
        for did, name, count, secs in rows
    ]


def kyc_funnel() -> dict:
    """KYC verification status counts, scoped to current tenant via the
    underlying patient."""
    stmt = (
        select(KycVerification.status, func.count(KycVerification.id))
        .join(Patient, Patient.id == KycVerification.patient_id)
        .group_by(KycVerification.status)
    )
    rows = dict(db.session.execute(scope_query(stmt, Patient)).all())
    return {k.value if hasattr(k, "value") else k: v for k, v in rows.items()}
