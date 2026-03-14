"""Company directory, company requests, and saved companies.

Public routes for browsing companies.
Authenticated routes for requesting and saving companies.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from typing import Optional
from app.middleware.auth import get_current_user
from app.config import get_supabase

router = APIRouter(tags=["companies"])


# ─── Models ──────────────────────────────────────────────────────────────────

class CompanyRequestCreate(BaseModel):
    company_name: str
    company_domain: str
    company_website: Optional[str] = None

    @field_validator("company_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Company name is required")
        return v

    @field_validator("company_domain")
    @classmethod
    def domain_valid(cls, v: str) -> str:
        v = v.strip().lower()
        if not v or "." not in v:
            raise ValueError("Valid domain is required (e.g., company.com)")
        return v


# ─── Companies Directory ─────────────────────────────────────────────────────


@router.get("/api/companies")
async def list_companies(
    q: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List registered companies. Public — no auth required.

    Optionally search by name. Returns company info + job count.
    """
    supabase = get_supabase()

    query = (
        supabase.table("organizations")
        .select("id,name,domain,org_type,logo_url,website_url,created_at")
        .order("name")
    )

    if q and len(q) >= 2:
        query = query.ilike("name", f"%{q}%")

    query = query.range(offset, offset + limit - 1)
    result = query.execute()

    companies = []
    for org in (result.data or []):
        # Get active job count
        jobs_count = (
            supabase.table("jobs")
            .select("id", count="exact")
            .eq("organization_id", org["id"])
            .eq("status", "active")
            .execute()
        )

        # Get verified employee count
        emp_count = (
            supabase.table("employment_claims")
            .select("id", count="exact")
            .eq("organization_id", org["id"])
            .eq("status", "verified")
            .execute()
        )

        companies.append({
            "id": org["id"],
            "name": org["name"],
            "domain": org["domain"],
            "org_type": org["org_type"],
            "logo_url": org.get("logo_url"),
            "website_url": org.get("website_url"),
            "member_since": org.get("created_at"),
            "active_job_count": jobs_count.count or 0,
            "verified_employee_count": emp_count.count or 0,
        })

    return companies


# ─── Company Requests ─────────────────────────────────────────────────────────


@router.post("/api/companies/request")
async def request_company(
    req: CompanyRequestCreate,
    user: dict = Depends(get_current_user),
):
    """Request to add a company not found in Clearbit.

    Creates a pending request for manual review by the Stamp team.
    """
    supabase = get_supabase()

    # Check if this domain is already registered
    existing_org = (
        supabase.table("organizations")
        .select("id,name")
        .eq("domain", req.company_domain)
        .execute()
    )
    if existing_org.data:
        raise HTTPException(
            status_code=400,
            detail=f"{existing_org.data[0]['name']} is already registered on Stamp"
        )

    # Check for existing pending request for this domain
    existing_req = (
        supabase.table("company_requests")
        .select("id")
        .eq("company_domain", req.company_domain)
        .eq("status", "pending")
        .execute()
    )
    if existing_req.data:
        raise HTTPException(
            status_code=400,
            detail="A request for this company is already pending review"
        )

    data = {
        "requested_by": user["id"],
        "requester_email": user["email"],
        "company_name": req.company_name,
        "company_domain": req.company_domain,
        "company_website": req.company_website,
        "status": "pending",
    }

    result = supabase.table("company_requests").insert(data).execute()

    return {
        "detail": f"Request submitted for {req.company_name}. We'll review and notify you.",
        "request": result.data[0] if result.data else data,
    }


@router.get("/api/companies/requests/mine")
async def get_my_requests(user: dict = Depends(get_current_user)):
    """Get the current user's company requests."""
    supabase = get_supabase()

    result = (
        supabase.table("company_requests")
        .select("*")
        .eq("requested_by", user["id"])
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


# ─── Saved Companies ─────────────────────────────────────────────────────────


@router.post("/api/companies/{org_id}/save")
async def save_company(org_id: str, user: dict = Depends(get_current_user)):
    """Save/follow a company. Get notified when they post new jobs."""
    supabase = get_supabase()

    # Check org exists
    org = supabase.table("organizations").select("id").eq("id", org_id).execute()
    if not org.data:
        raise HTTPException(status_code=404, detail="Company not found")

    # Check if already saved
    existing = (
        supabase.table("saved_companies")
        .select("id")
        .eq("user_id", user["id"])
        .eq("organization_id", org_id)
        .execute()
    )
    if existing.data:
        return {"detail": "Already saved", "saved": True}

    supabase.table("saved_companies").insert({
        "user_id": user["id"],
        "organization_id": org_id,
    }).execute()

    return {"detail": "Company saved", "saved": True}


@router.delete("/api/companies/{org_id}/save")
async def unsave_company(org_id: str, user: dict = Depends(get_current_user)):
    """Unsave/unfollow a company."""
    supabase = get_supabase()

    supabase.table("saved_companies").delete().eq(
        "user_id", user["id"]
    ).eq("organization_id", org_id).execute()

    return {"detail": "Company unfollowed", "saved": False}
