from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


# --- Employment Claims ---


class EmploymentClaimCreate(BaseModel):
    """User adding a new employment claim.
    No verifier_email — system routes to registered org automatically.
    company_domain comes from Clearbit autocomplete selection.
    """
    company_name: str
    company_domain: Optional[str] = None  # from Clearbit autocomplete
    title: str
    department: Optional[str] = None
    employment_type: str = "full_time"
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False


class EmploymentClaimUpdate(BaseModel):
    """User editing a claim. If verified, this resets verification."""
    company_name: Optional[str] = None
    company_domain: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None


class EmploymentClaimResponse(BaseModel):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    company_name: str
    company_domain: Optional[str] = None
    title: str
    department: Optional[str] = None
    employment_type: str
    start_date: date
    end_date: Optional[date] = None
    is_current: bool
    # Correction fields (from employer)
    corrected_title: Optional[str] = None
    corrected_start_date: Optional[date] = None
    corrected_end_date: Optional[date] = None
    corrected_by: Optional[str] = None
    correction_reason: Optional[str] = None
    # User denial
    user_denial_reason: Optional[str] = None
    # Dispute
    disputed_reason: Optional[str] = None
    previous_dispute_reason: Optional[str] = None
    dispute_count: int = 0
    # Status & verification
    status: str
    verified_at: Optional[datetime] = None
    verified_by_org: Optional[str] = None
    expired_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Education Claims ---


class EducationClaimCreate(BaseModel):
    """User adding a new education claim."""
    institution: str
    institution_domain: Optional[str] = None  # from HIPO/autocomplete
    degree: str
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class EducationClaimUpdate(BaseModel):
    institution: Optional[str] = None
    institution_domain: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class EducationClaimResponse(BaseModel):
    id: str
    user_id: str
    organization_id: Optional[str] = None
    institution: str
    institution_domain: Optional[str] = None
    degree: str
    field_of_study: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    # Correction fields
    corrected_degree: Optional[str] = None
    corrected_field: Optional[str] = None
    corrected_start_date: Optional[date] = None
    corrected_end_date: Optional[date] = None
    corrected_by: Optional[str] = None
    correction_reason: Optional[str] = None
    # User denial
    user_denial_reason: Optional[str] = None
    # Dispute
    disputed_reason: Optional[str] = None
    previous_dispute_reason: Optional[str] = None
    dispute_count: int = 0
    # Status & verification
    status: str
    verified_at: Optional[datetime] = None
    verified_by_org: Optional[str] = None
    expired_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# --- Verification Actions (used by org admin) ---


class VerifyAction(BaseModel):
    """Org admin confirms the claim as-is."""
    pass


class CorrectAndVerifyAction(BaseModel):
    """Org admin proposes corrections. Sent back to user for acceptance."""
    # Employment corrections
    corrected_title: Optional[str] = None
    corrected_start_date: Optional[date] = None
    corrected_end_date: Optional[date] = None
    # Education corrections
    corrected_degree: Optional[str] = None
    corrected_field: Optional[str] = None
    corrected_start_date: Optional[date] = None
    corrected_end_date: Optional[date] = None
    # Reason for correction
    correction_reason: Optional[str] = None


class DisputeAction(BaseModel):
    """Org admin disputes the claim entirely."""
    reason: str


class CorrectionResponse(BaseModel):
    """User responding to a proposed correction."""
    accept: bool
    denial_reason: Optional[str] = None  # required if accept=False
