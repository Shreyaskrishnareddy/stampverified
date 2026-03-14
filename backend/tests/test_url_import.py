"""Tests for URL import — extracting job details from ATS URLs.

Tests JSON-LD parsing, field mapping, and edge cases.
"""

import pytest
from app.services.url_import import (
    is_url,
    is_ats_url,
    _extract_from_jsonld,
    _parse_job_posting,
    _html_to_text,
)


class TestURLDetection:
    """is_url — detect if input is a URL."""

    def test_http_url(self):
        assert is_url("http://example.com/jobs/123")

    def test_https_url(self):
        assert is_url("https://boards.greenhouse.io/stripe/jobs/4215")

    def test_plain_text(self):
        assert not is_url("Senior Software Engineer at Stripe")

    def test_url_with_whitespace(self):
        assert is_url("  https://example.com/jobs  ")

    def test_empty_string(self):
        assert not is_url("")


class TestATSURLDetection:
    """is_ats_url — detect known ATS platforms."""

    def test_greenhouse(self):
        assert is_ats_url("https://boards.greenhouse.io/stripe/jobs/4215")

    def test_greenhouse_custom(self):
        assert is_ats_url("https://stripe.greenhouse.io/jobs/4215")

    def test_lever(self):
        assert is_ats_url("https://jobs.lever.co/figma/abc123")

    def test_ashby(self):
        assert is_ats_url("https://jobs.ashbyhq.com/ramp/456")

    def test_careers_page(self):
        assert is_ats_url("https://careers.stripe.com/jobs/4215")

    def test_random_url(self):
        assert not is_ats_url("https://example.com/about")

    def test_workable(self):
        assert is_ats_url("https://apply.workable.com/company/j/abc123/")


class TestJSONLDExtraction:
    """_extract_from_jsonld — parse schema.org/JobPosting from HTML."""

    def test_basic_job_posting(self):
        html = '''
        <html><head>
        <script type="application/ld+json">
        {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Software Engineer",
            "description": "<p>We are looking for a senior engineer.</p>",
            "jobLocation": {
                "@type": "Place",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "San Francisco",
                    "addressRegion": "CA"
                }
            },
            "baseSalary": {
                "@type": "MonetaryAmount",
                "currency": "USD",
                "value": {
                    "@type": "QuantitativeValue",
                    "minValue": 180000,
                    "maxValue": 220000,
                    "unitText": "YEAR"
                }
            },
            "employmentType": "FULL_TIME"
        }
        </script>
        </head><body></body></html>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.title == "Senior Software Engineer"
        assert result.salary_min == 180000
        assert result.salary_max == 220000
        assert result.salary_currency == "USD"
        assert result.location == "San Francisco, CA"
        assert result.employment_type == "full_time"

    def test_monthly_salary_conversion(self):
        html = '''
        <script type="application/ld+json">
        {"@type": "JobPosting", "title": "Designer",
         "baseSalary": {"currency": "USD", "value": {"minValue": 8000, "maxValue": 12000, "unitText": "MONTH"}}}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.salary_min == 96000   # 8000 * 12
        assert result.salary_max == 144000  # 12000 * 12

    def test_hourly_salary_conversion(self):
        html = '''
        <script type="application/ld+json">
        {"@type": "JobPosting", "title": "Intern",
         "baseSalary": {"currency": "USD", "value": {"minValue": 30, "maxValue": 40, "unitText": "HOUR"}}}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.salary_min == 62400   # 30 * 2080
        assert result.salary_max == 83200   # 40 * 2080

    def test_remote_job_location_type(self):
        html = '''
        <script type="application/ld+json">
        {"@type": "JobPosting", "title": "Remote Engineer",
         "jobLocationType": "TELECOMMUTE"}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.location_type == "remote"

    def test_internship_employment_type(self):
        html = '''
        <script type="application/ld+json">
        {"@type": "JobPosting", "title": "Summer Intern",
         "employmentType": "INTERN"}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.employment_type == "internship"

    def test_no_jsonld_returns_none(self):
        html = '<html><body><h1>Job Title</h1></body></html>'
        result = _extract_from_jsonld(html)
        assert result is None

    def test_non_job_posting_jsonld_ignored(self):
        html = '''
        <script type="application/ld+json">
        {"@type": "Organization", "name": "Stripe"}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is None

    def test_graph_pattern(self):
        html = '''
        <script type="application/ld+json">
        {"@context": "https://schema.org", "@graph": [
            {"@type": "Organization", "name": "Stripe"},
            {"@type": "JobPosting", "title": "Backend Engineer"}
        ]}
        </script>
        '''
        result = _extract_from_jsonld(html)
        assert result is not None
        assert result.title == "Backend Engineer"

    def test_experience_level_from_title(self):
        data = {"@type": "JobPosting", "title": "Staff Software Engineer"}
        result = _parse_job_posting(data)
        assert result.experience_level == "senior"

    def test_experience_level_entry(self):
        data = {"@type": "JobPosting", "title": "Junior Developer"}
        result = _parse_job_posting(data)
        assert result.experience_level == "entry"

    def test_experience_level_lead(self):
        data = {"@type": "JobPosting", "title": "Engineering Manager"}
        result = _parse_job_posting(data)
        assert result.experience_level == "lead"

    def test_description_html_stripped(self):
        data = {
            "@type": "JobPosting",
            "title": "Engineer",
            "description": "<h2>About the role</h2><p>We need an <strong>engineer</strong>.</p><ul><li>Python</li><li>Go</li></ul>"
        }
        result = _parse_job_posting(data)
        assert "<" not in result.description
        assert "engineer" in result.description
        assert "Python" in result.description

    def test_location_as_string(self):
        data = {
            "@type": "JobPosting",
            "title": "Engineer",
            "jobLocation": "New York, NY"
        }
        result = _parse_job_posting(data)
        assert result.location == "New York, NY"

    def test_multiple_employment_types(self):
        data = {
            "@type": "JobPosting",
            "title": "Contractor",
            "employmentType": ["CONTRACT", "PART_TIME"]
        }
        result = _parse_job_posting(data)
        assert result.employment_type == "contract"


class TestHTMLToText:
    """_html_to_text — convert HTML to clean plain text."""

    def test_basic_html(self):
        html = "<html><body><h1>Title</h1><p>Description</p></body></html>"
        text = _html_to_text(html)
        assert "Title" in text
        assert "Description" in text
        assert "<" not in text

    def test_strips_scripts(self):
        html = "<html><head><script>alert('xss')</script></head><body>Content</body></html>"
        text = _html_to_text(html)
        assert "alert" not in text
        assert "Content" in text

    def test_preserves_list_items(self):
        html = "<ul><li>First</li><li>Second</li></ul>"
        text = _html_to_text(html)
        assert "First" in text
        assert "Second" in text

    def test_empty_html(self):
        assert _html_to_text("") == ""
