# REST API Reference

All endpoints are prefixed with `/api/v1`. JSON in/out. Authentication is `Authorization: Bearer <access_token>` unless noted. Full interactive Swagger UI is mounted at `/api/docs`.

## Conventions

- **Pagination:** `?page=1&page_size=20`. Responses include `meta: { page, page_size, total }`.
- **Filtering:** documented per endpoint. Common filters: `q`, `status`, `date_from`, `date_to`, `branch_id`, `doctor_id`.
- **Errors:** uniform `{ "error": { "code": "appointment_conflict", "message": "...", "details": {...} } }`.
- **Idempotency:** mutating endpoints accept an `Idempotency-Key` header for safe retries.

## Auth · `/api/v1/auth`

| Method | Path | Description |
| --- | --- | --- |
| POST | `/login` | Login by email + password. Returns access + refresh tokens. |
| POST | `/refresh` | Exchange refresh token for a new access token. |
| POST | `/logout` | Revoke the current refresh token. |
| POST | `/password/forgot` | Trigger password-reset email (always 200 to avoid enumeration). |
| POST | `/password/reset` | Submit reset token + new password. |
| GET  | `/me` | Current user profile + permissions. |

## Users & roles · `/api/v1/users`, `/api/v1/roles`

| Method | Path | Roles |
| --- | --- | --- |
| GET / POST | `/users` | super_admin, clinic_admin |
| GET / PATCH / DELETE | `/users/{id}` | super_admin, clinic_admin |
| GET | `/roles` | super_admin |
| POST | `/users/{id}/roles` | super_admin |

## Patients · `/api/v1/patients`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List/search patients. Filters: `q`, `phone`, `national_id`, `kyc_status`. |
| POST | `/` | Create patient. Triggers patient-onboarding workflow. |
| GET | `/{id}` | Patient profile (basic + medical + KYC + insurance). |
| PATCH | `/{id}` | Update patient. |
| GET | `/{id}/timeline` | Combined timeline (appointments, documents, KYC events). |
| GET | `/{id}/appointments` | Patient's appointments. |

## KYC · `/api/v1/kyc`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/patients/{id}` | Current KYC status + documents + extracted fields. |
| POST | `/patients/{id}/documents` | Upload KYC document (multipart). |
| POST | `/patients/{id}/extract` | Run OCR on uploaded doc; return extracted fields. |
| POST | `/patients/{id}/verify` | Mark KYC verified / rejected / requires-review (officer roles). |
| GET | `/queue` | KYC review queue (paginated). |

## Doctors · `/api/v1/doctors`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | List/search doctors. Filters: `specialty_id`, `branch_id`, `accepts_insurance_id`, `q`. |
| POST | `/` | Create doctor (admin). |
| GET | `/{id}` | Doctor profile. |
| PATCH | `/{id}` | Update doctor. |
| GET | `/{id}/availability` | Computed availability for a date range. |
| GET | `/{id}/appointments` | Doctor's appointments. |

## Branches & rooms · `/api/v1/branches`

| Method | Path | Description |
| --- | --- | --- |
| GET / POST | `/branches` | Branches list/create. |
| GET / PATCH / DELETE | `/branches/{id}` | Branch CRUD. |
| GET / POST | `/branches/{id}/rooms` | Rooms in a branch. |
| GET | `/branches/{id}/working-hours` | Working hours + holidays. |

## Schedules · `/api/v1/schedules`

| Method | Path | Description |
| --- | --- | --- |
| GET / PUT | `/doctors/{id}/weekly` | Weekly availability template. |
| GET / POST | `/doctors/{id}/leaves` | Leave / vacation. |
| GET / POST | `/doctors/{id}/exceptions` | One-off availability exceptions. |

## Appointments · `/api/v1/appointments`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | Search appointments. Filters: `q`, `status`, `doctor_id`, `branch_id`, `patient_id`, `phone`, `national_id`, `date_from`, `date_to`. |
| POST | `/` | Create appointment. Body: see schema. |
| GET | `/{id}` | Appointment details + status history. |
| PATCH | `/{id}` | Update fields (notes, room). |
| POST | `/{id}/confirm` | Move to Confirmed. |
| POST | `/{id}/check-in` | Move to Checked-In. |
| POST | `/{id}/start` | Move to In Consultation. |
| POST | `/{id}/complete` | Move to Completed. |
| POST | `/{id}/cancel` | Move to Cancelled. Body: `reason`. |
| POST | `/{id}/no-show` | Move to No Show. |
| POST | `/{id}/reschedule` | New `starts_at`, optionally new doctor/branch. |
| GET | `/availability` | Slot finder: `?doctor_id&date&duration_minutes`. |
| GET | `/inquire` | High-level inquiry endpoint used by AI + UI search. |

## Insurance · `/api/v1/insurance`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/companies` | Insurance companies. |
| GET | `/patients/{id}` | Patient insurance records. |
| POST | `/patients/{id}` | Add a patient insurance record. |
| POST | `/extract-card` | OCR an uploaded insurance card → structured fields. |
| GET | `/appointments/{id}/check` | Does the appointment's doctor/branch accept this insurance? |
| POST | `/appointments/{id}/request-approval` | Submit for approval. |
| POST | `/approvals/{id}/decision` | Officer decision (approve / reject). |

## Documents · `/api/v1/documents`

| Method | Path | Description |
| --- | --- | --- |
| POST | `/upload` | Multipart upload. Returns document ID + URL. |
| GET | `/{id}` | Download with access check. |
| DELETE | `/{id}` | Soft-delete. |

## Notifications · `/api/v1/notifications`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | Current user notifications. |
| POST | `/{id}/read` | Mark read. |
| POST | `/test` | (admin) Send test notification on each channel. |

## Reports · `/api/v1/reports`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/overview` | Counts + rates for the admin dashboard. |
| GET | `/appointments` | Time series + breakdowns. |
| GET | `/doctor-utilization` | Utilization per doctor / branch. |
| GET | `/kyc-funnel` | KYC verification funnel. |
| GET | `/insurance-approvals` | Approval queue + average latency. |

## AI · `/api/v1/ai`

| Method | Path | Description |
| --- | --- | --- |
| POST | `/chat` | Send a message; receive an agent response (and possibly a confirmation request). |
| POST | `/chat/{conversation_id}/confirm` | Confirm/reject a pending destructive action. |
| GET | `/conversations` | Current user's AI conversations. |
| GET | `/conversations/{id}` | Conversation history + tool calls. |
| GET | `/tools` | List of tools the calling user is authorized to invoke. |

## Audit · `/api/v1/audit`

| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | Search audit log. Filters: `user_id`, `action`, `entity_type`, `entity_id`, `date_from`, `date_to`. |
| GET | `/{id}` | Single audit record (with diff). |

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness. |
| GET | `/health/ready` | Readiness (DB + Redis). |
