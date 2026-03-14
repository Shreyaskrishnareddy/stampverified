from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class CompanyMemberResponse(BaseModel):
    """Full company member record returned to authenticated employer users."""
    id: str
    organization_id: str
    user_id: str
    email: str
    role: str                                      # admin | member
    can_post_jobs: bool = False
    can_verify_claims: bool = False
    status: str = "active"                         # invited | active | deactivated
    invited_by: Optional[str] = None
    notification_preferences: Optional[dict] = None
    joined_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    # Organization info (populated via join)
    org_name: Optional[str] = None
    org_domain: Optional[str] = None
    org_logo_url: Optional[str] = None


class CompanyMemberPublic(BaseModel):
    """Public-facing member info. No emails, no permissions exposed."""
    id: str
    role: str
    full_name: Optional[str] = None                # from profile join
    org_name: Optional[str] = None
    org_domain: Optional[str] = None


class CompanyMemberInvite(BaseModel):
    """Admin inviting a new member to the workspace."""
    email: str
    can_post_jobs: bool = False
    can_verify_claims: bool = False

    @field_validator("email")
    @classmethod
    def email_must_be_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address")
        return v


class CompanyMemberPermissionUpdate(BaseModel):
    """Admin updating a member's permissions."""
    can_post_jobs: Optional[bool] = None
    can_verify_claims: Optional[bool] = None
    role: Optional[str] = None                     # only admin can promote to admin

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("admin", "member"):
            raise ValueError("Role must be 'admin' or 'member'")
        return v


class WorkspaceJoinRequest(BaseModel):
    """A user requesting to join a company workspace.
    The email comes from their JWT — this model carries no data.
    Kept as an explicit model for API clarity.
    """
    pass


class NotificationPreferencesUpdate(BaseModel):
    """Update notification preferences. Partial update — only include
    channels/events you want to change."""
    in_app: Optional[dict] = None                  # {"new_application": true, ...}
    email: Optional[dict] = None                   # {"new_application": false, ...}
