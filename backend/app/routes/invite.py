import base64
import json
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
    The link leads to the invite landing page with a base64-encoded code.
    """
    settings = get_settings()

    domain = invite.company_domain.strip().lower()

    # Check if org is already registered
    supabase = get_supabase()
    existing = supabase.table("organizations").select("id").eq("domain", domain).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="This organization is already registered on Stamp")

    # Get inviter's name
    profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
    inviter_name = profile.data[0]["full_name"] if profile.data else "Someone"

    # Encode invite data as URL-safe base64 code
    invite_data = json.dumps({
        "company": invite.company_name,
        "domain": domain,
        "from": inviter_name,
    })
    code = base64.urlsafe_b64encode(invite_data.encode()).decode().rstrip("=")
    invite_url = f"{settings.frontend_url}/invite/{code}"

    return {
        "invite_url": invite_url,
        "company_name": invite.company_name,
        "domain": domain,
    }


@router.get("/decode/{code}")
async def decode_invite(code: str):
    """Decode an invite code to get company info. Public endpoint."""
    try:
        # Add back padding
        padded = code + "=" * (4 - len(code) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded).decode())
        return {
            "company": data.get("company", ""),
            "domain": data.get("domain", ""),
            "from": data.get("from", "Someone"),
        }
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invite code")
