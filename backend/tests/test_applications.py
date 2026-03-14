"""Tests for Phase 2C: Applications & Apply Flow.

Tests application validation gates, status transitions,
candidate preferences, and model validation.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


def mock_response(data, count=None):
    resp = MagicMock()
    resp.data = data
    resp.count = count
    return resp


# ─── Application Model Validation ────────────────────────────────────────────


class TestApplicationModelValidation:
    """ApplicationCreate — field validation."""

    def test_valid_application(self):
        from app.models.application import ApplicationCreate
        app = ApplicationCreate(job_id="job-1", cover_note="I'm excited about this role")
        assert app.job_id == "job-1"

    def test_cover_note_too_long_raises(self):
        from app.models.application import ApplicationCreate
        with pytest.raises(Exception):
            ApplicationCreate(job_id="job-1", cover_note="A" * 2001)

    def test_cover_note_optional(self):
        from app.models.application import ApplicationCreate
        app = ApplicationCreate(job_id="job-1")
        assert app.cover_note is None

    def test_status_update_valid_values(self):
        from app.models.application import ApplicationStatusUpdate
        update = ApplicationStatusUpdate(status="shortlisted")
        assert update.status == "shortlisted"

        update = ApplicationStatusUpdate(status="rejected")
        assert update.status == "rejected"

    def test_status_update_invalid_value_raises(self):
        from app.models.application import ApplicationStatusUpdate
        with pytest.raises(Exception):
            ApplicationStatusUpdate(status="hired")

    def test_status_update_applied_not_allowed(self):
        from app.models.application import ApplicationStatusUpdate
        # Employers can only shortlist or reject, not reset to applied
        with pytest.raises(Exception):
            ApplicationStatusUpdate(status="applied")


# ─── Apply Flow Validation Gates ─────────────────────────────────────────────


class TestApplyValidation:
    """POST /api/applications — 5 validation gates."""

    @patch("app.routes.applications.notify_org_admin")
    @patch("app.routes.applications.notify_user")
    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_no_profile_raises_400(self, mock_get_sb, mock_notify_user, mock_notify_admin):
        from app.routes.applications import apply_to_job
        from app.models.application import ApplicationCreate

        sb = MagicMock()
        # No profile found
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([])
        mock_get_sb.return_value = sb

        user = {"id": "user-1", "email": "test@example.com"}
        app = ApplicationCreate(job_id="job-1")

        with pytest.raises(HTTPException) as exc_info:
            await apply_to_job(app, user)
        assert exc_info.value.status_code == 400
        assert "profile" in exc_info.value.detail.lower()

    @patch("app.routes.applications.notify_org_admin")
    @patch("app.routes.applications.notify_user")
    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_no_verified_claims_raises_400(self, mock_get_sb, mock_notify_user, mock_notify_admin):
        from app.routes.applications import apply_to_job
        from app.models.application import ApplicationCreate

        sb = MagicMock()
        profile_resp = mock_response([{"id": "user-1", "full_name": "Test User", "username": "test"}])
        empty_count = mock_response([], count=0)

        call_count = {"n": 0}
        def table_handler(name):
            call_count["n"] += 1
            t = MagicMock()
            if name == "profiles":
                t.select.return_value.eq.return_value.execute.return_value = profile_resp
            else:
                # employment_claims and education_claims return 0 verified
                t.select.return_value.eq.return_value.eq.return_value.execute.return_value = empty_count
            return t

        sb.table.side_effect = table_handler
        mock_get_sb.return_value = sb

        user = {"id": "user-1", "email": "test@example.com"}
        app = ApplicationCreate(job_id="job-1")

        with pytest.raises(HTTPException) as exc_info:
            await apply_to_job(app, user)
        assert exc_info.value.status_code == 400
        assert "confirmed" in exc_info.value.detail.lower() or "verified" in exc_info.value.detail.lower()

    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_no_resume_raises_400(self, mock_get_sb):
        from app.routes.applications import apply_to_job
        from app.models.application import ApplicationCreate

        sb = MagicMock()

        call_results = [
            # profiles
            mock_response([{"id": "user-1", "full_name": "Test", "username": "test"}]),
            # employment verified count
            mock_response([], count=1),
            # education verified count
            mock_response([], count=0),
            # candidate_preferences (no resume)
            mock_response([{"resume_url": None}]),
        ]

        call_idx = {"i": 0}
        original_table = MagicMock()

        def table_handler(name):
            t = MagicMock()
            idx = call_idx["i"]
            call_idx["i"] += 1
            resp = call_results[idx] if idx < len(call_results) else mock_response([])
            # Set up the chain to return the response
            chain = MagicMock()
            chain.execute.return_value = resp
            t.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            return t

        sb.table.side_effect = table_handler
        mock_get_sb.return_value = sb

        user = {"id": "user-1", "email": "test@example.com"}
        app = ApplicationCreate(job_id="job-1")

        with pytest.raises(HTTPException) as exc_info:
            await apply_to_job(app, user)
        assert exc_info.value.status_code == 400
        assert "resume" in exc_info.value.detail.lower()


# ─── Application Status Transitions ──────────────────────────────────────────


class TestApplicationStatus:
    """PUT /api/employer/applications/{id} — shortlist/reject."""

    @patch("app.routes.applications.notify_user")
    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_shortlist_notifies_candidate(self, mock_get_sb, mock_notify):
        from app.routes.applications import update_application_status
        from app.models.application import ApplicationStatusUpdate

        sb = MagicMock()
        app_data = {
            "id": "app-1",
            "candidate_id": "user-2",
            "status": "applied",
            "jobs": {"title": "Engineer", "organization_id": "org-1"},
        }
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([app_data])
        sb.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response([])
        mock_get_sb.return_value = sb

        user = {
            "id": "user-1",
            "email": "hr@acme.com",
            "member": {"id": "m-1", "role": "admin"},
            "org": {"id": "org-1", "name": "Acme"},
        }

        update = ApplicationStatusUpdate(status="shortlisted")
        result = await update_application_status("app-1", update, user)
        assert result["status"] == "shortlisted"

        # Verify notification was sent
        mock_notify.assert_called_once()
        call_args = mock_notify.call_args
        assert call_args.kwargs.get("user_id") == "user-2" or call_args[1].get("user_id") == "user-2"

    @patch("app.routes.applications.notify_user")
    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_reject_notifies_candidate(self, mock_get_sb, mock_notify):
        from app.routes.applications import update_application_status
        from app.models.application import ApplicationStatusUpdate

        sb = MagicMock()
        app_data = {
            "id": "app-1",
            "candidate_id": "user-2",
            "status": "applied",
            "jobs": {"title": "Designer", "organization_id": "org-1"},
        }
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([app_data])
        sb.table.return_value.update.return_value.eq.return_value.execute.return_value = mock_response([])
        mock_get_sb.return_value = sb

        user = {
            "id": "user-1",
            "email": "hr@acme.com",
            "member": {"id": "m-1", "role": "admin"},
            "org": {"id": "org-1", "name": "Acme"},
        }

        update = ApplicationStatusUpdate(status="rejected")
        result = await update_application_status("app-1", update, user)
        assert result["status"] == "rejected"
        mock_notify.assert_called_once()

    @patch("app.routes.applications.notify_user")
    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_cannot_update_withdrawn_application(self, mock_get_sb, mock_notify):
        from app.routes.applications import update_application_status
        from app.models.application import ApplicationStatusUpdate

        sb = MagicMock()
        app_data = {
            "id": "app-1",
            "candidate_id": "user-2",
            "status": "withdrawn",
            "jobs": {"title": "Engineer", "organization_id": "org-1"},
        }
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([app_data])
        mock_get_sb.return_value = sb

        user = {
            "id": "user-1",
            "email": "hr@acme.com",
            "member": {"id": "m-1", "role": "admin"},
            "org": {"id": "org-1", "name": "Acme"},
        }

        update = ApplicationStatusUpdate(status="shortlisted")
        with pytest.raises(HTTPException) as exc_info:
            await update_application_status("app-1", update, user)
        assert exc_info.value.status_code == 400
        assert "withdrawn" in exc_info.value.detail.lower()

    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_wrong_org_raises_403(self, mock_get_sb):
        from app.routes.applications import update_application_status
        from app.models.application import ApplicationStatusUpdate

        sb = MagicMock()
        app_data = {
            "id": "app-1",
            "candidate_id": "user-2",
            "status": "applied",
            "jobs": {"title": "Engineer", "organization_id": "other-org"},
        }
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([app_data])
        mock_get_sb.return_value = sb

        user = {
            "id": "user-1",
            "email": "hr@acme.com",
            "member": {"id": "m-1", "role": "admin"},
            "org": {"id": "org-1", "name": "Acme"},
        }

        update = ApplicationStatusUpdate(status="shortlisted")
        with pytest.raises(HTTPException) as exc_info:
            await update_application_status("app-1", update, user)
        assert exc_info.value.status_code == 403


# ─── Candidate Preferences ───────────────────────────────────────────────────


class TestCandidatePreferences:
    """Candidate preference model validation."""

    def test_valid_preferences_update(self):
        from app.models.application import CandidatePreferencesUpdate
        prefs = CandidatePreferencesUpdate(
            open_to_work=True,
            resume_visible=False,
            preferred_functions=["func-1", "func-2"],
        )
        assert prefs.open_to_work is True
        assert len(prefs.preferred_functions) == 2

    def test_partial_update_keeps_none(self):
        from app.models.application import CandidatePreferencesUpdate
        prefs = CandidatePreferencesUpdate(open_to_work=True)
        assert prefs.resume_visible is None  # Not set, won't be updated
        assert prefs.preferred_functions is None


# ─── Saved Jobs ───────────────────────────────────────────────────────────────


class TestSavedJobs:
    """Save/unsave job bookmarks."""

    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_save_nonexistent_job_raises_404(self, mock_get_sb):
        from app.routes.applications import save_job

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([])
        mock_get_sb.return_value = sb

        user = {"id": "user-1", "email": "test@example.com"}
        with pytest.raises(HTTPException) as exc_info:
            await save_job("nonexistent-job", user)
        assert exc_info.value.status_code == 404

    @patch("app.routes.applications.get_supabase")
    @pytest.mark.asyncio
    async def test_save_already_saved_returns_success(self, mock_get_sb):
        from app.routes.applications import save_job

        sb = MagicMock()
        # Job exists
        job_chain = MagicMock()
        job_chain.execute.return_value = mock_response([{"id": "job-1"}])
        # Already saved
        saved_chain = MagicMock()
        saved_chain.execute.return_value = mock_response([{"id": "save-1"}])

        call_count = {"n": 0}
        def table_handler(name):
            call_count["n"] += 1
            t = MagicMock()
            if call_count["n"] == 1:
                # First call: check job exists
                t.select.return_value.eq.return_value.execute.return_value = mock_response([{"id": "job-1"}])
            else:
                # Second call: check if already saved
                t.select.return_value.eq.return_value.eq.return_value.execute.return_value = mock_response([{"id": "save-1"}])
            return t

        sb.table.side_effect = table_handler
        mock_get_sb.return_value = sb

        user = {"id": "user-1", "email": "test@example.com"}
        result = await save_job("job-1", user)
        assert result["saved"] is True
