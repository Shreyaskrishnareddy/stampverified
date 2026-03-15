"""External job search via JSearch API (RapidAPI).

Searches Google Jobs aggregator to find matching jobs from across
the web. Used as the "hook" to give candidates immediate value
on signup — upload resume, see matching jobs.

Protections:
  1. Query+location cache (1 hour TTL) — same search = cached results
  2. Resume quality validation — rejects junk before burning quota
  3. IP rate limiting (15/hour) — prevents abuse
  4. Monthly quota guardrail — degrades to Stamp-only when near limit

JSearch free tier: 500 requests/month.
"""

import time
import re
import hashlib
import httpx
from collections import defaultdict
from app.config import get_settings


# ─── Query Cache ─────────────────────────────────────────────────────────────
# Cache by normalized(query + location). TTL 1 hour.
# Same search query from different resumes shares cached results.

_query_cache: dict[str, tuple[list[dict], float]] = {}
_CACHE_TTL = 3600  # 1 hour


def _normalize_cache_key(query: str, location: str | None) -> str:
    """Normalize query + location into a stable cache key."""
    q = re.sub(r'\s+', ' ', query.lower().strip())
    loc = re.sub(r'\s+', ' ', (location or "").lower().strip())
    raw = f"{q}|{loc}"
    return hashlib.md5(raw.encode()).hexdigest()


def _get_cached(key: str) -> list[dict] | None:
    """Get cached results if TTL hasn't expired."""
    if key in _query_cache:
        results, timestamp = _query_cache[key]
        if time.monotonic() - timestamp < _CACHE_TTL:
            return results
        del _query_cache[key]
    return None


def _set_cache(key: str, results: list[dict]):
    """Cache results with current timestamp."""
    _query_cache[key] = (results, time.monotonic())
    # Evict old entries if cache gets too large
    if len(_query_cache) > 200:
        oldest_key = min(_query_cache, key=lambda k: _query_cache[k][1])
        del _query_cache[oldest_key]


# ─── Rate Limiting ───────────────────────────────────────────────────────────
# 15 requests per hour per IP. Loose enough for real users, tight enough
# to prevent abuse.

_ip_requests: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 15
_RATE_WINDOW = 3600  # 1 hour


