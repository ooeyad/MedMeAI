"""Clinic, branches, working hours, holidays, rooms."""
from __future__ import annotations

from datetime import date, time
from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


class Clinic(TimestampMixin, db.Model):
    __tablename__ = "clinics"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(512))
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Amman", nullable=False)

    branches: Mapped[list["Branch"]] = relationship(back_populates="clinic", cascade="all,delete")


class Branch(TimestampMixin, db.Model):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    clinic_id: Mapped[int] = mapped_column(ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(128))
    country: Mapped[str | None] = mapped_column(String(64))
    phone: Mapped[str | None] = mapped_column(String(64))
    google_maps_url: Mapped[str | None] = mapped_column(String(512))
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 6))
    longitude: Mapped[float | None] = mapped_column(Numeric(10, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    clinic: Mapped[Clinic] = relationship(back_populates="branches")
    rooms: Mapped[list["Room"]] = relationship(back_populates="branch", cascade="all,delete")
    working_hours: Mapped[list["BranchWorkingHours"]] = relationship(
        back_populates="branch", cascade="all,delete"
    )
    holidays: Mapped[list["BranchHoliday"]] = relationship(
        back_populates="branch", cascade="all,delete"
    )


class BranchWorkingHours(TimestampMixin, db.Model):
    __tablename__ = "branch_working_hours"
    __table_args__ = (UniqueConstraint("branch_id", "weekday", name="uq_branch_weekday"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    # 0 = Monday, 6 = Sunday (ISO weekday-1). Stored as small int for portability.
    weekday: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    open_time: Mapped[time] = mapped_column(Time, nullable=False)
    close_time: Mapped[time] = mapped_column(Time, nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="working_hours")


class BranchHoliday(TimestampMixin, db.Model):
    __tablename__ = "branch_holidays"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    holiday_date: Mapped[date] = mapped_column(Date, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="holidays")


class Room(TimestampMixin, db.Model):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), default="consultation", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    branch: Mapped[Branch] = relationship(back_populates="rooms")
