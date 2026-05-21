from marshmallow import Schema, fields


class RoomSchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True)
    kind = fields.Str(load_default="consultation")
    is_active = fields.Bool(load_default=True)


class WorkingHoursSchema(Schema):
    weekday = fields.Int(required=True)
    open_time = fields.Time(required=True)
    close_time = fields.Time(required=True)
    is_closed = fields.Bool(load_default=False)


class BranchSchema(Schema):
    id = fields.Int(dump_only=True)
    clinic_id = fields.Int(required=True)
    name = fields.Str(required=True)
    name_ar = fields.Str()
    address = fields.Str()
    city = fields.Str()
    country = fields.Str()
    phone = fields.Str()
    google_maps_url = fields.Str()
    latitude = fields.Float()
    longitude = fields.Float()
    is_active = fields.Bool()
    rooms = fields.List(fields.Nested(RoomSchema), dump_only=True)
