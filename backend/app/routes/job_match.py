"""Resume-based job matching routes.

Upload resume -> parse -> embed full text -> pgvector search against 25,000+ jobs -> return scored results.

Sources:
  1. Stamp verified jobs (from Stamp database) — shown first with gold badge
  2. OneProfile jobs (25,000+ from 350+ companies) — pgvector cosine similarity

Protections:
  - Resume quality validation before matching
  - IP rate limiting (15/hour)
"""

import re
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from openai import OpenAI

from app.services.resume_parser import extract_text_from_pdf, parse_resume
from app.services.greenhouse_matcher import (
    extract_skills_from_text,
    normalize_skill,
    SKILL_SYNONYMS,
    _passes_title_filter,
    _passes_location_filter,
    _passes_experience_filter,
    _detect_seniority,
    _detect_deal_breakers,
    FOREIGN_IN_TITLE,
)
from app.config import get_supabase, get_oneprofile_supabase, get_settings


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
    return False, "Could not find enough job-relevant information in this resume."


# ─── Embedding ────────────────────────────────────────────────────────────────

def _get_openai_client():
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)


def _embed_text(text: str) -> list[float]:
    """Embed text using OpenAI text-embedding-3-small. 1 API call."""
    client = _get_openai_client()
    response = client.embeddings.create(input=text, model="text-embedding-3-small", dimensions=256)
    return response.data[0].embedding


# ─── OneProfile pgvector Search ───────────────────────────────────────────────

def _search_oneprofile_jobs(embedding: list[float], threshold=0.3, limit=500) -> list[dict]:
    """Search OneProfile's 25,000+ jobs using pgvector cosine similarity."""
    client = get_oneprofile_supabase()
    result = client.rpc("match_jobs", {
        "query_embedding": embedding,
        "match_threshold": threshold,
        "match_count": limit,
    }).execute()
    return result.data or []


SENIORITY_LEVELS = ["junior", "mid", "senior"]

TITLE_KW_HIGH = [
    "software development engineer", "sde", "software engineer",
    "software developer", "ai engineer", "ml engineer", "machine learning engineer",
    "backend engineer", "backend developer", "fullstack engineer", "full stack engineer",
    "python engineer", "applied scientist", "research engineer", "nlp engineer",
]

TITLE_KW_MEDIUM = [
    "platform engineer", "data engineer", "frontend engineer", "developer",
    "devops engineer", "cloud engineer", "site reliability", "infrastructure engineer",
    "systems engineer", "security engineer",
]


def _match_skills_synonym(resume_skills: list[str], job_skills: list[str]) -> tuple[list, list, float]:
    """Synonym-aware skill matching. Returns (matched, missing, ratio)."""
    resume_norm = {normalize_skill(s) for s in resume_skills}
    job_norm = {normalize_skill(s) for s in job_skills} if job_skills else set()
    if not job_norm:
        return [], [], 0.2
    matched = sorted(resume_norm & job_norm)
    missing = sorted(job_norm - resume_norm)
    if len(job_norm) <= 2:
        ratio = min(len(matched) * 0.2, 0.4)
    elif len(job_norm) <= 4 and len(matched) <= 2:
        ratio = min(len(matched) * 0.15, 0.4)
    else:
        ratio = len(matched) / len(job_norm)
        if len(matched) >= 5:
            ratio = min(ratio + 0.1, 1.0)
    return matched, missing[:5], min(ratio, 1.0)


def _title_relevance(title: str, target_roles: list[str]) -> float:
    tl = title.lower()
    for role in target_roles:
        if role.lower() in tl or tl in role.lower():
            return 1.0
    for kw in TITLE_KW_HIGH:
        if kw in tl:
            return 0.8
    for kw in TITLE_KW_MEDIUM:
        if kw in tl:
            return 0.5
    return 0.2


def _seniority_fit(job_level: str, candidate_level: str) -> float:
    if job_level not in SENIORITY_LEVELS or candidate_level not in SENIORITY_LEVELS:
        return 0.5
    diff = abs(SENIORITY_LEVELS.index(job_level) - SENIORITY_LEVELS.index(candidate_level))
    return {0: 1.0, 1: 0.5}.get(diff, 0.0)


def _composite_score(similarity, skill_ratio, title_score, seniority_score):
    return round((0.35 * similarity + 0.30 * skill_ratio + 0.15 * title_score + 0.10 * seniority_score + 0.10 * 0.5) * 100)


def _generate_why(matched: list, missing: list, title_score: float, sen_score: float) -> str:
    skill_part = ""
    if matched:
        top = matched[:3]
        if len(top) >= 2:
            skill_part = f"{', '.join(top[:-1])} and {top[-1]} match"
        else:
            skill_part = f"{top[0]} matches"
    tags = []
    if skill_part:
        tags.append(skill_part)
    if title_score >= 0.8:
        tags.append("title fit")
    if sen_score >= 1.0:
        tags.append("level fit")
    return " · ".join(tags) if tags else "Matches your experience profile"


