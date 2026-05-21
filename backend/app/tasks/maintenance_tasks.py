"""Maintenance / housekeeping tasks."""
from __future__ import annotations

from datetime import date

from celery import shared_task
from sqlalchemy import select

from ..extensions import db
from ..models.insurance import PatientInsurance, PatientInsuranceStatus


@shared_task
def sweep_kyc_expiry() -> int:
    """Mark expired insurance plans as `expired`."""
    today = date.today()
    rows = db.session.scalars(
        select(PatientInsurance).where(
            PatientInsurance.expiry_date.is_not(None),
            PatientInsurance.expiry_date < today,
            PatientInsurance.status != PatientInsuranceStatus.EXPIRED,
        )
    ).all()
    for r in rows:
        r.status = PatientInsuranceStatus.EXPIRED
    db.session.commit()
    return len(rows)
