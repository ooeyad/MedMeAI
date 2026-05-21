"""Common schemas."""
from marshmallow import Schema, fields


class PageMetaSchema(Schema):
    page = fields.Int()
    page_size = fields.Int()
    total = fields.Int()


class PageSchema(Schema):
    data = fields.List(fields.Raw())
    meta = fields.Nested(PageMetaSchema)
