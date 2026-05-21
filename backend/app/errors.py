"""Global error handlers and typed domain exceptions."""
from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify, request
from marshmallow import ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class DomainError(Exception):
    """Base class for typed application errors mapped to HTTP responses."""

    status_code = 400
    code = "domain_error"

    def __init__(self, message: str = "", details: dict[str, Any] | None = None):
        super().__init__(message or self.code)
        self.message = message or self.code
        self.details = details or {}


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"


class Unauthorized(DomainError):
    status_code = 401
    code = "unauthorized"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class ValidationFailed(DomainError):
    status_code = 422
    code = "validation_failed"


class AppointmentConflict(Conflict):
    code = "appointment_conflict"


class AppointmentOutsideHours(Conflict):
    code = "appointment_outside_hours"


class InvalidStateTransition(Conflict):
    code = "invalid_state_transition"


class KycRequired(Forbidden):
    code = "kyc_required"


class InsuranceExpired(Conflict):
    code = "insurance_expired"


class InsuranceNotAccepted(Conflict):
    code = "insurance_not_accepted"


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(DomainError)
    def _domain(err: DomainError):
        return _payload(err.code, err.message, err.details), err.status_code

    @app.errorhandler(ValidationError)
    def _marshmallow(err: ValidationError):
        return _payload("validation_failed", "Invalid request payload", err.messages), 422

    @app.errorhandler(HTTPException)
    def _http(err: HTTPException):
        return _payload(err.name.lower().replace(" ", "_"), err.description or err.name), err.code

    @app.errorhandler(Exception)
    def _unhandled(err: Exception):  # pragma: no cover - safety net
        logger.exception("unhandled-exception", extra={"path": request.path})
        return _payload("internal_error", "An unexpected error occurred."), 500


def _payload(code: str, message: str, details: dict | None = None):
    body = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return jsonify(body)
