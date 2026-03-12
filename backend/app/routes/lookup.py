import json
from pathlib import Path
from fastapi import APIRouter
import httpx

router = APIRouter(prefix="/api/lookup", tags=["lookup"])

# Pre-processed university data: list of (lowercase_name, result_dict)
_universities_index: list[tuple[str, dict]] | None = None


def _load_universities() -> list[tuple[str, dict]]:
    """Load and index the HIPO universities dataset."""
    global _universities_index
    if _universities_index is not None:
        return _universities_index

    data_path = Path(__file__).parent.parent.parent / "data" / "universities.json"
    if data_path.exists():
        with open(data_path) as f:
            raw = json.load(f)
    else:
        raw = []

    _universities_index = []
    for uni in raw:
        name = uni.get("name", "")
        domains = uni.get("domains", [])
        web_pages = uni.get("web_pages", [])
        _universities_index.append((
            name.lower(),
            {
                "name": name,
                "domain": domains[0] if domains else "",
                "country": uni.get("country", ""),
                "web_page": web_pages[0] if web_pages else "",
            },
        ))

    return _universities_index


@router.get("/companies")
async def search_companies(q: str):
    """Proxy for Clearbit Autocomplete API.

    Returns company suggestions with name, domain, and logo.
    Free, no API key needed.
    """
    if not q or len(q) < 2:
        return []

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://autocomplete.clearbit.com/v1/companies/suggest",
                params={"query": q},
                timeout=5.0,
            )
            resp.raise_for_status()
            companies = resp.json()

            # Return simplified format
            return [
                {
                    "name": c.get("name", ""),
                    "domain": c.get("domain", ""),
                    "logo": c.get("logo", ""),
                }
                for c in companies[:10]
            ]
    except Exception as e:
        print(f"[LOOKUP] Clearbit error: {e}")
        return []


@router.get("/universities")
async def search_universities(q: str):
    """Search the HIPO university dataset.

    Returns university name, domain, and country.
    Fully local — no external API call.
    """
    if not q or len(q) < 2:
        return []

    index = _load_universities()
    query = q.lower()

    results = []
    for lower_name, entry in index:
        if query in lower_name:
            results.append(entry)
            if len(results) >= 10:
                break

    return results
