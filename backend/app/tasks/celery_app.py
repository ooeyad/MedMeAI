"""Celery application setup that lives inside the Flask app context."""
from __future__ import annotations

import os

from celery import Celery
from celery.schedules import crontab

from app import create_app


def make_celery(app=None):
    app = app or create_app(os.getenv("FLASK_ENV", "development"))
    celery_app = Celery(
        app.import_name,
        broker=app.config["CELERY_BROKER_URL"],
        backend=app.config["CELERY_RESULT_BACKEND"],
    )
    celery_app.conf.update(app.config)
    celery_app.conf.beat_schedule = {
        "appointment-reminder-sweep": {
            "task": "app.tasks.notification_tasks.sweep_reminders",
            "schedule": crontab(minute="*/15"),
        },
        "kyc-doc-expiry-sweep": {
            "task": "app.tasks.maintenance_tasks.sweep_kyc_expiry",
            "schedule": crontab(hour=2, minute=0),
        },
    }

    class FlaskTask(celery_app.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = FlaskTask
    # Ensure tasks modules are imported so Celery registers them
    from . import notification_tasks  # noqa: F401
    from . import maintenance_tasks  # noqa: F401
    return celery_app


celery = make_celery()
