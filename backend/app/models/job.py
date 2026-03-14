from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


class JobCreate(BaseModel):
    """Data submitted when a company member posts a new job.

    salary_min and salary_max are required — pay transparency is a trust signal.
    job_function_id is auto-detected from title and should NOT be provided
    by the client. If provided, it is used as-is (for manual override).
    """
    title: str
    description: str
    location: Optional[str] = None
    location_type: Literal["remote", "hybrid", "onsite"] = "onsite"
    employment_type: Literal["full_time", "part_time", "contract", "internship"] = "full_time"
    experience_level: Literal["entry", "mid", "senior", "lead", "executive"] = "mid"
    salary_min: int
    salary_max: int
    salary_currency: str = "USD"
    show_poc_name: bool = False
    poc_member_id: Optional[str] = None
    job_function_id: Optional[str] = None          # auto-detected if not provided

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Job title is required")
        if len(v) > 255:
            raise ValueError("Job title must be under 255 characters")
        return v

    @field_validator("salary_max")
    @classmethod
    def salary_max_gte_min(cls, v: int, info) -> int:
        salary_min = info.data.get("salary_min", 0)
        if v < salary_min:
            raise ValueError("Maximum salary must be greater than or equal to minimum")
        return v

    @field_validator("salary_min")
    @classmethod
    def salary_min_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Salary cannot be negative")
        return v

    @field_validator("salary_currency")
    @classmethod
    def currency_uppercase(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) != 3:
            raise ValueError("Currency must be a 3-letter code (e.g., USD)")
        return v


class JobUpdate(BaseModel):
    """Partial update for an existing job posting."""
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    location_type: Optional[Literal["remote", "hybrid", "onsite"]] = None
    employment_type: Optional[Literal["full_time", "part_time", "contract", "internship"]] = None
    experience_level: Optional[Literal["entry", "mid", "senior", "lead", "executive"]] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_currency: Optional[str] = None
    show_poc_name: Optional[bool] = None
    poc_member_id: Optional[str] = None
    status: Optional[Literal["draft", "active", "paused", "closed", "filled"]] = None


class JobResponse(BaseModel):
    """Full job record returned to authenticated employer users."""
    id: str
    organization_id: str
    posted_by: Optional[str] = None
    poc_member_id: Optional[str] = None
    title: str
    job_function_id: Optional[str] = None
    description: str
    location: Optional[str] = None
    location_type: str = "onsite"
    employment_type: str = "full_time"
    experience_level: str = "mid"
    salary_min: int
    salary_max: int
    salary_currency: str = "USD"
    show_poc_name: bool = False
    status: str = "active"
    posted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Enriched fields (from joins)
    org_name: Optional[str] = None
    org_domain: Optional[str] = None
    org_logo_url: Optional[str] = None
    poster_email: Optional[str] = None
    poc_email: Optional[str] = None
    poc_name: Optional[str] = None
    job_function_name: Optional[str] = None
    job_function_category: Optional[str] = None


class JobPublic(BaseModel):
    """Public-facing job data for the jobs feed and detail page.

    No internal IDs, no poster emails, no sensitive data.
    POC name visibility is controlled by show_poc_name and caller's
    verification status.
    """
    id: str
    title: str
    description: str
    location: Optional[str] = None
    location_type: str = "onsite"
    employment_type: str = "full_time"
    experience_level: str = "mid"
    salary_min: int
    salary_max: int
    salary_currency: str = "USD"
    status: str = "active"
    posted_at: Optional[datetime] = None

    # Company info
    org_name: Optional[str] = None
    org_domain: Optional[str] = None
    org_logo_url: Optional[str] = None

    # POC info (conditionally populated based on visibility rules)
    poc_name: Optional[str] = None
    show_poc_name: bool = False

    # Function (for filtering)
    job_function_name: Optional[str] = None
    job_function_slug: Optional[str] = None
    job_function_category: Optional[str] = None


class JobFunctionResponse(BaseModel):
    """A job function from the taxonomy."""
    id: str
    name: str
    slug: str
    category: str
    sort_order: int = 0
