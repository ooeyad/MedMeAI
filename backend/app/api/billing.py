"""Billing API: catalog, invoices, payments."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user
from sqlalchemy import select

from ..errors import ValidationFailed
from ..extensions import db
from ..models.billing import (
    Invoice,
    InvoiceStatus,
    Item,
    ItemCategory,
    PaymentMethod,
    PriceList,
)
from ..rbac import require_permission
from ..services import billing_service
from ..utils.pagination import paginate
from ..utils.tenant_scope import scope_query

billing_bp = Blueprint("billing", __name__)


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------
def _ser_item(i: Item) -> dict:
    return {
        "id": i.id, "sku": i.sku, "name": i.name, "name_ar": i.name_ar,
        "description": i.description,
        "kind": i.kind.value if hasattr(i.kind, "value") else i.kind,
        "default_price": float(i.default_price or 0),
        "tax_rate_percent": float(i.tax_rate_percent or 0),
        "is_active": i.is_active, "is_taxable": i.is_taxable,
        "unit": i.unit,
        "category_id": i.category_id,
        "category": ({"id": i.category.id, "name": i.category.name} if i.category else None),
    }


@billing_bp.get("/items")
@require_permission("patients:read")
def list_items():
    stmt = billing_service.list_items(
        q=request.args.get("q"),
        kind=request.args.get("kind"),
    )
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_ser_item)), 200


@billing_bp.post("/items")
@require_permission("users:write")
def create_item():
    data = request.get_json() or {}
    item = billing_service.create_item(data, actor_user_id=current_user.id)
    return jsonify(_ser_item(item)), 201


@billing_bp.patch("/items/<int:item_id>")
@require_permission("users:write")
def update_item(item_id: int):
    item = billing_service.update_item(item_id, request.get_json() or {}, actor_user_id=current_user.id)
    return jsonify(_ser_item(item)), 200


@billing_bp.post("/items/bulk-import")
@require_permission("users:write")
def bulk_import_items():
    body = request.get_json() or {}
    rows = body.get("rows") or []
    if not isinstance(rows, list) or not rows:
        raise ValidationFailed("rows must be a non-empty list")
    default_kind = body.get("kind")
    summary = billing_service.bulk_import_items(
        rows, default_kind=default_kind, actor_user_id=current_user.id,
    )
    return jsonify(summary), 200


@billing_bp.get("/categories")
@require_permission("patients:read")
def list_categories():
    rows = db.session.scalars(
        scope_query(select(ItemCategory), ItemCategory).order_by(ItemCategory.name)
    ).all()
    return jsonify({
        "data": [
            {"id": c.id, "name": c.name, "kind": c.kind.value if hasattr(c.kind, "value") else c.kind}
            for c in rows
        ]
    }), 200


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------
def _ser_line(l) -> dict:
    return {
        "id": l.id, "item_id": l.item_id,
        "description": l.description,
        "quantity": float(l.quantity), "unit_price": float(l.unit_price),
        "tax_rate_percent": float(l.tax_rate_percent), "discount_percent": float(l.discount_percent),
        "line_total": float(l.line_total),
        "prescription_id": l.prescription_id, "lab_order_id": l.lab_order_id,
    }


def _ser_payment(p) -> dict:
    return {
        "id": p.id, "method": p.method.value if hasattr(p.method, "value") else p.method,
        "amount": float(p.amount), "currency": p.currency, "reference": p.reference,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
        "received_by_user_id": p.received_by_user_id,
        "notes": p.notes,
    }


def _ser_invoice(inv: Invoice, *, with_lines: bool = False, with_payments: bool = False) -> dict:
    body = {
        "id": inv.id, "code": inv.code,
        "status": inv.status.value if hasattr(inv.status, "value") else inv.status,
        "patient_id": inv.patient_id, "appointment_id": inv.appointment_id,
        "doctor_id": inv.doctor_id, "branch_id": inv.branch_id,
        "currency": inv.currency,
        "subtotal": float(inv.subtotal), "tax_total": float(inv.tax_total),
        "discount_total": float(inv.discount_total), "total": float(inv.total),
        "insurance_company_id": inv.insurance_company_id,
        "insurance_share": float(inv.insurance_share),
        "patient_share": float(inv.patient_share),
        "paid_total": float(inv.paid_total),
        "balance": float(inv.balance),
        "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "notes": inv.notes,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
    }
    if with_lines:
        body["lines"] = [_ser_line(l) for l in inv.lines]
    if with_payments:
        body["payments"] = [_ser_payment(p) for p in inv.payments]
    return body


@billing_bp.get("/invoices")
@require_permission("patients:read")
def list_invoices():
    stmt = billing_service.list_invoices(
        patient_id=request.args.get("patient_id", type=int),
        status=request.args.get("status"),
        doctor_id=request.args.get("doctor_id", type=int),
    )
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_ser_invoice)), 200


@billing_bp.get("/invoices/<int:invoice_id>")
@require_permission("patients:read")
def get_invoice(invoice_id: int):
    inv = billing_service.get_invoice(invoice_id)
    return jsonify(_ser_invoice(inv, with_lines=True, with_payments=True)), 200


@billing_bp.post("/invoices/<int:invoice_id>/lines")
@require_permission("patients:write")
def add_line(invoice_id: int):
    inv = billing_service.add_line(invoice_id, request.get_json() or {}, actor_user_id=current_user.id)
    return jsonify(_ser_invoice(inv, with_lines=True, with_payments=True)), 200


@billing_bp.delete("/invoices/<int:invoice_id>/lines/<int:line_id>")
@require_permission("patients:write")
def remove_line(invoice_id: int, line_id: int):
    inv = billing_service.remove_line(invoice_id, line_id, actor_user_id=current_user.id)
    return jsonify(_ser_invoice(inv, with_lines=True, with_payments=True)), 200


@billing_bp.post("/invoices/<int:invoice_id>/void")
@require_permission("patients:write")
def void_invoice(invoice_id: int):
    inv = billing_service.void_invoice(invoice_id, actor_user_id=current_user.id,
                                       reason=(request.get_json() or {}).get("reason"))
    return jsonify(_ser_invoice(inv)), 200


@billing_bp.post("/invoices/<int:invoice_id>/payments")
@require_permission("patients:write")
def add_payment(invoice_id: int):
    data = request.get_json() or {}
    method = data.get("method")
    if method not in {m.value for m in PaymentMethod}:
        raise ValidationFailed(f"method must be one of {[m.value for m in PaymentMethod]}")
    try:
        amount = float(data.get("amount"))
    except (TypeError, ValueError):
        raise ValidationFailed("amount must be a number")
    pay = billing_service.record_payment(
        invoice_id,
        amount=amount,
        method=PaymentMethod(method),
        reference=data.get("reference"),
        notes=data.get("notes"),
        actor_user_id=current_user.id,
    )
    return jsonify(_ser_payment(pay)), 201


# ---------------------------------------------------------------------------
# Manual invoice creation (from appointment id)
# ---------------------------------------------------------------------------
@billing_bp.post("/invoices/from-appointment/<int:appointment_id>")
@require_permission("patients:write")
def create_from_appointment(appointment_id: int):
    inv = billing_service.create_invoice_for_appointment(appointment_id, actor_user_id=current_user.id)
    return jsonify(_ser_invoice(inv, with_lines=True, with_payments=True)), 201
