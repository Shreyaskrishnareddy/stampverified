"""
Greenhouse job matching engine for StampVerified.

Loads Greenhouse jobs from JSON, matches against parsed resume data,
returns scored results. Replaces JSearch API for external job matching.

Scoring: 60% skill match + 40% keyword depth
Hard filters: location (US only), title (engineering), seniority, deal-breakers
"""

import re
import json
import os
from dataclasses import dataclass

# ─── Skill Synonyms ──────────────────────────────────────────────────────────

SKILL_SYNONYMS = {
    "js": "javascript", "ts": "typescript",
    "node": "node.js", "nodejs": "node.js",
    "react.js": "react", "reactjs": "react",
    "nextjs": "next.js", "next": "next.js",
    "postgres": "postgresql", "psql": "postgresql",
    "mongo": "mongodb", "k8s": "kubernetes",
    "ml": "machine learning", "ai": "artificial intelligence",
    "llm": "llm", "large language model": "llm", "large language models": "llm",
    "nlp": "natural language processing",
    "gpt": "llm", "openai": "llm", "langchain": "langchain", "rag": "rag",
    "fastapi": "fastapi", "fast api": "fastapi",
    "aws": "aws", "amazon web services": "aws",
    "azure": "azure", "microsoft azure": "azure",
    "ci/cd": "ci/cd", "cicd": "ci/cd",
    "docker": "docker", "containerization": "docker",
    "sql": "sql", "mysql": "sql",
    "rest": "rest api", "rest api": "rest api", "restful": "rest api",
    "microservices": "microservices", "micro-services": "microservices",
    "pytorch": "pytorch", "torch": "pytorch",
    "scikit-learn": "scikit-learn", "sklearn": "scikit-learn",
    "pandas": "pandas", "numpy": "numpy",
    "redis": "redis", "neo4j": "neo4j",
    "supabase": "supabase", "flask": "flask",
    "git": "git", "github": "git",
    "linux": "linux", "unix": "linux",
    "bash": "bash", "shell": "bash",
    "html": "html", "css": "css",
    "c++": "c++", "cpp": "c++",
    "java": "java", "python": "python", "python3": "python",
    "opencv": "opencv", "computer vision": "opencv",
    "golang": "go", "ruby": "ruby",
    "rails": "ruby on rails", "ruby on rails": "ruby on rails",
    "kafka": "kafka", "spark": "spark",
    "airflow": "airflow", "terraform": "terraform",
    "graphql": "graphql", "elasticsearch": "elasticsearch",
    "elastic": "elasticsearch",
    "tensorflow": "tensorflow", "keras": "tensorflow",
    "tailwind": "tailwind", "sass": "sass",
    "spring": "spring", "spring boot": "spring",
    "django": "django", "express": "express",
    "angular": "angular", "vue": "vue",
    "swift": "swift", "kotlin": "kotlin",
    "scala": "scala", "rust": "rust",
    "firebase": "firebase", "dynamodb": "dynamodb",
    "cassandra": "cassandra",
    "figma": "figma", "jira": "jira",
    "jenkins": "jenkins", "github actions": "github actions",
}

# ─── Title Keywords ───────────────────────────────────────────────────────────

TITLE_KEYWORDS_HIGH = [
    "software development engineer", "sde",
    "software engineer", "software developer",
    "ai engineer", "ai developer",
    "ml engineer", "machine learning engineer", "ml developer",
    "backend engineer", "backend developer",
    "fullstack engineer", "full stack engineer", "full-stack engineer",
    "fullstack developer", "full stack developer", "full-stack developer",
    "python engineer", "python developer",
    "applied scientist", "research engineer", "nlp engineer",
]

TITLE_KEYWORDS_MEDIUM = [
    "platform engineer", "data engineer",
    "frontend engineer", "front-end engineer",
    "developer", "web developer",
]

NON_ENGINEERING = [
    "account manager", "sales manager", "sales rep", "marketing manager",
    "marketing specialist", "recruiter", "writer", "copywriter",
    "content strategist", "content manager",
    "customer success", "support specialist", "business development",
    "hr ", "human resources", "office manager", "executive assistant",
    "legal counsel", "finance manager", "accountant",
    "graphic designer", "ui designer", "ux designer",
    "social media", "community manager",
    "product manager", "technical product manager",
    "program manager", "technical program manager",
    "scrum master", "agile coach", "talent acquisition",
    "operations manager", "procurement", "supply chain",
]

