"""Extract structured fields from pasted job description text.

Parses salary, location, employment type, experience level, and title
from raw JD text using regex patterns. Used in the paste-first job
posting flow — recruiter pastes JD, we auto-fill fields, they review.

MVP implementation: simple regex. No AI, no NLP. Works for ~70-80%
of standard JDs, especially in the tech wedge.
"""

import re
from dataclasses import dataclass, field


@dataclass
class ExtractedFields:
    """Fields auto-extracted from a pasted job description."""
    title: str | None = None
    description: str | None = None                  # Full JD text (from URL import)
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    location: str | None = None
    location_type: str | None = None               # remote | hybrid | onsite
    employment_type: str | None = None              # full_time | part_time | contract | internship
    experience_level: str | None = None             # entry | mid | senior | lead | executive
    confidence: dict = field(default_factory=dict)  # field → confidence score for debugging


def extract_from_text(text: str) -> ExtractedFields:
    """Extract structured fields from raw job description text.

    Args:
        text: The pasted job description (plain text or markdown).

    Returns:
        ExtractedFields with whatever could be parsed. Missing fields are None.
    """
    result = ExtractedFields()
    lines = text.strip().split("\n")

    # ── Title: first non-empty line ──
    for line in lines:
        line = line.strip()
        # Skip lines that look like company names, URLs, or section headers
        if line and not line.startswith("http") and not line.startswith("#") and len(line) < 120:
            # Remove markdown heading markers
            title = re.sub(r"^#+\s*", "", line).strip()
            if title and len(title) > 3:
                result.title = title
                result.confidence["title"] = 0.7
                break

    text_lower = text.lower()

    # ── Salary: look for dollar amounts ──
    # Patterns: "$150K - $200K", "$150,000-$200,000", "$150k to $200k"
    salary_patterns = [
        # $150K-$200K or $150k - $200k
        r'\$\s*(\d{2,3})\s*k\s*[-–—to]+\s*\$?\s*(\d{2,3})\s*k',
        # $150,000 - $200,000
        r'\$\s*(\d{2,3}),?(\d{3})\s*[-–—to]+\s*\$?\s*(\d{2,3}),?(\d{3})',
        # $150000-$200000
        r'\$\s*(\d{5,6})\s*[-–—to]+\s*\$?\s*(\d{5,6})',
    ]

    for pattern in salary_patterns:
        match = re.search(pattern, text_lower)
        if match:
            groups = match.groups()
            if len(groups) == 2 and all(len(g) <= 3 for g in groups):
                # $150K-$200K format
                result.salary_min = int(groups[0]) * 1000
                result.salary_max = int(groups[1]) * 1000
            elif len(groups) == 4:
                # $150,000-$200,000 format
                result.salary_min = int(groups[0] + groups[1])
                result.salary_max = int(groups[2] + groups[3])
            elif len(groups) == 2:
                # $150000-$200000 format
                result.salary_min = int(groups[0])
                result.salary_max = int(groups[1])

            if result.salary_min and result.salary_max:
                # Sanity check
                if result.salary_max < result.salary_min:
                    result.salary_min, result.salary_max = result.salary_max, result.salary_min
                result.confidence["salary"] = 0.8
                break

    # ── Location type ──
    if re.search(r'\b(fully\s+)?remote\b', text_lower):
        result.location_type = "remote"
        result.confidence["location_type"] = 0.8
    elif re.search(r'\bhybrid\b', text_lower):
        result.location_type = "hybrid"
        result.confidence["location_type"] = 0.8
    elif re.search(r'\bon[\s-]?site\b|\bin[\s-]?office\b', text_lower):
        result.location_type = "onsite"
        result.confidence["location_type"] = 0.7

    # ── Location: city names ──
    # Look for "City, ST" or "City, State" patterns
    city_pattern = r'(?:located?\s+(?:in|at)|based\s+in|location[:\s]+|office\s+in)\s+([A-Z][a-zA-Z\s]+(?:,\s*[A-Z]{2})?)'
    city_match = re.search(city_pattern, text)
    if city_match:
        result.location = city_match.group(1).strip().rstrip(".")
        result.confidence["location"] = 0.6

    if not result.location:
        # Try common city names directly
        known_cities = [
            "San Francisco", "New York", "Los Angeles", "Seattle", "Austin",
            "Chicago", "Boston", "Denver", "Portland", "Miami", "Atlanta",
            "San Diego", "San Jose", "Washington DC", "Philadelphia",
            "London", "Berlin", "Toronto", "Vancouver", "Singapore",
        ]
        for city in known_cities:
            if city.lower() in text_lower:
                result.location = city
                result.confidence["location"] = 0.5
                break

    # ── Employment type ──
    if re.search(r'\binternship\b|\bintern\b', text_lower):
        result.employment_type = "internship"
    elif re.search(r'\bcontract\b|\bfreelance\b|\b1099\b', text_lower):
        result.employment_type = "contract"
    elif re.search(r'\bpart[\s-]?time\b', text_lower):
        result.employment_type = "part_time"
    elif re.search(r'\bfull[\s-]?time\b', text_lower):
        result.employment_type = "full_time"

    if result.employment_type:
        result.confidence["employment_type"] = 0.8

    # ── Experience level ──
    if re.search(r'\bsenior\b|\bsr\.?\b|\bstaff\b|\bprincipal\b', text_lower):
        result.experience_level = "senior"
    elif re.search(r'\blead\b|\bmanager\b|\bdirector\b|\bhead of\b', text_lower):
        result.experience_level = "lead"
    elif re.search(r'\bjunior\b|\bjr\.?\b|\bentry[\s-]level\b|\bnew grad\b', text_lower):
        result.experience_level = "entry"
    elif re.search(r'\bexecutive\b|\bvp\b|\bc-level\b|\bchief\b', text_lower):
        result.experience_level = "executive"
    else:
        result.experience_level = "mid"

    if result.experience_level:
        result.confidence["experience_level"] = 0.6

    return result
