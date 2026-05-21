"""Validate appointment state-machine guards."""
from app.models.appointment import ALLOWED_TRANSITIONS, AppointmentStatus


def test_completed_is_terminal():
    assert ALLOWED_TRANSITIONS[AppointmentStatus.COMPLETED] == set()


def test_no_jumping_to_completed():
    # Must go through IN_CONSULTATION
    assert AppointmentStatus.COMPLETED not in ALLOWED_TRANSITIONS[AppointmentStatus.CONFIRMED]
    assert AppointmentStatus.COMPLETED in ALLOWED_TRANSITIONS[AppointmentStatus.IN_CONSULTATION]


def test_cancel_paths():
    assert AppointmentStatus.CANCELLED in ALLOWED_TRANSITIONS[AppointmentStatus.CONFIRMED]
    assert AppointmentStatus.CANCELLED in ALLOWED_TRANSITIONS[AppointmentStatus.REQUESTED]
