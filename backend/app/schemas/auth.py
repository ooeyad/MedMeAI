from marshmallow import Schema, fields, validate


class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, load_only=True, validate=validate.Length(min=1))


class RefreshSchema(Schema):
    refresh_token = fields.Str(required=True, load_only=True)


class PasswordForgotSchema(Schema):
    email = fields.Email(required=True)


class PasswordResetSchema(Schema):
    token = fields.Str(required=True, load_only=True)
    new_password = fields.Str(required=True, load_only=True, validate=validate.Length(min=8))


class UserSchema(Schema):
    id = fields.Int()
    email = fields.Email()
    full_name = fields.Str()
    preferred_language = fields.Str()
    roles = fields.List(fields.Str())
    permissions = fields.List(fields.Str())
    patient_id = fields.Int(allow_none=True)
    doctor_id = fields.Int(allow_none=True)


class TokensSchema(Schema):
    access_token = fields.Str()
    refresh_token = fields.Str()
    user = fields.Nested(UserSchema)
