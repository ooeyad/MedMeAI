# Database Schema

PostgreSQL 16. SQLAlchemy 2 declarative + Alembic migrations.

## ER overview

```
clinics ──< branches ──< rooms
                │
                └──< doctor_branches >── doctors ──< doctor_specialties >── specialties
                                                │
                                                ├──< doctor_schedules
                                                ├──< doctor_leaves
                                                ├──< doctor_schedule_exceptions
                                                └──< doctor_insurance_networks >── insurance_companies

users (1..1) patients
users (1..*) roles (via user_roles)
roles (1..*) permissions (via role_permissions)

patients ──< patient_documents
patients ──< kyc_verifications
patients ──< patient_insurance >── insurance_companies
patients ──< appointments >── doctors
                              ├── branches
                              ├── rooms
                              └──< appointment_status_history
                              └──< insurance_approvals

ai_conversations ──< ai_messages
                  └──< ai_tool_calls

notifications  (per user / channel / status)
audit_logs     (every mutating action)
files          (storage abstraction; referenced by documents/insurance/etc.)
```

## Tables

### Identity & access

| Table | Purpose |
| --- | --- |
| `users` | Login identities. Email unique. `password_hash`, `is_active`, `locked_until`, `last_login_at`. |
| `roles` | `super_admin / clinic_admin / secretary / doctor / nurse / insurance_officer / patient / auditor`. |
| `permissions` | Atomic permission strings (`patients:read`, `appointments:write`, …). |
| `user_roles` | Many-to-many. A doctor can also be a clinic_admin, etc. |
| `role_permissions` | Maps roles → permissions. |
| `refresh_tokens` | JTI denylist for logout + rotation. |
| `password_reset_tokens` | Token + expiry. |

### Clinic / branch

| Table | Purpose |
| --- | --- |
| `clinics` | Top-level clinic / hospital. `name`, `logo_url`, `timezone`. |
| `branches` | Physical location. `clinic_id`, `address`, `lat`, `lng`, `phones`, `google_maps_url`. |
| `branch_working_hours` | (`branch_id`, `weekday`, `open_time`, `close_time`). |
| `branch_holidays` | One-off / annual closures. |
| `rooms` | (`branch_id`, `name`, `kind`, `is_active`). |

### Patients

| Table | Purpose |
| --- | --- |
| `patients` | Core profile. Bilingual names, national_id, dob, gender, marital_status, contact, address, emergency_contact, blood_type, allergies, chronic_diseases, medications, history_summary, family_history, notes, accessibility_needs, `kyc_status` enum, `consent_*` flags. |
| `patient_documents` | Uploaded docs (`kind` enum: national_id_front, national_id_back, passport, residency, insurance_front, insurance_back, consent, other). Soft-delete. |
| `kyc_verifications` | One row per review cycle. `status`, `decision_reason`, `extracted_payload` (JSONB), `reviewed_by`, `reviewed_at`. |
| `kyc_extracted_fields` | Per-field extraction with confidence + manual override. |

### Doctors

| Table | Purpose |
| --- | --- |
| `doctors` | Linked to a `users` row. Specialty/subspecialty, license, years_experience, languages (array), consultation_fee, bio, profile_image, active. |
| `specialties` | `name`, `name_ar`, `slug`. |
| `doctor_specialties` | many-to-many. |
| `doctor_branches` | Which branches the doctor practises at. |
| `doctor_schedules` | Weekly template (`weekday`, `start_time`, `end_time`, `slot_minutes`, `branch_id`). |
| `doctor_breaks` | Recurring breaks inside a schedule. |
| `doctor_leaves` | `(date_from, date_to, reason)`. |
| `doctor_schedule_exceptions` | One-off adds/removes (`date`, `kind`, `start_time`, `end_time`). |
| `doctor_insurance_networks` | many-to-many with `insurance_companies` (acceptance + network tier). |

### Appointments

| Table | Purpose |
| --- | --- |
| `appointments` | The core entity. `code`, `patient_id`, `doctor_id`, `branch_id`, `room_id`, `specialty_id`, `appointment_type`, `status`, `starts_at`, `ends_at`, `duration_minutes`, `reason`, `symptoms`, `source_channel` (web/mobile/secretary/ai/api), `created_by`, `priority`, `is_recurring`, `parent_appointment_id`, `notes`, `payment_status`. Constraints prevent doctor/room double-booking. |
| `appointment_status_history` | Append-only. `(appointment_id, from_status, to_status, actor_user_id, reason, at)`. |
| `appointment_documents` | Files attached to an appointment. |
| `waiting_list` | Patients waiting on a doctor/specialty/branch with desired window. |

### Insurance

| Table | Purpose |
| --- | --- |
| `insurance_companies` | `name`, `name_ar`, `code`, `logo_url`, `active`. |
| `patient_insurance` | (`patient_id`, `insurance_company_id`, `policy_number`, `member_number`, `network_tier`, `coverage_type`, `expiry_date`, `deductible`, `copayment`, `approval_required`, `status` enum). |
| `insurance_approvals` | (`appointment_id`, `patient_insurance_id`, `status`, `reference_number`, `submitted_by`, `decided_by`, `decided_at`, `notes`, attachments). |

### AI

| Table | Purpose |
| --- | --- |
| `ai_conversations` | (`id`, `user_id`, `role_persona`, `channel`, `language`, `started_at`, `last_message_at`). |
| `ai_messages` | (`conversation_id`, `role` enum: user/assistant/system/tool, `content`, `metadata` JSONB). |
| `ai_tool_calls` | (`conversation_id`, `message_id`, `tool_name`, `arguments` JSONB, `result` JSONB, `success`, `latency_ms`, `error`, `at`). |
| `ai_pending_confirmations` | Confirmation token + planned tool/args (used by `/ai/chat/{id}/confirm`). |

### Notifications

| Table | Purpose |
| --- | --- |
| `notifications` | (`user_id`, `channel` enum: sms/email/push/whatsapp/in_app, `template`, `payload` JSONB, `status`, `provider_message_id`, `sent_at`, `read_at`). |
| `notification_templates` | (`code`, `channel`, `subject`, `body`, `locale`). |

### Audit & files

| Table | Purpose |
| --- | --- |
| `audit_logs` | (`user_id`, `role`, `action`, `entity_type`, `entity_id`, `old_value` JSONB, `new_value` JSONB, `ip`, `user_agent`, `source_channel`, `at`). |
| `files` | (`id`, `bucket`, `key`, `mime_type`, `size_bytes`, `checksum`, `uploaded_by`, `is_public`, `virus_scan_status`). |

## Indexes (highlights)

- `patients`: `phone`, `national_id`, `(name_en gin_trgm)`, `(name_ar gin_trgm)`, `kyc_status`
- `appointments`: `(doctor_id, starts_at)`, `(branch_id, starts_at)`, `(patient_id, starts_at)`, `status`, `code`
- `patient_insurance`: `(insurance_company_id, member_number)`, `expiry_date`
- `audit_logs`: `(entity_type, entity_id)`, `at`
- `ai_tool_calls`: `conversation_id`, `tool_name`

## Constraints (highlights)

- `EXCLUDE` constraint on `appointments` per doctor / room over the `(starts_at, ends_at)` range to prevent double-booking (Postgres `tstzrange` + `btree_gist`).
- `CHECK` constraints on enums (status, channel, kind).
- Foreign keys are `ON DELETE RESTRICT` for clinical data, `ON DELETE CASCADE` for ephemeral data (notifications, AI conversations).
