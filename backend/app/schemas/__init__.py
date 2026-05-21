"""Marshmallow schemas for request/response shapes."""
from .appointment import (
    AppointmentCreateSchema,
    AppointmentInquirySchema,
    AppointmentRescheduleSchema,
    AppointmentSchema,
    AppointmentTransitionSchema,
)
from .auth import LoginSchema, PasswordResetSchema, RefreshSchema
from .branch import BranchSchema, RoomSchema
from .common import PageSchema
from .doctor import DoctorSchema, ScheduleSchema, SpecialtySchema
from .insurance import (
    InsuranceApprovalDecisionSchema,
    InsuranceApprovalSchema,
    InsuranceCompanySchema,
    PatientInsuranceSchema,
)
from .kyc import KycDecisionSchema, KycVerificationSchema
from .patient import PatientCreateSchema, PatientSchema, PatientUpdateSchema

__all__ = [
    "AppointmentCreateSchema",
    "AppointmentInquirySchema",
    "AppointmentRescheduleSchema",
    "AppointmentSchema",
    "AppointmentTransitionSchema",
    "BranchSchema",
    "DoctorSchema",
    "InsuranceApprovalDecisionSchema",
    "InsuranceApprovalSchema",
    "InsuranceCompanySchema",
    "KycDecisionSchema",
    "KycVerificationSchema",
    "LoginSchema",
    "PageSchema",
    "PasswordResetSchema",
    "PatientCreateSchema",
    "PatientInsuranceSchema",
    "PatientSchema",
    "PatientUpdateSchema",
    "RefreshSchema",
    "RoomSchema",
    "ScheduleSchema",
    "SpecialtySchema",
]
