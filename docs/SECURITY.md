# Security & Compliance

This document captures the security posture of MedMeAI and the principles we follow during development. It is **not** a substitute for a formal HIPAA / GDPR / local healthcare-regulator assessment before going live.

## Authentication

- Email + password login. Passwords hashed with **Argon2id** (`argon2-cffi`).
- **JWT** tokens:
  - Access token: 15-minute lifetime, signed with `HS256` (or asymmetric `RS256` if `JWT_PRIVATE_KEY` is configured).
  - Refresh token: 14-day lifetime, single-use, rotated on every refresh, JTI stored in `refresh_tokens` for server-side revocation.
- Logout revokes the current refresh token.
- Failed-login throttling — after 5 failures in 15 minutes the account is locked for 15 minutes (`users.locked_until`).
- Password reset uses single-use signed tokens with a 1-hour expiry; the API never tells the user whether the email is known.

## Authorization

- Role-permission matrix lives in `backend/app/rbac.py`.
- Endpoint guard: `@require_permission("appointments:write")`.
- Service-layer guard: `ensure_scope(user, branch_id)` runs again on every service call, so AI tools and other entry points cannot bypass the route guard.
- Patients only see their own resources. Doctors only see patients with a current/past appointment to them. Secretaries are scoped to branches in `user.branches`.

## Input validation

- Marshmallow schemas validate every payload; unknown fields are rejected by default.
- Phone numbers, emails, national IDs are normalised on entry.
- File uploads pass through `verify_upload()` which checks MIME, size, magic bytes, and runs a virus-scan adapter (`clamav` adapter shipped as a stub; replace in production).

## SQL injection

- All DB access is via SQLAlchemy parameterised queries.
- Raw SQL is only used inside `repositories/` for tuned queries and uses bind parameters.

## XSS / CSRF

- All API endpoints return JSON; React app handles all rendering with React's default escaping.
- CORS is allow-listed to the frontend origins from `WEB_ORIGINS`.
- For browser-served endpoints, CSRF protection uses double-submit cookies (`flask-wtf.csrf`) on the few endpoints that accept cookies (login, refresh).

## Sensitive data

- `patients.national_id`, `patient_insurance.policy_number`, `patient_insurance.member_number` flow through a `SecretStr` mapper. Encryption-at-rest hook (`utils/crypto.py`) ready for a KMS adapter.
- Document storage uses a per-document access check; we **do not** rely on URL secrecy.
- Document URLs returned to clients are short-lived signed URLs minted by `services/file_service.py` (15 minutes).

## Audit

Every mutating action writes to `audit_logs`:
`user_id, role, action, entity_type, entity_id, old_value, new_value, ip, user_agent, source_channel, request_id, timestamp`.

The Auditor role has read-only access to the full audit log via `/api/v1/audit`.

## Rate limiting

`Flask-Limiter` with Redis storage:

- `/auth/login`: 10 per minute per IP, 30 per hour per email.
- `/auth/password/*`: 5 per hour per IP.
- `/ai/chat`: 30 per minute per user.
- Default: 120 per minute per user.

## Transport

- HTTPS-only in production. The reverse proxy (nginx/traefik) handles TLS and sets `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: same-origin`, `Permissions-Policy`.
- `SameSite=Lax`, `Secure`, `HttpOnly` on any cookie issued.

## Secrets

- `.env` for local; **never** committed.
- Production: use AWS Secrets Manager / HashiCorp Vault / equivalent. The app reads via `os.environ` only — no secrets in code.
- DB credentials, JWT keys, OCR provider keys, LLM provider keys all rotated independently.

## AI-specific safety

- Tool exposure is filtered per role **before** the LLM sees them.
- Destructive intents require an explicit confirmation token from the user before the corresponding tool runs.
- Every tool call is logged. We can replay any AI conversation forensically.
- Free-form text from users is never used to construct SQL — tool arguments go through Pydantic.

## Data subject rights (GDPR-inspired)

- `GET /api/v1/patients/me/export` returns a JSON bundle of all data we hold for the patient.
- `POST /api/v1/patients/me/erase` triggers a redaction job (subject to legal-retention constraints — clinical records cannot be hard-deleted, but PII is replaced with `REDACTED-{hash}`).
- Consent flags on the patient record gate marketing notifications.

## Vulnerability management

- `pip-audit` + `npm audit` + `flutter pub outdated` run in CI.
- `bandit` for Python static analysis.
- Container images built from minimal base images, non-root user.

## Logging

- Structured JSON logs.
- PII redactor middleware strips `password`, `token`, `national_id`, `member_number` from request bodies before logging.
- No PII in error messages returned to clients.
