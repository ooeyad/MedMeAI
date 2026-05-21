"""File storage abstraction (local + S3-ready)."""
from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path
from typing import BinaryIO

from flask import current_app

from ..extensions import db
from ..models.document import File


def store(stream: BinaryIO, *, original_name: str, mime_type: str, uploaded_by_user_id: int | None, is_public: bool = False) -> File:
    backend = current_app.config["STORAGE_BACKEND"]
    payload = stream.read()
    checksum = hashlib.sha256(payload).hexdigest()
    key = f"{uuid.uuid4().hex}-{Path(original_name).name}"

    if backend == "local":
        base = Path(current_app.config["LOCAL_STORAGE_PATH"])
        base.mkdir(parents=True, exist_ok=True)
        dest = base / key
        dest.write_bytes(payload)
        bucket = "local"
    else:  # pragma: no cover — S3 path
        import boto3  # local import keeps cold-start fast
        s3 = boto3.client(
            "s3",
            region_name=current_app.config["S3_REGION"],
            endpoint_url=current_app.config["S3_ENDPOINT_URL"],
            aws_access_key_id=current_app.config["S3_ACCESS_KEY"],
            aws_secret_access_key=current_app.config["S3_SECRET_KEY"],
        )
        bucket = current_app.config["S3_BUCKET"]
        s3.put_object(Bucket=bucket, Key=key, Body=payload, ContentType=mime_type)

    f = File(
        bucket=bucket,
        key=key,
        mime_type=mime_type,
        size_bytes=len(payload),
        checksum=checksum,
        original_name=original_name,
        uploaded_by_user_id=uploaded_by_user_id,
        is_public=is_public,
        virus_scan_status="clean",  # stub — replace with scanner
    )
    db.session.add(f)
    db.session.flush()
    db.session.commit()
    return f


def load(file_id: int) -> bytes:
    f = db.session.get(File, file_id)
    if f is None:
        raise FileNotFoundError(file_id)
    if f.bucket == "local":
        path = Path(current_app.config["LOCAL_STORAGE_PATH"]) / f.key
        return path.read_bytes()
    # pragma: no cover — S3 path
    import boto3
    s3 = boto3.client("s3", region_name=current_app.config["S3_REGION"])
    obj = s3.get_object(Bucket=f.bucket, Key=f.key)
    return obj["Body"].read()
