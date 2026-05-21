"""Documents API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import current_user
from io import BytesIO

from ..errors import NotFound, ValidationFailed
from ..extensions import db
from ..models.document import File
from ..rbac import require_permission
from ..services import file_service

documents_bp = Blueprint("documents", __name__)


@documents_bp.post("/upload")
@require_permission("documents:write", "documents:write:self")
def upload():
    if "file" not in request.files:
        raise ValidationFailed("file is required")
    f = request.files["file"]
    stored = file_service.store(
        f.stream,
        original_name=f.filename or "upload.bin",
        mime_type=f.mimetype or "application/octet-stream",
        uploaded_by_user_id=current_user.id,
    )
    return jsonify({"id": stored.id, "key": stored.key, "size_bytes": stored.size_bytes}), 201


@documents_bp.get("/<int:file_id>")
@require_permission("documents:read", "documents:read:self")
def download(file_id: int):
    f = db.session.get(File, file_id)
    if f is None:
        raise NotFound("File not found")
    data = file_service.load(file_id)
    return send_file(
        BytesIO(data),
        mimetype=f.mime_type,
        as_attachment=False,
        download_name=f.original_name or f.key,
    )
