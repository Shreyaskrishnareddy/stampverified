"""Tests for resume parser — title/company extraction, skills, location.

Tests the common resume formats that the parser must handle correctly.
Parser quality directly affects match quality and user trust.
"""

import pytest
from app.services.resume_parser import parse_resume, build_search_query
from app.services.job_search import validate_resume_quality


# ─── Title + Company Extraction ──────────────────────────────────────────────


class TestTitleAtCompany:
    """Format: Title at Company"""

    def test_basic(self):
        r = parse_resume("Software Engineer at Google")
        assert "Software Engineer" in r.titles
        assert "Google" in r.companies

    def test_with_seniority(self):
        r = parse_resume("Senior Product Manager at Stripe")
        assert "Senior Product Manager" in r.titles
        assert "Stripe" in r.companies

    def test_at_symbol(self):
        r = parse_resume("Data Scientist @ Meta")
        assert "Data Scientist" in r.titles
        assert "Meta" in r.companies


class TestTitlePipeCompany:
    """Format: Title | Company"""

    def test_basic_pipe(self):
        r = parse_resume("Software Engineer | Google")
        assert "Software Engineer" in r.titles
        assert "Google" in r.companies

    def test_pipe_with_dates(self):
        r = parse_resume("Product Manager | Stripe | 2020-2023")
        assert "Product Manager" in r.titles
        assert "Stripe" in r.companies
        assert "2020-2023" not in r.companies

    def test_pipe_with_month_dates(self):
        r = parse_resume("Backend Engineer | Acme Corp | Jan 2021 - Dec 2023")
        assert "Backend Engineer" in r.titles
        assert "Acme Corp" in r.companies


class TestTitleDashCompany:
    """Format: Title — Company (em dash / en dash)"""

    def test_em_dash(self):
        r = parse_resume("AI Engineer \u2014 Stamp")
        assert "AI Engineer" in r.titles
        assert "Stamp" in r.companies

    def test_en_dash(self):
        r = parse_resume("DevOps Engineer \u2013 Amazon")
        assert "DevOps Engineer" in r.titles
        assert "Amazon" in r.companies

    def test_dash_with_dates(self):
        r = parse_resume("Frontend Developer \u2014 Shopify \u2014 Mar 2022 to Present")
        assert "Frontend Developer" in r.titles
        assert "Shopify" in r.companies


class TestDateStripping:
    """Dates should be stripped from company names, not included."""

    def test_strips_month_year(self):
        r = parse_resume("Engineer at Acme Corp - Jan 2023 to Present")
        assert "Acme Corp" in r.companies
        assert not any("Jan" in c for c in r.companies)
        assert not any("2023" in c for c in r.companies)

    def test_strips_year_range(self):
        r = parse_resume("Designer | Studio X | 2019-2022")
        assert "Studio X" in r.companies
        assert not any("2019" in c for c in r.companies)


class TestEdgeCases:
    """Edge cases that should not break the parser."""

    def test_empty_string(self):
        r = parse_resume("")
        assert r.titles == []
        assert r.companies == []

    def test_short_text(self):
        r = parse_resume("Hi")
        assert r.titles == []

    def test_long_line_ignored(self):
        r = parse_resume("A" * 130)
        assert r.titles == []

    def test_education_not_in_titles(self):
        r = parse_resume("B.S. Computer Science, Stanford University\nSoftware Engineer at Google")
        assert not any("B.S." in t for t in r.titles)
        assert "Software Engineer" in r.titles

    def test_multiple_roles(self):
        r = parse_resume("""
Software Engineer at Google
Senior Engineer | Meta | 2022-2024
Tech Lead \u2014 Stripe
""")
        assert len(r.titles) >= 3
        assert "Google" in r.companies
        assert "Meta" in r.companies
        assert "Stripe" in r.companies


# ─── Skills Extraction ───────────────────────────────────────────────────────


