"""
Multi-ATS job scraper for StampVerified.

Scrapes jobs from Greenhouse, Ashby, and Lever public APIs.
No API keys needed. All endpoints are free and public.

Usage:
    from app.services.ats_scraper import scrape_all_ats
    jobs = scrape_all_ats()
"""

import requests
import re
import time

# ─── Company Database ─────────────────────────────────────────────────────────
# Format: (display_name, ats_platform, ats_slug)
# ats_platform: "greenhouse", "ashby", or "lever"
#
# To add a company:
#   1. Try: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
#   2. Try: https://api.ashbyhq.com/posting-api/job-board/{slug}
#   3. Try: https://api.lever.co/v0/postings/{slug}
#   Whichever returns jobs, that's the ATS and slug.

COMPANIES = [
    # ── Greenhouse ──
    ("Airbnb", "greenhouse", "airbnb"),
    ("Stripe", "greenhouse", "stripe"),
    ("Figma", "greenhouse", "figma"),
    ("Discord", "greenhouse", "discord"),
    ("Cloudflare", "greenhouse", "cloudflare"),
    ("Databricks", "greenhouse", "databricks"),
    ("Datadog", "greenhouse", "datadog"),
    ("Twitch", "greenhouse", "twitch"),
    ("Coinbase", "greenhouse", "coinbase"),
    ("Robinhood", "greenhouse", "robinhood"),
    ("Instacart", "greenhouse", "instacart"),
    ("Pinterest", "greenhouse", "pinterest"),
    ("Reddit", "greenhouse", "reddit"),
    ("Brex", "greenhouse", "brex"),
    ("Airtable", "greenhouse", "airtable"),
    ("Vercel", "greenhouse", "vercel"),
    ("GitLab", "greenhouse", "gitlab"),
    ("Elastic", "greenhouse", "elastic"),
    ("MongoDB", "greenhouse", "mongodb"),
    ("Cockroach Labs", "greenhouse", "cockroachlabs"),
    ("PlanetScale", "greenhouse", "planetscale"),
    ("LaunchDarkly", "greenhouse", "launchdarkly"),
    ("Postman", "greenhouse", "postman"),
    ("Twilio", "greenhouse", "twilio"),
    ("Algolia", "greenhouse", "algolia"),
    ("Grafana Labs", "greenhouse", "grafanalabs"),
    ("ClickHouse", "greenhouse", "clickhouse"),
    ("dbt Labs", "greenhouse", "dbtlabsinc"),
    ("Fivetran", "greenhouse", "fivetran"),

    # ── Ashby ──
    ("Notion", "ashby", "notion"),
    ("Ramp", "ashby", "ramp"),
    ("Linear", "ashby", "linear"),
    ("Plaid", "ashby", "plaid"),
    ("Sentry", "ashby", "sentry"),
    ("Supabase", "ashby", "supabase"),
    ("Resend", "ashby", "resend"),
    ("Clerk", "ashby", "clerk"),
    ("Render", "ashby", "render"),
    ("Neon", "ashby", "neon"),
    ("OpenAI", "ashby", "openai"),
    ("Cohere", "ashby", "cohere"),
    ("Anyscale", "ashby", "anyscale"),
    ("Warp", "ashby", "warp"),
    ("Railway", "ashby", "railway"),
    ("Replit", "ashby", "replit"),
    ("Cursor", "ashby", "cursor"),

    # ── Lever ──
    ("Palantir", "lever", "palantir"),
    ("Spotify", "lever", "spotify"),
]

# ─── API Endpoints ────────────────────────────────────────────────────────────

GREENHOUSE_API = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"
ASHBY_API = "https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true"
LEVER_API = "https://api.lever.co/v0/postings/{slug}"

HEADERS = {
    "User-Agent": "StampVerified/1.0 (https://stampverified.com)",
    "Accept": "application/json",
}

REQUEST_TIMEOUT = 15
DELAY_BETWEEN_REQUESTS = 0.3


# ─── Greenhouse Scraper ───────────────────────────────────────────────────────

