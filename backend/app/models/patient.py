"""Patient profile model."""
from __future__ import annotations

from datetime import date
import enum

from sqlalchemy import ARRAY, Boolean, Date, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class KycStatusEnum(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


class Patient(TimestampMixin, db.Model):
    __tablename__ = "patients"
    __table_args__ = (
        Index("ix_patients_phone", "phone"),
        Index("ix_patients_national_id", "national_id"),
        Index("ix_patients_full_name_en", "full_name_en"),
        Index("ix_patients_full_name_ar", "full_name_ar"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)  # e.g. PAT-0001234
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)

    # Basic identity (bilingual)
    full_name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name_ar: Mapped[str | None] = mapped_column(String(255))
    national_id: Mapped[str | None] = mapped_column(String(64))
    passport_number: Mapped[str | None] = mapped_column(String(64))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(16))  # male / female / other
    nationality: Mapped[str | None] = mapped_column(String(64))
    marital_status: Mapped[str | None] = mapped_column(String(32))

    # Contact
    phone: Mapped[str | None] = mapped_column(String(32))
    alternative_phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(128))
    country: Mapped[str | None] = mapped_column(String(64))

    # Emergency contact
    emergency_contact_name: Mapped[str | None] = mapped_column(String(255))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32))
    emergency_contact_relationship: Mapped[str | None] = mapped_column(String(64))

    # Medical
    blood_type: Mapped[str | None] = mapped_column(String(8))
    allergies: Mapped[list[str] | None] = mapped_column(ARRAY(String(128)))
    chronic_diseases: Mapped[list[str] | None] = mapped_column(ARRAY(String(128)))
    current_medications: Mapped[list[str] | None] = mapped_column(ARRAY(String(128)))
    medical_history_summary: Mapped[str | None] = mapped_column(Text)
    family_medical_history: Mapped[str | None] = mapped_column(Text)
    special_notes: Mapped[str | None] = mapped_column(Text)
    accessibility_needs: Mapped[str | None] = mapped_column(Text)

    # Consent
    consent_treatment: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_marketing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    consent_data_sharing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    kyc_status: Mapped[KycStatusEnum] = mapped_column(
        Enum(KycStatusEnum, name="kyc_status"), default=KycStatusEnum.PENDING, nullable=False
    )
    extra: Mapped[dict | None] = mapped_column(JSONB)

    user: Mapped["User | None"] = relationship(back_populates="patient")
    documents: Mapped[list["PatientDocument"]] = relationship(
        back_populates="patient", cascade="all,delete"
    )
    kyc_verifications: Mapped[list["KycVerification"]] = relationship(
        back_populates="patient", cascade="all,delete"
    )
    insurance: Mapped[list["PatientInsurance"]] = relationship(
        back_populates="patient", cascade="all,delete"
    )
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")


from .user import User  # noqa: E402
from .document import PatientDocument  # noqa: E402
from .kyc import KycVerification  # noqa: E402
from .insurance import PatientInsurance  # noqa: E402
from .appointment import Appointment  # noqa: E402
