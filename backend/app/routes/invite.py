import hmac
import hashlib
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


def _sign_payload(payload: str, secret: str) -> str:
    """Create HMAC-SHA256 signature for a payload."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


@router.post("/generate")
async def generate_invite_link(
    invite: InviteRequest,
    user: dict = Depends(get_current_user),
):
    """Generate an HMAC-signed invite link for a company not yet on Stamp."""
    settings = get_settings()
    if not settings.invite_hmac_secret:
        raise HTTPException(status_code=500, detail="Invite signing is not configured")

    domain = invite.company_domain.strip().lower()

    # Check if org is already registered
    supabase = get_supabase()
    existing = supabase.table("organizations").select("id").eq("domain", domain).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="This organization is already registered on Stamp")

    # Get inviter's name
    profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
    inviter_name = profile.data[0]["full_name"] if profile.data else "Someone"

    # HMAC-sign the invite payload
    invite_data = json.dumps({
        "company": invite.company_name,
        "domain": domain,
        "from": inviter_name,
    }, separators=(",", ":"))  # compact JSON for consistent signing
    payload_b64 = base64.urlsafe_b64encode(invite_data.encode()).decode().rstrip("=")
    signature = _sign_payload(payload_b64, settings.invite_hmac_secret)
    code = f"{payload_b64}.{signature}"
    invite_url = f"{settings.frontend_url}/invite/{code}"

    return {
        "invite_url": invite_url,
        "company_name": invite.company_name,
        "domain": domain,
    }


@router.get("/decode/{code:path}")
async def decode_invite(code: str):
    """Decode and verify an HMAC-signed invite code. Public endpoint."""
    settings = get_settings()

    parts = code.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid invite link")

    payload_b64, signature = parts

    # Verify HMAC signature
    expected_sig = _sign_payload(payload_b64, settings.invite_hmac_secret)
    if not hmac.compare_digest(signature, expected_sig):
        raise HTTPException(status_code=400, detail="Invalid or tampered invite link")

    try:
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded).decode())
        return {
            "company": data.get("company", ""),
            "domain": data.get("domain", ""),
            "from": data.get("from", "Someone"),
        }
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid invite link")
