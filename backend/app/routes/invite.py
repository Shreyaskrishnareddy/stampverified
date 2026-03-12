import secrets
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.middleware.auth import get_current_user
from app.config import get_supabase, get_settings

router = APIRouter(prefix="/api/invite", tags=["invite"])


class InviteRequest(BaseModel):
    company_name: str
    company_domain: str


@router.post("/generate")
async def generate_invite_link(
    invite: InviteRequest,
    user: dict = Depends(get_current_user),
):
    """Generate a shareable invite link for a company not yet on Stamp.

    Returns a URL the user can copy and send to anyone at the company.
    The link leads to the org registration page with pre-filled info.
    """
    settings = get_settings()

    # Create a simple invite code (domain-based, not random — so same company gets same link)
    domain = invite.company_domain.strip().lower()

    # Check if org is already registered
    supabase = get_supabase()
    existing = supabase.table("organizations").select("id").eq("domain", domain).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="This organization is already registered on Stamp")

    # Get inviter's name
    profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
    inviter_name = profile.data[0]["full_name"] if profile.data else "Someone"

    # The invite link encodes the company info in query params
    # No database entry needed — keeps it simple
    params = urlencode({
        "company": invite.company_name,
        "domain": domain,
        "from": inviter_name,
    })
    invite_url = f"{settings.frontend_url}/invite?{params}"

    return {
        "invite_url": invite_url,
        "company_name": invite.company_name,
        "domain": domain,
    }
