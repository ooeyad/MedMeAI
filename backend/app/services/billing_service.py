"""Billing service: catalog + invoices + payments + insurance split.

Invoices are auto-created when an appointment moves to COMPLETED. Lines for
the doctor consultation, the visit's prescriptions, and the visit's lab/imaging
orders are added automatically. The secretary can then add ad-hoc lines, apply
discounts, and record payments.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy import select

from ..errors import Conflict, NotFound, ValidationFailed
from ..extensions import db
from ..models.appointment import Appointment
from ..models.billing import (
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Item,
    ItemCategory,
    ItemKind,
    Payment,
    PaymentMethod,
    PriceList,
    PriceListEntry,
)
from ..models.clinical import LabOrder, Prescription
from ..models.doctor import Doctor
from ..models.insurance import PatientInsurance, PatientInsuranceStatus
from ..models.patient import Patient
from ..utils.tenant_scope import (
    active_tenant_id,
    scope_query,
    tenant_id_for_new_row,
)
from ..utils.time_utils import utcnow
from . import audit_service


# ---------------------------------------------------------------------------
# Catalog helpers
# ---------------------------------------------------------------------------
def list_items(*, q: str | None = None, kind: str | None = None):
    stmt = scope_query(select(Item), Item).order_by(Item.name)
    if q:
        like = f"%{q}%"
        stmt = stmt.where((Item.name.ilike(like)) | (Item.sku.ilike(like)))
    if kind:
        stmt = stmt.where(Item.kind == kind)
    return stmt


def create_item(data: dict, *, actor_user_id: int | None) -> Item:
    tid = tenant_id_for_new_row()
    if not data.get("name") or not data.get("sku"):
        raise ValidationFailed("name and sku are required")
    if db.session.scalar(
        scope_query(select(Item), Item).where(Item.sku == data["sku"])
    ) is not None:
        raise Conflict(f"Item with SKU '{data['sku']}' already exists in this tenant")
    item = Item(tenant_id=tid, **{k: v for k, v in data.items() if hasattr(Item, k)})
    db.session.add(item)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="catalog.item.create",
        entity_type="item", entity_id=item.id,
        new_value={"sku": item.sku, "name": item.name, "default_price": float(item.default_price)},
        source_channel="api",
    )
    db.session.commit()
    return item


def update_item(item_id: int, data: dict, *, actor_user_id: int | None) -> Item:
    item = db.session.get(Item, item_id)
    if item is None:
        raise NotFound("Item not found")
    old = {}
    for k, v in data.items():
        if hasattr(item, k):
            old[k] = getattr(item, k)
            setattr(item, k, v)
    audit_service.record(
        user_id=actor_user_id, role=None, action="catalog.item.update",
        entity_type="item", entity_id=item.id,
        old_value=old, new_value=data, source_channel="api",
    )
    db.session.commit()
    return item


def _slugify_sku(name: str, kind: str) -> str:
    import re as _re
    prefix = {
        "consultation": "CONS",
        "medication": "MED",
        "lab_test": "LAB",
        "imaging": "IMG",
        "procedure": "PROC",
        "supply": "SUP",
        "other": "OTH",
    }.get(kind, "ITEM")
    slug = _re.sub(r"[^A-Z0-9]+", "-", (name or "").upper()).strip("-")[:32] or "X"
    return f"{prefix}-{slug}"


_BULK_ITEM_FIELDS = {
    "sku", "name", "name_ar", "description", "kind",
    "default_price", "tax_rate_percent", "unit",
    "is_active", "is_taxable",
}

_VALID_KINDS = {k.value for k in ItemKind}


def bulk_import_items(rows: list[dict], *, default_kind: str | None, actor_user_id: int | None) -> dict:
    """Upsert a batch of catalog items. Match by SKU; if SKU absent, generate one from name+kind.

    Returns a summary with counts of created/updated/skipped and per-row errors.
    """
    tid = tenant_id_for_new_row()
    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    for idx, raw in enumerate(rows):
        # The frontend tags __row with the 1-based row number (header is row 1)
        row_num = raw.get("__row") or (idx + 2)
        name = (raw.get("name") or "").strip()
        if not name:
            skipped += 1
            errors.append({"row": row_num, "message": "name is required"})
            continue
        kind = (raw.get("kind") or default_kind or "consultation").strip().lower().replace(" ", "_")
        if kind not in _VALID_KINDS:
            skipped += 1
            errors.append({"row": row_num, "message": f"invalid kind '{kind}'"})
            continue

        sku = (raw.get("sku") or "").strip() or _slugify_sku(name, kind)

        # Look up existing by SKU within this tenant
        existing = db.session.scalar(
            scope_query(select(Item), Item).where(Item.sku == sku)
        )

        # Build the payload (only fields the model knows + we accept)
        payload: dict[str, Any] = {"sku": sku, "name": name, "kind": kind}
        if "name_ar" in raw and raw["name_ar"] != "":
            payload["name_ar"] = raw["name_ar"]
        if "description" in raw and raw["description"] != "":
            payload["description"] = raw["description"]
        if "unit" in raw and raw["unit"] != "":
            payload["unit"] = raw["unit"]
        if raw.get("default_price") not in (None, ""):
            try:
                payload["default_price"] = float(raw["default_price"])
            except (TypeError, ValueError):
                errors.append({"row": row_num, "message": "default_price is not a number"})
                skipped += 1
                continue
        if raw.get("tax_rate_percent") not in (None, ""):
            try:
                payload["tax_rate_percent"] = float(raw["tax_rate_percent"])
            except (TypeError, ValueError):
                errors.append({"row": row_num, "message": "tax_rate_percent is not a number"})
                skipped += 1
                continue
        if "is_active" in raw and raw["is_active"] != "":
            payload["is_active"] = _truthy(raw["is_active"])
        if "is_taxable" in raw and raw["is_taxable"] != "":
            payload["is_taxable"] = _truthy(raw["is_taxable"])

        try:
            if existing is not None:
                for k, v in payload.items():
                    setattr(existing, k, v)
                updated += 1
            else:
                new_item = Item(tenant_id=tid, **payload)
                db.session.add(new_item)
                created += 1
        except Exception as e:
            errors.append({"row": row_num, "message": str(e)})
            skipped += 1

    db.session.commit()
    audit_service.record(
        user_id=actor_user_id, role=None, action="catalog.item.bulk_import",
        entity_type="item", entity_id=None,
        new_value={"created": created, "updated": updated, "skipped": skipped, "errors": len(errors)},
        source_channel="api",
    )
    return {"created": created, "updated": updated, "skipped": skipped, "errors": errors}


def _truthy(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    s = str(v).strip().lower()
    return s in {"1", "true", "t", "yes", "y", "active", "on"}


def default_price_list() -> PriceList | None:
    return db.session.scalar(
        scope_query(select(PriceList), PriceList)
        .where(PriceList.is_default == True, PriceList.is_active == True)
    )


def price_for_item(item: Item, *, price_list: PriceList | None = None) -> float:
    if price_list:
        entry = db.session.scalar(
            select(PriceListEntry).where(
                PriceListEntry.price_list_id == price_list.id,
                PriceListEntry.item_id == item.id,
            )
        )
        if entry:
            return float(entry.price)
    return float(item.default_price or 0)


# ---------------------------------------------------------------------------
# Invoice lifecycle
# ---------------------------------------------------------------------------
def list_invoices(
    *,
    patient_id: int | None = None,
    status: str | None = None,
    doctor_id: int | None = None,
):
    stmt = scope_query(select(Invoice), Invoice).order_by(Invoice.created_at.desc())
    if patient_id:
        stmt = stmt.where(Invoice.patient_id == patient_id)
    if status:
        stmt = stmt.where(Invoice.status == status)
    if doctor_id:
        stmt = stmt.where(Invoice.doctor_id == doctor_id)
    return stmt


def get_invoice(invoice_id: int) -> Invoice:
    inv = db.session.get(Invoice, invoice_id)
    if inv is None:
        raise NotFound("Invoice not found")
    return inv


def _generate_invoice_code() -> str:
    seq = (db.session.scalar(select(db.func.coalesce(db.func.max(Invoice.id), 0))) or 0) + 1
    today = utcnow().strftime("%Y%m%d")
    return f"INV-{today}-{seq:05d}"


def create_invoice_for_appointment(appointment_id: int, *, actor_user_id: int | None = None) -> Invoice:
    """Create (or fetch existing) invoice for a given appointment.

    Idempotent — returns the existing invoice if one already exists for this
    appointment. Auto-adds consultation line + lines for each prescription
    and lab order attached to the visit.
    """
    existing = db.session.scalar(
        scope_query(select(Invoice), Invoice).where(Invoice.appointment_id == appointment_id)
    )
    if existing is not None:
        return existing

    appt = db.session.get(Appointment, appointment_id)
    if appt is None:
        raise NotFound("Appointment not found")
    patient = db.session.get(Patient, appt.patient_id)
    doctor = db.session.get(Doctor, appt.doctor_id)

    inv = Invoice(
        tenant_id=appt.tenant_id or tenant_id_for_new_row(),
        code=_generate_invoice_code(),
        patient_id=appt.patient_id,
        appointment_id=appt.id,
        branch_id=appt.branch_id,
        doctor_id=appt.doctor_id,
        status=InvoiceStatus.DRAFT,
        currency="JOD",
        issued_at=utcnow(),
    )
    db.session.add(inv)
    db.session.flush()

    # Consultation line — fee from doctor.consultation_fee or a "consultation" item
    fee = float(doctor.consultation_fee or 0) if doctor else 0.0
    if fee > 0:
        db.session.add(InvoiceLine(
            invoice_id=inv.id,
            description=f"Consultation — Dr. {doctor.user.full_name if doctor and doctor.user else 'doctor'}",
            quantity=1,
            unit_price=fee,
            line_total=fee,
        ))

    # Prescription lines (one per prescription)
    rxs = db.session.scalars(
        select(Prescription).where(Prescription.appointment_id == appt.id)
    ).all()
    for r in rxs:
        unit_price = _lookup_item_price_by_name(r.medication) or 0.0
        line_total = unit_price * (r.quantity or 1)
        db.session.add(InvoiceLine(
            invoice_id=inv.id,
            description=f"Medication: {r.medication} {r.dosage or ''}".strip(),
            quantity=r.quantity or 1,
            unit_price=unit_price,
            line_total=line_total,
            prescription_id=r.id,
        ))

    # Lab/imaging lines
    labs = db.session.scalars(
        select(LabOrder).where(LabOrder.appointment_id == appt.id)
    ).all()
    for l in labs:
        unit_price = _lookup_item_price_by_name(l.test_name) or 0.0
        db.session.add(InvoiceLine(
            invoice_id=inv.id,
            description=f"{(l.kind.value if hasattr(l.kind, 'value') else str(l.kind or 'lab')).title()}: {l.test_name}",
            quantity=1,
            unit_price=unit_price,
            line_total=unit_price,
            lab_order_id=l.id,
        ))

    _recompute_invoice_totals(inv, patient=patient)
    inv.status = InvoiceStatus.OPEN if float(inv.total) > 0 else InvoiceStatus.DRAFT

    audit_service.record(
        user_id=actor_user_id, role=None, action="invoice.auto_create_from_appointment",
        entity_type="invoice", entity_id=inv.id,
        new_value={"code": inv.code, "appointment_id": appt.id, "total": float(inv.total)},
        source_channel="api",
    )
    db.session.commit()
    return inv


def add_line(invoice_id: int, data: dict, *, actor_user_id: int | None) -> Invoice:
    inv = get_invoice(invoice_id)
    item = None
    if data.get("item_id"):
        item = db.session.get(Item, int(data["item_id"]))
    description = data.get("description") or (item.name if item else "Item")
    quantity = float(data.get("quantity") or 1)
    unit_price = float(
        data.get("unit_price") if data.get("unit_price") is not None
        else (price_for_item(item) if item else 0)
    )
    discount_pct = float(data.get("discount_percent") or 0)
    tax_pct = float(data.get("tax_rate_percent") or (item.tax_rate_percent if item else 0))
    line_total = unit_price * quantity * (1 - discount_pct / 100)

    line = InvoiceLine(
        invoice_id=inv.id,
        item_id=item.id if item else None,
        description=description,
        quantity=quantity,
        unit_price=unit_price,
        tax_rate_percent=tax_pct,
        discount_percent=discount_pct,
        line_total=line_total,
    )
    db.session.add(line)
    db.session.flush()
    _recompute_invoice_totals(inv)
    audit_service.record(
        user_id=actor_user_id, role=None, action="invoice.line.add",
        entity_type="invoice", entity_id=inv.id,
        new_value={"description": description, "line_total": line_total},
        source_channel="api",
    )
    db.session.commit()
    return inv


def remove_line(invoice_id: int, line_id: int, *, actor_user_id: int | None) -> Invoice:
    inv = get_invoice(invoice_id)
    line = db.session.get(InvoiceLine, line_id)
    if line is None or line.invoice_id != inv.id:
        raise NotFound("Line not found on this invoice")
    db.session.delete(line)
    db.session.flush()
    _recompute_invoice_totals(inv)
    audit_service.record(
        user_id=actor_user_id, role=None, action="invoice.line.remove",
        entity_type="invoice", entity_id=inv.id,
        old_value={"line_id": line_id, "description": line.description},
        source_channel="api",
    )
    db.session.commit()
    return inv


def void_invoice(invoice_id: int, *, actor_user_id: int | None, reason: str | None = None) -> Invoice:
    inv = get_invoice(invoice_id)
    if inv.status == InvoiceStatus.VOID:
        return inv
    inv.status = InvoiceStatus.VOID
    audit_service.record(
        user_id=actor_user_id, role=None, action="invoice.void",
        entity_type="invoice", entity_id=inv.id,
        new_value={"reason": reason}, source_channel="api",
    )
    db.session.commit()
    return inv


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
def record_payment(
    invoice_id: int,
    *,
    amount: float,
    method: PaymentMethod,
    paid_at=None,
    reference: str | None = None,
    notes: str | None = None,
    actor_user_id: int | None,
) -> Payment:
    inv = get_invoice(invoice_id)
    if inv.status == InvoiceStatus.VOID:
        raise Conflict("Cannot pay a void invoice")
    if amount <= 0:
        raise ValidationFailed("amount must be > 0")

    pay = Payment(
        tenant_id=inv.tenant_id,
        invoice_id=inv.id,
        patient_id=inv.patient_id,
        method=method,
        amount=amount,
        currency=inv.currency,
        reference=reference,
        notes=notes,
        paid_at=paid_at or utcnow(),
        received_by_user_id=actor_user_id,
    )
    db.session.add(pay)
    db.session.flush()
    _recompute_invoice_totals(inv)
    audit_service.record(
        user_id=actor_user_id, role=None, action="invoice.payment.recorded",
        entity_type="invoice", entity_id=inv.id,
        new_value={"amount": amount, "method": method.value, "reference": reference},
        source_channel="api",
    )
    db.session.commit()
    return pay


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _lookup_item_price_by_name(name: str) -> float | None:
    """Tries to match a medication / lab test name to a catalog item."""
    if not name:
        return None
    like = f"%{name.split()[0]}%"
    item = db.session.scalar(
        scope_query(select(Item), Item).where(Item.name.ilike(like)).limit(1)
    )
    if item is None:
        return None
    pl = default_price_list()
    return price_for_item(item, price_list=pl)


def _recompute_invoice_totals(inv: Invoice, *, patient: Patient | None = None) -> None:
    subtotal = Decimal("0")
    tax_total = Decimal("0")
    discount_total = Decimal("0")

    for line in inv.lines:
        qty = Decimal(str(line.quantity or 0))
        unit = Decimal(str(line.unit_price or 0))
        disc_pct = Decimal(str(line.discount_percent or 0))
        tax_pct = Decimal(str(line.tax_rate_percent or 0))

        gross = qty * unit
        discount = gross * (disc_pct / Decimal("100"))
        net = gross - discount
        tax = net * (tax_pct / Decimal("100"))

        line.line_total = float(net)
        subtotal += net
        tax_total += tax
        discount_total += discount

    total = subtotal + tax_total
    inv.subtotal = float(subtotal)
    inv.tax_total = float(tax_total)
    inv.discount_total = float(discount_total)
    inv.total = float(total)

    # Insurance split — primary plan's copayment is the patient share %
    if patient is None:
        patient = db.session.get(Patient, inv.patient_id)
    primary = None
    if patient:
        primary = db.session.scalar(
            select(PatientInsurance)
            .where(
                PatientInsurance.patient_id == patient.id,
                PatientInsurance.is_primary == True,
                PatientInsurance.status.in_([
                    PatientInsuranceStatus.VALID,
                    PatientInsuranceStatus.APPROVED,
                ]),
            )
            .order_by(PatientInsurance.id.desc())
        )
    if primary is not None and primary.copayment is not None:
        copay_pct = Decimal(str(primary.copayment))
        patient_share = total * (copay_pct / Decimal("100"))
        insurance_share = total - patient_share
        inv.insurance_company_id = primary.insurance_company_id
    else:
        patient_share = total
        insurance_share = Decimal("0")
    inv.patient_share = float(patient_share)
    inv.insurance_share = float(insurance_share)

    paid = sum(Decimal(str(p.amount or 0)) for p in inv.payments)
    inv.paid_total = float(paid)
    inv.balance = float(total - paid)

    if inv.status != InvoiceStatus.VOID:
        if total == 0:
            inv.status = InvoiceStatus.DRAFT
        elif paid >= total:
            inv.status = InvoiceStatus.PAID
        elif paid > 0:
            inv.status = InvoiceStatus.PARTIAL
        else:
            inv.status = InvoiceStatus.OPEN
