"""Users / role admin."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..errors import NotFound, ValidationFailed
from ..extensions import db
from ..models.user import Role, User
from ..rbac import require_permission
from ..utils.pagination import paginate
from ..utils.security import hash_password

users_bp = Blueprint("users", __name__)


def _ser_user(u: User) -> dict:
    return {
        "id": u.id, "email": u.email, "full_name": u.full_name, "phone": u.phone,
        "is_active": u.is_active, "roles": [r.code for r in u.roles],
        "branch_ids": [b.id for b in (u.branches or [])],
        "preferred_language": u.preferred_language,
        "created_at": u.created_at.isoformat(),
    }


@users_bp.get("/")
@require_permission("users:read")
def list_users():
    stmt = select(User).order_by(User.created_at.desc())
    if (q := request.args.get("q")):
        like = f"%{q}%"
        stmt = stmt.where(User.email.ilike(like) | User.full_name.ilike(like))
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=_ser_user)), 200


@users_bp.post("/")
@require_permission("users:write")
def create_user():
    data = request.get_json() or {}
    if not data.get("email") or not data.get("password"):
        raise ValidationFailed("email and password required")
    user = User(
        email=data["email"].lower(),
        full_name=data.get("full_name") or data["email"].split("@")[0],
        password_hash=hash_password(data["password"]),
        phone=data.get("phone"),
    )
    if data.get("role_codes"):
        roles = db.session.scalars(select(Role).where(Role.code.in_(data["role_codes"]))).all()
        user.roles = roles
    db.session.add(user)
    db.session.commit()
    return jsonify(_ser_user(user)), 201


@users_bp.get("/<int:user_id>")
@require_permission("users:read")
def get_user(user_id: int):
    u = db.session.get(User, user_id)
    if u is None:
        raise NotFound()
    return jsonify(_ser_user(u)), 200


@users_bp.patch("/<int:user_id>")
@require_permission("users:write")
def update_user(user_id: int):
    u = db.session.get(User, user_id)
    if u is None:
        raise NotFound()
    data = request.get_json() or {}
    for field in ("full_name", "full_name_ar", "phone", "is_active", "preferred_language"):
        if field in data:
            setattr(u, field, data[field])
    if (new_pw := data.get("password")):
        u.password_hash = hash_password(new_pw)
    if "role_codes" in data:
        roles = db.session.scalars(select(Role).where(Role.code.in_(data["role_codes"]))).all()
        u.roles = roles
    db.session.commit()
    return jsonify(_ser_user(u)), 200
