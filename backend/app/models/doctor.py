"""Doctors, specialties, schedules, leaves, exceptions, insurance networks."""
from __future__ import annotations

from datetime import date, time

from sqlalchemy import (
    ARRAY,
    Boolean,
    Column,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Table,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


doctor_specialties = Table(
    "doctor_specialties",
    db.metadata,
    Column("doctor_id", ForeignKey("doctors.id", ondelete="CASCADE"), primary_key=True),
    Column("specialty_id", ForeignKey("specialties.id", ondelete="CASCADE"), primary_key=True),
)

doctor_branches = Table(
    "doctor_branches",
    db.metadata,
    Column("doctor_id", ForeignKey("doctors.id", ondelete="CASCADE"), primary_key=True),
    Column("branch_id", ForeignKey("branches.id", ondelete="CASCADE"), primary_key=True),
)


class Specialty(TimestampMixin, db.Model):
    __tablename__ = "specialties"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text)

    doctors: Mapped[list["Doctor"]] = relationship(
        secondary=doctor_specialties, back_populates="specialties"
    )


class Doctor(TimestampMixin, db.Model):
    __tablename__ = "doctors"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    license_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    years_of_experience: Mapped[int | None] = mapped_column(Integer)
    languages: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)))
    consultation_fee: Mapped[float | None] = mapped_column(Numeric(10, 2))
    appointment_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    max_appointments_per_day: Mapped[int | None] = mapped_column(Integer)
    online_appointments: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    profile_image_url: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped["User"] = relationship(back_populates="doctor")
    specialties: Mapped[list[Specialty]] = relationship(
        secondary=doctor_specialties, back_populates="doctors", lazy="selectin"
    )
    branches: Mapped[list["Branch"]] = relationship(secondary=doctor_branches, lazy="selectin")
    schedules: Mapped[list["DoctorSchedule"]] = relationship(
        back_populates="doctor", cascade="all,delete"
    )
    leaves: Mapped[list["DoctorLeave"]] = relationship(
        back_populates="doctor", cascade="all,delete"
    )
    schedule_exceptions: Mapped[list["DoctorScheduleException"]] = relationship(
        back_populates="doctor", cascade="all,delete"
    )
    insurance_networks: Mapped[list["DoctorInsuranceNetwork"]] = relationship(
        back_populates="doctor", cascade="all,delete"
    )

    @property
    def primary_specialty_name(self) -> str | None:
        return self.specialties[0].name if self.specialties else None


class DoctorSchedule(TimestampMixin, db.Model):
    __tablename__ = "doctor_schedules"
    __table_args__ = (
        UniqueConstraint("doctor_id", "branch_id", "weekday", name="uq_doctor_branch_weekday"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0..6 (Mon..Sun)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    doctor: Mapped[Doctor] = relationship(back_populates="schedules")
    breaks: Mapped[list["DoctorBreak"]] = relationship(
        back_populates="schedule", cascade="all,delete"
    )


class DoctorBreak(TimestampMixin, db.Model):
    __tablename__ = "doctor_breaks"

    id: Mapped[int] = mapped_column(primary_key=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("doctor_schedules.id", ondelete="CASCADE"), nullable=False
    )
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    label: Mapped[str | None] = mapped_column(String(64))

    schedule: Mapped[DoctorSchedule] = relationship(back_populates="breaks")


class DoctorLeave(TimestampMixin, db.Model):
    __tablename__ = "doctor_leaves"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)

    doctor: Mapped[Doctor] = relationship(back_populates="leaves")


class DoctorScheduleException(TimestampMixin, db.Model):
    __tablename__ = "doctor_schedule_exceptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    exception_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # add | remove
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    note: Mapped[str | None] = mapped_column(String(255))

    doctor: Mapped[Doctor] = relationship(back_populates="schedule_exceptions")


class DoctorInsuranceNetwork(TimestampMixin, db.Model):
    __tablename__ = "doctor_insurance_networks"
    __table_args__ = (
        UniqueConstraint("doctor_id", "insurance_company_id", name="uq_doctor_insurance"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doctor_id: Mapped[int] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    insurance_company_id: Mapped[int] = mapped_column(
        ForeignKey("insurance_companies.id", ondelete="CASCADE"), nullable=False
    )
    network_tier: Mapped[str | None] = mapped_column(String(64))
    accepts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    doctor: Mapped[Doctor] = relationship(back_populates="insurance_networks")
    insurance_company: Mapped["InsuranceCompany"] = relationship()


# Convenience alias for export
DoctorSpecialty = doctor_specialties
DoctorBranch = doctor_branches


from .user import User  # noqa: E402
from .branch import Branch  # noqa: E402
from .insurance import InsuranceCompany  # noqa: E402
