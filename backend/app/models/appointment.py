"""Appointments, status history, waiting list, attached documents."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class AppointmentStatus(str, enum.Enum):
    REQUESTED = "requested"
    PENDING_CONFIRMATION = "pending_confirmation"
    CONFIRMED = "confirmed"
    CHECKED_IN = "checked_in"
    IN_CONSULTATION = "in_consultation"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"
    WAITING_INSURANCE_APPROVAL = "waiting_insurance_approval"
    REJECTED = "rejected"


# Allowed transitions: from -> {to,...}
ALLOWED_TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.REQUESTED: {
        AppointmentStatus.PENDING_CONFIRMATION,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.REJECTED,
        AppointmentStatus.WAITING_INSURANCE_APPROVAL,
    },
    AppointmentStatus.PENDING_CONFIRMATION: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.REJECTED,
        AppointmentStatus.WAITING_INSURANCE_APPROVAL,
    },
    AppointmentStatus.WAITING_INSURANCE_APPROVAL: {
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.REJECTED,
        AppointmentStatus.CANCELLED,
    },
    AppointmentStatus.CONFIRMED: {
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
        AppointmentStatus.RESCHEDULED,
    },
    AppointmentStatus.CHECKED_IN: {
        AppointmentStatus.IN_CONSULTATION,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
    },
    AppointmentStatus.IN_CONSULTATION: {AppointmentStatus.COMPLETED},
    AppointmentStatus.COMPLETED: set(),
    AppointmentStatus.CANCELLED: set(),
    AppointmentStatus.NO_SHOW: set(),
    AppointmentStatus.RESCHEDULED: set(),
    AppointmentStatus.REJECTED: set(),
}


class AppointmentType(str, enum.Enum):
    NEW_CONSULTATION = "new_consultation"
    FOLLOW_UP = "follow_up"
    LAB_REVIEW = "lab_review"
    PROCEDURE = "procedure"
    EMERGENCY = "emergency"
    TELEMEDICINE = "telemedicine"
    WALK_IN = "walk_in"


class SourceChannel(str, enum.Enum):
    WEB = "web"
    MOBILE = "mobile"
    SECRETARY = "secretary"
    AI = "ai"
    API = "api"


class Appointment(TimestampMixin, db.Model):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_doctor_starts", "doctor_id", "starts_at"),
        Index("ix_appointments_branch_starts", "branch_id", "starts_at"),
        Index("ix_appointments_patient_starts", "patient_id", "starts_at"),
        Index("ix_appointments_status", "status"),
        Index("ix_appointments_tenant", "tenant_id"),
        UniqueConstraint("code", name="uq_appointment_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT")
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)  # APT-YYYYMMDD-XXXXX

    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="RESTRICT"), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"))
    specialty_id: Mapped[int | None] = mapped_column(ForeignKey("specialties.id", ondelete="SET NULL"))

    appointment_type: Mapped[AppointmentType] = mapped_column(
        Enum(AppointmentType, name="appointment_type"),
        default=AppointmentType.NEW_CONSULTATION,
        nullable=False,
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status"),
        default=AppointmentStatus.REQUESTED,
        nullable=False,
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    reason: Mapped[str | None] = mapped_column(Text)
    symptoms: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    parent_appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL")
    )

    source_channel: Mapped[SourceChannel] = mapped_column(
        Enum(SourceChannel, name="source_channel"),
        default=SourceChannel.WEB,
        nullable=False,
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    payment_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    # snapshotted insurance details at booking time
    insurance_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship()
    branch: Mapped["Branch"] = relationship()
    status_history: Mapped[list["AppointmentStatusHistory"]] = relationship(
        back_populates="appointment", cascade="all,delete", order_by="AppointmentStatusHistory.at.asc()"
    )
    documents: Mapped[list["AppointmentDocument"]] = relationship(
        back_populates="appointment", cascade="all,delete"
    )

    @property
    def can_transition_to(self) -> set[AppointmentStatus]:
        return ALLOWED_TRANSITIONS.get(self.status, set())


class AppointmentStatusHistory(TimestampMixin, db.Model):
    __tablename__ = "appointment_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    from_status: Mapped[AppointmentStatus | None] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status", create_type=False)
    )
    to_status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status", create_type=False), nullable=False
    )
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reason: Mapped[str | None] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    appointment: Mapped[Appointment] = relationship(back_populates="status_history")


class AppointmentDocument(TimestampMixin, db.Model):
    __tablename__ = "appointment_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("files.id", ondelete="RESTRICT"), nullable=False)
    label: Mapped[str | None] = mapped_column(String(128))

    appointment: Mapped[Appointment] = relationship(back_populates="documents")


class WaitingList(TimestampMixin, db.Model):
    __tablename__ = "waiting_list"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id: Mapped[int | None] = mapped_column(ForeignKey("doctors.id", ondelete="SET NULL"))
    specialty_id: Mapped[int | None] = mapped_column(ForeignKey("specialties.id", ondelete="SET NULL"))
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id", ondelete="SET NULL"))
    desired_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    desired_to: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_satisfied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


from .patient import Patient  # noqa: E402
from .doctor import Doctor  # noqa: E402
from .branch import Branch  # noqa: E402
