"""Catalog (items + price lists) and patient billing (invoices + payments)."""
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
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db
from .base import TimestampMixin


# ---------------------------------------------------------------------------
class ItemKind(str, enum.Enum):
    CONSULTATION = "consultation"
    MEDICATION = "medication"
    LAB_TEST = "lab_test"
    IMAGING = "imaging"
    PROCEDURE = "procedure"
    SUPPLY = "supply"
    OTHER = "other"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    OPEN = "open"        # awaiting payment
    PAID = "paid"
    PARTIAL = "partial"  # partially paid
    VOID = "void"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    INSURANCE = "insurance"
    CHEQUE = "cheque"
    ONLINE = "online"
    OTHER = "other"


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------
class ItemCategory(TimestampMixin, db.Model):
    __tablename__ = "item_categories"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_item_category_tenant_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[ItemKind] = mapped_column(
        Enum(ItemKind, name="item_kind"), default=ItemKind.OTHER, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text)


class Item(TimestampMixin, db.Model):
    __tablename__ = "items"
    __table_args__ = (
        Index("ix_items_tenant", "tenant_id"),
        UniqueConstraint("tenant_id", "sku", name="uq_items_tenant_sku"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("item_categories.id", ondelete="SET NULL")
    )
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_ar: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    kind: Mapped[ItemKind] = mapped_column(
        Enum(ItemKind, name="item_kind", create_type=False),
        default=ItemKind.OTHER, nullable=False,
    )
    default_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_taxable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32))   # "tab", "ml", "visit"

    category: Mapped[ItemCategory | None] = relationship()


class PriceList(TimestampMixin, db.Model):
    """A named pricing scheme (default, insurance-A, corporate, etc.)."""
    __tablename__ = "price_lists"
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_price_list_tenant_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="JOD", nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    entries: Mapped[list["PriceListEntry"]] = relationship(
        back_populates="price_list", cascade="all,delete"
    )


class PriceListEntry(TimestampMixin, db.Model):
    """Override of item.default_price for a particular list."""
    __tablename__ = "price_list_entries"
    __table_args__ = (
        UniqueConstraint("price_list_id", "item_id", name="uq_priceentry_list_item"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    price_list_id: Mapped[int] = mapped_column(
        ForeignKey("price_lists.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    price_list: Mapped[PriceList] = relationship(back_populates="entries")
    item: Mapped[Item] = relationship()


# ---------------------------------------------------------------------------
# Patient billing (AR)
# ---------------------------------------------------------------------------
class Invoice(TimestampMixin, db.Model):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_patient", "patient_id"),
        Index("ix_invoices_appointment", "appointment_id"),
        Index("ix_invoices_tenant", "tenant_id"),
        UniqueConstraint("code", name="uq_invoice_code"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT")
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )
    appointment_id: Mapped[int | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL")
    )
    branch_id: Mapped[int | None] = mapped_column(
        ForeignKey("branches.id", ondelete="SET NULL")
    )
    doctor_id: Mapped[int | None] = mapped_column(
        ForeignKey("doctors.id", ondelete="SET NULL")
    )

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status"), default=InvoiceStatus.DRAFT, nullable=False
    )
    currency: Mapped[str] = mapped_column(String(8), default="JOD", nullable=False)

    # Money
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Insurance split
    insurance_company_id: Mapped[int | None] = mapped_column(
        ForeignKey("insurance_companies.id", ondelete="SET NULL")
    )
    insurance_share: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    patient_share: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Payment progress
    paid_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    lines: Mapped[list["InvoiceLine"]] = relationship(
        back_populates="invoice", cascade="all,delete", order_by="InvoiceLine.id"
    )
    payments: Mapped[list["Payment"]] = relationship(
        back_populates="invoice", cascade="all,delete", order_by="Payment.id"
    )


class InvoiceLine(TimestampMixin, db.Model):
    __tablename__ = "invoice_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"))

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 3), default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Optional source links
    prescription_id: Mapped[int | None] = mapped_column(
        ForeignKey("prescriptions.id", ondelete="SET NULL")
    )
    lab_order_id: Mapped[int | None] = mapped_column(
        ForeignKey("lab_orders.id", ondelete="SET NULL")
    )

    invoice: Mapped[Invoice] = relationship(back_populates="lines")
    item: Mapped[Item | None] = relationship()


class Payment(TimestampMixin, db.Model):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_invoice", "invoice_id"),
        Index("ix_payments_tenant", "tenant_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT")
    )
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="RESTRICT"), nullable=False
    )

    method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method"), default=PaymentMethod.CASH, nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="JOD", nullable=False)
    reference: Mapped[str | None] = mapped_column(String(128))    # card auth code / cheque #
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    notes: Mapped[str | None] = mapped_column(Text)

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
