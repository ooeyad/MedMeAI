"""Auth API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, get_jwt, jwt_required

from ..extensions import limiter
from ..rbac import require_auth
from ..schemas.auth import (
    LoginSchema,
    PasswordForgotSchema,
    PasswordResetSchema,
    RefreshSchema,
    TokensSchema,
    UserSchema,
)
from ..services import auth_service

auth_bp = Blueprint("auth", __name__)

_login_schema = LoginSchema()
_refresh_schema = RefreshSchema()
_forgot_schema = PasswordForgotSchema()
_reset_schema = PasswordResetSchema()
_tokens_schema = TokensSchema()
_user_schema = UserSchema()


@auth_bp.post("/login")
@limiter.limit("10 per minute; 30 per hour")
def login():
    data = _login_schema.load(request.get_json() or {})
    tokens = auth_service.authenticate(
        data["email"], data["password"],
        ip=request.headers.get("X-Forwarded-For", request.remote_addr),
        user_agent=request.headers.get("User-Agent"),
    )
    return jsonify(_tokens_schema.dump(tokens)), 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refresh():
    payload = get_jwt()
    tokens = auth_service.refresh(payload["jti"], current_user)
    return jsonify(tokens), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    payload = get_jwt()
    auth_service.logout(payload["jti"], int(payload.get("exp", 0) - payload.get("iat", 0)))
    return jsonify({"status": "ok"})


@auth_bp.post("/password/forgot")
@limiter.limit("5 per hour")
def password_forgot():
    data = _forgot_schema.load(request.get_json() or {})
    _ = auth_service.request_password_reset(data["email"])
    # Always 200 to avoid email enumeration; reset token is delivered via the
    # notifications subsystem in real deployments.
    return jsonify({"status": "ok"})


@auth_bp.post("/password/reset")
@limiter.limit("10 per hour")
def password_reset():
    data = _reset_schema.load(request.get_json() or {})
    auth_service.reset_password(data["token"], data["new_password"])
    return jsonify({"status": "ok"})


@auth_bp.get("/me")
@require_auth
def me():
    from ..services.auth_service import _resolve_permissions

    user = current_user
    body = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "preferred_language": user.preferred_language,
        "roles": [r.code for r in user.roles],
        "permissions": _resolve_permissions(user),
        "patient_id": user.patient.id if user.patient else None,
        "doctor_id": user.doctor.id if user.doctor else None,
        "tenant_id": user.tenant_id,
    }
    return jsonify(body), 200
