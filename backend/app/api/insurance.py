"""Insurance API."""
from __future__ import annotations

import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..errors import Conflict, Forbidden, NotFound, ValidationFailed
from ..extensions import db
from ..models.insurance import InsuranceApprovalStatus, InsuranceCompany, PatientInsurance
from ..rbac import require_permission
from ..schemas.insurance import (
    InsuranceApprovalDecisionSchema,
    InsuranceCompanySchema,
    PatientInsuranceSchema,
)
from ..services import audit_service, insurance_service, ocr_service

insurance_bp = Blueprint("insurance", __name__)

_company_schema = InsuranceCompanySchema()
_patient_ins_schema = PatientInsuranceSchema()
_decision_schema = InsuranceApprovalDecisionSchema()


def _company_code(value: str) -> str:
    code = re.sub(r"[^A-Z0-9]+", "_", (value or "").upper()).strip("_")
    return code or "INS"


@insurance_bp.get("/companies")
@require_permission("insurance:read", "insurance:read:self")
def list_companies():
    return jsonify({"data": [_company_schema.dump(c) for c in insurance_service.get_companies()]}), 200


@insurance_bp.post("/companies")
@require_permission("insurance:write")
def create_company():
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValidationFailed("name is required")
    code = (payload.get("code") or _company_code(name)).strip().upper()
    # Ensure unique code
    existing = db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.code == code))
    if existing:
        i = 2
        base = code
        while db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.code == f"{base}_{i}")):
            i += 1
        code = f"{base}_{i}"
    company = InsuranceCompany(
        code=code,
        name=name,
        name_ar=payload.get("name_ar") or None,
        logo_url=payload.get("logo_url") or None,
        active=bool(payload.get("active", True)),
        api_provider=payload.get("api_provider") or None,
    )
    db.session.add(company)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise Conflict("Insurance company already exists")
    audit_service.record(
        user_id=current_user.id, role=None, action="insurance_company.create",
        entity_type="insurance_company", entity_id=company.id,
        new_value={"name": company.name, "code": company.code}, source_channel="api",
    )
    return jsonify(_company_schema.dump(company)), 201


@insurance_bp.patch("/companies/<int:company_id>")
@require_permission("insurance:write")
def update_company(company_id: int):
    company = db.session.get(InsuranceCompany, company_id)
    if company is None:
        raise NotFound("Insurance company not found")
    payload = request.get_json() or {}
    old = {
        "name": company.name, "name_ar": company.name_ar,
        "logo_url": company.logo_url, "active": company.active,
        "code": company.code,
    }
    if "name" in payload and payload["name"]:
        company.name = payload["name"].strip()
    if "name_ar" in payload:
        company.name_ar = payload["name_ar"] or None
    if "logo_url" in payload:
        company.logo_url = payload["logo_url"] or None
    if "active" in payload:
        company.active = bool(payload["active"])
    if "code" in payload and payload["code"]:
        company.code = payload["code"].strip().upper()
    if "api_provider" in payload:
        company.api_provider = payload["api_provider"] or None
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise Conflict("Another insurance company with that code already exists")
    audit_service.record(
        user_id=current_user.id, role=None, action="insurance_company.update",
        entity_type="insurance_company", entity_id=company.id,
        old_value=old, new_value=payload, source_channel="api",
    )
    return jsonify(_company_schema.dump(company)), 200


@insurance_bp.delete("/companies/<int:company_id>")
@require_permission("insurance:write")
def delete_company(company_id: int):
    company = db.session.get(InsuranceCompany, company_id)
    if company is None:
        raise NotFound("Insurance company not found")
    # Check usage
    in_use = db.session.scalar(
        select(PatientInsurance.id).where(PatientInsurance.insurance_company_id == company.id).limit(1)
    )
    if in_use:
        raise Conflict("Cannot delete: patients still linked to this insurance company. Deactivate it instead.")
    audit_service.record(
        user_id=current_user.id, role=None, action="insurance_company.delete",
        entity_type="insurance_company", entity_id=company.id,
        old_value={"name": company.name, "code": company.code}, source_channel="api",
    )
    db.session.delete(company)
    db.session.commit()
    return "", 204


def _truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    s = str(v).strip().lower()
    return s in {"1", "true", "t", "yes", "y", "active", "on"}


