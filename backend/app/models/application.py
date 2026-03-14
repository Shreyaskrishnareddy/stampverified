from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


class ApplicationCreate(BaseModel):
    """Candidate applying to a job."""
    job_id: str
    cover_note: Optional[str] = None

    @field_validator("cover_note")
    @classmethod
    def cover_note_length(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 2000:
            raise ValueError("Cover note must be under 2,000 characters")
        return v


class ApplicationResponse(BaseModel):
    """Application record returned to candidates and employers."""
    id: str
    job_id: str
    candidate_id: str
    resume_snapshot_url: Optional[str] = None
    cover_note: Optional[str] = None
    status: str = "applied"
    applied_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Enriched fields (from joins)
    job_title: Optional[str] = None
    org_name: Optional[str] = None
    org_domain: Optional[str] = None
    candidate_name: Optional[str] = None
    candidate_headline: Optional[str] = None
    candidate_username: Optional[str] = None


class ApplicationStatusUpdate(BaseModel):
    """Employer updating application status."""
    status: Literal["shortlisted", "rejected"]


class CandidatePreferencesUpdate(BaseModel):
    """Update candidate preferences. Partial update."""
    open_to_work: Optional[bool] = None
    resume_visible: Optional[bool] = None
    preferred_functions: Optional[list[str]] = None  # list of job_function UUIDs


class CandidatePreferencesResponse(BaseModel):
    """Candidate preferences returned to the authenticated user."""
    user_id: str
    open_to_work: bool = False
    resume_url: Optional[str] = None
    resume_visible: bool = True
    preferred_functions: list[str] = []
    updated_at: Optional[datetime] = None
