"""Branches API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from sqlalchemy import select

from ..errors import NotFound
from ..extensions import db
from ..models.branch import Branch, Room
from ..rbac import require_permission
from ..schemas.branch import BranchSchema, RoomSchema

branches_bp = Blueprint("branches", __name__)

_branch_schema = BranchSchema()
_room_schema = RoomSchema()


@branches_bp.get("/")
@require_permission("branches:read")
def list_branches():
    branches = db.session.scalars(select(Branch).order_by(Branch.name)).all()
    return jsonify({"data": [_branch_schema.dump(b) for b in branches]}), 200


@branches_bp.get("/<int:branch_id>")
@require_permission("branches:read")
def get_branch(branch_id: int):
    b = db.session.get(Branch, branch_id)
    if b is None:
        raise NotFound("Branch not found")
    return jsonify(_branch_schema.dump(b)), 200


@branches_bp.post("/")
@require_permission("branches:write")
def create_branch():
    data = _branch_schema.load(request.get_json() or {})
    b = Branch(**data)
    db.session.add(b)
    db.session.commit()
    return jsonify(_branch_schema.dump(b)), 201


@branches_bp.get("/<int:branch_id>/rooms")
@require_permission("branches:read")
def list_rooms(branch_id: int):
    rooms = db.session.scalars(select(Room).where(Room.branch_id == branch_id)).all()
    return jsonify({"data": [_room_schema.dump(r) for r in rooms]}), 200


@branches_bp.post("/<int:branch_id>/rooms")
@require_permission("branches:write")
def create_room(branch_id: int):
    data = _room_schema.load(request.get_json() or {})
    r = Room(branch_id=branch_id, **data)
    db.session.add(r)
    db.session.commit()
    return jsonify(_room_schema.dump(r)), 201
