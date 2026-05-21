# Architecture Overview

## 1. High-level view

```
                ┌────────────────────────────────────────────────────────────┐
                │                       Client surfaces                       │
                │                                                            │
   Patient ─►   Flutter mobile app  (patient role)                           │
   Doctor  ─►   Flutter mobile app  (doctor role)                            │
   Staff   ─►   React + TS web portal (admin / secretary / doctor / insurance / auditor)
                └──────────────────────────┬─────────────────────────────────┘
                                           │  HTTPS · JWT (access + refresh)
                                           ▼
                ┌────────────────────────────────────────────────────────────┐
                │                Flask 3 API gateway / app factory           │
                │  ┌────────────┬────────────┬────────────┬───────────────┐  │
                │  │ /auth      │ /patients  │ /doctors   │ /branches     │  │
                │  │ /kyc       │ /schedules │ /appoint.. │ /insurance    │  │
                │  │ /documents │ /notif..   │ /reports   │ /audit        │  │
                │  │ /ai/chat   │ /ai/tools  │ /users     │ /health       │  │
                │  └────────────┴────────────┴────────────┴───────────────┘  │
                │  Service layer · Repositories · Schemas · RBAC · Audit     │
                └──────┬───────────┬────────────────────┬─────────────┬─────┘
                       │           │                    │             │
            SQLAlchemy │     Celery│ tasks      LangGraph│ agent   OCR │ adapter
                       ▼           ▼                    ▼             ▼
                ┌──────────┐  ┌──────────┐    ┌──────────────┐  ┌──────────────┐
                │ Postgres │  │  Redis   │    │ LLM provider │  │ Tesseract /  │
                │   16     │  │ broker + │    │  abstraction │  │ PaddleOCR /  │
                │          │  │  cache   │    │ (OpenAI /    │  │ Vision LLM   │
                │          │  │          │    │  Anthropic / │  │              │
                │          │  │          │    │  local)      │  │              │
                └──────────┘  └──────────┘    └──────────────┘  └──────────────┘
                       ▲
                       │ S3-compatible / local FS via storage adapter
                       │
                ┌──────┴──────┐
                │  Documents  │  Patient docs, ID scans, insurance cards, signed consents
                └─────────────┘
```

## 2. Project layout

```
MedMeAI/
├── README.md
├── .env.example
├── docker-compose.yml
├── docs/                       Architecture, API, DB, AI agent, security, deployment
├── backend/                    Flask app + Celery workers + AI agent
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── migrations/             Alembic migrations
│   ├── manage.py               CLI entry
│   └── app/
│       ├── __init__.py         App factory
│       ├── config.py           Env-driven config classes
│       ├── extensions.py       db, jwt, ma, migrate, cors, limiter, celery
│       ├── errors.py           Global error handlers
│       ├── logging_config.py
│       ├── rbac.py             Role permissions matrix + decorators
│       ├── models/             SQLAlchemy 2 declarative models
│       ├── schemas/            Marshmallow request/response schemas
│       ├── services/           Business logic (one per domain)
│       ├── repositories/       Query helpers per aggregate
│       ├── api/                Flask blueprints (one per resource)
│       ├── ai/                 LangGraph agent, tools, prompts, LLM client
│       ├── tasks/              Celery app + scheduled / background tasks
│       ├── utils/              Security, pagination, datetime, OCR adapters
│       └── seed/               Realistic seed data fixtures
├── web/                        React + Vite + TS admin/secretary/doctor portal
└── mobile/                     Flutter patient + doctor apps
```

## 3. Layering & responsibility

| Layer | Responsibility | Notes |
| --- | --- | --- |
| **API (Blueprints)** | HTTP, validation, auth, calling services. No business logic. | One blueprint per resource group. |
| **Schemas** | Request/response shapes, validation. | Marshmallow with `dump_only` / `load_only` discipline. |
| **Services** | Business logic. Orchestrates repositories, emits audit + notification events. | Pure functions where possible. Raise typed exceptions. |
| **Repositories** | Encapsulate complex queries and avoid leaking SQLAlchemy into services. | Optional — small queries inline in services. |
| **Models** | Persistence + invariants. | SQLAlchemy 2 `Mapped[]` style. |
| **AI agent** | LangGraph state graph that calls services through whitelisted tools. | Role-aware tool exposure, destructive-action confirmation. |
| **Tasks (Celery)** | Notifications, reminders, OCR jobs, KYC verification, cleanup. | Idempotent. Retries with backoff. |

## 4. Multi-tenancy stance

Today the model carries a `branch_id` on most domain rows and a `clinic_id` on `branches`. A future migration to a tenant-per-row model (`tenant_id` everywhere + row-level security) is straightforward — services already pass a `current_tenant_context` object end-to-end.

## 5. AI agentic layer

See [`AI_AGENT.md`](AI_AGENT.md) for the LangGraph state diagram. Headlines:

- **Role-aware tool exposure.** The same agent process serves four personas (secretary / doctor / patient / admin); the toolset is filtered per `current_user.role` before the graph runs.
- **Confirmation gate.** Destructive intents (cancel / reschedule) are recognised at planning time; the agent must call `request_confirmation` and observe an explicit "yes" before invoking the tool.
- **Tool calls are real DB calls.** No hallucinated data. Every tool runs through the same service layer the REST API uses, so RBAC, audit and validation are uniform.
- **Audit.** Each tool invocation persists to `ai_tool_calls` (conversation, tool, inputs, outputs, latency, success).

## 6. Security model

- **JWT** with 15-minute access tokens and 14-day refresh tokens, refresh-token rotation, server-side denylist on logout.
- **RBAC** matrix in `app/rbac.py` mapping (role → permission). Decorators `@require_permission("appointments:write")` gate endpoints.
- **Field-level privacy.** Patients only see their own data through the API — enforced in the service layer, not just the route.
- **Audit** records `user_id, role, action, entity_type, entity_id, old_value, new_value, ip, source_channel, timestamp` for every mutating action.
- **Encryption-ready.** Sensitive PII fields (`national_id`, insurance numbers) flow through a `SecretStr`-style mapper; pluggable encryption-at-rest adapter sits in `utils/crypto.py`.
- **Rate limiting** via Flask-Limiter on auth + AI endpoints.
- **HIPAA/GDPR-inspired** consent flags on the patient record; document access is checked per-request rather than relying on signed URLs.

## 7. Failure handling

- Typed domain exceptions (`AppointmentConflict`, `KycRequired`, `InsuranceExpired`, …) map to 4xx responses with a stable `code` field consumed by the UI.
- All 5xx paths log full context (request ID, user, route) but never leak stack traces to the client.
- Celery tasks retry with exponential backoff; permanent failures land in a `dead_letter_jobs` table for the Auditor role to review.

## 8. Observability

- Structured JSON logging.
- Request IDs propagated to Celery tasks and into the AI agent.
- `/health` (liveness) and `/health/ready` (DB + Redis reachable) endpoints for container probes.

## 9. Extensibility roadmap

- **Billing module.** `appointments.payment_status` and `services` are already present; bolt a `billing` blueprint on top.
- **EMR / lab / pharmacy.** Service abstraction; add adapters and one new blueprint per integration.
- **Insurance APIs.** `services/insurance_service.py` already routes through a provider abstraction; today's adapters are manual + OCR, replace with HTTP adapters per insurer.
- **Voice I/O.** AI agent already accepts a `channel` field; add a `voice` channel and a STT/TTS adapter.
- **Multi-tenancy.** Add `tenant_id` migration + row-level security policies; the service-layer context object is ready.