# ─── Seniority ────────────────────────────────────────────────────────────────

SENIORITY = {
    "management": ["director", "vp ", "vp,", "vice president", "head of", "chief", "cto", "cio"],
    "senior": ["senior", "sr.", "sr ", "lead", "principal", "staff", "iii", "architect", "distinguished"],
    "junior": ["junior", "jr.", "jr ", "entry level", "entry-level", "associate", "new grad", "graduate", "intern", "internship"],
    "mid": ["mid", "mid-level", "mid level", "intermediate", "ii"],
}

# ─── Deal Breakers ────────────────────────────────────────────────────────────

DEAL_BREAKER_PATTERNS = [
    r"ts/sci\s+clearance", r"top\s+secret.*clearance", r"secret\s+clearance",
    r"security\s+clearance\s+required", r"must\s+have.*clearance",
    r"active\s+clearance", r"clearance\s+required", r"polygraph",
    r"us\s+citizen(ship)?\s+(required|only|must)", r"must\s+be\s+(a\s+)?us\s+citizen",
    r"no\s+visa\s+sponsorship", r"will\s+not\s+sponsor", r"cannot\s+sponsor",
]

# ─── US Locations ─────────────────────────────────────────────────────────────

US_LOCATIONS = [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
    "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
    "rhode island", "south carolina", "south dakota", "tennessee", "texas",
    "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming",
    "san francisco", "new york", "seattle", "austin", "boston", "chicago",
    "los angeles", "denver", "portland", "atlanta", "dallas", "houston",
    "san diego", "san jose", "phoenix", "philadelphia", "raleigh",
    "salt lake", "minneapolis", "detroit", "pittsburgh", "charlotte",
    "mountain view", "palo alto", "menlo park", "bellevue", "redmond",
    "oakland", "brooklyn", "manhattan",
]

FOREIGN_INDICATORS = [
    "europe", "eu ", "uk ", "united kingdom", "england", "germany", "berlin",
    "munich", "hamburg", "frankfurt", "france", "paris", "india", "bangalore",
    "mumbai", "hyderabad", "chennai", "pune", "delhi", "canada", "toronto",
    "vancouver", "montreal", "australia", "sydney", "melbourne", "singapore",
    "japan", "tokyo", "brazil", "mexico", "ireland", "dublin", "netherlands",
    "amsterdam", "spain", "portugal", "italy", "austria", "switzerland",
    "poland", "warsaw", "romania", "ukraine", "israel", "tel aviv",
    "china", "beijing", "shanghai", "korea", "seoul", "argentina",
    "colombia", "chile", "peru", "nigeria", "kenya", "south africa",
    "philippines", "vietnam", "indonesia", "serbia", "croatia", "czech",
    "hungary", "bulgaria", "pakistan", "bangladesh", "egypt",
    "emea", "apac", "latam",
]

FOREIGN_IN_TITLE = [
    "brazil", "brasil", "india", "germany", "uk ", "london", "berlin",
    "mumbai", "bangalore", "hyderabad", "toronto", "canada", "australia",
    "singapore", "japan", "tokyo", "mexico", "ireland", "dublin",
    "amsterdam", "paris", "france", "spain", "argentina", "colombia",
    "poland", "romania", "ukraine", "turkey", "israel", "europe",
    "korea", "china", "latam", "emea", "apac", "serbia",
]

# ─── Job Data ─────────────────────────────────────────────────────────────────

_cached_greenhouse_jobs = None


def _load_greenhouse_jobs():
    """Load Greenhouse jobs from JSON file."""
    global _cached_greenhouse_jobs
    if _cached_greenhouse_jobs is not None:
        return _cached_greenhouse_jobs

    json_path = os.path.join(os.path.dirname(__file__), "..", "..", "greenhouse_jobs.json")
    json_path = os.path.abspath(json_path)

    try:
        with open(json_path, "r") as f:
            data = json.load(f)
        _cached_greenhouse_jobs = data.get("jobs", [])
        print(f"[GREENHOUSE] Loaded {len(_cached_greenhouse_jobs)} jobs")
        return _cached_greenhouse_jobs
    except FileNotFoundError:
        print(f"[GREENHOUSE] greenhouse_jobs.json not found at {json_path}")
        return []
    except Exception as e:
        print(f"[GREENHOUSE] Error loading jobs: {e}")
        return []


