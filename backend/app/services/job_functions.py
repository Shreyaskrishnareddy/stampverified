"""Auto-detect job function from job title.

Maps keywords in the title to the platform's job function taxonomy.
The recruiter never sees or picks a function — it's derived internally.
This powers feed filtering and candidate matching.

The mapping is intentionally simple (keyword-based) for MVP.
Can be upgraded to ML-based classification later.
"""

from app.config import get_supabase

# Keyword → function slug mapping.
# Order matters: more specific patterns should come before general ones.
# Checked against lowercase title.
_TITLE_KEYWORDS: list[tuple[list[str], str]] = [
    # Engineering specializations (check before generic "engineer")
    (["frontend", "front-end", "front end", "react", "vue", "angular", "ui engineer"], "frontend-engineering"),
    (["backend", "back-end", "back end", "server-side", "api engineer"], "backend-engineering"),
    (["full stack", "fullstack", "full-stack"], "full-stack-engineering"),
    (["mobile", "ios", "android", "react native", "flutter", "swift developer", "kotlin developer"], "mobile-engineering"),
    (["devops", "sre", "site reliability", "infrastructure", "platform engineer", "cloud engineer"], "devops-infrastructure"),
    (["data engineer", "data pipeline", "etl", "data infrastructure"], "data-engineering"),
    (["machine learning", "ml engineer", "ai engineer", "deep learning", "nlp engineer", "computer vision"], "machine-learning-ai"),
    (["qa", "quality assurance", "test engineer", "sdet", "automation engineer"], "qa-testing"),
    (["security engineer", "appsec", "infosec", "cybersecurity", "security analyst"], "security-engineering"),
    (["software engineer", "software developer", "swe", "engineer"], "software-engineering"),

    # Product
    (["technical program", "tpm"], "technical-program-management"),
    (["product manager", "product lead", "product owner", "head of product"], "product-management"),

    # Design
    (["ux research", "user research"], "ux-research"),
    (["brand design", "visual design", "graphic design"], "brand-visual-design"),
    (["product design", "ux design", "ui/ux", "designer"], "product-design"),

    # Data
    (["data scientist", "research scientist"], "data-science"),
    (["data analyst", "business intelligence", "bi analyst", "analytics"], "data-analytics"),

    # Business
    (["account manager", "account executive", "account management"], "account-management"),
    (["customer success", "csm", "client success"], "customer-success"),
    (["business development", "bdr", "partnerships"], "business-development"),
    (["sales", "ae", "account executive", "revenue"], "sales"),

    # Marketing
    (["growth", "growth marketing", "growth hacker"], "growth"),
    (["content", "copywriter", "content writer", "editor", "content marketing"], "content"),
    (["marketing", "demand gen", "performance marketing", "brand marketing"], "marketing"),

    # Operations
    (["project manager", "program manager", "scrum master"], "project-management"),
    (["strategy", "chief of staff", "strategic"], "strategy"),
    (["operations", "ops manager", "business operations"], "operations"),

    # Finance
    (["accounting", "accountant", "controller", "bookkeeper"], "accounting"),
    (["finance", "financial analyst", "fp&a", "cfo", "treasury"], "finance"),

    # People
    (["recruiter", "talent acquisition", "sourcer"], "recruiting"),
    (["hr", "human resources", "people operations", "people partner", "hrbp"], "hr-people-operations"),

    # Legal
    (["compliance", "regulatory"], "compliance"),
    (["legal", "counsel", "attorney", "lawyer", "paralegal"], "legal"),
]

# Cache: slug → function UUID (populated on first call)
_slug_to_id: dict[str, str] = {}


def _load_slug_map():
    """Load job function slugs → IDs from the database. Cached after first call."""
    if _slug_to_id:
        return

    supabase = get_supabase()
    result = supabase.table("job_functions").select("id,slug").execute()
    for row in (result.data or []):
        _slug_to_id[row["slug"]] = row["id"]


def detect_job_function(title: str) -> str | None:
    """Detect the job function ID from a job title.

    Returns the UUID of the matching job_function, or None if no match.
    Uses keyword matching against the title — first match wins.

    Args:
        title: The job posting title (e.g., "Senior Software Engineer")

    Returns:
        The job_function UUID, or None if undetectable.
    """
    _load_slug_map()

    title_lower = title.lower().strip()

    for keywords, slug in _TITLE_KEYWORDS:
        for keyword in keywords:
            if keyword in title_lower:
                return _slug_to_id.get(slug)

    return None


def get_all_functions() -> list[dict]:
    """Get all job functions, ordered by category and sort_order.

    Used by the candidate preferences multi-select and the jobs filter.
    """
    supabase = get_supabase()
    result = (
        supabase.table("job_functions")
        .select("id,name,slug,category,sort_order")
        .order("sort_order")
        .execute()
    )
    return result.data or []
