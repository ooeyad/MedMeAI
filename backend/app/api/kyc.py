"""KYC API."""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..errors import Forbidden, ValidationFailed
from ..extensions import db
from ..models.document import PatientDocumentKind
from ..models.kyc import KycStatus
from ..rbac import require_permission
from ..schemas.kyc import KycDecisionSchema, KycVerificationSchema
from ..services import file_service, kyc_service
from ..utils.pagination import paginate

kyc_bp = Blueprint("kyc", __name__)
_decision_schema = KycDecisionSchema()
_ver_schema = KycVerificationSchema()


def _check_owner(patient_id: int) -> None:
    if current_user.has_role("patient") and (
        not current_user.patient or current_user.patient.id != patient_id
    ):
        raise Forbidden()


@kyc_bp.get("/patients/<int:patient_id>")
@require_permission("kyc:read", "kyc:read:self")
def get_patient_kyc(patient_id: int):
    _check_owner(patient_id)
    ver = kyc_service.latest_verification(patient_id)
    return jsonify(_ver_schema.dump(ver) if ver else {"status": "pending"}), 200


@kyc_bp.post("/patients/<int:patient_id>/documents")
@require_permission("kyc:write", "kyc:write:self")
def upload_document(patient_id: int):
    _check_owner(patient_id)
    if "file" not in request.files:
        raise ValidationFailed("file is required (multipart)")
    kind_str = request.form.get("kind")
    if kind_str not in {k.value for k in PatientDocumentKind}:
        raise ValidationFailed(f"kind must be one of {[k.value for k in PatientDocumentKind]}")
    uploaded = request.files["file"]
    stored = file_service.store(
        uploaded.stream,
        original_name=uploaded.filename or "upload.bin",
        mime_type=uploaded.mimetype or "application/octet-stream",
        uploaded_by_user_id=current_user.id,
    )
    pd = kyc_service.attach_document(
        patient_id=patient_id, file_id=stored.id, kind=PatientDocumentKind(kind_str),
        actor_user_id=current_user.id,
    )
    return jsonify({"id": pd.id, "file_id": stored.id, "kind": pd.kind.value}), 201


@kyc_bp.post("/patients/<int:patient_id>/extract")
@require_permission("kyc:write", "kyc:write:self")
def extract(patient_id: int):
    _check_owner(patient_id)
    ver = kyc_service.extract(patient_id, actor_user_id=current_user.id)
    return jsonify(_ver_schema.dump(ver)), 200


@kyc_bp.post("/patients/<int:patient_id>/verify")
@require_permission("kyc:verify")
def verify(patient_id: int):
    data = _decision_schema.load(request.get_json() or {})
    ver = kyc_service.decide(
        patient_id, decision=KycStatus(data["decision"]), reason=data.get("reason"),
        actor_user_id=current_user.id,
    )
    return jsonify(_ver_schema.dump(ver)), 200


@kyc_bp.get("/queue")
@require_permission("kyc:read", "kyc:verify")
def queue():
    from sqlalchemy import select
    from ..models.patient import Patient, KycStatusEnum
    from ..utils.tenant_scope import scope_query
    stmt = (
        scope_query(select(Patient), Patient)
        .where(Patient.kyc_status.in_([KycStatusEnum.PENDING, KycStatusEnum.REQUIRES_REVIEW]))
        .order_by(Patient.created_at.asc())
    )
    from ..schemas.patient import PatientSchema
    page = paginate(db.session, stmt)
    return jsonify(page.to_dict(item_serializer=PatientSchema().dump)), 200
