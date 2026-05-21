from marshmallow import Schema, fields, validate

from ..models.insurance import InsuranceApprovalStatus, PatientInsuranceStatus


class InsuranceCompanySchema(Schema):
    id = fields.Int(dump_only=True)
    code = fields.Str()
    name = fields.Str()
    name_ar = fields.Str()
    logo_url = fields.Str()
    active = fields.Bool()


class PatientInsuranceSchema(Schema):
    id = fields.Int(dump_only=True)
    patient_id = fields.Int()
    insurance_company_id = fields.Int(required=True)
    policy_number = fields.Str()
    member_number = fields.Str()
    network_tier = fields.Str()
    coverage_type = fields.Str()
    expiry_date = fields.Date()
    deductible = fields.Float()
    copayment = fields.Float()
    approval_required = fields.Bool()
    is_primary = fields.Bool()
    status = fields.Function(lambda obj: obj.status.value if hasattr(obj.status, "value") else obj.status)
    extracted_payload = fields.Dict(dump_only=True)


class InsuranceApprovalSchema(Schema):
    id = fields.Int(dump_only=True)
    appointment_id = fields.Int(required=True)
    patient_insurance_id = fields.Int(required=True)
    status = fields.Function(lambda obj: obj.status.value)
    reference_number = fields.Str()
    notes = fields.Str()
    submitted_at = fields.DateTime()
    decided_at = fields.DateTime()


class InsuranceApprovalDecisionSchema(Schema):
    status = fields.Str(required=True, validate=validate.OneOf([s.value for s in InsuranceApprovalStatus]))
    notes = fields.Str()