class TestSkillsExtraction:
    """Skills should be extracted from resume text."""

    def test_common_tech_skills(self):
        r = parse_resume("Experience with Python, React, AWS, Docker, PostgreSQL")
        assert "python" in r.skills
        assert "react" in r.skills
        assert "aws" in r.skills
        assert "docker" in r.skills
        assert "postgresql" in r.skills

    def test_case_insensitive(self):
        r = parse_resume("PYTHON JAVASCRIPT TYPESCRIPT")
        assert "python" in r.skills
        assert "javascript" in r.skills

    def test_no_false_positives(self):
        r = parse_resume("I like to eat pizza and watch movies")
        assert len(r.skills) == 0


# ─── Location Extraction ─────────────────────────────────────────────────────


class TestLocationExtraction:
    """Location should be extracted from resume text."""

    def test_known_city(self):
        r = parse_resume("Based in San Francisco, working on distributed systems")
        assert r.location == "San Francisco"

    def test_city_state(self):
        r = parse_resume("Located in Austin, TX")
        # Should find Austin
        assert r.location is not None
        assert "Austin" in r.location

    def test_remote(self):
        r = parse_resume("Remote worker based in Denver, building APIs")
        assert r.location is not None


# ─── Search Query Building ───────────────────────────────────────────────────


class TestSearchQuery:
    """build_search_query should return a usable search string."""

    def test_uses_first_title(self):
        r = parse_resume("Software Engineer at Google\nProduct Manager at Stripe")
        q = build_search_query(r)
        assert "Software Engineer" in q

    def test_falls_back_to_skills(self):
        r = parse_resume("Experienced with Python, React, and AWS infrastructure")
        q = build_search_query(r)
        assert q  # Should return something even without titles

    def test_empty_resume(self):
        r = parse_resume("")
        q = build_search_query(r)
        assert q == ""


# ─── Resume Quality Validation ───────────────────────────────────────────────


class TestResumeValidation:
    """validate_resume_quality should reject junk and accept real resumes."""

    def test_valid_with_title(self):
        valid, _ = validate_resume_quality(["Software Engineer"], [], [])
        assert valid

    def test_valid_with_skills(self):
        valid, _ = validate_resume_quality([], ["python", "react", "aws"], [])
        assert valid

    def test_valid_with_title_and_skill(self):
        valid, _ = validate_resume_quality(["Engineer"], ["python"], [])
        assert valid

    def test_invalid_empty(self):
        valid, reason = validate_resume_quality([], [], [])
        assert not valid
        assert "Could not find" in reason

    def test_valid_with_single_skill(self):
        valid, _ = validate_resume_quality([], ["python"], [])
        assert valid


# ─── Full Resume Parse ───────────────────────────────────────────────────────


class TestFullResumeParse:
    """Integration tests with realistic resume text."""

    def test_typical_tech_resume(self):
        text = """
John Doe
Software Engineer
San Francisco, CA

EXPERIENCE

Senior Software Engineer at Stripe
Jan 2022 - Present
Built payment infrastructure using Python, Go, and AWS.
Led a team of 5 engineers.

Software Engineer | Google | 2019-2022
Worked on search ranking algorithms.
Python, Java, TensorFlow.

EDUCATION

B.S. Computer Science, Stanford University, 2019

SKILLS
Python, Go, Java, AWS, Docker, Kubernetes, TensorFlow, React
"""
        r = parse_resume(text)

        # Titles
        assert any("Software Engineer" in t for t in r.titles)

        # Companies
        assert "Stripe" in r.companies
        assert "Google" in r.companies

        # Skills
        assert "python" in r.skills
        assert "aws" in r.skills
        assert "docker" in r.skills

        # Location
        assert r.location == "San Francisco"

        # Education
        assert len(r.education) >= 1

        # Search query
        q = build_search_query(r)
        assert q
        assert len(q) > 3

    def test_minimal_resume(self):
        text = """
Jane Smith
Product Designer

Experience with Figma, Sketch, and user research.
Previously at Airbnb and Notion.
"""
        r = parse_resume(text)
        assert "figma" in r.skills or "sketch" in r.skills
        q = build_search_query(r)
        assert q
