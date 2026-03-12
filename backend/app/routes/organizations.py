from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.middleware.auth import get_current_user, get_current_org_admin
from app.services.storage import upload_org_logo
from app.models.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationPublic,
)
from app.config import get_supabase
from app.services.notifications import notify_user, notify_org_admin

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.post("/", response_model=OrganizationResponse)
async def register_organization(
    org: OrganizationCreate,
    user: dict = Depends(get_current_user),
):
    """Register a new organization.

    The user's email (from their JWT) becomes the admin_email.
    Domain must be unique — one registration per domain.
    """
    supabase = get_supabase()

    # Normalize domain to lowercase
    domain = org.domain.strip().lower()

    # Check if domain is already registered
    existing = (
        supabase.table("organizations")
        .select("id")
        .eq("domain", domain)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="An organization with this domain is already registered"
        )

    # Default verifier_email to admin's email if not provided
    verifier_email = (org.verifier_email or user["email"]).strip().lower()

    data = {
        "name": org.name.strip(),
        "domain": domain,
        "org_type": org.org_type,
        "admin_email": user["email"],
        "verifier_name": org.verifier_name,
        "verifier_email": verifier_email,
        "logo_url": org.logo_url,
    }

    result = supabase.table("organizations").insert(data).execute()
    new_org = result.data[0]

    # Auto-surface any existing claims that were awaiting this org
    _link_pending_claims(domain, new_org["id"], new_org["name"], user["email"])

    return new_org


def _link_pending_claims(domain: str, org_id: str, org_name: str, admin_email: str):
    """When an org registers, find all 'awaiting_org' claims that match
    this domain and link them to the new org."""
    supabase = get_supabase()

    # Match employment claims by company_domain
    emp_claims = (
        supabase.table("employment_claims")
        .select("id,user_id")
        .eq("company_domain", domain)
        .eq("status", "awaiting_org")
        .execute()
    )
    if emp_claims.data:
        for claim in emp_claims.data:
            supabase.table("employment_claims").update({
                "organization_id": org_id,
                "status": "awaiting_verification",
            }).eq("id", claim["id"]).execute()

            # Notify the user that their company has joined
            notify_user(
                user_id=claim["user_id"],
                type="org_registered",
                title=f"{org_name} has joined Stamp",
                message="Your claim has been sent for verification.",
                claim_id=claim["id"],
                claim_table="employment_claims",
            )

    # Match education claims by institution_domain
    edu_claims = (
        supabase.table("education_claims")
        .select("id,user_id")
        .eq("institution_domain", domain)
        .eq("status", "awaiting_org")
        .execute()
    )
    if edu_claims.data:
        for claim in edu_claims.data:
            supabase.table("education_claims").update({
                "organization_id": org_id,
                "status": "awaiting_verification",
            }).eq("id", claim["id"]).execute()

            notify_user(
                user_id=claim["user_id"],
                type="org_registered",
                title=f"{org_name} has joined Stamp",
                message="Your claim has been sent for verification.",
                claim_id=claim["id"],
                claim_table="education_claims",
            )

    # Notify the org admin about pending claims
    total_pending = len(emp_claims.data or []) + len(edu_claims.data or [])
    if total_pending > 0:
        notify_org_admin(
            org_admin_email=admin_email,
            type="new_verification_request",
            title=f"You have {total_pending} pending verification request{'s' if total_pending > 1 else ''}",
            message="Review them in your employer dashboard.",
        )


@router.get("/mine", response_model=OrganizationResponse)
async def get_my_organization(user: dict = Depends(get_current_org_admin)):
    """Get the org that the current admin manages."""
    return user["org"]


@router.put("/mine", response_model=OrganizationResponse)
async def update_my_organization(
    updates: OrganizationUpdate,
    user: dict = Depends(get_current_org_admin),
):
    """Update org details (name, verifier contact, logo)."""
    supabase = get_supabase()
    org = user["org"]

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "verifier_email" in update_data:
        update_data["verifier_email"] = update_data["verifier_email"].strip().lower()

    result = (
        supabase.table("organizations")
        .update(update_data)
        .eq("id", org["id"])
        .execute()
    )
    return result.data[0]


@router.post("/mine/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_org_admin),
):
    """Upload organization logo to Supabase Storage."""
    org = user["org"]
    logo_url = await upload_org_logo(org["id"], file)
    return {"logo_url": logo_url}


@router.get("/search")
async def search_organizations(q: str):
    """Search registered orgs by name (for the claim dropdown).
    Returns public info only — no admin emails.
    """
    if not q or len(q) < 2:
        return []

    try:
        supabase = get_supabase()
        result = (
            supabase.table("organizations")
            .select("id,name,domain,org_type,logo_url,is_domain_verified")
            .ilike("name", f"%{q}%")
            .limit(10)
            .execute()
        )
        return result.data or []
    except Exception:
        return []
