# AI Agent Workflow

The agentic layer is a LangGraph state machine that wraps a single conversation per user. It exposes role-filtered tools that are thin wrappers over the same service layer used by the REST API. **The agent never invents data** — it only reports what tools return.

## Personas

| Persona | Trigger | Available tools |
| --- | --- | --- |
| `secretary` | Caller has `secretary` or `clinic_admin` role | Full appointment + patient + insurance toolset within their branch scope |
| `doctor` | Caller has `doctor` role | Read-only patient + their own schedule + dictation note write |
| `patient` | Caller has `patient` role | Self-service: own appointments, doctor search, insurance check |
| `admin` | Caller has `super_admin` or `clinic_admin` role | Aggregate / reporting tools (no PII unless filtered) |

## State graph

```
                  ┌──────────────┐
                  │  user_input  │
                  └──────┬───────┘
                         ▼
                  ┌──────────────┐
                  │   classify   │   intent + entities + missing-slot detection
                  └──────┬───────┘
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        clarify     plan_tools    refuse  ── (out of scope / unauthorized)
            │            │
            ▼            ▼
        ask_user    is_destructive?  ── yes ──► request_confirmation ──► wait_for_user
            │            │
            ▼            ▼ no
        finish      execute_tools  ──► observe ──► (loop if more tools)
                         │
                         ▼
                    compose_reply
                         │
                         ▼
                       finish
```

Implementation: `backend/app/ai/agent.py`. Nodes are Python functions; state is a `TypedDict` carrying `messages`, `intent`, `entities`, `tool_plan`, `confirmation`, `tool_results`, `language`.

## Intent set

A non-exhaustive list — extend in `app/ai/intents.py`:

- `search_appointments`, `appointment_details`, `book_appointment`, `reschedule_appointment`, `cancel_appointment`, `check_in_patient`
- `find_doctor`, `doctor_availability`, `doctor_schedule_today`, `next_patient`
- `patient_search`, `patient_summary`, `patient_history`
- `insurance_check`, `submit_approval`, `approval_status`
- `report_overview`, `report_no_show_rate`, `report_doctor_utilization`
- `smalltalk`, `out_of_scope`

## Tools

Defined in `backend/app/ai/tools.py`. Each tool has a Pydantic argument model and a typed return.

```
search_patient(q: str, phone: str | None, national_id: str | None) -> [PatientSummary]
get_patient_profile(patient_id: int) -> PatientProfile
search_appointments(filters) -> [AppointmentSummary]
get_appointment(appointment_id: int) -> AppointmentDetail
find_available_slots(doctor_id, date_from, date_to, duration_minutes) -> [Slot]
create_appointment(patient_id, doctor_id, branch_id, starts_at, ...) -> Appointment
reschedule_appointment(appointment_id, new_starts_at, ...) -> Appointment
cancel_appointment(appointment_id, reason) -> Appointment           # destructive
check_insurance_acceptance(patient_id, doctor_id, branch_id) -> InsuranceCheck
extract_insurance_card_data(document_id) -> InsuranceCardData
summarize_patient_history(patient_id) -> str
get_doctor_schedule(doctor_id, date) -> DaySchedule
generate_daily_schedule_report(branch_id, date) -> Report
request_confirmation(intent, args, summary) -> ConfirmationToken     # internal
```

Tool filtering happens before the graph runs:

```python
tools_for(user) = ALL_TOOLS ∩ ROLE_TOOLS[user.primary_role]
```

A patient cannot see `generate_daily_schedule_report`. A doctor cannot see `cancel_appointment` unless flagged. A secretary cannot see another branch's patients (enforced inside the tool, not just the routing).

## Confirmation flow

For any intent in `DESTRUCTIVE = {cancel_appointment, reschedule_appointment, mass_notify}`:

1. The graph calls `request_confirmation(...)`, which persists a pending action and returns a token.
2. The agent replies in natural language with a short summary, e.g. *"Cancel Ahmad Ali's appointment with Dr Sami on Mon 18 Aug at 15:00 — confirm?"*
3. The frontend re-submits to `POST /ai/chat/{conversation_id}/confirm` with `{ token, decision }`.
4. On `yes`, the tool runs; on `no`, the agent acknowledges and ends.

## Safety rules (enforced)

- Authorization is checked **inside** every tool via the same `require_permission` machinery as REST endpoints. The agent cannot bypass RBAC even if the LLM tries.
- Patient persona only sees their own data (`user.patient_id == args.patient_id`).
- Doctor persona only sees patients with an appointment assigned to that doctor (`exists(appointment WHERE doctor_id = current_doctor AND patient_id = args.patient_id)`).
- Secretary persona is scoped to branches in `user.branches`.
- Free-form text is never trusted as a date — every date enters through a dedicated parser tool with locale support (Arabic dates included).
- Every tool call is logged to `ai_tool_calls` with arguments, result hash, latency, success.

## LLM provider abstraction

`backend/app/ai/llm.py` wraps a `LLMClient` interface (`generate(messages, tools) -> Response`). Adapters:

- `OpenAIClient` (default; reads `OPENAI_API_KEY`)
- `AnthropicClient` (reads `ANTHROPIC_API_KEY`)
- `LocalEchoClient` (no key required; rule-based — used when no LLM key is configured so the demo still runs)

The provider returns either content or tool calls (OpenAI tool-calling shape). LangGraph nodes consume this uniformly.

## Multilingual support

`language` is detected on first user message and pinned to the conversation. Prompts have `{language}` placeholders. Date parsing accepts Arabic numerals + month names. Doctor specialty lookups try `name`, then `name_ar`.

## Sample conversations

### Secretary

> **User:** Check if Ahmad Ali with phone 0791234567 has an appointment today.
> **Agent → tools:** `search_patient(phone="0791234567")` → 1 hit → `search_appointments(patient_id=12, date_from=today, date_to=today)`
> **Agent → user:** "Yes — Ahmad Ali has a 14:30 appointment today with Dr Sami Khalil (Cardiology, Amman Main). Status: Confirmed."

### Doctor

> **User:** Who is my next patient?
> **Agent → tools:** `get_doctor_schedule(doctor_id=self, date=today)` → next appointment → `summarize_patient_history(patient_id)`
> **Agent → user:** "Next: Reem Said at 15:00. 34F. Chief complaint: chest pain on exertion. Allergies: penicillin. Last visit 2024-12-02 for the same complaint — ECG was normal."

### Patient

> **User:** I want to book with a dermatologist tomorrow.
> **Agent → tools:** `find_doctor(specialty="Dermatology")` → 3 options → asks which branch
> **User:** Amman Main.
> **Agent → tools:** `find_available_slots(doctor_id=..., date=tomorrow, duration_minutes=30)`
> **Agent → user:** "Dr Lina Haddad has 10:30, 11:00, 12:00. Which works?"
> **User:** 11:00.
> **Agent:** `request_confirmation(intent=book_appointment, ...)` → "Book 11:00 tomorrow with Dr Lina Haddad — confirm?"
> **User:** Yes.
> **Agent:** `create_appointment(...)` → confirmation + notification dispatched.

### Insurance

> **User:** Does this patient's insurance cover Dr Sami?
> **Agent → tools:** `check_insurance_acceptance(patient_id=..., doctor_id=...)`
> **Agent → user:** "Yes. Patient's plan (Newton Gold) is in Dr Sami's accepted network. Co-payment 10 JOD. Pre-approval required for cardiac procedures — none for consultation."
