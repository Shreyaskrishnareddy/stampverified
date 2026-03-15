"""Resume-based job matching routes.

Upload resume → validate quality → search (cached) → return matches.
The hook that gives candidates immediate value on signup.

Protections:
  - Resume quality validation before JSearch call
  - Query+location caching (1 hour TTL)
  - IP rate limiting (15/hour)
  - Monthly quota guardrail with graceful degradation
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from app.services.resume_parser import extract_text_from_pdf, parse_resume, build_search_query
from app.services.job_search import (
    search_external_jobs,
    validate_resume_quality,
    check_rate_limit,
    is_quota_available,
    get_quota_status,
)
from app.config import get_supabase, get_settings

router = APIRouter(prefix="/api/jobs", tags=["job-match"])


@router.get("/match-debug")
async def match_debug():
    """Temporary debug endpoint to check JSearch config."""
    settings = get_settings()
    key = settings.jsearch_api_key or ""
    return {
        "key_configured": bool(key),
        "key_length": len(key),
        "key_prefix": key[:8] + "..." if len(key) > 8 else "empty",
    }


@router.post("/match")
async def match_jobs_from_resume(
    request: Request,
    file: UploadFile = File(...),
):
    """Upload a resume and get matching jobs.

    Parses the resume, validates quality, searches JSearch API (cached),
    and returns matching jobs. Stamp verified jobs appear first.

    Public endpoint — no auth required. Rate limited by IP.
    """
    # Get client IP for rate limiting
    client_ip = request.client.host if request.client else "unknown"

    # Rate limit check
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many uploads. Please wait a few minutes and try again."
        )

    # Validate file
    if not file.content_type or file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF resumes are accepted")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Resume must be under 5MB")

    # Extract text from PDF
    try:
        text = extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract enough text from this PDF. Please check the file.")

    # Parse resume
    resume = parse_resume(text)

    # Validate resume quality before burning API quota
    is_valid, reason = validate_resume_quality(resume.titles, resume.skills, resume.companies)
    if not is_valid:
        raise HTTPException(status_code=400, detail=reason)

    # Build search query from resume
    query = build_search_query(resume)
    if not query:
        raise HTTPException(status_code=400, detail="Could not extract enough information to search for jobs.")

    # Search external jobs (with caching and quota tracking)
    external_jobs = await search_external_jobs(
        query=query,
        location=resume.location,
        num_results=15,
        client_ip=client_ip,
    )

    # Check if external search was skipped due to quota
    quota = get_quota_status()
    quota_exhausted = not is_quota_available() and len(external_jobs) == 0

    # Search Stamp's own jobs
    stamp_jobs = _match_stamp_jobs(resume)

    # Combine: Stamp jobs first, then external
    all_jobs = stamp_jobs + external_jobs

    response = {
        "resume_summary": {
            "titles": resume.titles,
            "skills": resume.skills[:10],
            "location": resume.location,
            "experience_years": resume.experience_years,
            "companies": resume.companies,
        },
        "search_query": query,
        "stamp_jobs_count": len(stamp_jobs),
        "external_jobs_count": len(external_jobs),
        "jobs": all_jobs,
    }

    if quota_exhausted:
        response["notice"] = "External job search is temporarily unavailable. Showing Stamp jobs only."

    return response


def _match_stamp_jobs(resume) -> list[dict]:
    """Find matching jobs from Stamp's own database."""
    try:
        supabase = get_supabase()
        stamp_result = (
            supabase.table("jobs")
            .select("id,title,location,location_type,employment_type,salary_min,salary_max,salary_currency,posted_at, organizations(name,domain,logo_url)")
            .eq("status", "active")
            .limit(50)
            .execute()
        )

        stamp_jobs = []
        for job in (stamp_result.data or []):
            org = job.pop("organizations", None) or {}
            job_title_lower = (job.get("title") or "").lower()

            # Match by title or skills
            title_match = any(
                t.lower() in job_title_lower or job_title_lower in t.lower()
                for t in resume.titles
            )
            skill_match = any(
                s in job_title_lower
                for s in resume.skills[:5]
            )

            if title_match or skill_match:
                stamp_jobs.append({
                    "id": job["id"],
                    "title": job["title"],
                    "company": org.get("name", ""),
                    "company_logo": org.get("logo_url"),
                    "company_domain": org.get("domain"),
                    "location": job.get("location", ""),
                    "location_type": job.get("location_type", "onsite"),
                    "employment_type": job.get("employment_type", "full_time"),
                    "salary_min": job.get("salary_min"),
                    "salary_max": job.get("salary_max"),
                    "salary_currency": job.get("salary_currency", "USD"),
                    "posted_at": job.get("posted_at"),
                    "apply_link": None,
                    "is_stamp_verified": True,
                })

        return stamp_jobs
    except Exception:
        return []


@router.post("/match-text")
async def match_jobs_from_text(
    request: Request,
    data: dict,
):
    """Match jobs from raw resume text.

    Request body: {"text": "...resume text...", "location": "optional"}
    """
    client_ip = request.client.host if request.client else "unknown"

    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please wait a few minutes.")

    text = data.get("text", "").strip()
    if not text or len(text) < 50:
        raise HTTPException(status_code=400, detail="Resume text is too short")

    resume = parse_resume(text)

    is_valid, reason = validate_resume_quality(resume.titles, resume.skills, resume.companies)
    if not is_valid:
        raise HTTPException(status_code=400, detail=reason)

    query = build_search_query(resume)
    if not query:
        raise HTTPException(status_code=400, detail="Could not extract enough information to search for jobs.")

    location = data.get("location") or resume.location

    external_jobs = await search_external_jobs(
        query=query,
        location=location,
        num_results=15,
        client_ip=client_ip,
    )

    return {
        "resume_summary": {
            "titles": resume.titles,
            "skills": resume.skills[:10],
            "location": resume.location,
        },
        "search_query": query,
        "jobs": external_jobs,
    }
