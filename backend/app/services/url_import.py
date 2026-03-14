"""Import job postings from ATS URLs.

Fetches a job page from Greenhouse, Lever, Ashby (or any ATS that embeds
schema.org/JobPosting JSON-LD) and extracts structured fields.

Most ATS platforms embed JSON-LD structured data for Google Jobs indexing.
This is far more reliable than HTML scraping because:
  - It's a standard schema (schema.org/JobPosting)
  - It's structured JSON, not fragile HTML selectors
  - ATS platforms maintain it for SEO compliance

Supported ATS platforms:
  - Greenhouse (boards.greenhouse.io, *.greenhouse.io)
  - Lever (jobs.lever.co)
  - Ashby (jobs.ashbyhq.com)
  - Any site with schema.org/JobPosting JSON-LD

Fallback: if no JSON-LD found, extracts text from the page body
and runs regex extraction (same as paste flow).
"""

import re
import json
import httpx
from html import unescape
from app.services.jd_extract import extract_from_text, ExtractedFields


# User-Agent to avoid bot blocks
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; StampBot/1.0; +https://stampverified.com)",
    "Accept": "text/html,application/xhtml+xml",
}

# Known ATS URL patterns
_ATS_PATTERNS = [
    r"boards\.greenhouse\.io/",
    r"\.greenhouse\.io/jobs/",
    r"jobs\.lever\.co/",
    r"jobs\.ashbyhq\.com/",
    r"apply\.workable\.com/",
    r"\.recruitee\.com/",
    r"careers\..+/jobs?/",
]


def is_url(text: str) -> bool:
    """Check if the input looks like a URL."""
    text = text.strip()
    return text.startswith("http://") or text.startswith("https://")


def is_ats_url(url: str) -> bool:
    """Check if the URL matches a known ATS platform pattern."""
    for pattern in _ATS_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            return True
    return False


async def extract_from_url(url: str) -> ExtractedFields:
    """Fetch a job posting URL and extract structured fields.

    Tries JSON-LD first (most reliable), falls back to page text extraction.

    Args:
        url: The job posting URL (e.g., boards.greenhouse.io/stripe/jobs/4215)

    Returns:
        ExtractedFields with whatever could be parsed.

    Raises:
        ValueError: If the URL cannot be fetched or parsed.
    """
    url = url.strip()

    # Ensure URL has protocol
    if not url.startswith("http"):
        url = "https://" + url

    # Fetch the page
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(url, headers=_HEADERS)
            response.raise_for_status()
            html = response.text
    except httpx.TimeoutException:
        raise ValueError("The page took too long to load. Please paste the job description instead.")
    except httpx.HTTPStatusError as e:
        raise ValueError(f"Could not access the page (HTTP {e.response.status_code}). Please paste the job description instead.")
    except Exception:
        raise ValueError("Could not fetch the URL. Please paste the job description instead.")

    # Try JSON-LD extraction first
    result = _extract_from_jsonld(html)
    if result and result.title:
        return result

    # Fallback: extract text from HTML and run regex extraction
    text = _html_to_text(html)
    if text:
        return extract_from_text(text)

    raise ValueError("Could not extract job details from this URL. Please paste the job description instead.")


def _extract_from_jsonld(html: str) -> ExtractedFields | None:
    """Extract fields from schema.org/JobPosting JSON-LD embedded in the page.

    Looks for <script type="application/ld+json"> tags containing
    a JobPosting schema object.
    """
    # Find all JSON-LD script blocks
    jsonld_pattern = r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    matches = re.findall(jsonld_pattern, html, re.DOTALL | re.IGNORECASE)

    for match in matches:
        try:
            data = json.loads(match)
        except json.JSONDecodeError:
            continue

        # Handle both single objects and arrays
        items = data if isinstance(data, list) else [data]

        # Also handle @graph pattern
        for item in items:
            if isinstance(item, dict) and "@graph" in item:
                items.extend(item["@graph"])

        for item in items:
            if not isinstance(item, dict):
                continue

            item_type = item.get("@type", "")
            if isinstance(item_type, list):
                item_type = " ".join(item_type)

            if "JobPosting" not in item_type:
                continue

            return _parse_job_posting(item)

    return None


