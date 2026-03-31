"""Resume-based job matching routes.

Upload resume -> validate quality -> match against Greenhouse jobs + Stamp jobs -> return scored results.

Sources:
  1. Stamp verified jobs (from database) — shown first with gold badge
  2. Greenhouse jobs (5,700+ from 29 top companies) — scored and ranked

Protections:
  - Resume quality validation before matching
  - IP rate limiting (15/hour)
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from app.services.resume_parser import extract_text_from_pdf, parse_resume, build_search_query
from app.services.greenhouse_matcher import match_greenhouse_jobs
from app.config import get_supabase
import time
from collections import defaultdict

router = APIRouter(prefix="/api/jobs", tags=["job-match"])

# ─── Rate Limiting ────────────────────────────────────────────────────────────

_ip_requests: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 15
_RATE_WINDOW = 3600


def _check_rate_limit(ip: str) -> bool:
    now = time.monotonic()
    _ip_requests[ip] = [t for t in _ip_requests[ip] if now - t < _RATE_WINDOW]
    if len(_ip_requests[ip]) >= _RATE_LIMIT:
        return False
    _ip_requests[ip].append(now)
    return True


# ─── Resume Quality ───────────────────────────────────────────────────────────

def _validate_resume_quality(titles, skills, companies):
    has_title = len(titles) >= 1
    has_skills = len(skills) >= 3
    has_some = len(titles) >= 1 and len(skills) >= 1

    if has_title or has_skills or has_some or len(skills) >= 1:
        return True, ""
    return False, "Could not find enough job-relevant information in this resume. Make sure it includes job titles, skills, or company names."


# ─── Match Endpoint ───────────────────────────────────────────────────────────

@router.post("/match")
async def match_jobs_from_resume(
    request: Request,
    file: UploadFile = File(...),
):
    """Upload a resume and get matching jobs.

    Parses the resume, validates quality, matches against Greenhouse jobs
    and Stamp's own database. Returns scored results.

    Public endpoint — no auth required. Rate limited by IP.
    """
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many uploads. Please wait a few minutes and try again."
        )

    if not file.content_type or file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF resumes are accepted")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Resume must be under 5MB")

    try:
        text = extract_text_from_pdf(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract enough text from this PDF.")

    resume = parse_resume(text)

    is_valid, reason = _validate_resume_quality(resume.titles, resume.skills, resume.companies)
    if not is_valid:
        raise HTTPException(status_code=400, detail=reason)

    # Match against Stamp's own database
    stamp_jobs = _match_stamp_jobs(resume)

    # Match against Greenhouse jobs (5,700+ from top companies)
    greenhouse_results = match_greenhouse_jobs(
        candidate_skills=resume.skills,
        experience_level=_infer_level(resume),
        threshold=1,
    )

    response = {
        "resume_summary": {
            "titles": resume.titles,
            "skills": resume.skills[:15],
            "location": resume.location,
            "experience_years": resume.experience_years,
            "companies": resume.companies,
        },
        "stamp_jobs_count": len(stamp_jobs),
        "greenhouse_jobs_count": len(greenhouse_results),
        "total_greenhouse_scanned": _get_total_greenhouse_count(),
        "jobs": stamp_jobs,
        "greenhouse_jobs": greenhouse_results,
    }

    return response


@router.post("/match-with-skills")
async def match_jobs_with_skills(
    request: Request,
    data: dict,
):
    """Match jobs using provided skills list (after user edits skills).

    Request body: {"skills": ["python", "react", ...], "level": "mid"}
    """
    client_ip = request.client.host if request.client else "unknown"

    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests.")

    skills = data.get("skills", [])
    level = data.get("level", "mid")

    if not skills:
        raise HTTPException(status_code=400, detail="No skills provided")

    greenhouse_results = match_greenhouse_jobs(
        candidate_skills=skills,
        experience_level=level,
        threshold=1,
    )

    return {
        "greenhouse_jobs_count": len(greenhouse_results),
        "greenhouse_jobs": greenhouse_results,
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _infer_level(resume) -> str:
    """Infer experience level from resume."""
    text_lower = " ".join(resume.titles).lower() + " " + (resume.raw_text or "")[:500].lower()
    for kw in ["senior", "sr.", "lead", "principal", "staff"]:
        if kw in text_lower:
            return "senior"
    for kw in ["junior", "jr.", "entry", "intern", "new grad"]:
        if kw in text_lower:
            return "junior"
    return "mid"


def _get_total_greenhouse_count() -> int:
    """Get total number of Greenhouse jobs loaded."""
    from app.services.greenhouse_matcher import _load_greenhouse_jobs
    jobs = _load_greenhouse_jobs()
    return len(jobs) if jobs else 0


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
                    "score": None,
                    "matched_skills": [],
                    "why_matched": "Verified employer on Stamp",
                    "seniority": None,
                })

        return stamp_jobs
    except Exception:
        return []
