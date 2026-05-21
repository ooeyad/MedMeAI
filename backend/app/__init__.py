"""Flask application factory for MedMeAI."""
from __future__ import annotations

import os

from flask import Flask, jsonify, request

from .config import get_config
from .errors import register_error_handlers
from .extensions import (
    cors,
    db,
    jwt,
    limiter,
    metrics,
    migrate,
)
from .logging_config import configure_logging


def create_app(config_name: str | None = None) -> Flask:
    """Application factory."""
    app = Flask(__name__)
    cfg = get_config(config_name or os.getenv("FLASK_ENV", "development"))
    app.config.from_object(cfg)

    configure_logging(app)
    _register_extensions(app)
    _register_blueprints(app)
    register_error_handlers(app)
    _register_health(app)

    @app.before_request
    def _attach_request_id():
        from uuid import uuid4
        request.environ["request_id"] = request.headers.get("X-Request-ID") or uuid4().hex

    @app.after_request
    def _propagate_request_id(resp):
        rid = request.environ.get("request_id")
        if rid:
            resp.headers["X-Request-ID"] = rid
        return resp

    return app


def _register_extensions(app: Flask) -> None:
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # CORS origins: combine explicit hostnames from config with regex patterns
    # that allow any device on common LAN ranges (192.168.x.x, 10.x.x.x,
    # 172.16-31.x.x) on the Vite ports — useful when you load the PWA on your
    # phone using your laptop's network IP.
    import re as _re
    lan_pattern = _re.compile(
        r"^https?://(?:"
        r"localhost|127\.0\.0\.1|"                      # local
        r"192\.168\.\d{1,3}\.\d{1,3}|"                  # 192.168.x.x
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"               # 10.x.x.x
        r"172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"  # 172.16-31.x.x
        r")(?::\d+)?$"
    )
    origins: list = list(app.config["WEB_ORIGINS"]) + [lan_pattern]
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=True,
        max_age=3600,  # cache CORS preflight for an hour — kills the per-request OPTIONS round-trip
    )
    limiter.init_app(app)
    metrics.init_app(app)

    # Late import to avoid circulars
    from .extensions import register_jwt_handlers
    register_jwt_handlers(jwt)


def _register_blueprints(app: Flask) -> None:
    from .api import (
        ai_bp,
        appointments_bp,
        audit_bp,
        auth_bp,
        billing_bp,
        branches_bp,
        clinical_bp,
        docs_bp,
        documents_bp,
        doctors_bp,
        insurance_bp,
        kyc_bp,
        notifications_bp,
        patients_bp,
        reports_bp,
        schedules_bp,
        tenants_bp,
        users_bp,
    )

    base = "/api/v1"
    app.register_blueprint(auth_bp, url_prefix=f"{base}/auth")
    app.register_blueprint(users_bp, url_prefix=f"{base}/users")
    app.register_blueprint(patients_bp, url_prefix=f"{base}/patients")
    app.register_blueprint(kyc_bp, url_prefix=f"{base}/kyc")
    app.register_blueprint(doctors_bp, url_prefix=f"{base}/doctors")
    app.register_blueprint(branches_bp, url_prefix=f"{base}/branches")
    app.register_blueprint(schedules_bp, url_prefix=f"{base}/schedules")
    app.register_blueprint(appointments_bp, url_prefix=f"{base}/appointments")
    app.register_blueprint(clinical_bp, url_prefix=f"{base}/clinical")
    app.register_blueprint(tenants_bp, url_prefix=f"{base}/tenants")
    app.register_blueprint(billing_bp, url_prefix=f"{base}/billing")
    app.register_blueprint(insurance_bp, url_prefix=f"{base}/insurance")
    app.register_blueprint(documents_bp, url_prefix=f"{base}/documents")
    app.register_blueprint(notifications_bp, url_prefix=f"{base}/notifications")
    app.register_blueprint(reports_bp, url_prefix=f"{base}/reports")
    app.register_blueprint(ai_bp, url_prefix=f"{base}/ai")
    app.register_blueprint(audit_bp, url_prefix=f"{base}/audit")
    app.register_blueprint(docs_bp, url_prefix="/api/docs")

    # CLI
    from .cli import register_cli
    register_cli(app)


def _register_health(app: Flask) -> None:
    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.get("/health/ready")
    def ready():
        from sqlalchemy import text

        checks = {"database": "ok", "redis": "ok"}
        try:
            db.session.execute(text("SELECT 1"))
        except Exception as exc:  # pragma: no cover - defensive
            checks["database"] = f"error: {exc.__class__.__name__}"
        try:
            from .extensions import redis_client
            redis_client().ping()
        except Exception as exc:  # pragma: no cover - defensive
            checks["redis"] = f"error: {exc.__class__.__name__}"
        status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
        return jsonify(status=status, checks=checks), 200 if status == "ok" else 503