def _parse_job_posting(data: dict) -> ExtractedFields:
    """Parse a schema.org/JobPosting JSON-LD object into ExtractedFields."""
    result = ExtractedFields()

    # Title
    result.title = data.get("title") or data.get("name")
    if result.title:
        result.confidence["title"] = 0.95

    # Description — strip HTML tags
    desc = data.get("description", "")
    if desc:
        # Remove HTML tags but keep structure
        desc = re.sub(r'<br\s*/?>', '\n', desc, flags=re.IGNORECASE)
        desc = re.sub(r'<li[^>]*>', '\n• ', desc, flags=re.IGNORECASE)
        desc = re.sub(r'<p[^>]*>', '\n\n', desc, flags=re.IGNORECASE)
        desc = re.sub(r'<h[1-6][^>]*>', '\n\n## ', desc, flags=re.IGNORECASE)
        desc = re.sub(r'</h[1-6]>', '\n', desc, flags=re.IGNORECASE)
        desc = re.sub(r'<[^>]+>', '', desc)
        desc = unescape(desc)
        desc = re.sub(r'\n{3,}', '\n\n', desc).strip()
        result.description = desc

    # Location
    location = data.get("jobLocation")
    if location:
        if isinstance(location, list):
            location = location[0]
        if isinstance(location, dict):
            address = location.get("address", {})
            if isinstance(address, dict):
                city = address.get("addressLocality", "")
                region = address.get("addressRegion", "")
                result.location = f"{city}, {region}".strip(", ") if city or region else None
            elif isinstance(address, str):
                result.location = address
        elif isinstance(location, str):
            result.location = location
        if result.location:
            result.confidence["location"] = 0.9

    # Location type (remote/hybrid/onsite)
    location_type = data.get("jobLocationType")
    if location_type:
        lt_lower = str(location_type).lower()
        if "remote" in lt_lower or "telecommute" in lt_lower:
            result.location_type = "remote"
            result.confidence["location_type"] = 0.95
    applicant_req = data.get("applicantLocationRequirements")
    if applicant_req and not result.location_type:
        result.location_type = "remote"
        result.confidence["location_type"] = 0.8

    # Employment type
    emp_type = data.get("employmentType")
    if emp_type:
        if isinstance(emp_type, list):
            emp_type = emp_type[0]
        emp_type = str(emp_type).upper()
        type_map = {
            "FULL_TIME": "full_time",
            "PART_TIME": "part_time",
            "CONTRACT": "contract",
            "TEMPORARY": "contract",
            "INTERN": "internship",
            "INTERNSHIP": "internship",
        }
        result.employment_type = type_map.get(emp_type)
        if result.employment_type:
            result.confidence["employment_type"] = 0.95

    # Salary
    salary = data.get("baseSalary")
    if salary and isinstance(salary, dict):
        value = salary.get("value", {})
        currency = salary.get("currency", "USD")

        if isinstance(value, dict):
            min_val = value.get("minValue")
            max_val = value.get("maxValue")
            if min_val is not None:
                result.salary_min = int(float(min_val))
            if max_val is not None:
                result.salary_max = int(float(max_val))

            # Handle unitText (YEAR, MONTH, HOUR)
            unit = value.get("unitText", "YEAR").upper()
            if unit == "MONTH" and result.salary_min:
                result.salary_min *= 12
                result.salary_max = (result.salary_max or result.salary_min) * 12
            elif unit == "HOUR" and result.salary_min:
                result.salary_min *= 2080  # 40h * 52 weeks
                result.salary_max = (result.salary_max or result.salary_min) * 2080
        elif isinstance(value, (int, float)):
            result.salary_min = int(value)
            result.salary_max = int(value)

        result.salary_currency = currency or "USD"
        if result.salary_min:
            result.confidence["salary"] = 0.95

    # Experience level — from title or experienceRequirements
    exp = data.get("experienceRequirements")
    if exp:
        exp_str = str(exp).lower() if isinstance(exp, str) else ""
        if "senior" in exp_str or "5+" in exp_str or "7+" in exp_str:
            result.experience_level = "senior"
        elif "junior" in exp_str or "entry" in exp_str or "0-2" in exp_str:
            result.experience_level = "entry"
        elif "lead" in exp_str or "manager" in exp_str:
            result.experience_level = "lead"

    # Infer level from title if not found
    if not result.experience_level and result.title:
        title_lower = result.title.lower()
        if "senior" in title_lower or "sr." in title_lower or "staff" in title_lower:
            result.experience_level = "senior"
        elif "lead" in title_lower or "manager" in title_lower or "director" in title_lower:
            result.experience_level = "lead"
        elif "junior" in title_lower or "jr." in title_lower or "entry" in title_lower:
            result.experience_level = "entry"
        elif "vp" in title_lower or "chief" in title_lower:
            result.experience_level = "executive"
        else:
            result.experience_level = "mid"

    if result.experience_level:
        result.confidence["experience_level"] = 0.8

    return result


def _html_to_text(html: str) -> str:
    """Convert HTML to plain text, preserving basic structure."""
    # Remove script, style, head tags and their content
    text = re.sub(r'<(script|style|head)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)

    # Convert common block elements to newlines
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<li[^>]*>', '\n• ', text, flags=re.IGNORECASE)
    text = re.sub(r'<p[^>]*>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<h[1-6][^>]*>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<div[^>]*>', '\n', text, flags=re.IGNORECASE)

    # Strip remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)

    # Decode HTML entities
    text = unescape(text)

    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)

    return text.strip()