# ─── Matching Functions ───────────────────────────────────────────────────────

def normalize_skill(skill):
    s = skill.lower().strip()
    return SKILL_SYNONYMS.get(s, s)


def extract_skills_from_text(text):
    if not text:
        return set()
    text_lower = text.lower()
    found = set()
    all_known = set(SKILL_SYNONYMS.keys()) | set(SKILL_SYNONYMS.values())
    for skill in all_known:
        if len(skill) <= 3:
            if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
                found.add(normalize_skill(skill))
        else:
            if skill in text_lower:
                found.add(normalize_skill(skill))
    return found


def _detect_deal_breakers(title, description):
    text = (title + " " + (description or "")).lower()
    for pattern in DEAL_BREAKER_PATTERNS:
        if re.search(pattern, text):
            return True
    return False


def _detect_seniority(title, description=""):
    title_lower = title.lower()
    for level, keywords in SENIORITY.items():
        for kw in keywords:
            if kw in title_lower:
                return level
    desc_lower = (description or "")[:500].lower()
    for level, keywords in SENIORITY.items():
        for kw in keywords:
            if kw in desc_lower:
                return level
    return "mid"


def _is_us_based(location_str):
    loc = (" " + location_str.lower() + " ")
    if "united states" in loc or "usa" in loc:
        return True
    for us_loc in US_LOCATIONS:
        if us_loc in loc:
            return True
    return False


def _passes_location_filter(job):
    location = job.get("location", "")
    if isinstance(location, list):
        location = " ".join(str(l) for l in location)
    loc_lower = (" " + location.lower() + " ")

    for indicator in FOREIGN_INDICATORS:
        if indicator in loc_lower:
            return False

    if job.get("remote"):
        us_terms = ["us", "usa", "united states", "north america",
                     "worldwide", "anywhere", "global", "americas"]
        if not location.strip():
            return True
        if any(t in loc_lower for t in us_terms):
            return True
        if _is_us_based(loc_lower):
            return True
        return False

    if _is_us_based(loc_lower):
        return True
    return False


def _passes_title_filter(title):
    title_lower = title.lower()
    for term in NON_ENGINEERING:
        if term in title_lower:
            return False
    for kw in TITLE_KEYWORDS_HIGH:
        if kw in title_lower:
            return True
    for kw in TITLE_KEYWORDS_MEDIUM:
        if kw in title_lower:
            return True
    return False


def _passes_experience_filter(job_seniority, candidate_level):
    levels = ["junior", "mid", "senior", "management"]
    if job_seniority not in levels:
        return True
    if candidate_level not in levels:
        return True
    diff = abs(levels.index(job_seniority) - levels.index(candidate_level))
    return diff <= 1


def _score_skill_match(candidate_skills, job_skills):
    if not job_skills:
        return 0.2
    candidate_normalized = {normalize_skill(s) for s in candidate_skills}
    job_normalized = {normalize_skill(s) for s in job_skills}
    if not job_normalized:
        return 0.2
    matches = candidate_normalized & job_normalized
    if len(job_normalized) <= 2:
        return min(len(matches) * 0.2, 0.4)
    if len(job_normalized) <= 4 and len(matches) <= 2:
        return min(len(matches) * 0.15, 0.4)
    score = len(matches) / len(job_normalized)
    if len(matches) >= 5:
        score = min(score + 0.1, 1.0)
    return min(score, 1.0)


def _score_keyword_depth(candidate_skills, description):
    if not description:
        return 0.2
    desc_lower = description.lower()
    depth_keywords = [
        "microservices", "rest api", "data pipeline", "real-time",
        "knowledge graph", "retrieval", "rag", "llm", "embeddings",
        "document processing", "semantic search", "vector",
        "authentication", "jwt", "role-based", "containeriz",
        "async", "concurrent", "horizontal scal",
        "fastapi", "next.js", "react", "postgresql",
        "machine learning", "deep learning", "neural",
        "nlp", "natural language", "computer vision",
        "trading", "quantitative", "financial",
        "aws", "cloud", "deploy", "docker",
        "full-stack", "full stack", "backend", "frontend",
    ]
    matches = sum(1 for kw in depth_keywords if kw in desc_lower)
    return min(matches / 8, 1.0)


