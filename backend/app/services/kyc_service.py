"""KYC service: upload document, extract via OCR, accept/reject."""
from __future__ import annotations

from sqlalchemy import select

from ..errors import NotFound
from ..extensions import db
from ..models.document import PatientDocument, PatientDocumentKind
from ..models.kyc import KycExtractedField, KycStatus, KycVerification
from ..models.patient import KycStatusEnum, Patient
from ..utils.time_utils import utcnow
from . import audit_service, ocr_service


def latest_verification(patient_id: int) -> KycVerification | None:
    return db.session.scalar(
        select(KycVerification)
        .where(KycVerification.patient_id == patient_id)
        .order_by(KycVerification.id.desc())
    )


def attach_document(*, patient_id: int, file_id: int, kind: PatientDocumentKind, actor_user_id: int | None) -> PatientDocument:
    pd = PatientDocument(patient_id=patient_id, file_id=file_id, kind=kind)
    db.session.add(pd)
    db.session.flush()
    audit_service.record(
        user_id=actor_user_id, role=None, action="kyc.document_uploaded",
        entity_type="patient_document", entity_id=pd.id,
        new_value={"kind": kind.value, "patient_id": patient_id, "file_id": file_id},
        source_channel="api",
    )
    db.session.commit()
    return pd


def extract(patient_id: int, *, actor_user_id: int | None) -> KycVerification:
    p = db.session.get(Patient, patient_id)
    if p is None:
        raise NotFound("Patient not found")

    docs = db.session.scalars(
        select(PatientDocument).where(PatientDocument.patient_id == patient_id, PatientDocument.is_deleted == False)
    ).all()

    payload = {}
    for doc in docs:
        if doc.kind in (PatientDocumentKind.NATIONAL_ID_FRONT, PatientDocumentKind.PASSPORT):
            payload.update(ocr_service.extract_id(doc.file_id))
        if doc.kind == PatientDocumentKind.INSURANCE_FRONT:
            payload["insurance"] = ocr_service.extract_insurance_card(doc.file_id)

    ver = KycVerification(patient_id=patient_id, extracted_payload=payload, status=KycStatus.REQUIRES_REVIEW)
    db.session.add(ver)
    db.session.flush()

    for field in ("national_id", "date_of_birth", "passport_number"):
        if payload.get(field):
            db.session.add(
                KycExtractedField(
                    verification_id=ver.id,
                    field_name=field,
                    extracted_value=str(payload[field]),
                    confidence=payload.get("confidence", 0.5),
                )
            )

    p.kyc_status = KycStatusEnum.REQUIRES_REVIEW
    audit_service.record(
        user_id=actor_user_id, role=None, action="kyc.extracted",
        entity_type="kyc_verification", entity_id=ver.id,
        new_value={"fields": list(payload.keys())},
        source_channel="api",
    )
    db.session.commit()
    return ver


def decide(patient_id: int, *, decision: KycStatus, reason: str | None, actor_user_id: int) -> KycVerification:
    ver = latest_verification(patient_id)
    if ver is None:
        ver = KycVerification(patient_id=patient_id, status=decision, decision_reason=reason)
        db.session.add(ver)
    else:
        ver.status = decision
        ver.decision_reason = reason
    ver.reviewed_at = utcnow()
    ver.reviewed_by_user_id = actor_user_id

    p = db.session.get(Patient, patient_id)
    if decision == KycStatus.VERIFIED:
        p.kyc_status = KycStatusEnum.VERIFIED
    elif decision == KycStatus.REJECTED:
        p.kyc_status = KycStatusEnum.REJECTED
    elif decision == KycStatus.REQUIRES_REVIEW:
        p.kyc_status = KycStatusEnum.REQUIRES_REVIEW
    else:
        p.kyc_status = KycStatusEnum.PENDING

    audit_service.record(
        user_id=actor_user_id, role=None, action=f"kyc.{decision.value}",
        entity_type="patient", entity_id=p.id,
        new_value={"kyc_status": p.kyc_status.value, "reason": reason},
        source_channel="api",
    )
    db.session.commit()
    return ver
