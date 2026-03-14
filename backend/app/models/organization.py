from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OrganizationCreate(BaseModel):
    """Sent by org admin when registering their company/university."""
    name: str
    domain: str                                   # e.g. "arytic.com", "stanford.edu"
    org_type: str = "company"                     # company | university | other
    verifier_name: Optional[str] = None           # name of verification contact
    verifier_email: Optional[str] = None          # defaults to admin_email if not provided
    logo_url: Optional[str] = None                # manual upload or Logo.dev URL


class OrganizationUpdate(BaseModel):
    """Org admin updating their org details."""
    name: Optional[str] = None
    verifier_name: Optional[str] = None
    verifier_email: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    domain: str
    org_type: str
    admin_email: str
    verifier_name: Optional[str] = None
    verifier_email: str
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    is_domain_verified: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OrganizationPublic(BaseModel):
    """Public-facing org info (no admin_email exposed)."""
    id: str
    name: str
    domain: str
    org_type: str
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    is_domain_verified: bool = False
