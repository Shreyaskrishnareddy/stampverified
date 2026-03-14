"""Tests for Phase 2D: Discovery & Messaging.

Tests talent search, outreach, conversations, and message validation.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException


def mock_response(data, count=None):
    resp = MagicMock()
    resp.data = data
    resp.count = count
    return resp


# ─── Conversation Model Validation ──────────────────────────────────────────


class TestOutreachModel:
    """OutreachCreate — field validation."""

    def test_valid_outreach(self):
        from app.models.conversation import OutreachCreate
        o = OutreachCreate(candidate_id="c-1", job_id="j-1", message="Hi, interested in your profile")
        assert o.message == "Hi, interested in your profile"

    def test_empty_message_raises(self):
        from app.models.conversation import OutreachCreate
        with pytest.raises(Exception):
            OutreachCreate(candidate_id="c-1", job_id="j-1", message="")

    def test_whitespace_only_message_raises(self):
        from app.models.conversation import OutreachCreate
        with pytest.raises(Exception):
            OutreachCreate(candidate_id="c-1", job_id="j-1", message="   ")

    def test_message_over_300_chars_raises(self):
        from app.models.conversation import OutreachCreate
        with pytest.raises(Exception):
            OutreachCreate(candidate_id="c-1", job_id="j-1", message="A" * 301)

    def test_message_exactly_300_chars_passes(self):
        from app.models.conversation import OutreachCreate
        o = OutreachCreate(candidate_id="c-1", job_id="j-1", message="A" * 300)
        assert len(o.message) == 300


class TestMessageModel:
    """MessageCreate — field validation."""

    def test_valid_message(self):
        from app.models.conversation import MessageCreate
        m = MessageCreate(content="Thanks for reaching out!")
        assert m.content == "Thanks for reaching out!"

    def test_empty_message_raises(self):
        from app.models.conversation import MessageCreate
        with pytest.raises(Exception):
            MessageCreate(content="")

    def test_message_over_5000_chars_raises(self):
        from app.models.conversation import MessageCreate
        with pytest.raises(Exception):
            MessageCreate(content="A" * 5001)


# ─── Talent Search ───────────────────────────────────────────────────────────


class TestTalentSearch:
    """search_candidates — talent search engine."""

    @patch("app.services.talent_search.get_supabase")
    def test_excludes_current_employer(self, mock_sb):
        from app.services.talent_search import search_candidates

        sb = MagicMock()

        # Open to work candidates
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([
            {"user_id": "u-1", "resume_url": None, "resume_visible": True, "preferred_functions": []},
            {"user_id": "u-2", "resume_url": None, "resume_visible": True, "preferred_functions": []},
        ])

        # Profiles
        profiles_chain = MagicMock()
        profiles_chain.execute.return_value = mock_response([
            {"id": "u-1", "full_name": "Alice", "username": "alice", "headline": "Engineer", "location": "SF", "avatar_url": None},
            {"id": "u-2", "full_name": "Bob", "username": "bob", "headline": "Engineer", "location": "NY", "avatar_url": None},
        ])

        # Employment claims — u-1 currently works at acme.com (should be blocked)
        emp_chain = MagicMock()
        emp_chain.execute.return_value = mock_response([
            {"user_id": "u-1", "company_name": "Acme", "company_domain": "acme.com", "title": "Engineer", "is_current": True, "start_date": "2024-01-01", "end_date": None, "verified_at": "2025-01-01"},
            {"user_id": "u-2", "company_name": "Other", "company_domain": "other.com", "title": "Engineer", "is_current": True, "start_date": "2024-01-01", "end_date": None, "verified_at": "2025-01-01"},
        ])

        # Education claims
        edu_chain = MagicMock()
        edu_chain.execute.return_value = mock_response([])

        call_count = {"n": 0}
        def table_handler(name):
            call_count["n"] += 1
            t = MagicMock()
            if call_count["n"] == 1:  # candidate_preferences
                t.select.return_value.eq.return_value.execute.return_value = mock_response([
                    {"user_id": "u-1", "resume_url": None, "resume_visible": True, "preferred_functions": []},
                    {"user_id": "u-2", "resume_url": None, "resume_visible": True, "preferred_functions": []},
                ])
            elif call_count["n"] == 2:  # profiles
                t.select.return_value.in_.return_value.execute.return_value = mock_response([
                    {"id": "u-1", "full_name": "Alice", "username": "alice", "headline": "Engineer", "location": "SF", "avatar_url": None},
                    {"id": "u-2", "full_name": "Bob", "username": "bob", "headline": "Engineer", "location": "NY", "avatar_url": None},
                ])
            elif call_count["n"] == 3:  # employment_claims
                t.select.return_value.in_.return_value.eq.return_value.execute.return_value = mock_response([
                    {"user_id": "u-1", "company_name": "Acme", "company_domain": "acme.com", "title": "Engineer", "is_current": True, "start_date": "2024-01-01", "end_date": None, "verified_at": "2025-01-01"},
                    {"user_id": "u-2", "company_name": "Other", "company_domain": "other.com", "title": "Engineer", "is_current": True, "start_date": "2024-01-01", "end_date": None, "verified_at": "2025-01-01"},
                ])
            else:  # education_claims
                t.select.return_value.in_.return_value.eq.return_value.execute.return_value = mock_response([])
            return t

        sb.table.side_effect = table_handler
        mock_sb.return_value = sb

        results = search_candidates(org_domain="acme.com")

        # u-1 should be excluded (current employer = acme.com)
        user_ids = [r["user_id"] for r in results]
        assert "u-1" not in user_ids
        assert "u-2" in user_ids

    @patch("app.services.talent_search.get_supabase")
    def test_excludes_candidates_without_verified_claims(self, mock_sb):
        from app.services.talent_search import search_candidates

        sb = MagicMock()

        call_count = {"n": 0}
        def table_handler(name):
            call_count["n"] += 1
            t = MagicMock()
            if call_count["n"] == 1:  # candidate_preferences
                t.select.return_value.eq.return_value.execute.return_value = mock_response([
                    {"user_id": "u-1", "resume_url": None, "resume_visible": True, "preferred_functions": []},
                ])
            elif call_count["n"] == 2:  # profiles
                t.select.return_value.in_.return_value.execute.return_value = mock_response([
                    {"id": "u-1", "full_name": "Alice", "username": "alice", "headline": None, "location": None, "avatar_url": None},
                ])
            elif call_count["n"] == 3:  # employment (none verified)
                t.select.return_value.in_.return_value.eq.return_value.execute.return_value = mock_response([])
            else:  # education (none verified)
                t.select.return_value.in_.return_value.eq.return_value.execute.return_value = mock_response([])
            return t

        sb.table.side_effect = table_handler
        mock_sb.return_value = sb

        results = search_candidates(org_domain="other.com")
        assert len(results) == 0


# ─── Outreach ────────────────────────────────────────────────────────────────


class TestOutreach:
    """POST /api/employer/outreach — send outreach to candidate."""

    @patch("app.routes.messaging.notify_user")
    @patch("app.routes.messaging.get_supabase")
    @pytest.mark.asyncio
    async def test_outreach_to_non_open_candidate_raises(self, mock_sb, mock_notify):
        from app.routes.messaging import send_outreach
        from app.models.conversation import OutreachCreate

        sb = MagicMock()
        # Candidate not open to work
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([
            {"user_id": "c-1", "open_to_work": False}
        ])
        mock_sb.return_value = sb

        user = {
            "id": "u-1", "email": "jane@acme.com",
            "member": {"id": "m-1", "role": "admin", "can_post_jobs": True},
            "org": {"id": "org-1", "name": "Acme", "domain": "acme.com"},
        }

        outreach = OutreachCreate(candidate_id="c-1", job_id="j-1", message="Hi there")
        with pytest.raises(HTTPException) as exc_info:
            await send_outreach(outreach, user)
        assert exc_info.value.status_code == 400
        assert "not open" in exc_info.value.detail.lower()


# ─── Conversation Actions ───────────────────────────────────────────────────


class TestDeclineConversation:
    """PUT /api/conversations/{id}/decline — candidate declines outreach."""

    @patch("app.routes.messaging.get_supabase")
    @pytest.mark.asyncio
    async def test_only_candidate_can_decline(self, mock_sb):
        from app.routes.messaging import decline_conversation

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([{
            "id": "conv-1",
            "type": "outreach",
            "candidate_id": "other-user",
            "status": "active",
        }])
        mock_sb.return_value = sb

        user = {"id": "not-the-candidate", "email": "test@test.com"}
        with pytest.raises(HTTPException) as exc_info:
            await decline_conversation("conv-1", user)
        assert exc_info.value.status_code == 403

    @patch("app.routes.messaging.get_supabase")
    @pytest.mark.asyncio
    async def test_cannot_decline_application_thread(self, mock_sb):
        from app.routes.messaging import decline_conversation

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([{
            "id": "conv-1",
            "type": "application",
            "candidate_id": "user-1",
            "status": "active",
        }])
        mock_sb.return_value = sb

        user = {"id": "user-1", "email": "test@test.com"}
        with pytest.raises(HTTPException) as exc_info:
            await decline_conversation("conv-1", user)
        assert exc_info.value.status_code == 400
        assert "outreach" in exc_info.value.detail.lower()

    @patch("app.routes.messaging.get_supabase")
    @pytest.mark.asyncio
    async def test_cannot_decline_twice(self, mock_sb):
        from app.routes.messaging import decline_conversation

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([{
            "id": "conv-1",
            "type": "outreach",
            "candidate_id": "user-1",
            "status": "declined",
        }])
        mock_sb.return_value = sb

        user = {"id": "user-1", "email": "test@test.com"}
        with pytest.raises(HTTPException) as exc_info:
            await decline_conversation("conv-1", user)
        assert exc_info.value.status_code == 400


class TestSendMessage:
    """POST /api/conversations/{id}/messages — send message."""

    @patch("app.routes.messaging.notify_user")
    @patch("app.routes.messaging.notify_org_admin")
    @patch("app.routes.messaging.get_supabase")
    @pytest.mark.asyncio
    async def test_cannot_message_declined_conversation(self, mock_sb, mock_notify_admin, mock_notify_user):
        from app.routes.messaging import send_message
        from app.models.conversation import MessageCreate

        sb = MagicMock()
        sb.table.return_value.select.return_value.eq.return_value.execute.return_value = mock_response([{
            "id": "conv-1",
            "type": "outreach",
            "candidate_id": "user-1",
            "company_member_id": "m-1",
            "status": "declined",
        }])
        mock_sb.return_value = sb

        user = {"id": "user-1", "email": "test@test.com"}
        message = MessageCreate(content="Hello")
        with pytest.raises(HTTPException) as exc_info:
            await send_message("conv-1", message, user)
        assert exc_info.value.status_code == 400
        assert "declined" in exc_info.value.detail.lower()
