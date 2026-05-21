from marshmallow import Schema, fields


class SpecialtySchema(Schema):
    id = fields.Int(dump_only=True)
    slug = fields.Str()
    name = fields.Str()
    name_ar = fields.Str()


class _DoctorUserSchema(Schema):
    id = fields.Int()
    full_name = fields.Str()
    full_name_ar = fields.Str()
    email = fields.Email()
    phone = fields.Str()


class DoctorSchema(Schema):
    id = fields.Int(dump_only=True)
    user = fields.Nested(_DoctorUserSchema, dump_only=True)
    license_number = fields.Str()
    years_of_experience = fields.Int()
    languages = fields.List(fields.Str())
    consultation_fee = fields.Float()
    appointment_duration_minutes = fields.Int()
    online_appointments = fields.Bool()
    bio = fields.Str()
    profile_image_url = fields.Str()
    is_active = fields.Bool()
    specialties = fields.List(fields.Nested(SpecialtySchema), dump_only=True)
    branch_ids = fields.Function(lambda obj: [b.id for b in (obj.branches or [])], dump_only=True)


class ScheduleSlotSchema(Schema):
    date = fields.Str()
    start = fields.Str()
    end = fields.Str()
    starts_at = fields.Str()
    ends_at = fields.Str()
    branch_id = fields.Int()


class ScheduleSchema(Schema):
    weekday = fields.Int(required=True)
    branch_id = fields.Int(required=True)
    start_time = fields.Time(required=True)
    end_time = fields.Time(required=True)
    slot_minutes = fields.Int(load_default=30)
    is_active = fields.Bool(load_default=True)
