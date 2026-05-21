"""Minimal Swagger UI shell + OpenAPI snapshot."""
from __future__ import annotations

from flask import Blueprint, jsonify, render_template_string

docs_bp = Blueprint("docs", __name__)

_SWAGGER_HTML = """
<!doctype html>
<html>
  <head>
    <title>MedMeAI API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger',
      });
    </script>
  </body>
</html>
"""


@docs_bp.get("/")
def index():
    return render_template_string(_SWAGGER_HTML)


@docs_bp.get("/openapi.json")
def openapi():
    """A pragmatic OpenAPI snapshot. Full generation lives in tools/openapi.py."""
    return jsonify(_snapshot())


def _snapshot():
    return {
        "openapi": "3.0.3",
        "info": {
            "title": "MedMeAI API",
            "version": "1.0.0",
            "description": "AI-Powered Medical Appointment & Patient Management Platform",
        },
        "servers": [{"url": "/api/v1"}],
        "components": {
            "securitySchemes": {
                "bearer": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
            }
        },
        "security": [{"bearer": []}],
        "paths": {
            "/auth/login": {"post": {"summary": "Login"}},
            "/auth/refresh": {"post": {"summary": "Refresh access token"}},
            "/auth/logout": {"post": {"summary": "Logout"}},
            "/auth/me": {"get": {"summary": "Current user + permissions"}},
            "/patients/": {
                "get": {"summary": "Search patients"},
                "post": {"summary": "Create patient"},
            },
            "/patients/{id}": {"get": {"summary": "Patient profile"}, "patch": {"summary": "Update patient"}},
            "/kyc/patients/{id}": {"get": {"summary": "Patient KYC status"}},
            "/kyc/patients/{id}/documents": {"post": {"summary": "Upload KYC document"}},
            "/kyc/patients/{id}/extract": {"post": {"summary": "OCR-extract KYC fields"}},
            "/kyc/patients/{id}/verify": {"post": {"summary": "Officer decision"}},
            "/doctors/": {"get": {"summary": "Search doctors"}},
            "/doctors/{id}/availability": {"get": {"summary": "Slot finder"}},
            "/branches/": {"get": {"summary": "Branches"}, "post": {"summary": "Create branch"}},
            "/schedules/doctors/{id}/weekly": {
                "get": {"summary": "Weekly schedule"},
                "put": {"summary": "Replace weekly schedule"},
            },
            "/appointments/": {
                "get": {"summary": "Search appointments"},
                "post": {"summary": "Book appointment"},
            },
            "/appointments/{id}/confirm": {"post": {"summary": "Confirm"}},
            "/appointments/{id}/check-in": {"post": {"summary": "Check in"}},
            "/appointments/{id}/start": {"post": {"summary": "Start consultation"}},
            "/appointments/{id}/complete": {"post": {"summary": "Complete"}},
            "/appointments/{id}/cancel": {"post": {"summary": "Cancel"}},
            "/appointments/{id}/no-show": {"post": {"summary": "Mark no-show"}},
            "/appointments/{id}/reschedule": {"post": {"summary": "Reschedule"}},
            "/appointments/availability": {"get": {"summary": "Find slots"}},
            "/appointments/inquire": {"get": {"summary": "Unified inquiry"}},
            "/insurance/companies": {"get": {"summary": "Insurance companies"}},
            "/insurance/patients/{id}": {
                "get": {"summary": "Patient insurance"},
                "post": {"summary": "Add insurance"},
            },
            "/insurance/appointments/{id}/check": {"get": {"summary": "Acceptance check"}},
            "/insurance/extract-card": {"post": {"summary": "OCR insurance card"}},
            "/insurance/approvals/{id}/decision": {"post": {"summary": "Officer decision"}},
            "/documents/upload": {"post": {"summary": "Upload file"}},
            "/documents/{file_id}": {"get": {"summary": "Download file"}},
            "/notifications/": {"get": {"summary": "Inbox"}},
            "/reports/overview": {"get": {"summary": "Dashboard overview"}},
            "/reports/doctor-utilization": {"get": {"summary": "Doctor utilization"}},
            "/reports/kyc-funnel": {"get": {"summary": "KYC funnel"}},
            "/ai/chat": {"post": {"summary": "Send a chat message"}},
            "/ai/chat/{conversation_id}/confirm": {"post": {"summary": "Confirm destructive action"}},
            "/ai/conversations": {"get": {"summary": "List conversations"}},
            "/ai/tools": {"get": {"summary": "Tools available to current user"}},
            "/audit/": {"get": {"summary": "Audit log"}},
            "/health": {"get": {"summary": "Liveness"}},
            "/health/ready": {"get": {"summary": "Readiness"}},
        },
    }
