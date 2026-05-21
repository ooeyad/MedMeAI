"""Clinical entities: prescriptions, lab orders, vitals.

These are attached to appointments. A completed appointment with a diagnosis
note plus its prescriptions and lab orders forms the equivalent of a basic
EMR consultation record.
"""
from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


# ---------------------------------------------------------------------------
class PrescriptionStatus(str, enum.Enum):
    PRESCRIBED = "prescribed"
    DISPENSED = "dispensed"
    PARTIALLY_DISPENSED = "partially_dispensed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class LabOrderStatus(str, enum.Enum):
    ORDERED = "ordered"
    SAMPLE_COLLECTED = "sample_collected"
    IN_PROGRESS = "in_progress"
    RESULTS_READY = "results_ready"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class LabOrderPriority(str, enum.Enum):
    ROUTINE = "routine"
    URGENT = "urgent"
    STAT = "stat"


class LabOrderKind(str, enum.Enum):
    LAB = "lab"
    IMAGING = "imaging"   # X-ray, CT, MRI, ultrasound
    PROCEDURE = "procedure"  # ECG, biopsy, endoscopy
    REFERRAL = "referral"


# ---------------------------------------------------------------------------
class Prescription(TimestampMixin, db.Model):
    __tablename__ = "prescriptions"
    __table_args__ = (
        Index("ix_prescriptions_appointment", "appointment_id"),
        Index("ix_prescriptions_patient", "patient_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    prescribed_by_doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False
    )

    medication: Mapped[str] = mapped_column(String(255), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(128))            # e.g. "500mg"
    frequency: Mapped[str | None] = mapped_column(String(128))         # e.g. "twice daily"
    route: Mapped[str | None] = mapped_column(String(64))              # oral / IV / topical
    duration_days: Mapped[int | None] = mapped_column(Integer)
    quantity: Mapped[int | None] = mapped_column(Integer)
    refills: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[PrescriptionStatus] = mapped_column(
        Enum(PrescriptionStatus, name="prescription_status"),
        default=PrescriptionStatus.PRESCRIBED,
        nullable=False,
    )
    dispensed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------
class LabOrder(TimestampMixin, db.Model):
    __tablename__ = "lab_orders"
    __table_args__ = (
        Index("ix_lab_orders_appointment", "appointment_id"),
        Index("ix_lab_orders_patient", "patient_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    ordered_by_doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False
    )

    kind: Mapped[LabOrderKind] = mapped_column(
        Enum(LabOrderKind, name="lab_order_kind"),
        default=LabOrderKind.LAB,
        nullable=False,
    )
    test_name: Mapped[str] = mapped_column(String(255), nullable=False)
    test_code: Mapped[str | None] = mapped_column(String(64))
    priority: Mapped[LabOrderPriority] = mapped_column(
        Enum(LabOrderPriority, name="lab_order_priority"),
        default=LabOrderPriority.ROUTINE,
        nullable=False,
    )
    status: Mapped[LabOrderStatus] = mapped_column(
        Enum(LabOrderStatus, name="lab_order_status"),
        default=LabOrderStatus.ORDERED,
        nullable=False,
    )
    clinical_notes: Mapped[str | None] = mapped_column(Text)
    results: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------
class Vitals(TimestampMixin, db.Model):
    """Vital signs captured at check-in or during consultation."""
    __tablename__ = "vitals"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    recorded_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    weight_kg: Mapped[float | None] = mapped_column(Numeric(5, 2))
    height_cm: Mapped[float | None] = mapped_column(Numeric(5, 2))
    blood_pressure_systolic: Mapped[int | None] = mapped_column(Integer)
    blood_pressure_diastolic: Mapped[int | None] = mapped_column(Integer)
    heart_rate_bpm: Mapped[int | None] = mapped_column(Integer)
    temperature_c: Mapped[float | None] = mapped_column(Numeric(4, 1))
    respiratory_rate: Mapped[int | None] = mapped_column(Integer)
    oxygen_saturation: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
class ConsultationNote(TimestampMixin, db.Model):
    """Structured clinical notes for an appointment (chief complaint, exam, diagnosis, plan)."""
    __tablename__ = "consultation_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    doctor_id: Mapped[int] = mapped_column(
        ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False
    )
    chief_complaint: Mapped[str | None] = mapped_column(Text)
    history_of_present_illness: Mapped[str | None] = mapped_column(Text)
    examination: Mapped[str | None] = mapped_column(Text)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    icd10_codes: Mapped[str | None] = mapped_column(String(255))
    treatment_plan: Mapped[str | None] = mapped_column(Text)
    follow_up_in_days: Mapped[int | None] = mapped_column(Integer)
    private_notes: Mapped[str | None] = mapped_column(Text)
