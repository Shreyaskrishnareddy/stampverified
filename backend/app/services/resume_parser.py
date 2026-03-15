"""Resume parsing and keyword extraction.

Extracts job titles, company names, skills, location, and education
from resume PDF text. No AI needed for v1 — uses keyword matching
and pattern recognition.

Used to power the job matching feature: upload resume → extract
keywords → search JSearch API → show matching jobs.
"""

import re
import io
from dataclasses import dataclass, field


@dataclass
class ResumeData:
    """Extracted data from a resume."""
    titles: list[str] = field(default_factory=list)
    companies: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    location: str | None = None
    experience_years: int | None = None
    education: list[str] = field(default_factory=list)
    raw_text: str = ""


# Common tech skills to look for
_TECH_SKILLS = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "r", "sql", "nosql",
    "react", "angular", "vue", "next.js", "node.js", "express", "django",
    "flask", "fastapi", "spring", "rails",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "graphql", "rest", "grpc", "microservices",
    "machine learning", "deep learning", "nlp", "computer vision",
    "data science", "data engineering", "data analytics",
    "figma", "sketch", "adobe", "photoshop", "illustrator",
    "product management", "agile", "scrum", "jira",
    "git", "ci/cd", "jenkins", "github actions",
    "html", "css", "tailwind", "sass",
    "tensorflow", "pytorch", "pandas", "numpy",
    "tableau", "power bi", "excel",
    "salesforce", "hubspot", "stripe",
}

# Common job title keywords
_TITLE_PATTERNS = [
    r"(?:senior|sr\.?|junior|jr\.?|lead|staff|principal|chief|head of|vp of|director of|manager)?\s*"
    r"(?:software|frontend|backend|full[- ]?stack|mobile|devops|cloud|data|ml|ai|product|ux|ui|"
    r"qa|security|systems?|network|database|platform|infrastructure|site reliability|"
    r"solutions?|technical|engineering|design|marketing|sales|business|account|customer|"
    r"growth|content|operations|finance|hr|people|legal|compliance)\s*"
    r"(?:engineer|developer|architect|manager|designer|analyst|scientist|researcher|"
    r"lead|director|officer|consultant|specialist|coordinator|associate|intern)",
]

# Location patterns
_LOCATION_PATTERNS = [
    r"(?:based in|located in|location[:\s]+)([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)",
    r"(San Francisco|New York|Los Angeles|Seattle|Austin|Chicago|Boston|Denver|Portland|"
    r"Miami|Atlanta|San Diego|San Jose|Washington DC|Philadelphia|Dallas|Houston|"
    r"London|Berlin|Toronto|Vancouver|Singapore|Bangalore|Mumbai|Remote)",
]


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n\n".join(pages)
    except Exception as e:
        raise ValueError(f"Could not read PDF: {str(e)}")


def parse_resume(text: str) -> ResumeData:
    """Parse resume text and extract structured data.

    Uses regex and keyword matching. No AI. Works for ~70% of
    standard tech resumes.
    """
    result = ResumeData(raw_text=text)
    text_lower = text.lower()
    lines = text.split("\n")

    # Extract skills
    for skill in _TECH_SKILLS:
        # Match whole word (with word boundaries)
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            result.skills.append(skill)

    # Extract job titles
    for pattern in _TITLE_PATTERNS:
        matches = re.findall(pattern, text_lower)
        for match in matches:
            title = match.strip()
            if len(title) > 5 and title not in result.titles:
                result.titles.append(title.title())

    # Extract title-company pairs from common resume line formats
    _DATE_SUFFIX = r'\s*[\u2014\u2013\-|,]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|20[0-2]\d|19[89]\d|Present|Current).*$'

    # Patterns ordered by specificity (most specific first)
    _LINE_PATTERNS = [
        # "Title at Company" or "Title @ Company"
        r'^(.+?)\s+(?:at|@)\s+(.+?)$',
        # "Title | Company" or "Title | Company | dates"
        r'^([^|]+?)\s*\|\s*([^|]+?)(?:\s*\|.*)?$',
        # "Title — Company" or "Title – Company" (em/en dash)
        r'^(.+?)\s*[\u2014\u2013]\s*(.+?)$',
    ]

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped or len(line_stripped) < 5 or len(line_stripped) > 120:
            continue

        for pat in _LINE_PATTERNS:
            m = re.match(pat, line_stripped)
            if m:
                title = m.group(1).strip()
                company = m.group(2).strip()

                # Strip date fragments from the end of company
                company = re.sub(_DATE_SUFFIX, '', company, flags=re.IGNORECASE).strip()
                # Strip date fragments from end of title too
                title = re.sub(_DATE_SUFFIX, '', title, flags=re.IGNORECASE).strip()
                # Strip trailing punctuation
                company = company.rstrip('|,;: ')
                title = title.rstrip('|,;: ')

                if 3 < len(title) < 60 and title not in result.titles:
                    result.titles.append(title)
                if 2 < len(company) < 40 and company not in result.companies:
                    result.companies.append(company)
                break  # First matching pattern wins for this line

    # Extract location
    for pattern in _LOCATION_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            loc = match.group(1) if match.lastindex else match.group(0)
            result.location = loc.strip()
            break

    # Estimate experience years
    year_pattern = r'(20[0-2]\d|19[89]\d)'
    years = [int(y) for y in re.findall(year_pattern, text)]
    if years:
        result.experience_years = max(years) - min(years)

    # Extract education
    edu_patterns = [
        r"(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|Ph\.?D\.?|MBA)\s+(?:in\s+)?([A-Za-z\s]+?)(?:\s*[,\n|])",
        r"(?:Bachelor|Master|Doctor|PhD)\s*(?:of|in|'s)?\s*(?:of\s+)?(?:Science|Arts|Engineering|Business)?\s*(?:in\s+)?([A-Za-z\s]+?)(?:\s*[,\n|])",
    ]
    for pattern in edu_patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            edu = match.strip()
            if 3 < len(edu) < 50 and edu not in result.education:
                result.education.append(edu)

    # Filter out education entries that got into titles
    edu_keywords = {"b.s.", "b.a.", "m.s.", "m.a.", "ph.d.", "mba", "bachelor", "master", "doctor"}
    result.titles = [t for t in result.titles if not any(k in t.lower() for k in edu_keywords)]

    # Deduplicate and limit
    result.titles = list(dict.fromkeys(result.titles))[:5]
    result.companies = list(dict.fromkeys(result.companies))[:5]
    result.skills = list(dict.fromkeys(result.skills))[:15]
    result.education = list(dict.fromkeys(result.education))[:3]

    return result


def build_search_query(resume: ResumeData) -> str:
    """Build a search query string from parsed resume data.

    Prioritizes job titles, then top skills, then location.
    Returns a query suitable for JSearch API.
    """
    parts = []

    # Use the most recent/relevant title
    if resume.titles:
        parts.append(resume.titles[0])
    elif resume.skills:
        # No title found, use top skills
        parts.append(" ".join(resume.skills[:3]))

    return " ".join(parts)
