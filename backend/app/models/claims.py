from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class EmploymentClaimCreate(BaseModel):
    company_name: str
    title: str
    department: Optional[str] = None
    employment_type: str = "full_time"
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    verifier_email: Optional[str] = None


class EmploymentClaimUpdate(BaseModel):
    company_name: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    verifier_email: Optional[str] = None


class EmploymentClaimResponse(BaseModel):
    id: str
    user_id: str
    company_name: str
    title: str
    department: Optional[str] = None
    employment_type: str
    start_date: date
    end_date: Optional[date] = None
    is_current: bool
    status: str
    verified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class EducationClaimCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    year_started: Optional[int] = None
    year_completed: Optional[int] = None
    verifier_email: Optional[str] = None


class EducationClaimUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    year_started: Optional[int] = None
    year_completed: Optional[int] = None
    verifier_email: Optional[str] = None


class EducationClaimResponse(BaseModel):
    id: str
    user_id: str
    institution: str
    degree: str
    field_of_study: Optional[str] = None
    year_started: Optional[int] = None
    year_completed: Optional[int] = None
    status: str
    verified_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class VerificationAction(BaseModel):
    action: str  # "verify" or "dispute"
    reason: Optional[str] = None  # required if dispute
