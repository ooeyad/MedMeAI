# MedMeAI — AI-Powered Medical Appointment & Patient Management Platform

Enterprise-grade medical appointment management system for hospitals, clinics, medical centers, and insurance-connected healthcare providers. Built with Flask, PostgreSQL, Redis, React, Flutter, and an agentic LangGraph AI layer.

## What's in the box

| Layer | Tech | Path |
| --- | --- | --- |
| Backend API | Python 3.11 + Flask 3 + SQLAlchemy 2 + Alembic | `backend/` |
| Database | PostgreSQL 16 | `backend/migrations/` |
| Cache & queues | Redis 7 + Celery | `backend/app/tasks/` |
| AI agent | LangGraph + LLM provider abstraction | `backend/app/ai/` |
| OCR | Pluggable adapter (Tesseract / PaddleOCR / Vision LLM) | `backend/app/services/ocr_service.py` |
| Web portal (admin / secretary / doctor) | React 18 + TypeScript + Vite + Tailwind | `web/` |
| Mobile apps (patient + doctor) | Flutter 3 | `mobile/` |
| Orchestration | Docker Compose | `docker-compose.yml` |

## Quick start

```bash
# 1. Copy env template
cp .env.example .env

# 2. Bring up the stack (Postgres + Redis + backend + Celery + web)
docker compose up --build

# 3. In another terminal, run migrations + seed sample data
docker compose exec backend flask db upgrade
docker compose exec backend flask seed run

# 4. Open the portals
#    Web admin/secretary/doctor portal:  http://localhost:5173
#    Backend API + Swagger:              http://localhost:5000/api/docs
#    Patient/Doctor mobile app:          cd mobile && flutter run
```

## Default test users (after seeding)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@medme.ai | `ChangeMe!123` |
| Clinic Admin | clinic.admin@medme.ai | `ChangeMe!123` |
| Secretary | secretary@medme.ai | `ChangeMe!123` |
| Doctor | dr.sami@medme.ai | `ChangeMe!123` |
| Nurse | nurse@medme.ai | `ChangeMe!123` |
| Insurance Officer | insurance@medme.ai | `ChangeMe!123` |
| Patient | ahmad.ali@example.com | `ChangeMe!123` |
| Auditor | auditor@medme.ai | `ChangeMe!123` |

> Rotate these in production. They exist only so reviewers can log in and click around.

## Documentation

- **Architecture overview** — [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Database schema** — [`docs/DATABASE.md`](docs/DATABASE.md)
- **REST API reference** — [`docs/API.md`](docs/API.md) (Swagger UI also available at `/api/docs`)
- **AI agent workflow** — [`docs/AI_AGENT.md`](docs/AI_AGENT.md)
- **Security & compliance** — [`docs/SECURITY.md`](docs/SECURITY.md)
- **Deployment guide** — [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## Feature summary

- Patient profiles, KYC verification, document upload, OCR ID/insurance extraction
- Doctor profiles, weekly schedules, leaves, exceptions, multi-branch
- Full appointment lifecycle (Requested → Confirmed → Checked-in → In Consultation → Completed / No-show / Cancelled / Rescheduled / Waiting Insurance Approval / Rejected)
- Insurance management with network/coverage checks and approval workflow
- Role-based access control across 8 roles, JWT auth with refresh tokens
- Agentic AI assistant per role (secretary, doctor, patient, admin) with safe tool-calling, confirmation flow on destructive actions, and audit logging
- Notifications via pluggable SMS / Email / Push / WhatsApp providers
- Audit trail across patient, KYC, appointment, insurance, AI actions
- Reporting dashboard with no-show rate, doctor utilization, KYC funnel, insurance approval delays
- Designed for multi-tenancy (branches + future tenant scoping)

## Development without Docker

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export FLASK_APP=app:create_app
flask db upgrade
flask seed run
flask run --port 5000

# Web
cd web
npm install
npm run dev

# Mobile
cd mobile
flutter pub get
flutter run
```

## License

Proprietary. Build artifact generated as a reference implementation. Replace this notice with your real license before deploying.
