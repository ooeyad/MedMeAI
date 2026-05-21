"""Structured JSON logging."""
from __future__ import annotations

import logging
import sys

import structlog
from flask import Flask, has_request_context, request


_SENSITIVE_KEYS = {"password", "token", "national_id", "member_number", "policy_number"}


def _redact(_, __, event_dict):
    for key in list(event_dict):
        if key.lower() in _SENSITIVE_KEYS:
            event_dict[key] = "[REDACTED]"
    return event_dict


def _request_context(_, __, event_dict):
    if has_request_context():
        event_dict.setdefault("request_id", request.environ.get("request_id"))
        event_dict.setdefault("path", request.path)
        event_dict.setdefault("method", request.method)
    return event_dict


def configure_logging(app: Flask) -> None:
    level = getattr(logging, app.config.get("LOG_LEVEL", "INFO").upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            _request_context,
            _redact,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
