"""KYC verification cycles and extracted fields."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, String, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class KycStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    REQUIRES_REVIEW = "requires_review"


class KycVerification(TimestampMixin, db.Model):
    __tablename__ = "kyc_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[KycStatus] = mapped_column(
        Enum(KycStatus, name="kyc_verification_status"),
        default=KycStatus.PENDING,
        nullable=False,
    )
    decision_reason: Mapped[str | None] = mapped_column(Text)
    extracted_payload: Mapped[dict | None] = mapped_column(JSONB)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patient: Mapped["Patient"] = relationship(back_populates="kyc_verifications")
    extracted_fields: Mapped[list["KycExtractedField"]] = relationship(
        back_populates="verification", cascade="all,delete"
    )


class KycExtractedField(TimestampMixin, db.Model):
    __tablename__ = "kyc_extracted_fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    verification_id: Mapped[int] = mapped_column(
        ForeignKey("kyc_verifications.id", ondelete="CASCADE"), nullable=False
    )
    field_name: Mapped[str] = mapped_column(String(64), nullable=False)
    extracted_value: Mapped[str | None] = mapped_column(String(255))
    manual_value: Mapped[str | None] = mapped_column(String(255))
    confidence: Mapped[float | None] = mapped_column(Float)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    verification: Mapped[KycVerification] = relationship(back_populates="extracted_fields")


from .patient import Patient  # noqa: E402
