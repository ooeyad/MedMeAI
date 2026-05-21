"""Pagination helpers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

from flask import request
from sqlalchemy import func, select
from sqlalchemy.orm import Session


@dataclass
class Page:
    items: Sequence
    page: int
    page_size: int
    total: int

    def to_dict(self, item_serializer=lambda x: x):
        return {
            "data": [item_serializer(it) for it in self.items],
            "meta": {"page": self.page, "page_size": self.page_size, "total": self.total},
        }


def paginate(session: Session, stmt, default_page_size: int = 20, max_page_size: int = 100) -> Page:
    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", default_page_size)), 1), max_page_size)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = session.execute(count_stmt).scalar_one()

    items = session.execute(stmt.limit(page_size).offset((page - 1) * page_size)).scalars().all()

    return Page(items=items, page=page, page_size=page_size, total=total)
