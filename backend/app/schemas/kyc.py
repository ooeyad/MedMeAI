from marshmallow import Schema, fields, validate

from ..models.kyc import KycStatus


class KycExtractedFieldSchema(Schema):
    id = fields.Int(dump_only=True)
    field_name = fields.Str()
    extracted_value = fields.Str()
    manual_value = fields.Str()
    confidence = fields.Float()
    is_verified = fields.Bool()


class KycVerificationSchema(Schema):
    id = fields.Int(dump_only=True)
    status = fields.Function(lambda obj: obj.status.value)
    decision_reason = fields.Str()
    extracted_payload = fields.Dict()
    reviewed_at = fields.DateTime()
    reviewed_by_user_id = fields.Int()
    extracted_fields = fields.List(fields.Nested(KycExtractedFieldSchema), dump_only=True)


class KycDecisionSchema(Schema):
    decision = fields.Str(required=True, validate=validate.OneOf([s.value for s in KycStatus]))
    reason = fields.Str()