def _match_oneprofile_jobs(
    resume_text: str,
    resume_skills: list[str],
    experience_level: str = "mid",
    target_roles: list[str] = None,
) -> tuple[list[dict], int]:
    """Embed resume text, search pgvector, re-rank with composite score."""
    if target_roles is None:
        target_roles = ["Software Engineer"]

    embedding = _embed_text(resume_text)
    raw_results = _search_oneprofile_jobs(embedding, threshold=0.3, limit=500)
    total_searched = len(raw_results)

    results = []
    for job in raw_results:
        title = (job.get("title") or "").strip()
        company = (job.get("company") or "").strip()
        description = job.get("description") or ""

        if not title or len(title) < 5 or not company or len(company) < 2:
            continue
        if _detect_deal_breakers(title, description):
            continue

        job_level = job.get("experience_level") or "mid"
        sen_score = _seniority_fit(job_level, experience_level)
        if sen_score == 0.0:
            continue

        # Synonym-aware skill matching using pre-extracted job skills
        job_skills = job.get("skills") or []
        matched, missing, skill_ratio = _match_skills_synonym(resume_skills, job_skills)

        title_score = _title_relevance(title, target_roles)
        similarity = job.get("similarity", 0)
        score = _composite_score(similarity, skill_ratio, title_score, sen_score)

        location = job.get("location") or ""
        if isinstance(location, list):
            location = ", ".join(str(l) for l in location)
        loc_lower = location.lower() if location else ""
        if job.get("remote") or "remote" in loc_lower:
            location_type = "remote"
        elif "hybrid" in loc_lower:
            location_type = "hybrid"
        else:
            location_type = "onsite"

        company_domain = job.get("company_domain") or ""
        if not company_domain and company:
            company_domain = company.lower().replace(" ", "") + ".com"

        results.append({
            "title": title,
            "company": company,
            "company_logo": None,
            "company_domain": company_domain,
            "location": location or "Not specified",
            "location_type": location_type,
            "employment_type": job.get("employment_type") or "full_time",
            "salary_min": job.get("salary_min"),
            "salary_max": job.get("salary_max"),
            "salary_currency": job.get("salary_currency") or "USD",
            "description_snippet": (description or "")[:200],
            "apply_link": job.get("apply_url") or "",
            "posted_at": job.get("posted_at"),
            "source": job.get("source") or "",
            "is_stamp_verified": False,
            "score": score,
            "matched_skills": matched[:8],
            "why_matched": _generate_why(matched, missing, title_score, sen_score),
            "seniority": job_level,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results, total_searched


# ─── Match Endpoint ───────────────────────────────────────────────────────────

@router.post("/match")
async def match_jobs_from_resume(
    request: Request,
    file: UploadFile = File(...),
):
    """Upload a resume and get matching jobs.

    Parses the resume, embeds full text, searches 25,000+ jobs via pgvector,
    applies hard filters, returns scored results.
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

    # Match against OneProfile's 25,000+ jobs via pgvector
    experience_level = _infer_level(resume)
    greenhouse_results, total_searched = _match_oneprofile_jobs(
        resume_text=text,
        resume_skills=resume.skills,
        experience_level=experience_level,
        target_roles=resume.titles,
    )

    # Limit to top 200
    greenhouse_results = greenhouse_results[:200]

    return {
        "resume_summary": {
            "titles": resume.titles,
            "skills": resume.skills[:15],
            "location": resume.location,
            "experience_years": resume.experience_years,
            "companies": resume.companies,
        },
        "stamp_jobs_count": len(stamp_jobs),
        "greenhouse_jobs_count": len(greenhouse_results),
        "total_greenhouse_scanned": total_searched,
        "jobs": stamp_jobs,
        "greenhouse_jobs": greenhouse_results,
    }


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

    # Build a text representation from skills for embedding
    skills_text = "Software engineer with skills: " + ", ".join(skills) + f". Experience level: {level}."
    greenhouse_results, _ = _match_oneprofile_jobs(
        resume_text=skills_text,
        resume_skills=skills,
        experience_level=level,
    )

    return {
        "greenhouse_jobs_count": len(greenhouse_results),
        "greenhouse_jobs": greenhouse_results,
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _infer_level(resume) -> str:
    text_lower = " ".join(resume.titles).lower() + " " + (resume.raw_text or "")[:500].lower()
    for kw in ["senior", "sr.", "lead", "principal", "staff"]:
        if kw in text_lower:
            return "senior"
    for kw in ["junior", "jr.", "entry", "intern", "new grad"]:
        if kw in text_lower:
            return "junior"
    return "mid"


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
