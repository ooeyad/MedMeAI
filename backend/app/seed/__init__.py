"""Seed data orchestrator — realistic sample for the demo."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from flask import current_app
from sqlalchemy import select

from ..extensions import db
from ..models.appointment import Appointment, AppointmentStatus, AppointmentType, SourceChannel
from ..models.branch import Branch, BranchWorkingHours, Clinic, Room
from ..models.doctor import (
    Doctor,
    DoctorInsuranceNetwork,
    DoctorSchedule,
    Specialty,
)
from ..models.billing import Item, ItemCategory, ItemKind, PriceList, PriceListEntry
from ..models.insurance import InsuranceCompany, PatientInsurance, PatientInsuranceStatus
from ..models.patient import KycStatusEnum, Patient
from ..models.tenant import Tenant, TenantSettings
from ..models.user import Role, User
from ..rbac import PERMISSIONS
from ..utils.security import hash_password


def run_seed() -> dict:
    pw = current_app.config["SEED_DEFAULT_PASSWORD"]
    pw_hash = hash_password(pw)

    tenant = _seed_default_tenant()
    roles = _seed_roles()
    clinic, branches = _seed_clinic_and_branches(tenant_id=tenant.id)
    rooms = _seed_rooms(branches)
    specialties = _seed_specialties()
    insurances = _seed_insurance_companies()
    users_by_role = _seed_users(pw_hash, roles, branches, tenant_id=tenant.id)
    doctors = _seed_doctors(users_by_role, specialties, branches, insurances, tenant_id=tenant.id)
    patients = _seed_patients(users_by_role, tenant_id=tenant.id)
    _seed_doctor_schedules(doctors, branches)
    _seed_appointments(patients, doctors, branches, rooms)
    _seed_catalog(tenant_id=tenant.id)

    # Belt-and-braces backfill for any tenant-aware rows that pre-date the
    # tenant_id columns (or were created via APIs before scoping was tight).
    _backfill_tenant_ids(tenant.id)

    db.session.commit()
    return {
        "users": sum(len(v) for v in users_by_role.values()),
        "doctors": len(doctors),
        "patients": len(patients),
        "branches": len(branches),
        "appointments": db.session.scalar(select(db.func.count(Appointment.id))) or 0,
        "default_password": pw,
    }


def reset_seed() -> None:
    db.drop_all()
    db.create_all()


# ---------------------------------------------------------------------------
def _backfill_tenant_ids(tenant_id: int) -> None:
    """Set tenant_id on any tenant-aware rows that still have NULL.

    Previous seed runs created Doctor and Patient rows without a tenant_id,
    which made queries scoped by `WHERE tenant_id = X` return zero matches.
    This idempotent pass assigns the default tenant to anything stranded.
    """
    from ..models.appointment import Appointment
    from ..models.branch import Branch
    from ..models.doctor import Doctor
    from ..models.patient import Patient
    from ..models.user import User

    for model in (Doctor, Patient, Branch, Appointment, User):
        if not hasattr(model, "tenant_id"):
            continue
        rows = db.session.scalars(select(model).where(model.tenant_id.is_(None))).all()
        for r in rows:
            r.tenant_id = tenant_id


# ---------------------------------------------------------------------------
def _seed_catalog(*, tenant_id: int) -> None:
    """Seed item categories + items + default price list."""
    cat_specs = [
        ("Consultations", ItemKind.CONSULTATION),
        ("Medications", ItemKind.MEDICATION),
        ("Lab Tests", ItemKind.LAB_TEST),
        ("Imaging", ItemKind.IMAGING),
        ("Procedures", ItemKind.PROCEDURE),
    ]
    cats: dict[str, ItemCategory] = {}
    for name, kind in cat_specs:
        existing = db.session.scalar(
            select(ItemCategory).where(ItemCategory.tenant_id == tenant_id, ItemCategory.name == name)
        )
        if existing is None:
            existing = ItemCategory(tenant_id=tenant_id, name=name, kind=kind)
            db.session.add(existing)
            db.session.flush()
        cats[name] = existing

    item_specs = [
        ("CONS-GP", "General consultation", ItemKind.CONSULTATION, "Consultations", 35.0, "visit"),
        ("CONS-SPC", "Specialist consultation", ItemKind.CONSULTATION, "Consultations", 50.0, "visit"),
        ("CONS-FU", "Follow-up consultation", ItemKind.CONSULTATION, "Consultations", 25.0, "visit"),
        ("MED-PARA-500", "Paracetamol 500mg", ItemKind.MEDICATION, "Medications", 2.0, "tab"),
        ("MED-AMOX-500", "Amoxicillin 500mg", ItemKind.MEDICATION, "Medications", 6.0, "course"),
        ("MED-IBU-400", "Ibuprofen 400mg", ItemKind.MEDICATION, "Medications", 3.0, "tab"),
        ("MED-LISIN-10", "Lisinopril 10mg", ItemKind.MEDICATION, "Medications", 8.0, "month"),
        ("LAB-CBC", "CBC (Complete Blood Count)", ItemKind.LAB_TEST, "Lab Tests", 15.0, "test"),
        ("LAB-LIPID", "Lipid Panel", ItemKind.LAB_TEST, "Lab Tests", 18.0, "test"),
        ("LAB-HBA1C", "HbA1c", ItemKind.LAB_TEST, "Lab Tests", 12.0, "test"),
        ("IMG-CXR", "Chest X-ray", ItemKind.IMAGING, "Imaging", 25.0, "study"),
        ("IMG-USG-ABD", "Abdominal Ultrasound", ItemKind.IMAGING, "Imaging", 40.0, "study"),
        ("PROC-ECG", "ECG (12-lead)", ItemKind.PROCEDURE, "Procedures", 20.0, "test"),
        ("PROC-DRESS", "Wound dressing", ItemKind.PROCEDURE, "Procedures", 15.0, "visit"),
    ]
    for sku, name, kind, cat_name, price, unit in item_specs:
        existing = db.session.scalar(
            select(Item).where(Item.tenant_id == tenant_id, Item.sku == sku)
        )
        if existing is None:
            db.session.add(Item(
                tenant_id=tenant_id, category_id=cats[cat_name].id,
                sku=sku, name=name, kind=kind,
                default_price=price, unit=unit,
                is_active=True, is_taxable=False,
            ))

    # Default price list
    pl = db.session.scalar(
        select(PriceList).where(PriceList.tenant_id == tenant_id, PriceList.is_default == True)
    )
    if pl is None:
        pl = PriceList(tenant_id=tenant_id, code="standard", name="Standard rates",
                       currency="JOD", is_default=True, is_active=True)
        db.session.add(pl)


def _seed_default_tenant() -> Tenant:
    t = db.session.scalar(select(Tenant).where(Tenant.slug == "default"))
    if t is None:
        t = Tenant(slug="default", name="MedMe Health Network", name_ar="شبكة ميدمي الصحية", is_active=True)
        db.session.add(t)
        db.session.flush()
    if db.session.scalar(select(TenantSettings).where(TenantSettings.tenant_id == t.id)) is None:
        db.session.add(TenantSettings(
            tenant_id=t.id,
            primary_color="#14b8a6",
            accent_color="#0ea5e9",
            tagline="Medical Appointment Platform",
            default_timezone="Asia/Amman",
            default_language="en",
            supported_languages=["en", "ar"],
            currency="JOD",
            appointment_slot_minutes_default=30,
            features={
                "telemedicine": False,
                "ai_assistant": True,
                "patient_self_registration": True,
                "require_kyc_before_booking": False,
            },
            support_email="support@medme.ai",
            support_phone="+962-6-500-0000",
            website_url="https://medme.ai",
        ))
    return t


def _seed_roles():
    role_data = [
        ("super_admin", "Super Admin"),
        ("clinic_admin", "Clinic Admin"),
        ("secretary", "Secretary"),
        ("doctor", "Doctor"),
        ("nurse", "Nurse"),
        ("insurance_officer", "Insurance Officer"),
        ("patient", "Patient"),
        ("auditor", "Auditor"),
    ]
    out: dict[str, Role] = {}
    for code, name in role_data:
        existing = db.session.scalar(select(Role).where(Role.code == code))
        if existing is None:
            existing = Role(code=code, name=name)
            db.session.add(existing)
            db.session.flush()
        out[code] = existing
    return out


def _seed_clinic_and_branches(*, tenant_id: int | None = None):
    clinic = db.session.scalar(select(Clinic).where(Clinic.name == "MedMe Health Network"))
    if clinic is None:
        clinic = Clinic(
            tenant_id=tenant_id,
            name="MedMe Health Network", name_ar="شبكة ميدمي الصحية", timezone="Asia/Amman",
        )
        db.session.add(clinic)
        db.session.flush()
    elif clinic.tenant_id is None and tenant_id is not None:
        clinic.tenant_id = tenant_id
    branch_specs = [
        ("Amman Main", "عمان الرئيسي", "Wasfi Al-Tal St", "Amman", "Jordan", "+962-6-555-1000"),
        ("Irbid Branch", "فرع إربد", "University St", "Irbid", "Jordan", "+962-2-555-2000"),
    ]
    branches = []
    for name, name_ar, addr, city, country, phone in branch_specs:
        b = db.session.scalar(select(Branch).where(Branch.name == name))
        if b is None:
            b = Branch(
                clinic_id=clinic.id, name=name, name_ar=name_ar, address=addr,
                city=city, country=country, phone=phone, is_active=True,
            )
            db.session.add(b)
            db.session.flush()
            for weekday in range(0, 5):  # Mon-Fri
                db.session.add(BranchWorkingHours(
                    branch_id=b.id, weekday=weekday, open_time=time(8, 0), close_time=time(18, 0),
                ))
            db.session.add(BranchWorkingHours(branch_id=b.id, weekday=5, open_time=time(9, 0), close_time=time(14, 0)))  # Sat
        branches.append(b)
    return clinic, branches


def _seed_rooms(branches):
    rooms = []
    for b in branches:
        for i in range(1, 4):
            existing = db.session.scalar(select(Room).where(Room.branch_id == b.id, Room.name == f"Room {i}"))
            if existing is None:
                existing = Room(branch_id=b.id, name=f"Room {i}", kind="consultation")
                db.session.add(existing)
                db.session.flush()
            rooms.append(existing)
    return rooms


def _seed_specialties():
    specs = [
        ("cardiology", "Cardiology", "أمراض القلب"),
        ("dermatology", "Dermatology", "الجلدية"),
        ("pediatrics", "Pediatrics", "الأطفال"),
        ("orthopedics", "Orthopedics", "العظام"),
        ("internal_medicine", "Internal Medicine", "الباطنية"),
    ]
    out = {}
    for slug, name, name_ar in specs:
        s = db.session.scalar(select(Specialty).where(Specialty.slug == slug))
        if s is None:
            s = Specialty(slug=slug, name=name, name_ar=name_ar)
            db.session.add(s)
            db.session.flush()
        out[slug] = s
    return out


def _seed_insurance_companies():
    companies = [
        ("NEWTON", "Newton Health", "نيوتن"),
        ("ALICO", "Allied Insurance Co", "أليكو"),
        ("MEDGLOBAL", "Med Global", "ميد جلوبال"),
    ]
    out = []
    for code, name, name_ar in companies:
        c = db.session.scalar(select(InsuranceCompany).where(InsuranceCompany.code == code))
        if c is None:
            c = InsuranceCompany(code=code, name=name, name_ar=name_ar, active=True)
            db.session.add(c)
            db.session.flush()
        out.append(c)
    return out


def _seed_users(pw_hash, roles, branches, *, tenant_id: int | None = None):
    user_specs = [
        ("admin@medme.ai", "MedMe Admin", "super_admin"),
        ("clinic.admin@medme.ai", "Lina Admin", "clinic_admin"),
        ("secretary@medme.ai", "Rana Secretary", "secretary"),
        ("dr.sami@medme.ai", "Sami Khalil", "doctor"),
        ("dr.lina@medme.ai", "Lina Haddad", "doctor"),
        ("nurse@medme.ai", "Khalid Nurse", "nurse"),
        ("insurance@medme.ai", "Ola Insurance", "insurance_officer"),
        ("ahmad.ali@example.com", "Ahmad Ali", "patient"),
        ("reem.said@example.com", "Reem Said", "patient"),
        ("auditor@medme.ai", "Auditor Bot", "auditor"),
    ]
    out: dict[str, list[User]] = {}
    for email, name, role_code in user_specs:
        u = db.session.scalar(select(User).where(User.email == email))
        if u is None:
            u = User(
                tenant_id=tenant_id,
                email=email, full_name=name, password_hash=pw_hash, is_active=True,
                preferred_language="ar" if "ola" in email or "rana" in email else "en",
            )
            u.roles = [roles[role_code]]
            if role_code in {"clinic_admin", "secretary"}:
                u.branches = [branches[0]]
            db.session.add(u)
            db.session.flush()
        elif u.tenant_id is None and tenant_id is not None:
            u.tenant_id = tenant_id
        out.setdefault(role_code, []).append(u)
    return out


def _seed_doctors(users_by_role, specialties, branches, insurances, tenant_id):
    out = []
    pairs = [
        (users_by_role["doctor"][0], [specialties["cardiology"], specialties["internal_medicine"]], "LIC-CARD-001"),
        (users_by_role["doctor"][1], [specialties["dermatology"]], "LIC-DERM-001"),
    ]
    for user, specs, license_no in pairs:
        d = db.session.scalar(select(Doctor).where(Doctor.user_id == user.id))
        if d is None:
            d = Doctor(
                tenant_id=tenant_id,
                user_id=user.id, license_number=license_no, years_of_experience=12,
                languages=["en", "ar"], consultation_fee=45.0,
                appointment_duration_minutes=30, online_appointments=True,
                bio=f"{user.full_name}, specialist physician.",
            )
            d.specialties = specs
            d.branches = list(branches)
            db.session.add(d)
            db.session.flush()
            for ins in insurances[:2]:
                db.session.add(DoctorInsuranceNetwork(
                    doctor_id=d.id, insurance_company_id=ins.id, accepts=True, network_tier="standard",
                ))
        elif d.tenant_id is None:
            # Backfill tenant_id on existing seed data (older runs created rows
            # without it, which broke tenant-scoped queries for patients).
            d.tenant_id = tenant_id
        out.append(d)
    return out


def _seed_patients(users_by_role, tenant_id):
    patients_data = [
        (users_by_role["patient"][0], "Ahmad Ali", "أحمد علي", "0791234567", "9991122334", date(1988, 4, 12), "male"),
        (users_by_role["patient"][1], "Reem Said", "ريم سعيد", "0792233445", "9992233445", date(1992, 1, 25), "female"),
    ]
    out = []
    for user, name_en, name_ar, phone, nid, dob, gender in patients_data:
        p = db.session.scalar(select(Patient).where(Patient.user_id == user.id))
        if p is None:
            seq = (db.session.scalar(select(db.func.coalesce(db.func.max(Patient.id), 0))) or 0) + 1
            p = Patient(
                tenant_id=tenant_id,
                code=f"PAT-{seq:07d}", user_id=user.id,
                full_name_en=name_en, full_name_ar=name_ar,
                phone=phone, national_id=nid, date_of_birth=dob, gender=gender,
                blood_type="O+",
                allergies=["penicillin"] if "ali" in name_en.lower() else [],
                chronic_diseases=["hypertension"] if "ali" in name_en.lower() else [],
                current_medications=["lisinopril 10mg"] if "ali" in name_en.lower() else [],
                medical_history_summary="Patient profile for demonstration purposes.",
                kyc_status=KycStatusEnum.VERIFIED,
                consent_treatment=True, consent_data_sharing=True,
            )
            db.session.add(p)
            db.session.flush()
        elif p.tenant_id is None:
            p.tenant_id = tenant_id
        out.append(p)
    return out


def _seed_doctor_schedules(doctors, branches):
    for d in doctors:
        for b in branches:
            for weekday in range(0, 5):
                exists = db.session.scalar(select(DoctorSchedule).where(
                    DoctorSchedule.doctor_id == d.id,
                    DoctorSchedule.branch_id == b.id,
                    DoctorSchedule.weekday == weekday,
                ))
                if exists is None:
                    db.session.add(DoctorSchedule(
                        doctor_id=d.id, branch_id=b.id, weekday=weekday,
                        start_time=time(9, 0), end_time=time(17, 0),
                        slot_minutes=30, is_active=True,
                    ))


def _seed_appointments(patients, doctors, branches, rooms):
    now = datetime.now(timezone.utc).replace(microsecond=0, second=0, minute=0)
    samples = [
        (patients[0], doctors[0], branches[0], now + timedelta(hours=4), AppointmentStatus.CONFIRMED, "chest pain on exertion"),
        (patients[0], doctors[0], branches[0], now + timedelta(days=1, hours=2), AppointmentStatus.REQUESTED, "follow-up review"),
        (patients[1], doctors[1], branches[0], now + timedelta(hours=2), AppointmentStatus.CONFIRMED, "skin rash check"),
        (patients[1], doctors[1], branches[1], now + timedelta(days=2, hours=3), AppointmentStatus.PENDING_CONFIRMATION, "follow-up"),
    ]
    for i, (patient, doctor, branch, dt, status, reason) in enumerate(samples, start=1):
        existing = db.session.scalar(select(Appointment).where(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == doctor.id,
            Appointment.starts_at == dt,
        ))
        if existing:
            continue
        seq = (db.session.scalar(select(db.func.coalesce(db.func.max(Appointment.id), 0))) or 0) + 1
        appt = Appointment(
            code=f"APT-{dt.strftime('%Y%m%d')}-{seq:05d}",
            patient_id=patient.id, doctor_id=doctor.id, branch_id=branch.id,
            room_id=rooms[0].id, appointment_type=AppointmentType.NEW_CONSULTATION,
            status=status, starts_at=dt, ends_at=dt + timedelta(minutes=30),
            duration_minutes=30, reason=reason, source_channel=SourceChannel.SECRETARY,
        )
        db.session.add(appt)
