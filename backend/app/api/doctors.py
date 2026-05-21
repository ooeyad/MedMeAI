"""Doctors API."""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..errors import Conflict, NotFound, ValidationFailed
from ..extensions import db
from ..models.doctor import Specialty
from ..rbac import require_permission
from ..schemas.doctor import DoctorSchema, ScheduleSlotSchema
from ..services import audit_service, doctor_service
from ..utils.pagination import paginate

doctors_bp = Blueprint("doctors", __name__)

_doctor_schema = DoctorSchema()
_slot_schema = ScheduleSlotSchema(many=True)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value or "").strip("-").lower()
    return slug or "specialty"


def _serialize_specialty(s: Specialty) -> dict:
    return {
        "id": s.id,
        "slug": s.slug,
        "name": s.name,
        "name_ar": s.name_ar,
        "description": s.description,
    }


@doctors_bp.get("/specialties")
@require_permission("doctors:read", "doctors:read:self")
def list_specialties():
    rows = db.session.scalars(select(Specialty).order_by(Specialty.name)).all()
    return jsonify({"data": [_serialize_specialty(s) for s in rows]}), 200


@doctors_bp.post("/specialties")
@require_permission("doctors:write")
def create_specialty():
    payload = request.get_json() or {}
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValidationFailed("name is required")
    slug = (payload.get("slug") or _slugify(name)).strip().lower()
    # Make slug unique by appending counter if needed
    existing = db.session.scalar(select(Specialty).where(Specialty.slug == slug))
    if existing:
        i = 2
        base = slug
        while db.session.scalar(select(Specialty).where(Specialty.slug == f"{base}-{i}")):
            i += 1
        slug = f"{base}-{i}"
    s = Specialty(
        slug=slug,
        name=name,
        name_ar=payload.get("name_ar") or None,
        description=payload.get("description") or None,
    )
    db.session.add(s)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise Conflict("Specialty already exists")
    audit_service.record(
        user_id=current_user.id, role=None, action="specialty.create",
        entity_type="specialty", entity_id=s.id,
        new_value={"name": s.name, "slug": s.slug}, source_channel="api",
    )
    return jsonify(_serialize_specialty(s)), 201


@doctors_bp.patch("/specialties/<int:specialty_id>")
@require_permission("doctors:write")
def update_specialty(specialty_id: int):
    s = db.session.get(Specialty, specialty_id)
    if s is None:
        raise NotFound("Specialty not found")
    payload = request.get_json() or {}
    old = {"name": s.name, "name_ar": s.name_ar, "description": s.description, "slug": s.slug}
    if "name" in payload and payload["name"]:
        s.name = payload["name"].strip()
    if "name_ar" in payload:
        s.name_ar = (payload["name_ar"] or None)
    if "description" in payload:
        s.description = (payload["description"] or None)
    if "slug" in payload and payload["slug"]:
        s.slug = payload["slug"].strip().lower()
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise Conflict("Another specialty with that slug already exists")
    audit_service.record(
        user_id=current_user.id, role=None, action="specialty.update",
        entity_type="specialty", entity_id=s.id,
        old_value=old, new_value=payload, source_channel="api",
    )
    return jsonify(_serialize_specialty(s)), 200


@doctors_bp.delete("/specialties/<int:specialty_id>")
@require_permission("doctors:write")
def delete_specialty(specialty_id: int):
    s = db.session.get(Specialty, specialty_id)
    if s is None:
        raise NotFound("Specialty not found")
    if s.doctors:
        raise Conflict(
            f"Cannot delete: {len(s.doctors)} doctor(s) still linked to this specialty"
        )
    audit_service.record(
        user_id=current_user.id, role=None, action="specialty.delete",
        entity_type="specialty", entity_id=s.id,
        old_value={"name": s.name, "slug": s.slug}, source_channel="api",
    )
    db.session.delete(s)
    db.session.commit()
    return "", 204


