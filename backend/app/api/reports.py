"""Reports API."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from ..rbac import require_permission
from ..services import report_service

reports_bp = Blueprint("reports", __name__)


@reports_bp.get("/overview")
@require_permission("reports:read", "reports:read:self")
def overview():
    return jsonify(report_service.overview()), 200


@reports_bp.get("/doctor-utilization")
@require_permission("reports:read")
def doctor_utilization():
    date_to = _parse_dt(request.args.get("date_to")) or datetime.now(timezone.utc)
    date_from = _parse_dt(request.args.get("date_from")) or date_to - timedelta(days=30)
    return jsonify({"data": report_service.doctor_utilization(date_from, date_to)}), 200


@reports_bp.get("/kyc-funnel")
@require_permission("reports:read")
def kyc_funnel():
    return jsonify(report_service.kyc_funnel()), 200


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
