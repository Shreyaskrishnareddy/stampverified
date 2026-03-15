"""External job search via JSearch API (RapidAPI).

Searches Google Jobs aggregator to find matching jobs from across
the web. Used as the "hook" to give candidates immediate value
on signup — upload resume, see matching jobs.

JSearch free tier: 500 requests/month.
"""

import httpx
from app.config import get_settings


async def search_external_jobs(
    query: str,
    location: str | None = None,
    num_results: int = 15,
) -> list[dict]:
    """Search for jobs using JSearch API.

    Args:
        query: Search query (e.g., "Software Engineer")
        location: Optional location filter
        num_results: Number of results to return (max 20)

    Returns:
        List of job dicts with title, company, location, link, etc.
    """
    settings = get_settings()

    api_key = getattr(settings, "jsearch_api_key", "") or ""
    if not api_key:
        print("[JSEARCH] API key not configured")
        return []

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