@doctors_bp.post("/specialties/bulk-import")
@require_permission("doctors:write")
def bulk_import_specialties():
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
        slug = (raw.get("slug") or _slugify(name)).strip().lower()
        existing = db.session.scalar(select(Specialty).where(Specialty.slug == slug))
        if existing is None:
            # fall back to matching by name to avoid duplicates when slug differs
            existing = db.session.scalar(select(Specialty).where(Specialty.name == name))
        try:
            if existing is not None:
                existing.name = name
                if "name_ar" in raw and raw["name_ar"] != "":
                    existing.name_ar = raw["name_ar"]
                if "description" in raw and raw["description"] != "":
                    existing.description = raw["description"]
                updated += 1
            else:
                # dedupe slug if needed
                base = slug
                i = 2
                while db.session.scalar(select(Specialty).where(Specialty.slug == slug)):
                    slug = f"{base}-{i}"
                    i += 1
                s = Specialty(
                    slug=slug, name=name,
                    name_ar=raw.get("name_ar") or None,
                    description=raw.get("description") or None,
                )
                db.session.add(s)
                created += 1
        except Exception as e:
            errors.append({"row": row_num, "message": str(e)})
            skipped += 1

    db.session.commit()
    audit_service.record(
        user_id=current_user.id, role=None, action="specialty.bulk_import",
        entity_type="specialty", entity_id=None,
        new_value={"created": created, "updated": updated, "skipped": skipped},
        source_channel="api",
    )
    return jsonify({"created": created, "updated": updated, "skipped": skipped, "errors": errors}), 200


@doctors_bp.post("/")
@require_permission("doctors:write")
def create_doctor():
    payload = request.get_json() or {}
    required = ["full_name", "email", "license_number"]
    missing = [k for k in required if not payload.get(k)]
    if missing:
        raise ValidationFailed(f"Missing required fields: {', '.join(missing)}")
    result = doctor_service.create_doctor(payload, actor_user_id=current_user.id)
    return jsonify(result), 201


@doctors_bp.get("/")
@require_permission("doctors:read", "doctors:read:self")
def list_doctors():
    # Multi-value specialty filter. Accept three wire formats:
    #   ?specialty_ids=1&specialty_ids=2     (repeated key)
    #   ?specialty_ids[]=1&specialty_ids[]=2 (bracketed; what axios sends by default)
    #   ?specialty_ids_csv=1,2               (comma-separated single value)
    raw_ids: list[str] = []
    raw_ids.extend(request.args.getlist("specialty_ids"))
    raw_ids.extend(request.args.getlist("specialty_ids[]"))
    if request.args.get("specialty_ids_csv"):
        raw_ids.extend(request.args["specialty_ids_csv"].split(","))
    specialty_ids = [int(x) for x in raw_ids if str(x).strip().isdigit()] or None

    def _bool(name: str) -> bool:
        v = (request.args.get(name) or "").lower()
        return v in {"1", "true", "yes", "on"}

    stmt = doctor_service.list_doctors(
        q=request.args.get("q"),
        specialty_id=request.args.get("specialty_id", type=int),
        specialty_ids=specialty_ids,
        branch_id=request.args.get("branch_id", type=int),
        language=request.args.get("language"),
        online_only=_bool("online_only"),
        min_fee=request.args.get("min_fee", type=float),
        max_fee=request.args.get("max_fee", type=float),
        active_only=_bool("active_only"),
        accepts_insurance_id=request.args.get("accepts_insurance_id", type=int),
        sort=request.args.get("sort"),
    )
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_doctor_schema.dump)), 200


@doctors_bp.get("/<int:doctor_id>")
@require_permission("doctors:read", "doctors:read:self")
def get_doctor(doctor_id: int):
    return jsonify(_doctor_schema.dump(doctor_service.get(doctor_id))), 200


@doctors_bp.patch("/<int:doctor_id>")
@require_permission("doctors:write", "doctors:write:self")
def update_doctor(doctor_id: int):
    payload = request.get_json() or {}
    doctor = doctor_service.update_doctor(doctor_id, payload, actor_user_id=current_user.id)
    return jsonify(_doctor_schema.dump(doctor)), 200


@doctors_bp.post("/<int:doctor_id>/move-tenant")
@require_permission("doctors:write")
def move_doctor_tenant(doctor_id: int):
    from ..errors import Forbidden
    if "super_admin" not in {r.code for r in current_user.roles}:
        raise Forbidden("Only super admins can move data between tenants")
    body = request.get_json() or {}
    target = body.get("tenant_id")
    if not target:
        raise ValidationFailed("tenant_id is required")
    doctor = doctor_service.move_doctor_to_tenant(doctor_id, int(target), actor_user_id=current_user.id)
    return jsonify(_doctor_schema.dump(doctor)), 200


@doctors_bp.get("/<int:doctor_id>/availability")
@require_permission("doctors:read")
def doctor_availability(doctor_id: int):
    date_from = _parse_date(request.args.get("date_from")) or date.today()
    date_to = _parse_date(request.args.get("date_to")) or (date_from + timedelta(days=7))
    duration = request.args.get("duration_minutes", type=int)
    branch_id = request.args.get("branch_id", type=int)
    slots = doctor_service.compute_availability(
        doctor_id=doctor_id, date_from=date_from, date_to=date_to,
        duration_minutes=duration, branch_id=branch_id,
    )
    return jsonify({"slots": slots}), 200


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None
