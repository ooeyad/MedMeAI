from app.rbac import Role, has_permission


def test_super_admin_can_do_anything():
    assert has_permission([Role.SUPER_ADMIN], "appointments:write")
    assert has_permission([Role.SUPER_ADMIN], "audit:read")


def test_patient_cannot_audit():
    assert not has_permission([Role.PATIENT], "audit:read")


def test_secretary_can_book_appointments():
    assert has_permission([Role.SECRETARY], "appointments:write")


def test_doctor_can_only_self_for_appointments_write():
    assert has_permission([Role.DOCTOR], "appointments:write:self")
