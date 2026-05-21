"""Insurance companies, patient insurance, approvals."""
from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class PatientInsuranceStatus(str, enum.Enum):
    NOT_PROVIDED = "not_provided"
    UNDER_REVIEW = "under_review"
    VALID = "valid"
    EXPIRED = "expired"
    REJECTED = "rejected"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"


class InsuranceApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    NOT_REQUIRED = "not_required"


class InsuranceCompany(TimestampMixin, db.Model):
    __tablename__ = "insurance_companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(512))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    api_provider: Mapped[str | None] = mapped_column(String(64))  # future API integration


class PatientInsurance(TimestampMixin, db.Model):
    __tablename__ = "patient_insurance"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    insurance_company_id: Mapped[int] = mapped_column(
        ForeignKey("insurance_companies.id", ondelete="RESTRICT"), nullable=False
    )

    policy_number: Mapped[str | None] = mapped_column(String(128))
    member_number: Mapped[str | None] = mapped_column(String(128))
    network_tier: Mapped[str | None] = mapped_column(String(64))   # silver / gold / platinum / class A
    coverage_type: Mapped[str | None] = mapped_column(String(64))   # employee / family / corporate / individual
    expiry_date: Mapped[date | None] = mapped_column(Date)
    deductible: Mapped[float | None] = mapped_column(Numeric(10, 2))
    copayment: Mapped[float | None] = mapped_column(Numeric(10, 2))
    approval_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    front_document_id: Mapped[int | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    back_document_id: Mapped[int | None] = mapped_column(ForeignKey("files.id", ondelete="SET NULL"))
    extracted_payload: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[PatientInsuranceStatus] = mapped_column(
        Enum(PatientInsuranceStatus, name="patient_insurance_status"),
        default=PatientInsuranceStatus.UNDER_REVIEW,
        nullable=False,
    )

    patient: Mapped["Patient"] = relationship(back_populates="insurance")
    insurance_company: Mapped[InsuranceCompany] = relationship()


class InsuranceApproval(TimestampMixin, db.Model):
    __tablename__ = "insurance_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    patient_insurance_id: Mapped[int] = mapped_column(
        ForeignKey("patient_insurance.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[InsuranceApprovalStatus] = mapped_column(
        Enum(InsuranceApprovalStatus, name="insurance_approval_status"),
        default=InsuranceApprovalStatus.PENDING,
        nullable=False,
    )
    reference_number: Mapped[str | None] = mapped_column(String(128))
    submitted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    decided_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[dict | None] = mapped_column(JSONB)


from .patient import Patient  # noqa: E402
