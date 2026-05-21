"""Auth service: login, refresh, logout, password reset."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from sqlalchemy import select

from ..errors import Unauthorized, ValidationFailed
from ..extensions import db, redis_client
from ..models.user import PasswordResetToken, RefreshToken, User
from ..utils.security import generate_token, hash_password, hash_token, verify_password
from ..utils.time_utils import utcnow
from . import audit_service

_LOCKOUT_THRESHOLD = 5
_LOCKOUT_MINUTES = 15


def authenticate(email: str, password: str, *, ip: str | None = None, user_agent: str | None = None) -> dict[str, Any]:
    user: User | None = db.session.scalar(select(User).where(User.email == email.lower()))
    if user is None or not user.is_active:
        raise Unauthorized("Invalid credentials")

    if user.locked_until and user.locked_until > utcnow():
        raise Unauthorized("Account temporarily locked. Try again later.")

    if not verify_password(password, user.password_hash):
        user.failed_login_count += 1
        if user.failed_login_count >= _LOCKOUT_THRESHOLD:
            user.locked_until = utcnow() + timedelta(minutes=_LOCKOUT_MINUTES)
            user.failed_login_count = 0
        db.session.commit()
        raise Unauthorized("Invalid credentials")

    user.failed_login_count = 0
    user.last_login_at = utcnow()
    user.locked_until = None

    access = create_access_token(identity=user)
    refresh = create_refresh_token(identity=user)
    refresh_payload = decode_token(refresh)

    db.session.add(
        RefreshToken(
            user_id=user.id,
            jti=refresh_payload["jti"],
            expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc),
            user_agent=user_agent,
            ip=ip,
        )
    )
    audit_service.record(
        user_id=user.id,
        role=user.roles[0].code if user.roles else None,
        action="auth.login",
        entity_type="user",
        entity_id=user.id,
        source_channel="api",
    )
    db.session.commit()

    return {
        "access_token": access,
        "refresh_token": refresh,
        "user": _serialize_user(user),
    }


def refresh(jti: str, user: User) -> dict[str, Any]:
    token: RefreshToken | None = db.session.scalar(
        select(RefreshToken).where(RefreshToken.jti == jti)
    )
    if token is None or token.revoked or token.expires_at < utcnow():
        raise Unauthorized("Refresh token not valid")

    # rotate: revoke old, issue new
    token.revoked = True
    new_refresh = create_refresh_token(identity=user)
    new_access = create_access_token(identity=user)
    payload = decode_token(new_refresh)
    db.session.add(
        RefreshToken(
            user_id=user.id,
            jti=payload["jti"],
            expires_at=datetime.fromtimestamp(payload["exp"], tz=timezone.utc),
            user_agent=token.user_agent,
            ip=token.ip,
        )
    )
    db.session.commit()
    return {"access_token": new_access, "refresh_token": new_refresh}


def logout(jti: str, exp_seconds: int) -> None:
    # Best-effort Redis revoke: the token still expires on its own if Redis is offline.
    try:
        redis_client().setex(f"revoked_jti:{jti}", exp_seconds, "1")
    except Exception:
        pass
    token = db.session.scalar(select(RefreshToken).where(RefreshToken.jti == jti))
    if token:
        token.revoked = True
        db.session.commit()


def request_password_reset(email: str) -> str | None:
    user = db.session.scalar(select(User).where(User.email == email.lower()))
    if user is None:
        return None
    raw = generate_token()
    db.session.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw),
            expires_at=utcnow() + timedelta(hours=1),
        )
    )
    db.session.commit()
    return raw  # delivered via email channel in real environment


def reset_password(token: str, new_password: str) -> None:
    if len(new_password) < 8:
        raise ValidationFailed("Password must be at least 8 characters")
    prt = db.session.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token)))
    if prt is None or prt.used_at is not None or prt.expires_at < utcnow():
        raise Unauthorized("Reset token invalid or expired")
    user = db.session.get(User, prt.user_id)
    user.password_hash = hash_password(new_password)
    prt.used_at = utcnow()
    audit_service.record(
        user_id=user.id, role=None, action="auth.password_reset",
        entity_type="user", entity_id=user.id, source_channel="api",
    )
    db.session.commit()


def _serialize_user(user: User) -> dict[str, Any]:
    return {
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


def _resolve_permissions(user: User) -> list[str]:
    from ..rbac import PERMISSIONS, Role

    out: set[str] = set()
    for role in user.roles:
        try:
            out |= PERMISSIONS[Role(role.code)]
        except Exception:
            continue
    return sorted(out)
