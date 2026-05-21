"""Configuration objects driven entirely by environment variables."""
from __future__ import annotations

import os
from datetime import timedelta


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _csv(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


class BaseConfig:
    # Core
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    TESTING = False
    DEBUG = False
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True

    # CORS — allow browser-direct API calls from the local dev server and the
    # PWA preview, both http and https variants (basic-ssl plugin serves HTTPS
    # for local-network phones).
    WEB_ORIGINS = _csv(
        "WEB_ORIGINS",
        "http://localhost:5173,https://localhost:5173,"
        "http://localhost:4173,https://localhost:4173,"
        "http://localhost:3000",
    )

    # DB
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://medme:medme@localhost:5432/medme",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        # pre_ping costs a SELECT 1 per checkout; useful in prod, slow on a dev laptop.
        "pool_pre_ping": _bool("DB_POOL_PRE_PING", False),
        "pool_size": _int("DB_POOL_SIZE", 10),
        "max_overflow": _int("DB_MAX_OVERFLOW", 20),
        "pool_recycle": 1800,
    }

    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # JWT
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=_int("JWT_ACCESS_MINUTES", 15))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=_int("JWT_REFRESH_DAYS", 14))
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_TYPE = "Bearer"
    JWT_ERROR_MESSAGE_KEY = "message"

    # Limiter — defaults to in-memory so the app runs without Redis.
    # Set RATELIMIT_STORAGE_URI explicitly to point at Redis in production.
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")
    RATELIMIT_HEADERS_ENABLED = True
    RATELIMIT_DEFAULT = "120 per minute"

    # Storage
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
    LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "/app/storage")
    S3_BUCKET = os.getenv("S3_BUCKET")
    S3_REGION = os.getenv("S3_REGION")
    S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
    S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
    S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")

    # LLM
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "local")
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")

    # OCR
    OCR_PROVIDER = os.getenv("OCR_PROVIDER", "tesseract")

    # Notifications
    EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "console")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "no-reply@medme.ai")
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = _int("SMTP_PORT", 587)
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

    SMS_BACKEND = os.getenv("SMS_BACKEND", "console")
    SMS_FROM = os.getenv("SMS_FROM", "MedMe")
    PUSH_BACKEND = os.getenv("PUSH_BACKEND", "console")
    WHATSAPP_BACKEND = os.getenv("WHATSAPP_BACKEND", "console")

    # Celery
    CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
    CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

    # Seed
    SEED_DEFAULT_PASSWORD = os.getenv("SEED_DEFAULT_PASSWORD", "ChangeMe!123")

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    PROPAGATE_EXCEPTIONS = True


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///:memory:")
    RATELIMIT_ENABLED = False
    SECRET_KEY = "test-secret"
    JWT_SECRET_KEY = "test-jwt"


class ProductionConfig(BaseConfig):
    DEBUG = False
    PROPAGATE_EXCEPTIONS = False


_CONFIG_MAP = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}


def get_config(name: str) -> type[BaseConfig]:
    return _CONFIG_MAP.get(name, DevelopmentConfig)
