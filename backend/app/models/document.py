"""File storage abstraction + patient documents."""
from __future__ import annotations

import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class PatientDocumentKind(str, enum.Enum):
    NATIONAL_ID_FRONT = "national_id_front"
    NATIONAL_ID_BACK = "national_id_back"
    PASSPORT = "passport"
    RESIDENCY = "residency"
    INSURANCE_FRONT = "insurance_front"
    INSURANCE_BACK = "insurance_back"
    CONSENT = "consent"
    OTHER = "other"


class File(TimestampMixin, db.Model):
    """A stored file: local path or S3 key. Referenced by docs/insurance/etc."""
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(primary_key=True)
    bucket: Mapped[str] = mapped_column(String(128), nullable=False)
    key: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum: Mapped[str | None] = mapped_column(String(128))
    original_name: Mapped[str | None] = mapped_column(String(255))
    uploaded_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    virus_scan_status: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)


class PatientDocument(TimestampMixin, db.Model):
    __tablename__ = "patient_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="RESTRICT"), nullable=False)
    kind: Mapped[PatientDocumentKind] = mapped_column(
        Enum(PatientDocumentKind, name="patient_document_kind"), nullable=False
    )
    note: Mapped[str | None] = mapped_column(String(255))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="documents")
    file: Mapped[File] = relationship()


from .patient import Patient  # noqa: E402