def _generate_why_matched(matched_skills, total_matched):
    top = sorted(matched_skills)[:4]
    if len(top) >= 2:
        return f"Your {', '.join(top[:-1])} and {top[-1]} experience aligns with this role. {total_matched} skill{'s' if total_matched != 1 else ''} matched."
    elif len(top) == 1:
        return f"Your {top[0]} experience aligns with this role."
    return "Role matches your experience profile."


# ─── Main Match Function ──────────────────────────────────────────────────────

def match_greenhouse_jobs_from_list(
    jobs: list[dict],
    candidate_skills: list[str],
    experience_level: str = "mid",
    threshold: int = 1,
) -> list[dict]:
    """Match candidate against a provided list of Greenhouse jobs.

    Args:
        jobs: List of job dicts (from scrape_greenhouse())
        candidate_skills: List of candidate's skills (strings)
        experience_level: junior, mid, or senior
        threshold: minimum score to include (0-100)

    Returns:
        List of matched jobs with scores, sorted by score descending.
    """
    if not jobs:
        return []

    candidate_skills_lower = {s.lower() for s in candidate_skills}
    known_skills = set(SKILL_SYNONYMS.keys()) | set(SKILL_SYNONYMS.values())
    results = []

    for job in jobs:
        title = job.get("title", "")
        description = job.get("description", "")
        title_lower = title.lower()

        # Hard filter 1: deal-breakers
        if _detect_deal_breakers(title, description):
            continue

        # Hard filter 2: foreign location in title
        if any(loc in title_lower for loc in FOREIGN_IN_TITLE):
            continue

        # Hard filter 3: location (US only)
        if not _passes_location_filter(job):
            continue

        # Hard filter 4: title relevance
        if not _passes_title_filter(title):
            continue

        # Hard filter 5: seniority
        seniority = _detect_seniority(title, description)
        if not _passes_experience_filter(seniority, experience_level):
            continue

        # Scoring
        raw_tags = set(job.get("tags", []))
        filtered_tags = {t for t in raw_tags if t.lower() in known_skills}
        desc_skills = extract_skills_from_text(description)
        job_skills = filtered_tags | desc_skills

        skill_score = _score_skill_match(candidate_skills_lower, job_skills)
        depth_score = _score_keyword_depth(candidate_skills_lower, description)

        total = (skill_score * 0.60) + (depth_score * 0.40)

        matched_skills = list(
            candidate_skills_lower & {normalize_skill(s) for s in job_skills}
        )

        if len(matched_skills) <= 1 and skill_score < 0.5:
            total *= 0.7

        score = round(total * 100)
        if score < threshold:
            continue

        # Location formatting
        location = job.get("location", "")
        if isinstance(location, list):
            location = ", ".join(str(l) for l in location)

        # Detect location type
        loc_lower = location.lower() if location else ""
        if job.get("remote") or "remote" in loc_lower:
            location_type = "remote"
        elif "hybrid" in loc_lower:
            location_type = "hybrid"
        else:
            location_type = "onsite"

        # Company domain for favicon
        company = job.get("company", "")
        source_company = job.get("source_company", company)
        company_domain = job.get("company_domain", "")
        if not company_domain and source_company:
            company_domain = source_company.lower().replace(" ", "") + ".com"

        results.append({
            "title": title,
            "company": company,
            "company_logo": None,
            "company_domain": company_domain,
            "location": location or "Not specified",
            "location_type": location_type,
            "employment_type": "full_time",
            "salary_min": job.get("salary_min"),
            "salary_max": job.get("salary_max"),
            "salary_currency": "USD",
            "description_snippet": (description or "")[:200],
            "apply_link": job.get("url", ""),
            "posted_at": job.get("created_at"),
            "source": f"via {source_company}",
            "is_stamp_verified": False,
            "score": score,
            "matched_skills": sorted(matched_skills)[:8],
            "why_matched": _generate_why_matched(matched_skills, len(matched_skills)),
            "seniority": seniority,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results
