from marshmallow import Schema, fields, validate

from ..models.patient import KycStatusEnum


class PatientSchema(Schema):
    id = fields.Int(dump_only=True)
    code = fields.Str(dump_only=True)
    full_name_en = fields.Str(required=True)
    full_name_ar = fields.Str()
    national_id = fields.Str()
    passport_number = fields.Str()
    date_of_birth = fields.Date()
    gender = fields.Str(validate=validate.OneOf(["male", "female", "other"]))
    nationality = fields.Str()
    marital_status = fields.Str()
    phone = fields.Str()
    alternative_phone = fields.Str()
    email = fields.Email()
    address = fields.Str()
    city = fields.Str()
    country = fields.Str()
    emergency_contact_name = fields.Str()
    emergency_contact_phone = fields.Str()
    emergency_contact_relationship = fields.Str()
    blood_type = fields.Str()
    allergies = fields.List(fields.Str())
    chronic_diseases = fields.List(fields.Str())
    current_medications = fields.List(fields.Str())
    medical_history_summary = fields.Str()
    family_medical_history = fields.Str()
    special_notes = fields.Str()
    accessibility_needs = fields.Str()
    consent_treatment = fields.Bool()
    consent_marketing = fields.Bool()
    consent_data_sharing = fields.Bool()
    kyc_status = fields.Function(lambda obj: getattr(obj.kyc_status, "value", str(obj.kyc_status)))
    created_at = fields.DateTime(dump_only=True)
    updated_at = fields.DateTime(dump_only=True)


class PatientCreateSchema(PatientSchema):
    class Meta:
        exclude = ()


class PatientUpdateSchema(PatientSchema):
    full_name_en = fields.Str()