@insurance_bp.post("/companies/bulk-import")
@require_permission("insurance:write")
def bulk_import_companies():
    body = request.get_json() or {}
    rows = body.get("rows") or []
    if not isinstance(rows, list) or not rows:
        raise ValidationFailed("rows must be a non-empty list")

    created = 0
    updated = 0
    skipped = 0
    errors: list[dict] = []

    for idx, raw in enumerate(rows):
        row_num = raw.get("__row") or (idx + 2)
        name = (raw.get("name") or "").strip()
        if not name:
            skipped += 1
            errors.append({"row": row_num, "message": "name is required"})
            continue
        code = (raw.get("code") or _company_code(name)).strip().upper()
        # Look up by code, fall back to name
        existing = db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.code == code))
        if existing is None:
            existing = db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.name == name))
        try:
            if existing is not None:
                existing.name = name
                if "name_ar" in raw and raw["name_ar"] != "":
                    existing.name_ar = raw["name_ar"]
                if "logo_url" in raw and raw["logo_url"] != "":
                    existing.logo_url = raw["logo_url"]
                if "active" in raw and raw["active"] != "":
                    existing.active = _truthy(raw["active"])
                updated += 1
            else:
                base = code
                i = 2
                while db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.code == code)):
                    code = f"{base}_{i}"
                    i += 1
                c = InsuranceCompany(
                    code=code, name=name,
                    name_ar=raw.get("name_ar") or None,
                    logo_url=raw.get("logo_url") or None,
                    active=_truthy(raw.get("active", True)) if raw.get("active") not in (None, "") else True,
                )
                db.session.add(c)
                created += 1
        except Exception as e:
            errors.append({"row": row_num, "message": str(e)})
            skipped += 1

    db.session.commit()
    audit_service.record(
        user_id=current_user.id, role=None, action="insurance_company.bulk_import",
        entity_type="insurance_company", entity_id=None,
        new_value={"created": created, "updated": updated, "skipped": skipped},
        source_channel="api",
    )
    return jsonify({"created": created, "updated": updated, "skipped": skipped, "errors": errors}), 200


@insurance_bp.get("/patients/<int:patient_id>")
@require_permission("insurance:read", "insurance:read:self")
def list_patient_insurance(patient_id: int):
    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient_id):
        raise Forbidden()
    rows = insurance_service.get_patient_insurance(patient_id)
    return jsonify({"data": [_patient_ins_schema.dump(r) for r in rows]}), 200


@insurance_bp.post("/patients/<int:patient_id>")
@require_permission("insurance:write", "insurance:write:self")
def add_patient_insurance(patient_id: int):
    if current_user.has_role("patient") and (not current_user.patient or current_user.patient.id != patient_id):
        raise Forbidden()
    data = _patient_ins_schema.load(request.get_json() or {})
    ins = insurance_service.add_patient_insurance(patient_id, data, actor_user_id=current_user.id)
    return jsonify(_patient_ins_schema.dump(ins)), 201


@insurance_bp.patch("/patient-records/<int:insurance_id>")
@require_permission("insurance:write", "insurance:write:self")
def update_patient_insurance(insurance_id: int):
    data = _patient_ins_schema.load(request.get_json() or {}, partial=True)
    ins = insurance_service.update_patient_insurance(
        insurance_id, data, actor_user_id=current_user.id,
    )
    return jsonify(_patient_ins_schema.dump(ins)), 200


@insurance_bp.delete("/patient-records/<int:insurance_id>")
@require_permission("insurance:write", "insurance:write:self")
def delete_patient_insurance(insurance_id: int):
    insurance_service.delete_patient_insurance(insurance_id, actor_user_id=current_user.id)
    return "", 204


@insurance_bp.post("/extract-card")
@require_permission("insurance:write", "insurance:write:self")
def extract_card():
    file_id = (request.get_json() or {}).get("file_id")
    if not file_id:
        raise NotFound("file_id required")
    return jsonify(ocr_service.extract_insurance_card(file_id)), 200


@insurance_bp.get("/appointments/<int:appointment_id>/check")
@require_permission("insurance:read", "insurance:read:self")
def check(appointment_id: int):
    from ..services import appointment_service
    appt = appointment_service.get(appointment_id)
    result = insurance_service.check_acceptance(patient_id=appt.patient_id, doctor_id=appt.doctor_id)
    return jsonify(result), 200


@insurance_bp.post("/appointments/<int:appointment_id>/request-approval")
@require_permission("insurance:write")
def request_approval(appointment_id: int):
    body = request.get_json() or {}
    pi = body.get("patient_insurance_id")
    if not pi:
        raise NotFound("patient_insurance_id required")
    appr = insurance_service.request_approval(
        appointment_id=appointment_id, patient_insurance_id=pi, actor_user_id=current_user.id,
    )
    return jsonify({"id": appr.id, "status": appr.status.value}), 201


@insurance_bp.post("/approvals/<int:approval_id>/decision")
@require_permission("insurance:approve")
def decide(approval_id: int):
    data = _decision_schema.load(request.get_json() or {})
    appr = insurance_service.decide_approval(
        approval_id, status=InsuranceApprovalStatus(data["status"]), notes=data.get("notes"),
        actor_user_id=current_user.id,
    )
    return jsonify({"id": appr.id, "status": appr.status.value, "notes": appr.notes}), 200