def _fetch_greenhouse(name, slug):
    """Fetch jobs from a Greenhouse board."""
    url = GREENHOUSE_API.format(slug=slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data.get("jobs", []):
            location = item.get("location", {}).get("name", "")
            content = item.get("content", "")
            description = re.sub(r'<[^>]+>', ' ', content).strip() if content else ""
            description = re.sub(r'\s+', ' ', description)

            jobs.append(_make_job(
                source="greenhouse",
                company=name,
                title=item.get("title", ""),
                location=location,
                description=description[:3000],
                url=item.get("absolute_url", ""),
                created_at=item.get("updated_at", ""),
            ))
        return jobs
    except Exception as e:
        print(f"    [Greenhouse] {name}: {e}")
        return []


# ─── Ashby Scraper ────────────────────────────────────────────────────────────

def _fetch_ashby(name, slug):
    """Fetch jobs from an Ashby board."""
    url = ASHBY_API.format(slug=slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data.get("jobs", []):
            title = item.get("title", "")
            location = item.get("location", "")
            if isinstance(location, dict):
                location = location.get("name", "")

            # Ashby compensation
            comp = item.get("compensation", {})
            salary_text = ""
            if comp:
                salary_text = comp.get("compensationTierSummary", "")

            # Description
            desc = item.get("descriptionPlain", "") or ""

            apply_url = item.get("jobUrl", "")
            if not apply_url and item.get("id"):
                apply_url = f"https://jobs.ashbyhq.com/{slug}/{item['id']}"

            jobs.append(_make_job(
                source="ashby",
                company=name,
                title=title,
                location=location,
                description=desc[:3000],
                url=apply_url,
                created_at=item.get("publishedAt", ""),
                salary_text=salary_text,
            ))
        return jobs
    except Exception as e:
        print(f"    [Ashby] {name}: {e}")
        return []


# ─── Lever Scraper ────────────────────────────────────────────────────────────

def _fetch_lever(name, slug):
    """Fetch jobs from a Lever board."""
    url = LEVER_API.format(slug=slug)
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()

        # Lever returns an array. Empty or very small = no real jobs
        if not isinstance(data, list) or len(data) <= 2:
            return []

        jobs = []
        for item in data:
            categories = item.get("categories", {})
            location = categories.get("location", "")
            team = categories.get("team", "")
            commitment = categories.get("commitment", "")

            # Description from lists
            desc_parts = []
            for section in item.get("lists", []):
                desc_parts.append(section.get("text", ""))
                for li in section.get("content", "").split("<li>"):
                    cleaned = re.sub(r'<[^>]+>', '', li).strip()
                    if cleaned:
                        desc_parts.append(cleaned)
            description = " ".join(desc_parts)

            # Additional description from opening
            opening = item.get("descriptionPlain", "") or item.get("description", "")
            if opening:
                opening = re.sub(r'<[^>]+>', ' ', opening).strip()
                description = opening + " " + description

            apply_url = item.get("applyUrl", "") or item.get("hostedUrl", "")

            jobs.append(_make_job(
                source="lever",
                company=name,
                title=item.get("text", ""),
                location=location,
                description=description[:3000],
                url=apply_url,
                created_at=item.get("createdAt", ""),
            ))
        return jobs
    except Exception as e:
        print(f"    [Lever] {name}: {e}")
        return []


# ─── Unified Job Format ───────────────────────────────────────────────────────

def _strip_html(text):
    """Remove HTML tags and clean up whitespace."""
    if not text:
        return ""
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&[a-zA-Z]+;', ' ', text)  # &lt; &gt; &amp; etc
    text = re.sub(r'&#\d+;', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def _make_job(source, company, title, location, description, url, created_at, salary_text=""):
    """Create a unified job dict regardless of ATS source."""
    loc_lower = location.lower() if location else ""
    remote = "remote" in loc_lower
    description = _strip_html(description)

    return {
        "source": source,
        "source_company": company,
        "title": title,
        "company": company,
        "location": location,
        "remote": remote,
        "description": description,
        "tags": [],
        "url": url,
        "created_at": str(created_at),
        "salary_text": salary_text,
    }


# ─── Main Scraper ─────────────────────────────────────────────────────────────

FETCHERS = {
    "greenhouse": _fetch_greenhouse,
    "ashby": _fetch_ashby,
    "lever": _fetch_lever,
}


def scrape_all_ats(companies=None):
    """Scrape all companies across all ATS platforms.

    Args:
        companies: Optional list of (name, ats, slug) tuples. Defaults to COMPANIES.

    Returns:
        List of job dicts in unified format.
    """
    if companies is None:
        companies = COMPANIES

    print(f"Scraping {len(companies)} companies across Greenhouse, Ashby, Lever...")
    all_jobs = []
    successful = 0
    failed = 0
    by_ats = {"greenhouse": 0, "ashby": 0, "lever": 0}

    for i, (name, ats, slug) in enumerate(companies):
        print(f"  [{i+1}/{len(companies)}] {name} ({ats})...", end="", flush=True)
        fetcher = FETCHERS.get(ats)
        if not fetcher:
            print(f" unknown ATS: {ats}")
            failed += 1
            continue

        jobs = fetcher(name, slug)
        if jobs:
            all_jobs.extend(jobs)
            successful += 1
            by_ats[ats] += len(jobs)
            print(f" {len(jobs)} jobs")
        else:
            failed += 1
            print(f" 0 jobs")

        if i < len(companies) - 1:
            time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\nDone: {successful} companies, {failed} empty/failed")
    print(f"  Greenhouse: {by_ats['greenhouse']} jobs")
    print(f"  Ashby: {by_ats['ashby']} jobs")
    print(f"  Lever: {by_ats['lever']} jobs")
    print(f"  Total: {len(all_jobs)} jobs")
    return all_jobs


# ─── Slug Discovery ───────────────────────────────────────────────────────────

def discover_company(company_name):
    """Try to discover which ATS a company uses and their slug.

    Tries common slug patterns across all three ATS platforms.

    Returns: (ats_platform, slug, job_count) or None if not found.
    """
    slugs_to_try = [
        company_name.lower().replace(" ", ""),
        company_name.lower().replace(" ", "-"),
        company_name.lower().replace(" ", "_"),
        company_name.lower(),
    ]

    for slug in slugs_to_try:
        # Try Greenhouse
        try:
            url = GREENHOUSE_API.format(slug=slug).split("?")[0]
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                count = len(data.get("jobs", []))
                if count > 0:
                    return ("greenhouse", slug, count)
        except Exception:
            pass

        # Try Ashby
        try:
            url = ASHBY_API.format(slug=slug).split("?")[0]
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                count = len(data.get("jobs", []))
                if count > 0:
                    return ("ashby", slug, count)
        except Exception:
            pass

        # Try Lever
        try:
            url = LEVER_API.format(slug=slug)
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list) and len(data) > 2:
                    return ("lever", slug, len(data))
        except Exception:
            pass

        time.sleep(0.2)

    return None


if __name__ == "__main__":
    jobs = scrape_all_ats()
    print(f"\n{len(set(j['company'] for j in jobs))} companies with active listings")
