"""Flask extensions, shared singletons, and connection helpers."""
from __future__ import annotations

import redis
from flask import current_app
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from prometheus_flask_exporter import PrometheusMetrics
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Common declarative base so models share the same metadata."""


db = SQLAlchemy(model_class=Base)
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address, default_limits=["120 per minute"])
metrics = PrometheusMetrics.for_app_factory()

_redis: redis.Redis | None = None


def redis_client() -> redis.Redis:
    """Lazy Redis client with a tight timeout so failures are instant.

    On Windows, connecting to a non-listening localhost port can otherwise
    take 1-2 seconds. We cap both connect + read at 200ms; callers must
    catch ConnectionError and degrade gracefully.
    """
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(
            current_app.config["REDIS_URL"],
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
    return _redis


# ---------------------------------------------------------------------------
# JWT hooks
# ---------------------------------------------------------------------------
def register_jwt_handlers(jwt_mgr: JWTManager) -> None:
    @jwt_mgr.user_identity_loader
    def _user_identity(user):
        # flask-jwt-extended 4.6+ requires the `sub` claim to be a string.
        raw = user.id if hasattr(user, "id") else user
        return str(raw)

    @jwt_mgr.user_lookup_loader
    def _user_lookup(_jwt_header, jwt_data):
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        from .models.user import User
        try:
            uid = int(jwt_data["sub"])
        except (TypeError, ValueError):
            return None
        # Single round-trip: load User + roles + branches + patient + doctor
        # so every authenticated request doesn't pay multiple lazy lookups.
        return db.session.execute(
            select(User)
            .options(
                selectinload(User.roles),
                selectinload(User.branches),
                selectinload(User.patient),
                selectinload(User.doctor),
            )
            .where(User.id == uid)
        ).unique().scalar_one_or_none()

    @jwt_mgr.token_in_blocklist_loader
    def _is_revoked(_jwt_header, jwt_payload) -> bool:
        # When Redis isn't running, fail open instantly (tokens expire on their
        # own; the refresh_tokens table still tracks revocation persistently).
        jti = jwt_payload["jti"]
        try:
            return bool(redis_client().get(f"revoked_jti:{jti}"))
        except Exception:
            return False

    @jwt_mgr.unauthorized_loader
    def _unauthorized(reason: str):
        from flask import jsonify
        return jsonify(error={"code": "unauthorized", "message": reason}), 401

    @jwt_mgr.invalid_token_loader
    def _invalid(reason: str):
        from flask import jsonify
        return jsonify(error={"code": "invalid_token", "message": reason}), 401

    @jwt_mgr.expired_token_loader
    def _expired(_header, _payload):
        from flask import jsonify
        return jsonify(error={"code": "token_expired", "message": "Token expired"}), 401

    @jwt_mgr.revoked_token_loader
    def _revoked(_header, _payload):
        from flask import jsonify
        return jsonify(error={"code": "token_revoked", "message": "Token revoked"}), 401
