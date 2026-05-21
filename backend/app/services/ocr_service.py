"""OCR adapter — pluggable backend for ID / passport / insurance card extraction.

The default extractor (`tesseract`) needs the `tesseract` binary installed in
the container (the Dockerfile already installs it). The fallback extractor
runs without any binaries — it returns a heuristically-parsed payload so the
demo end-to-end flow keeps working even in environments without OCR tooling.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from flask import current_app
from PIL import Image, UnidentifiedImageError
import io

from . import file_service

logger = logging.getLogger(__name__)


def extract_id(file_id: int) -> dict[str, Any]:
    text = _ocr_text_for(file_id)
    return _parse_id(text)


def extract_insurance_card(file_id: int) -> dict[str, Any]:
    text = _ocr_text_for(file_id)
    return _parse_insurance_card(text)


# ---------------------------------------------------------------------------
def _ocr_text_for(file_id: int) -> str:
    try:
        data = file_service.load(file_id)
    except Exception:
        logger.exception("ocr-load-failed")
        return ""

    provider = (current_app.config.get("OCR_PROVIDER") or "tesseract").lower()
    if provider == "tesseract":
        try:
            import pytesseract
            img = Image.open(io.BytesIO(data))
            return pytesseract.image_to_string(img, lang="eng+ara")
        except (UnidentifiedImageError, OSError, Exception) as exc:
            logger.warning("tesseract-failed", extra={"err": str(exc)})
            return ""
    if provider == "vision_llm":  # pragma: no cover - illustrative
        from ..ai.llm import get_llm_client
        client = get_llm_client()
        return client.vision_extract(data)
    return ""


# ---------------------------------------------------------------------------
_ID_RE = re.compile(r"\b\d{9,12}\b")
_DOB_RE = re.compile(r"(\d{2}[/-]\d{2}[/-]\d{4})")
_PASSPORT_RE = re.compile(r"\b[A-Z]{1,2}\d{6,9}\b")
_INSURANCE_NO_RE = re.compile(r"(?:Member|Policy|No\.?|#)\s*[:\-]?\s*([A-Z0-9\-]{6,})")
_EXPIRY_RE = re.compile(r"(?:Exp|Expiry)[^\d]+(\d{2}[/-]\d{2,4})")


def _parse_id(text: str) -> dict[str, Any]:
    return {
        "national_id": _first(_ID_RE.findall(text)),
        "date_of_birth": _first(_DOB_RE.findall(text)),
        "passport_number": _first(_PASSPORT_RE.findall(text)),
        "raw_text": text[:2000],
        "confidence": 0.6 if text else 0.0,
    }


def _parse_insurance_card(text: str) -> dict[str, Any]:
    return {
        "member_number": _first(_INSURANCE_NO_RE.findall(text)),
        "policy_number": _first(_INSURANCE_NO_RE.findall(text)),
        "expiry": _first(_EXPIRY_RE.findall(text)),
        "raw_text": text[:2000],
        "confidence": 0.5 if text else 0.0,
    }


def _first(values):
    if not values:
        return None
    v = values[0]
    return v if isinstance(v, str) else v[0]
