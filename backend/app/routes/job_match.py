"""Resume-based job matching routes.

Upload resume → parse → search external jobs → return matches.
The hook that gives candidates immediate value on signup.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from app.services.resume_parser import extract_text_from_pdf, parse_resume, build_search_query
from app.services.job_search import search_external_jobs
from app.config import get_supabase

router = APIRouter(prefix="/api/jobs", tags=["job-match"])


@router.post("/match")
async def match_jobs_from_resume(
    file: UploadFile = File(...),
):
    """Upload a resume and get matching jobs.

    Parses the resume, extracts keywords, searches JSearch API,
    and returns matching jobs from across the web. Also includes
    any matching Stamp verified jobs.

    Accepts PDF only. Max 5MB.
    """
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

    # Build search query from resume
    query = build_search_query(resume)
    if not query:
        raise HTTPException(status_code=400, detail="Could not extract job titles or skills from this resume.")

    # Search external jobs
    external_jobs = await search_external_jobs(
        query=query,
        location=resume.location,
        num_results=15,
    )

    # Also search Stamp's own jobs
    stamp_jobs = []
    try:
        supabase = get_supabase()
        stamp_result = (
            supabase.table("jobs")
            .select("id,title,location,location_type,employment_type,salary_min,salary_max,salary_currency,posted_at, organizations(name,domain,logo_url)")
            .eq("status", "active")
            .limit(20)
            .execute()
        )

        for job in (stamp_result.data or []):
            org = job.pop("organizations", None) or {}
            # Simple keyword match against Stamp jobs
            job_title_lower = (job.get("title") or "").lower()
            if any(
                t.lower() in job_title_lower or job_title_lower in t.lower()
                for t in resume.titles
            ) or any(
                s in job_title_lower
                for s in resume.skills[:5]
            ):
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
    except Exception:
        pass

    # Combine: Stamp jobs first, then external
    all_jobs = stamp_jobs + external_jobs

    return {
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


@router.post("/match-text")
async def match_jobs_from_text(
    data: dict,
):
    """Match jobs from raw resume text (for already-extracted text).

    Request body: {"text": "...resume text...", "location": "optional"}
    """
    text = data.get("text", "").strip()
    if not text or len(text) < 50:
        raise HTTPException(status_code=400, detail="Resume text is too short")

    resume = parse_resume(text)
    query = build_search_query(resume)
    if not query:
        raise HTTPException(status_code=400, detail="Could not extract job titles or skills")

    location = data.get("location") or resume.location

    external_jobs = await search_external_jobs(
        query=query,
        location=location,
        num_results=15,
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