def check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limit. Returns True if allowed."""
    now = time.monotonic()
    # Clean old entries
    _ip_requests[ip] = [t for t in _ip_requests[ip] if now - t < _RATE_WINDOW]
    if len(_ip_requests[ip]) >= _RATE_LIMIT:
        return False
    _ip_requests[ip].append(now)
    return True


# ─── Monthly Quota ───────────────────────────────────────────────────────────
# Track total JSearch API calls this month. Degrade gracefully when near limit.

_monthly_calls = 0
_monthly_reset_time = time.monotonic()
_MONTHLY_LIMIT = 450  # Leave 50 buffer from 500 free tier
_MONTH_SECONDS = 30 * 24 * 3600


def _track_api_call():
    """Track a JSearch API call against the monthly quota."""
    global _monthly_calls, _monthly_reset_time
    now = time.monotonic()
    # Reset counter if a month has passed
    if now - _monthly_reset_time > _MONTH_SECONDS:
        _monthly_calls = 0
        _monthly_reset_time = now
    _monthly_calls += 1


def is_quota_available() -> bool:
    """Check if monthly quota is available."""
    global _monthly_calls, _monthly_reset_time
    now = time.monotonic()
    if now - _monthly_reset_time > _MONTH_SECONDS:
        _monthly_calls = 0
        _monthly_reset_time = now
    return _monthly_calls < _MONTHLY_LIMIT


def get_quota_status() -> dict:
    """Get current quota usage."""
    return {
        "used": _monthly_calls,
        "limit": _MONTHLY_LIMIT,
        "remaining": max(0, _MONTHLY_LIMIT - _monthly_calls),
    }


# ─── Resume Quality Validation ──────────────────────────────────────────────
# Reject junk PDFs before burning API quota.

def validate_resume_quality(titles: list[str], skills: list[str], companies: list[str]) -> tuple[bool, str]:
    """Check if parsed resume has enough signal to search.

    Rules:
      - At least 1 plausible title, OR
      - At least 3 recognized skills, OR
      - At least 1 title + 1 skill

    Returns (is_valid, reason).
    """
    has_title = len(titles) >= 1
    has_skills = len(skills) >= 3
    has_some_signal = len(titles) >= 1 and len(skills) >= 1

    if has_title or has_skills or has_some_signal:
        return True, ""

    if len(skills) >= 1:
        return True, ""  # Even 1 skill is better than nothing

    return False, "Could not find enough job-relevant information in this resume. Make sure it includes job titles, skills, or company names."


# ─── JSearch API ─────────────────────────────────────────────────────────────


async def search_external_jobs(
    query: str,
    location: str | None = None,
    num_results: int = 15,
    client_ip: str | None = None,
) -> list[dict]:
    """Search for jobs using JSearch API with caching and protections.

    Args:
        query: Search query (e.g., "Software Engineer")
        location: Optional location filter
        num_results: Number of results to return (max 20)
        client_ip: Client IP for rate limiting

    Returns:
        List of job dicts. Returns empty list if quota exhausted
        (caller should fall back to Stamp-only jobs).
    """
    settings = get_settings()

    api_key = (settings.jsearch_api_key or "").strip()
    if not api_key:
        print("[JSEARCH] API key not configured — check JSEARCH_API_KEY env var")
        return []

    # Rate limit check
    if client_ip and not check_rate_limit(client_ip):
        print(f"[JSEARCH] Rate limited: {client_ip}")
        return []

    # Check cache first
    cache_key = _normalize_cache_key(query, location)
    cached = _get_cached(cache_key)
    if cached is not None:
        print(f"[JSEARCH] Cache hit: {cache_key[:8]}...")
        return cached[:num_results]

    # Quota check — degrade gracefully
    if not is_quota_available():
        print(f"[JSEARCH] Monthly quota exhausted ({_monthly_calls}/{_MONTHLY_LIMIT})")
        return []

    # Build search query
    search_query = query
    if location:
        search_query += f" in {location}"

    params = {
        "query": search_query,
        "page": "1",
        "num_pages": "1",
        "date_posted": "month",
    }

    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://jsearch.p.rapidapi.com/search",
                params=params,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        _track_api_call()

        jobs = []
        for item in (data.get("data") or [])[:num_results]:
            jobs.append({
                "title": item.get("job_title", ""),
                "company": item.get("employer_name", ""),
                "company_logo": item.get("employer_logo"),
                "location": _format_location(item),
                "location_type": _detect_remote(item),
                "employment_type": _normalize_type(item.get("job_employment_type")),
                "description_snippet": (item.get("job_description") or "")[:200],
                "apply_link": item.get("job_apply_link") or item.get("job_google_link", ""),
                "posted_at": item.get("job_posted_at_datetime_utc"),
                "source": item.get("job_publisher", ""),
                "is_stamp_verified": False,
            })

        # Cache results
        _set_cache(cache_key, jobs)
        quota = get_quota_status()
        print(f"[JSEARCH] API call #{quota['used']}/{quota['limit']} — {len(jobs)} results for '{search_query}'")

        return jobs

    except httpx.TimeoutException:
        print("[JSEARCH] Request timed out")
        return []
    except Exception as e:
        print(f"[JSEARCH] Error: {e}")
        return []


def _format_location(item: dict) -> str:
    """Format location from JSearch response."""
    city = item.get("job_city", "")
    state = item.get("job_state", "")
    country = item.get("job_country", "")

    if city and state:
        return f"{city}, {state}"
    if city:
        return city
    if state:
        return state
    if country:
        return country
    return "Not specified"


def _detect_remote(item: dict) -> str:
    """Detect if job is remote."""
    if item.get("job_is_remote"):
        return "remote"
    title = (item.get("job_title") or "").lower()
    desc = (item.get("job_description") or "")[:500].lower()
    if "remote" in title or "remote" in desc:
        return "remote"
    if "hybrid" in title or "hybrid" in desc:
        return "hybrid"
    return "onsite"


def _normalize_type(emp_type: str | None) -> str:
    """Normalize employment type."""
    if not emp_type:
        return "full_time"
    emp_type = emp_type.upper()
    if "FULL" in emp_type:
        return "full_time"
    if "PART" in emp_type:
        return "part_time"
    if "CONTRACT" in emp_type or "TEMP" in emp_type:
        return "contract"
    if "INTERN" in emp_type:
        return "internship"
    return "full_time"
