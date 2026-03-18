"""Job posting and browsing routes.

Two sections:
  1. Employer routes (/api/employer/jobs/*) — create, update, close, list org jobs
  2. Public routes (/api/jobs/*) — browse and search active jobs

URL prefix: /api
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from app.middleware.auth import (
    get_current_user,
    get_current_company_member,
    require_permission,
    require_domain_verified,
)
from app.models.job import JobCreate, JobUpdate
from app.config import get_supabase
from app.services.job_functions import detect_job_function, get_all_functions
from app.services.jd_extract import extract_from_text
from app.services.url_import import is_url, extract_from_url

router = APIRouter(tags=["jobs"])

JOB_EXPIRY_DAYS = 30


# =============================================================================
# Job functions (public)
# =============================================================================


@router.get("/api/jobs/functions")
async def list_job_functions():
    """List all job functions in the taxonomy.

    Used by candidate preferences (multi-select) and jobs feed filters.
    """
    return get_all_functions()


# =============================================================================
# JD extraction (employer, authenticated)
# =============================================================================


@router.post("/api/employer/jobs/extract")
async def extract_jd_fields(
    data: dict,
    user: dict = Depends(get_current_company_member),
):
    """Extract structured fields from pasted job description text or URL.

    Accepts either plain text or a job posting URL.
    - If input is a URL (Greenhouse, Lever, Ashby, etc.): fetches the page
      and extracts from schema.org/JobPosting JSON-LD.
    - If input is plain text: uses regex extraction.

    Request body: {"text": "...pasted JD or URL..."}
    """
    require_permission(user["member"], "can_post_jobs")

    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")

    # Detect if input is a URL
    if is_url(text):
        try:
            extracted = await extract_from_url(text)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        description = extracted.description or text
        source = "url"
    else:
        if len(text) > 50000:
            raise HTTPException(status_code=400, detail="Text too long (max 50,000 characters)")

        extracted = extract_from_text(text)
        description = text
        source = "text"

    # Auto-detect job function from extracted title
    function_id = None
    if extracted.title:
        function_id = detect_job_function(extracted.title)

    return {
        "title": extracted.title,
        "salary_min": extracted.salary_min,
        "salary_max": extracted.salary_max,
        "salary_currency": extracted.salary_currency,
        "location": extracted.location,
        "location_type": extracted.location_type,
        "employment_type": extracted.employment_type,
        "experience_level": extracted.experience_level,
        "job_function_id": function_id,
        "description": description,
        "confidence": extracted.confidence,
        "source": source,
    }


# =============================================================================
# Employer job management
# =============================================================================


@router.post("/api/employer/jobs")
async def create_job(
    job: JobCreate,
    user: dict = Depends(get_current_company_member),
):
    """Create a new job posting.

    Requires can_post_jobs permission and a verified domain.
    The job function is auto-detected from the title if not provided.
    Jobs default to 'active' status and auto-expire after 30 days.
    """
    require_permission(user["member"], "can_post_jobs")
    require_domain_verified(user["org"])

    org = user["org"]
    member = user["member"]
    supabase = get_supabase()

    now = datetime.now(timezone.utc)

    # Auto-detect job function if not provided
    job_function_id = job.job_function_id
    if not job_function_id:
        job_function_id = detect_job_function(job.title)

    # POC defaults to the poster
    poc_member_id = job.poc_member_id or member["id"]

    # Validate POC is an active member of the same org
    if poc_member_id != member["id"]:
        poc_check = (
            supabase.table("company_members")
            .select("id")
            .eq("id", poc_member_id)
            .eq("organization_id", org["id"])
            .eq("status", "active")
            .execute()
        )
        if not poc_check.data:
            raise HTTPException(status_code=400, detail="Point of contact must be an active member of your company")

    job_data = {
        "organization_id": org["id"],
        "posted_by": member["id"],
        "poc_member_id": poc_member_id,
        "title": job.title.strip(),
        "job_function_id": job_function_id,
        "description": job.description,
        "location": job.location,
        "location_type": job.location_type,
        "employment_type": job.employment_type,
        "experience_level": job.experience_level,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "salary_currency": job.salary_currency,
        "show_poc_name": job.show_poc_name,
        "status": "active",
        "posted_at": now.isoformat(),
        "expires_at": (now + timedelta(days=JOB_EXPIRY_DAYS)).isoformat(),
    }

    result = supabase.table("jobs").insert(job_data).execute()

    return result.data[0]


@router.get("/api/employer/jobs")
async def list_org_jobs(
    user: dict = Depends(get_current_company_member),
    status: Optional[str] = None,
):
    """List all jobs posted by this organization.

    Any active member can view. Optionally filter by status.
    """
    org = user["org"]
    supabase = get_supabase()

    query = (
        supabase.table("jobs")
        .select("*, job_functions(name,slug,category)")
        .eq("organization_id", org["id"])
        .order("created_at", desc=True)
    )

    if status:
        query = query.eq("status", status)

    result = query.execute()

    # Flatten the job_functions join
    jobs = []
    for job in (result.data or []):
        func = job.pop("job_functions", None)
        if func:
            job["job_function_name"] = func.get("name")
            job["job_function_category"] = func.get("category")
        jobs.append(job)

    return jobs


@router.get("/api/employer/jobs/{job_id}")
async def get_org_job(
    job_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Get a specific job posting (employer view, full details)."""
    org = user["org"]
    supabase = get_supabase()

    result = (
        supabase.table("jobs")
        .select("*, job_functions(name,slug,category)")
        .eq("id", job_id)
        .eq("organization_id", org["id"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data[0]
    func = job.pop("job_functions", None)
    if func:
        job["job_function_name"] = func.get("name")
        job["job_function_category"] = func.get("category")

    return job


@router.put("/api/employer/jobs/{job_id}")
async def update_job(
    job_id: str,
    updates: JobUpdate,
    user: dict = Depends(get_current_company_member),
):
    """Update a job posting.

    Requires can_post_jobs permission. Only the poster or an admin can update.
    If title changes, job function is re-detected.
    """
    require_permission(user["member"], "can_post_jobs")

    org = user["org"]
    member = user["member"]
    supabase = get_supabase()

    # Fetch the job
    existing = (
        supabase.table("jobs")
        .select("*")
        .eq("id", job_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = existing.data[0]

    # Only poster or admin can update
    if job["posted_by"] != member["id"] and member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the poster or an admin can update this job")

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Re-detect job function if title changed
    if "title" in update_data:
        new_function = detect_job_function(update_data["title"])
        if new_function:
            update_data["job_function_id"] = new_function

    # If activating, set posted_at and expires_at
    if update_data.get("status") == "active" and job["status"] != "active":
        now = datetime.now(timezone.utc)
        update_data["posted_at"] = now.isoformat()
        update_data["expires_at"] = (now + timedelta(days=JOB_EXPIRY_DAYS)).isoformat()

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = (
        supabase.table("jobs")
        .update(update_data)
        .eq("id", job_id)
        .execute()
    )

    return result.data[0]


@router.delete("/api/employer/jobs/{job_id}")
async def close_job(
    job_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Close a job posting. Sets status to 'closed'.

    Requires can_post_jobs permission. Only the poster or an admin can close.
    Does not delete — closed jobs remain visible but marked as closed.
    """
    require_permission(user["member"], "can_post_jobs")

    org = user["org"]
    member = user["member"]
    supabase = get_supabase()

    existing = (
        supabase.table("jobs")
        .select("posted_by")
        .eq("id", job_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Job not found")

    if existing.data[0]["posted_by"] != member["id"] and member["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only the poster or an admin can close this job")

    supabase.table("jobs").update({
        "status": "closed",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", job_id).execute()

    return {"detail": "Job closed"}


# =============================================================================
# Public job browsing
# =============================================================================


@router.get("/api/jobs")
async def list_public_jobs(
    sort: Literal["recent", "relevant"] = "recent",
    function: Optional[str] = None,
    location_type: Optional[str] = None,
    employment_type: Optional[str] = None,
    experience_level: Optional[str] = None,
    company: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """List active job postings. Public — no auth required.

    Supports filtering by function, location type, employment type,
    experience level, and company domain. Text search matches against
    title and description.

    Sort options:
      - recent: newest first (default)
      - relevant: by job function match (requires function filter or
        candidate preferences — for MVP, falls back to recent)
    """
    supabase = get_supabase()

    query = (
        supabase.table("jobs")
        .select("id,title,description,location,location_type,employment_type,experience_level,salary_min,salary_max,salary_currency,show_poc_name,status,posted_at,organization_id,poc_member_id,job_function_id, organizations(name,domain,logo_url), job_functions(name,slug,category)")
        .eq("status", "active")
        .order("posted_at", desc=True)
    )

    # Apply filters
    if function:
        # Function can be slug or ID
        func_result = supabase.table("job_functions").select("id").eq("slug", function).execute()
        if func_result.data:
            query = query.eq("job_function_id", func_result.data[0]["id"])

    if location_type:
        query = query.eq("location_type", location_type)

    if employment_type:
        query = query.eq("employment_type", employment_type)

    if experience_level:
        query = query.eq("experience_level", experience_level)

    if company:
        # Find org by domain
        org_result = supabase.table("organizations").select("id").eq("domain", company).execute()
        if org_result.data:
            query = query.eq("organization_id", org_result.data[0]["id"])
        else:
            return []  # No such company, no jobs

    query = query.range(offset, offset + limit - 1)

    result = query.execute()

    # Flatten joins and format for public consumption
    jobs = []
    for job in (result.data or []):
        org_data = job.pop("organizations", None) or {}
        func_data = job.pop("job_functions", None) or {}

        public_job = {
            "id": job["id"],
            "title": job["title"],
            "description": job["description"][:500] + "..." if len(job.get("description", "")) > 500 else job.get("description", ""),
            "location": job.get("location"),
            "location_type": job["location_type"],
            "employment_type": job["employment_type"],
            "experience_level": job["experience_level"],
            "salary_min": job["salary_min"],
            "salary_max": job["salary_max"],
            "salary_currency": job["salary_currency"],
            "posted_at": job.get("posted_at"),
            "org_name": org_data.get("name"),
            "org_domain": org_data.get("domain"),
            "org_logo_url": org_data.get("logo_url"),
            "job_function_name": func_data.get("name"),
            "job_function_slug": func_data.get("slug"),
            "job_function_category": func_data.get("category"),
        }
        jobs.append(public_job)

    # Text search filter (post-query for MVP — upgrade to full-text search later)
    if q:
        q_lower = q.lower()
        jobs = [
            j for j in jobs
            if q_lower in (j["title"] or "").lower()
            or q_lower in (j["description"] or "").lower()
            or q_lower in (j["org_name"] or "").lower()
        ]

    return jobs


@router.get("/api/jobs/{job_id}")
async def get_public_job(
    job_id: str,
    authorization: str | None = Header(None),
):
    """Get a single job posting detail. Public — no auth required.

    Returns the full job description and company info. POC name is
    shown if show_poc_name is true OR if the requester has 1+ verified claims.
    Pass Authorization header to unlock POC identity.
    """
    supabase = get_supabase()

    # Check if requester has verified claims (optional auth)
    requester_is_verified = False
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.middleware.auth import _decode_token
            token = authorization.split(" ", 1)[1]
            user = _decode_token(token)
            emp_count = supabase.table("employment_claims").select("id", count="exact").eq("user_id", user["id"]).eq("status", "verified").execute()
            edu_count = supabase.table("education_claims").select("id", count="exact").eq("user_id", user["id"]).eq("status", "verified").execute()
            requester_is_verified = ((emp_count.count or 0) + (edu_count.count or 0)) > 0
        except Exception:
            pass  # Invalid token — treat as anonymous

    result = (
        supabase.table("jobs")
        .select("*, organizations(name,domain,logo_url,website_url), job_functions(name,slug,category), company_members!jobs_poc_member_id_fkey(email)")
        .eq("id", job_id)
        .in_("status", ["active", "closed", "filled"])
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job = result.data[0]
    org_data = job.pop("organizations", None) or {}
    func_data = job.pop("job_functions", None) or {}
    poc_data = job.pop("company_members", None) or {}

    # Build public response
    public_job = {
        "id": job["id"],
        "title": job["title"],
        "description": job["description"],
        "location": job.get("location"),
        "location_type": job["location_type"],
        "employment_type": job["employment_type"],
        "experience_level": job["experience_level"],
        "salary_min": job["salary_min"],
        "salary_max": job["salary_max"],
        "salary_currency": job["salary_currency"],
        "show_poc_name": job["show_poc_name"],
        "status": job["status"],
        "posted_at": job.get("posted_at"),
        "org_name": org_data.get("name"),
        "org_domain": org_data.get("domain"),
        "org_logo_url": org_data.get("logo_url"),
        "org_website_url": org_data.get("website_url"),
        "job_function_name": func_data.get("name"),
        "job_function_slug": func_data.get("slug"),
        "job_function_category": func_data.get("category"),
    }

    # POC name: include if show_poc_name is true OR requester has verified claims
    if (job["show_poc_name"] or requester_is_verified) and poc_data:
        public_job["poc_name"] = poc_data.get("email", "").split("@")[0].replace(".", " ").title()

    return public_job


# =============================================================================
# Company jobs (public)
# =============================================================================


@router.get("/api/companies/{domain}/jobs")
async def list_company_jobs(domain: str):
    """List active jobs for a specific company. Public — no auth required.

    Used on the company page (/companies/{domain}).
    """
    supabase = get_supabase()

    org_result = (
        supabase.table("organizations")
        .select("id,name,domain,logo_url,website_url,created_at")
        .eq("domain", domain.lower())
        .execute()
    )

    if not org_result.data:
        raise HTTPException(status_code=404, detail="Company not found")

    org = org_result.data[0]

    # Count verified employees
    emp_count_result = (
        supabase.table("employment_claims")
        .select("id", count="exact")
        .eq("organization_id", org["id"])
        .eq("status", "verified")
        .execute()
    )

    # Get active jobs
    jobs_result = (
        supabase.table("jobs")
        .select("id,title,location,location_type,employment_type,experience_level,salary_min,salary_max,salary_currency,posted_at, job_functions(name,slug,category)")
        .eq("organization_id", org["id"])
        .eq("status", "active")
        .order("posted_at", desc=True)
        .execute()
    )

    jobs = []
    for job in (jobs_result.data or []):
        func = job.pop("job_functions", None) or {}
        job["job_function_name"] = func.get("name")
        job["job_function_category"] = func.get("category")
        jobs.append(job)

    return {
        "company": {
            "name": org["name"],
            "domain": org["domain"],
            "logo_url": org.get("logo_url"),
            "website_url": org.get("website_url"),
            "member_since": org.get("created_at"),
            "verified_employee_count": emp_count_result.count or 0,
        },
        "jobs": jobs,
    }
