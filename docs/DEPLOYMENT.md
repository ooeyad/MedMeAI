# Deployment Guide

## Local (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
docker compose exec backend flask db upgrade
docker compose exec backend flask seed run
```

Endpoints:

- Backend API: http://localhost:5000/api/v1
- Swagger UI:  http://localhost:5000/api/docs
- Web portal:  http://localhost:5173

## Environment variables

See `.env.example`. Key ones:

| Name | Purpose |
| --- | --- |
| `FLASK_ENV` | `development` / `production` |
| `SECRET_KEY` | Flask secret. Required. |
| `JWT_SECRET_KEY` | JWT signing key. Required. |
| `DATABASE_URL` | `postgresql+psycopg://user:pass@host:5432/medme` |
| `REDIS_URL` | `redis://redis:6379/0` |
| `STORAGE_BACKEND` | `local` / `s3` |
| `LOCAL_STORAGE_PATH` | If `local`, where to write files. |
| `S3_*` | AWS S3-compatible settings if `s3`. |
| `LLM_PROVIDER` | `openai` / `anthropic` / `local` |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Provider keys. |
| `OCR_PROVIDER` | `tesseract` / `paddle` / `vision_llm` |
| `WEB_ORIGINS` | Comma-separated allow-list for CORS. |
| `EMAIL_*`, `SMS_*`, `PUSH_*`, `WHATSAPP_*` | Notification provider creds. |

## Production checklist

- [ ] Replace dev `SECRET_KEY` / `JWT_SECRET_KEY` with values from a secret manager.
- [ ] Enable TLS at the proxy. Force `https://` and set HSTS.
- [ ] Switch storage backend to S3 (or compliant equivalent) with bucket-level encryption.
- [ ] Connect a managed Postgres with backups + PITR.
- [ ] Connect a managed Redis with auth enabled.
- [ ] Configure a real SMTP / SMS / WhatsApp / Push provider — the in-repo adapters write to `notifications.payload` for inspection.
- [ ] Run a security review of RBAC mappings against your clinic's reality.
- [ ] Stand up Celery beat for reminder schedules.
- [ ] Wire up application logs to your log aggregator (Loki / ELK / Datadog).
- [ ] Add liveness/readiness probes and autoscaling rules.
- [ ] Pen-test before go-live.

## Kubernetes (sketch)

A reference Helm chart is **not** included in this repo, but the deployable units map cleanly:

| Component | Replicas | Notes |
| --- | --- | --- |
| `backend` (gunicorn) | 3+ | Stateless. Read/write Postgres + Redis. |
| `celery-worker` | 2+ | Same image as backend. `CMD ["celery", "-A", "app.tasks.celery_app", "worker"]`. |
| `celery-beat` | 1 | Single instance only. |
| `web` (nginx serving built React) | 2+ | Behind the ingress. |
| `postgres` | managed service | Don't run this yourself in production. |
| `redis` | managed service | Same. |

A `Service` of type `LoadBalancer` (or behind an Ingress) in front of `backend`. Web portal can be served by the same ingress under a different path or hostname.

## Migrations

- Run `flask db upgrade` in a one-shot Job before rolling out a new backend.
- Migrations are forward-compatible: deploy code that tolerates both old and new schema, then run migrations, then remove old code paths.

## Backups & DR

- Postgres: WAL archiving + PITR. Restore drills quarterly.
- File storage: bucket versioning + cross-region replication.
- Redis: ephemeral cache — no backup required, but persist sessions to DB.

## Observability

- `/health` (liveness) and `/health/ready` (readiness) for container probes.
- Logs: structured JSON to stdout.
- Metrics: `prometheus_flask_exporter` already wired at `/metrics`.
- Traces: OpenTelemetry hooks ready in `app/extensions.py` — pass an OTLP endpoint via env.
