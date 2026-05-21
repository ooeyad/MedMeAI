"""API blueprints."""
from .ai import ai_bp
from .appointments import appointments_bp
from .audit import audit_bp
from .auth import auth_bp
from .billing import billing_bp
from .branches import branches_bp
from .clinical import clinical_bp
from .docs import docs_bp
from .doctors import doctors_bp
from .documents import documents_bp
from .insurance import insurance_bp
from .kyc import kyc_bp
from .notifications import notifications_bp
from .patients import patients_bp
from .reports import reports_bp
from .schedules import schedules_bp
from .tenants import tenants_bp
from .users import users_bp

__all__ = [
    "ai_bp",
    "appointments_bp",
    "audit_bp",
    "auth_bp",
    "billing_bp",
    "branches_bp",
    "clinical_bp",
    "docs_bp",
    "doctors_bp",
    "documents_bp",
    "insurance_bp",
    "kyc_bp",
    "notifications_bp",
    "patients_bp",
    "reports_bp",
    "schedules_bp",
    "tenants_bp",
    "users_bp",
]
