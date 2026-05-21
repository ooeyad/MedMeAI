"""Schedules API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..extensions import db
from ..models.doctor import DoctorLeave, DoctorSchedule, DoctorScheduleException
from ..rbac import require_permission
from ..schemas.doctor import ScheduleSchema

schedules_bp = Blueprint("schedules", __name__)
_schedule_schema = ScheduleSchema()


@schedules_bp.get("/doctors/<int:doctor_id>/weekly")
@require_permission("schedules:read", "schedules:read:self")
def get_weekly(doctor_id: int):
    rows = db.session.scalars(
        select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor_id)
    ).all()
    return jsonify({
        "data": [
            {
                "id": r.id,
                "doctor_id": r.doctor_id,
                "branch_id": r.branch_id,
                "weekday": r.weekday,
                "start_time": r.start_time.isoformat(timespec="minutes"),
                "end_time": r.end_time.isoformat(timespec="minutes"),
                "slot_minutes": r.slot_minutes,
                "is_active": r.is_active,
            }
            for r in rows
        ]
    }), 200


@schedules_bp.put("/doctors/<int:doctor_id>/weekly")
@require_permission("schedules:write", "schedules:write:self")
def put_weekly(doctor_id: int):
    """Replace the weekly schedule. Body: { schedules: [ScheduleSchema, ...] }"""
    payload = request.get_json() or {}
    schedules = [ _schedule_schema.load(s) for s in payload.get("schedules", []) ]

    db.session.execute(DoctorSchedule.__table__.delete().where(DoctorSchedule.doctor_id == doctor_id))
    for s in schedules:
        db.session.add(DoctorSchedule(doctor_id=doctor_id, **s))
    db.session.commit()
    return get_weekly(doctor_id)


@schedules_bp.get("/doctors/<int:doctor_id>/leaves")
@require_permission("schedules:read", "schedules:read:self")
def get_leaves(doctor_id: int):
    leaves = db.session.scalars(
        select(DoctorLeave).where(DoctorLeave.doctor_id == doctor_id).order_by(DoctorLeave.date_from)
    ).all()
    return jsonify({
        "data": [
            {"id": l.id, "date_from": l.date_from.isoformat(), "date_to": l.date_to.isoformat(), "reason": l.reason}
            for l in leaves
        ]
    }), 200


@schedules_bp.post("/doctors/<int:doctor_id>/leaves")
@require_permission("schedules:write", "schedules:write:self")
def add_leave(doctor_id: int):
    data = request.get_json() or {}
    from datetime import date
    leave = DoctorLeave(
        doctor_id=doctor_id,
        date_from=date.fromisoformat(data["date_from"]),
        date_to=date.fromisoformat(data["date_to"]),
        reason=data.get("reason"),
    )
    db.session.add(leave)
    db.session.commit()
    return jsonify({"id": leave.id}), 201


@schedules_bp.post("/doctors/<int:doctor_id>/exceptions")
@require_permission("schedules:write", "schedules:write:self")
def add_exception(doctor_id: int):
    data = request.get_json() or {}
    from datetime import date, time
    ex = DoctorScheduleException(
        doctor_id=doctor_id,
        exception_date=date.fromisoformat(data["exception_date"]),
        kind=data["kind"],
        start_time=time.fromisoformat(data["start_time"]) if data.get("start_time") else None,
        end_time=time.fromisoformat(data["end_time"]) if data.get("end_time") else None,
        note=data.get("note"),
    )
    db.session.add(ex)
    db.session.commit()
    return jsonify({"id": ex.id}), 201
