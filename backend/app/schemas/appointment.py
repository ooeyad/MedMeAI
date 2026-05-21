from marshmallow import EXCLUDE, Schema, fields, validate

from ..models.appointment import AppointmentStatus, AppointmentType, SourceChannel


_STATUS_VALUES = [s.value for s in AppointmentStatus]
_TYPE_VALUES = [t.value for t in AppointmentType]
_CHANNEL_VALUES = [c.value for c in SourceChannel]


class _PatientSnippetSchema(Schema):
    id = fields.Int()
    code = fields.Str()
    full_name_en = fields.Str()
    full_name_ar = fields.Str()
    phone = fields.Str()


class _DoctorSnippetSchema(Schema):
    id = fields.Int()
    user = fields.Function(lambda d: {"full_name": d.user.full_name} if d and d.user else None)


class AppointmentSchema(Schema):
    id = fields.Int(dump_only=True)
    code = fields.Str(dump_only=True)
    status = fields.Function(lambda obj: obj.status.value)
    appointment_type = fields.Function(lambda obj: obj.appointment_type.value)
    starts_at = fields.DateTime()
    ends_at = fields.DateTime(dump_only=True)
    duration_minutes = fields.Int()
    reason = fields.Str()
    symptoms = fields.Str()
    notes = fields.Str()
    priority = fields.Int()
    payment_status = fields.Str()
    source_channel = fields.Function(lambda obj: obj.source_channel.value)

    patient_id = fields.Int()
    doctor_id = fields.Int()
    branch_id = fields.Int()
    room_id = fields.Int()
    specialty_id = fields.Int()

    patient = fields.Nested(_PatientSnippetSchema, dump_only=True)
    doctor = fields.Nested(_DoctorSnippetSchema, dump_only=True)


class AppointmentCreateSchema(Schema):
    patient_id = fields.Int(required=True)
    doctor_id = fields.Int(required=True)
    branch_id = fields.Int(required=True)
    starts_at = fields.DateTime(required=True)
    duration_minutes = fields.Int()
    appointment_type = fields.Str(load_default=AppointmentType.NEW_CONSULTATION.value,
                                  validate=validate.OneOf(_TYPE_VALUES))
    reason = fields.Str()
    symptoms = fields.Str()
    notes = fields.Str()
    room_id = fields.Int()
    specialty_id = fields.Int()
    source_channel = fields.Str(load_default=SourceChannel.WEB.value,
                                validate=validate.OneOf(_CHANNEL_VALUES))
    allow_overbook = fields.Bool(load_default=False)
    insurance_snapshot = fields.Dict()


class AppointmentRescheduleSchema(Schema):
    new_starts_at = fields.DateTime(required=True)
    new_doctor_id = fields.Int()
    new_branch_id = fields.Int()
    reason = fields.Str()


class AppointmentTransitionSchema(Schema):
    reason = fields.Str()


class AppointmentInquirySchema(Schema):
    class Meta:
        unknown = EXCLUDE  # ignore pagination params and other query-only keys

    q = fields.Str(load_default=None)
    status = fields.Str(load_default=None, validate=validate.OneOf(_STATUS_VALUES))
    doctor_id = fields.Int(load_default=None)
    branch_id = fields.Int(load_default=None)
    patient_id = fields.Int(load_default=None)
    phone = fields.Str(load_default=None)
    national_id = fields.Str(load_default=None)
    date_from = fields.DateTime(load_default=None)
    date_to = fields.DateTime(load_default=None)
    appointment_type = fields.Str(load_default=None, validate=validate.OneOf(_TYPE_VALUES))
    source_channel = fields.Str(load_default=None, validate=validate.OneOf(_CHANNEL_VALUES))
    specialty_id = fields.Int(load_default=None)
    sort = fields.Str(load_default=None)
