"""
Greenhouse career page scraper.
Pulls jobs from 50 tech companies via Greenhouse's public API.
"""

import requests
import json
import time
import re
from datetime import datetime

# 50 tech companies on Greenhouse
# Format: (display_name, greenhouse_board_slug)
COMPANIES = [
    ("Airbnb", "airbnb"),
    ("Stripe", "stripe"),
    ("Figma", "figma"),
    ("Notion", "notion"),
    ("Discord", "discord"),
    ("Canva", "canva"),
    ("Cloudflare", "cloudflare"),
    ("Databricks", "databricks"),
    ("Datadog", "datadog"),
    ("HashiCorp", "hashicorp"),
    ("Twitch", "twitch"),
    ("Square", "squareup"),
    ("Plaid", "plaid"),
    ("Coinbase", "coinbase"),
    ("Robinhood", "robinhood"),
    ("DoorDash", "doordash"),
    ("Instacart", "instacart"),
    ("Pinterest", "pinterest"),
    ("Snap", "snap"),
    ("Reddit", "reddit"),
    ("Palantir", "palantir"),
    ("Ramp", "ramp"),
    ("Brex", "brex"),
    ("Airtable", "airtable"),
    ("Retool", "retool"),
    ("Vercel", "vercel"),
    ("Supabase", "supabase"),
    ("Linear", "linear"),
    ("Loom", "loom"),
    ("Miro", "miro"),
    ("GitLab", "gitlab"),
    ("Elastic", "elastic"),
    ("MongoDB", "mongodb"),
    ("Cockroach Labs", "cockroachlabs"),
    ("PlanetScale", "planetscale"),
    ("Neon", "neondatabase"),
    ("Sentry", "sentry"),
    ("LaunchDarkly", "launchdarkly"),
    ("Postman", "postman"),
    ("Twilio", "twilio"),
    ("SendGrid", "sendgrid"),
    ("Algolia", "algolia"),
    ("Auth0", "auth0"),
    ("Grafana Labs", "grafanalabs"),
    ("ClickHouse", "clickhouse"),
    ("dbt Labs", "dbtlabsinc"),
    ("Fivetran", "fivetran"),
    ("Census", "census"),
    ("Weights & Biases", "wandb"),
    ("Hugging Face", "huggingface"),
]

API_BASE = "https://boards-api.greenhouse.io/v1/boards"


def fetch_company_jobs(name, slug):
    """Fetch all jobs from a single company's Greenhouse board."""
    url = f"{API_BASE}/{slug}/jobs?content=true"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 404:
            return []
        resp.raise_for_status()
        data = resp.json()
        jobs = []
        for item in data.get("jobs", []):
            location = item.get("location", {}).get("name", "")
            content = item.get("content", "")
            # Strip HTML tags from content
            description = re.sub(r'<[^>]+>', ' ', content) if content else ""
            description = re.sub(r'\s+', ' ', description).strip()

            jobs.append({
                "source": "greenhouse",
                "source_company": name,
                "title": item.get("title", ""),
                "company": name,
                "location": location,
                "remote": "remote" in location.lower(),
                "description": description[:3000],  # cap at 3000 chars
                "tags": [],
                "url": item.get("absolute_url", ""),
                "created_at": item.get("updated_at", ""),
                "job_id": str(item.get("id", "")),
            })
        return jobs
    except Exception as e:
        print(f"    Error: {e}")
        return []


def scrape_greenhouse(companies=None):
    """Scrape all Greenhouse companies."""
    if companies is None:
        companies = COMPANIES

    print(f"Scraping {len(companies)} companies from Greenhouse...")
    all_jobs = []
    successful = 0
    failed = 0

    for i, (name, slug) in enumerate(companies):
        print(f"  [{i+1}/{len(companies)}] {name}...", end="", flush=True)
        jobs = fetch_company_jobs(name, slug)
        if jobs:
            all_jobs.extend(jobs)
            successful += 1
            print(f" {len(jobs)} jobs")
        else:
            failed += 1
            print(f" 0 jobs")
        # Small delay to be respectful
        if i < len(companies) - 1:
            time.sleep(0.3)

    print(f"\nDone: {successful} companies scraped, {failed} empty/failed")
    print(f"Total jobs: {len(all_jobs)}")
    return all_jobs


def save_jobs(jobs, filepath="greenhouse_jobs.json"):
    """Save scraped jobs to JSON file."""
    with open(filepath, "w") as f:
        json.dump({
            "scraped_at": datetime.now().isoformat(),
            "total_jobs": len(jobs),
            "jobs": jobs,
        }, f, indent=2)
    print(f"Saved to {filepath}")


def load_jobs(filepath="greenhouse_jobs.json"):
    """Load previously scraped jobs from JSON file."""
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
        print(f"Loaded {data['total_jobs']} jobs (scraped at {data['scraped_at']})")
        return data["jobs"]
    except FileNotFoundError:
        return None


if __name__ == "__main__":
    jobs = scrape_greenhouse()
    save_jobs(jobs)

    # Quick stats
    companies = set(j["company"] for j in jobs)
    us_remote = [j for j in jobs if j["remote"] or "united states" in j["location"].lower()
                 or any(s in j["location"].lower() for s in ["san francisco", "new york", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "remote"])]
    print(f"\n{len(companies)} companies with active listings")
    print(f"~{len(us_remote)} US/Remote jobs (rough estimate)")
