"""Tests for Phase 2B: Job Functions & Job Posting.

Tests job function auto-detection, JD text extraction, job creation
validation, and permission enforcement.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


# ─── Job Function Auto-Detection ────────────────────────────────────────────


class TestJobFunctionDetection:
    """detect_job_function — maps titles to function slugs."""

    @patch("app.services.job_functions.get_supabase")
    def test_detects_software_engineer(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        # Seed the cache
        _slug_to_id.clear()
        _slug_to_id["software-engineering"] = "func-swe"
        _slug_to_id["frontend-engineering"] = "func-fe"

        assert detect_job_function("Senior Software Engineer") == "func-swe"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_frontend_over_generic(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["software-engineering"] = "func-swe"
        _slug_to_id["frontend-engineering"] = "func-fe"

        # "Frontend" is more specific, should match before generic "engineer"
        assert detect_job_function("Frontend Engineer") == "func-fe"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_product_manager(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["product-management"] = "func-pm"

        assert detect_job_function("Senior Product Manager") == "func-pm"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_data_scientist(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["data-science"] = "func-ds"

        assert detect_job_function("Data Scientist - ML Platform") == "func-ds"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_devops(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["devops-infrastructure"] = "func-devops"

        assert detect_job_function("Site Reliability Engineer") == "func-devops"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_mobile(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["mobile-engineering"] = "func-mobile"

        assert detect_job_function("iOS Developer") == "func-mobile"

    @patch("app.services.job_functions.get_supabase")
    def test_detects_ux_research(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["ux-research"] = "func-ux"
        _slug_to_id["product-design"] = "func-pd"

        # UX Research should match before generic designer
        assert detect_job_function("UX Researcher") == "func-ux"

    @patch("app.services.job_functions.get_supabase")
    def test_unrecognized_title_returns_none(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["software-engineering"] = "func-swe"

        assert detect_job_function("Chief Happiness Officer") is None

    @patch("app.services.job_functions.get_supabase")
    def test_case_insensitive(self, mock_sb):
        from app.services.job_functions import detect_job_function, _slug_to_id

        _slug_to_id.clear()
        _slug_to_id["software-engineering"] = "func-swe"

        assert detect_job_function("SOFTWARE ENGINEER") == "func-swe"
        assert detect_job_function("software engineer") == "func-swe"


# ─── JD Text Extraction ─────────────────────────────────────────────────────


class TestJDExtraction:
    """extract_from_text — regex-based field extraction from JD text."""

    def test_extracts_title_from_first_line(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Senior Software Engineer\n\nWe are looking for...")
        assert result.title == "Senior Software Engineer"

    def test_extracts_salary_k_format(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nSalary: $150K - $200K\n\nDescription")
        assert result.salary_min == 150000
        assert result.salary_max == 200000

    def test_extracts_salary_full_format(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nCompensation: $150,000-$200,000 per year")
        assert result.salary_min == 150000
        assert result.salary_max == 200000

    def test_extracts_remote_location_type(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nThis is a fully remote position.")
        assert result.location_type == "remote"

    def test_extracts_hybrid_location_type(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nHybrid work environment, 3 days in office.")
        assert result.location_type == "hybrid"

    def test_extracts_senior_level(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Senior Software Engineer\n\nJoin our team")
        assert result.experience_level == "senior"

    def test_extracts_entry_level(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Junior Developer\n\nEntry-level position")
        assert result.experience_level == "entry"

    def test_extracts_full_time_type(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nFull-time position in our SF office")
        assert result.employment_type == "full_time"

    def test_extracts_internship_type(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Summer Intern\n\nInternship opportunity")
        assert result.employment_type == "internship"

    def test_extracts_contract_type(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\n6-month contract position")
        assert result.employment_type == "contract"

    def test_extracts_known_city(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Title\n\nOur San Francisco office is looking for...")
        assert result.location == "San Francisco"

    def test_handles_empty_text(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("")
        assert result.title is None
        assert result.salary_min is None

    def test_handles_no_salary(self):
        from app.services.jd_extract import extract_from_text

        result = extract_from_text("Software Engineer\n\nGreat benefits, competitive pay")
        assert result.salary_min is None
        assert result.salary_max is None

    def test_salary_range_ordered_correctly(self):
        from app.services.jd_extract import extract_from_text

        # Even if someone writes it backwards, we fix the order
        result = extract_from_text("Title\n\n$200K - $150K")
        if result.salary_min and result.salary_max:
            assert result.salary_min <= result.salary_max


# ─── Job Model Validation ────────────────────────────────────────────────────


class TestJobModelValidation:
    """JobCreate model — field validation."""

    def test_valid_job_create(self):
        from app.models.job import JobCreate

        job = JobCreate(
            title="Senior Software Engineer",
            description="We are looking for...",
            salary_min=150000,
            salary_max=200000,
        )
        assert job.title == "Senior Software Engineer"
        assert job.salary_currency == "USD"  # default

    def test_salary_max_less_than_min_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="Engineer",
                description="...",
                salary_min=200000,
                salary_max=150000,
            )

    def test_negative_salary_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="Engineer",
                description="...",
                salary_min=-1,
                salary_max=100000,
            )

    def test_empty_title_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="   ",
                description="...",
                salary_min=100000,
                salary_max=200000,
            )

    def test_title_too_long_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="A" * 256,
                description="...",
                salary_min=100000,
                salary_max=200000,
            )

    def test_currency_uppercased(self):
        from app.models.job import JobCreate

        job = JobCreate(
            title="Engineer",
            description="...",
            salary_min=100000,
            salary_max=200000,
            salary_currency="eur",
        )
        assert job.salary_currency == "EUR"

    def test_invalid_location_type_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="Engineer",
                description="...",
                salary_min=100000,
                salary_max=200000,
                location_type="anywhere",
            )

    def test_invalid_employment_type_raises(self):
        from app.models.job import JobCreate

        with pytest.raises(Exception):
            JobCreate(
                title="Engineer",
                description="...",
                salary_min=100000,
                salary_max=200000,
                employment_type="freelance",
            )


# ─── Job Permission Tests ───────────────────────────────────────────────────


class TestJobPermissions:
    """Job posting requires can_post_jobs permission."""

    @patch("app.routes.jobs.detect_job_function")
    @patch("app.routes.jobs.get_supabase")
    @pytest.mark.asyncio
    async def test_member_without_post_permission_blocked(self, mock_get_sb, mock_detect):
        from app.routes.jobs import create_job
        from app.models.job import JobCreate

        user = {
            "id": "user-1",
            "email": "john@acme.com",
            "member": {
                "id": "member-1",
                "role": "member",
                "can_post_jobs": False,
                "can_verify_claims": False,
            },
            "org": {"id": "org-1", "name": "Acme"},
        }

        job = JobCreate(
            title="Engineer",
            description="...",
            salary_min=100000,
            salary_max=200000,
        )

        with pytest.raises(HTTPException) as exc_info:
            await create_job(job, user)
        assert exc_info.value.status_code == 403
