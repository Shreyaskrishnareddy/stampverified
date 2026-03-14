"""Messaging and talent search routes.

Three sections:
  1. Talent search (/api/employer/talent)
  2. Matching candidates per job (/api/employer/jobs/{id}/matches)
  3. Conversations & messages (/api/conversations/*)
  4. Outreach (/api/employer/outreach)
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.middleware.auth import (
    get_current_user,
    get_current_company_member,
    require_permission,
)
from app.models.conversation import OutreachCreate, MessageCreate
from app.config import get_supabase
from app.services.talent_search import search_candidates, get_matching_candidates_for_job
from app.services.notifications import notify_user, notify_org_admin

router = APIRouter(tags=["messaging"])


# =============================================================================
# Talent Search
# =============================================================================


@router.get("/api/employer/talent")
async def talent_search(
    user: dict = Depends(get_current_company_member),
    title: Optional[str] = None,
    company: Optional[str] = None,
    degree: Optional[str] = None,
    location: Optional[str] = None,
    function: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Search discoverable candidates.

    Only shows candidates who are open to work, have verified claims,
    and are NOT currently employed at the searching company.
    """
    org = user["org"]
    supabase = get_supabase()

    # Resolve function slug to ID if provided
    function_id = None
    if function:
        func_result = supabase.table("job_functions").select("id").eq("slug", function).execute()
        if func_result.data:
            function_id = func_result.data[0]["id"]

    results = search_candidates(
        org_domain=org["domain"],
        job_function_id=function_id,
        title_query=title,
        company_query=company,
        degree_query=degree,
        location_query=location,
        limit=limit,
        offset=offset,
    )

    return results


@router.get("/api/employer/jobs/{job_id}/matches")
async def get_job_matches(
    job_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Get matching candidates for a specific job.

    Returns candidates who match the job's function AND have applied,
    plus open-to-work candidates who haven't applied yet.
    Applied candidates are marked with applied=True.
    """
    org = user["org"]

    # Verify the job belongs to this org
    supabase = get_supabase()
    job = (
        supabase.table("jobs")
        .select("id, organization_id")
        .eq("id", job_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    return get_matching_candidates_for_job(
        job_id=job_id,
        org_domain=org["domain"],
    )


# =============================================================================
# Outreach
# =============================================================================


@router.post("/api/employer/outreach")
async def send_outreach(
    outreach: OutreachCreate,
    user: dict = Depends(get_current_company_member),
):
    """Send a direct outreach to a candidate.

    Requires can_post_jobs permission (outreach is a hiring action).
    Creates a conversation + first message atomically.
    Recruiter must select a job and write a note (max 300 chars).
    """
    require_permission(user["member"], "can_post_jobs")

    org = user["org"]
    member = user["member"]
    supabase = get_supabase()

    # Verify the candidate exists and is open to work
    prefs = (
        supabase.table("candidate_preferences")
        .select("user_id, open_to_work")
        .eq("user_id", outreach.candidate_id)
        .execute()
    )
    if not prefs.data or not prefs.data[0].get("open_to_work"):
        raise HTTPException(status_code=400, detail="This candidate is not open to outreach")

    # Verify the job belongs to this org
    job = (
        supabase.table("jobs")
        .select("id, title, organization_id")
        .eq("id", outreach.job_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")
    job_title = job.data[0].get("title", "")

    # Check for existing outreach conversation with this candidate for this job
    existing = (
        supabase.table("conversations")
        .select("id")
        .eq("type", "outreach")
        .eq("candidate_id", outreach.candidate_id)
        .eq("company_member_id", member["id"])
        .eq("job_id", outreach.job_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="You already reached out to this candidate about this role")

    now = datetime.now(timezone.utc).isoformat()

    # Create conversation
    conv_data = {
        "type": "outreach",
        "job_id": outreach.job_id,
        "candidate_id": outreach.candidate_id,
        "company_member_id": member["id"],
        "organization_id": org["id"],
        "status": "active",
        "updated_at": now,
    }
    conv_result = supabase.table("conversations").insert(conv_data).execute()
    conversation = conv_result.data[0]

    # Create first message
    msg_data = {
        "conversation_id": conversation["id"],
        "sender_type": "employer",
        "sender_id": member["id"],
        "content": outreach.message,
        "sent_at": now,
    }
    supabase.table("messages").insert(msg_data).execute()

    # Notify the candidate
    notify_user(
        user_id=outreach.candidate_id,
        type="new_outreach",
        title=f"{org['name']} reached out about {job_title}",
        message=outreach.message[:100] + ("..." if len(outreach.message) > 100 else ""),
    )

    return {
        "detail": "Outreach sent",
        "conversation_id": conversation["id"],
    }


# =============================================================================
# Conversations
# =============================================================================


@router.get("/api/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    role: str = "candidate",
):
    """List conversations for the current user.

    role=candidate: show conversations where user is the candidate
    role=employer: show conversations where user is the company member
    """
    supabase = get_supabase()

    if role == "employer":
        # Find the user's company member ID
        member_result = (
            supabase.table("company_members")
            .select("id, organization_id")
            .eq("user_id", user["id"])
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not member_result.data:
            return []

        member_id = member_result.data[0]["id"]
        convs = (
            supabase.table("conversations")
            .select("*, jobs(title), organizations(name,domain)")
            .eq("company_member_id", member_id)
            .order("updated_at", desc=True)
            .limit(50)
            .execute()
        )
    else:
        convs = (
            supabase.table("conversations")
            .select("*, jobs(title), organizations(name,domain)")
            .eq("candidate_id", user["id"])
            .order("updated_at", desc=True)
            .limit(50)
            .execute()
        )

    # Enrich with last message and unread count
    results = []
    for conv in (convs.data or []):
        job_data = conv.pop("jobs", None) or {}
        org_data = conv.pop("organizations", None) or {}

        # Get last message
        last_msg = (
            supabase.table("messages")
            .select("content, sender_type, sent_at")
            .eq("conversation_id", conv["id"])
            .order("sent_at", desc=True)
            .limit(1)
            .execute()
        )

        # Count unread messages (messages NOT sent by me that are unread)
        my_sender_type = "employer" if role == "employer" else "candidate"
        unread = (
            supabase.table("messages")
            .select("id", count="exact")
            .eq("conversation_id", conv["id"])
            .neq("sender_type", my_sender_type)
            .is_("read_at", "null")
            .execute()
        )

        # Get other party name
        if role == "candidate":
            # Get company member name
            member_profile = (
                supabase.table("company_members")
                .select("email")
                .eq("id", conv["company_member_id"])
                .execute()
            )
            other_name = (member_profile.data[0]["email"].split("@")[0].replace(".", " ").title()
                         if member_profile.data else "Recruiter")
        else:
            # Get candidate name
            candidate_profile = (
                supabase.table("profiles")
                .select("full_name")
                .eq("id", conv["candidate_id"])
                .execute()
            )
            other_name = candidate_profile.data[0]["full_name"] if candidate_profile.data else "Candidate"

        msg = last_msg.data[0] if last_msg.data else {}
        results.append({
            **conv,
            "job_title": job_data.get("title"),
            "org_name": org_data.get("name"),
            "org_domain": org_data.get("domain"),
            "other_party_name": other_name,
            "last_message": msg.get("content", "")[:100],
            "last_message_at": msg.get("sent_at"),
            "last_message_sender": msg.get("sender_type"),
            "unread_count": unread.count or 0,
        })

    return results


@router.get("/api/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a conversation with all messages.

    Also marks unread messages as read for the current user.
    """
    supabase = get_supabase()

    # Get conversation
    conv = (
        supabase.table("conversations")
        .select("*, jobs(id,title,salary_min,salary_max,salary_currency,location,location_type), organizations(name,domain,logo_url)")
        .eq("id", conversation_id)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = conv.data[0]

    # Verify the user is a participant
    is_candidate = conversation["candidate_id"] == user["id"]

    is_employer = False
    if not is_candidate:
        member = (
            supabase.table("company_members")
            .select("id")
            .eq("user_id", user["id"])
            .eq("id", conversation["company_member_id"])
            .execute()
        )
        is_employer = bool(member.data)

    if not is_candidate and not is_employer:
        raise HTTPException(status_code=403, detail="You are not a participant in this conversation")

    # Get all messages
    msgs = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("sent_at", desc=False)
        .execute()
    )

    # Mark unread messages as read
    my_sender_type = "employer" if is_employer else "candidate"
    now = datetime.now(timezone.utc).isoformat()
    for msg in (msgs.data or []):
        if msg["sender_type"] != my_sender_type and msg["read_at"] is None:
            supabase.table("messages").update({
                "read_at": now,
            }).eq("id", msg["id"]).execute()

    # Enrich conversation
    job_data = conversation.pop("jobs", None) or {}
    org_data = conversation.pop("organizations", None) or {}

    # Get participant names
    candidate_profile = (
        supabase.table("profiles")
        .select("full_name, username, headline")
        .eq("id", conversation["candidate_id"])
        .execute()
    )
    member_info = (
        supabase.table("company_members")
        .select("email")
        .eq("id", conversation["company_member_id"])
        .execute()
    )

    return {
        "conversation": {
            **conversation,
            "job": job_data if job_data.get("id") else None,
            "org_name": org_data.get("name"),
            "org_domain": org_data.get("domain"),
            "org_logo_url": org_data.get("logo_url"),
            "candidate_name": candidate_profile.data[0]["full_name"] if candidate_profile.data else None,
            "candidate_username": candidate_profile.data[0].get("username") if candidate_profile.data else None,
            "member_name": (member_info.data[0]["email"].split("@")[0].replace(".", " ").title()
                           if member_info.data else None),
        },
        "messages": msgs.data or [],
        "is_candidate": is_candidate,
    }


@router.post("/api/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    message: MessageCreate,
    user: dict = Depends(get_current_user),
):
    """Send a message in a conversation.

    Validates the user is a participant and the conversation is active.
    """
    supabase = get_supabase()

    # Get conversation
    conv = (
        supabase.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = conv.data[0]

    if conversation["status"] == "declined":
        raise HTTPException(status_code=400, detail="This conversation has been declined. No further messages can be sent.")

    # Determine sender type
    is_candidate = conversation["candidate_id"] == user["id"]
    if is_candidate:
        sender_type = "candidate"
        sender_id = user["id"]
    else:
        member = (
            supabase.table("company_members")
            .select("id")
            .eq("user_id", user["id"])
            .eq("id", conversation["company_member_id"])
            .execute()
        )
        if not member.data:
            raise HTTPException(status_code=403, detail="You are not a participant in this conversation")
        sender_type = "employer"
        sender_id = member.data[0]["id"]

    now = datetime.now(timezone.utc).isoformat()

    # Insert message
    msg_data = {
        "conversation_id": conversation_id,
        "sender_type": sender_type,
        "sender_id": sender_id,
        "content": message.content,
        "sent_at": now,
    }
    result = supabase.table("messages").insert(msg_data).execute()

    # Update conversation timestamp
    supabase.table("conversations").update({
        "updated_at": now,
    }).eq("id", conversation_id).execute()

    # Notify the other party
    if sender_type == "candidate":
        # Look up the company member's email for notification
        member_record = supabase.table("company_members").select("email").eq("id", conversation["company_member_id"]).execute()
        if member_record.data:
            notify_org_admin(
                org_admin_email=member_record.data[0]["email"],
                type="new_message",
                title="New message",
                message=message.content[:100],
            )
    else:
        notify_user(
            user_id=conversation["candidate_id"],
            type="new_message",
            title="New message",
            message=message.content[:100],
        )

    return result.data[0] if result.data else msg_data


# =============================================================================
# Conversation actions
# =============================================================================


@router.put("/api/conversations/{conversation_id}/decline")
async def decline_conversation(
    conversation_id: str,
    user: dict = Depends(get_current_user),
):
    """Candidate declines an outreach conversation.

    Sets status to 'declined'. No further messages can be sent.
    Only candidates can decline. Only outreach conversations can be declined.
    """
    supabase = get_supabase()

    conv = (
        supabase.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .execute()
    )
    if not conv.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = conv.data[0]

    if conversation["candidate_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the candidate can decline")

    if conversation["type"] != "outreach":
        raise HTTPException(status_code=400, detail="Only outreach conversations can be declined")

    if conversation["status"] == "declined":
        raise HTTPException(status_code=400, detail="Already declined")

    supabase.table("conversations").update({
        "status": "declined",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", conversation_id).execute()

    return {"detail": "Conversation declined"}


# =============================================================================
# Application thread helper
# =============================================================================


@router.post("/api/applications/{application_id}/message")
async def send_application_message(
    application_id: str,
    message: MessageCreate,
    user: dict = Depends(get_current_user),
):
    """Send a message in an application thread.

    Creates the conversation if it doesn't exist yet (first message).
    Both candidates and employers can initiate.
    """
    supabase = get_supabase()

    # Get the application
    app = (
        supabase.table("applications")
        .select("*, jobs(id, title, organization_id)")
        .eq("id", application_id)
        .execute()
    )
    if not app.data:
        raise HTTPException(status_code=404, detail="Application not found")

    application = app.data[0]
    job_data = application.get("jobs") or {}

    # Determine if user is candidate or employer
    is_candidate = application["candidate_id"] == user["id"]
    if not is_candidate:
        member = (
            supabase.table("company_members")
            .select("id")
            .eq("user_id", user["id"])
            .eq("organization_id", job_data.get("organization_id"))
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not member.data:
            raise HTTPException(status_code=403, detail="You are not authorized to message on this application")
        member_id = member.data[0]["id"]
    else:
        # Find the job's org and a relevant company member (POC or admin)
        poc = (
            supabase.table("company_members")
            .select("id")
            .eq("organization_id", job_data.get("organization_id"))
            .eq("status", "active")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )
        if not poc.data:
            raise HTTPException(status_code=400, detail="No active company member to receive your message")
        member_id = poc.data[0]["id"]

    # Find or create conversation
    existing_conv = (
        supabase.table("conversations")
        .select("id, status")
        .eq("application_id", application_id)
        .execute()
    )

    now = datetime.now(timezone.utc).isoformat()

    if existing_conv.data:
        conv_id = existing_conv.data[0]["id"]
        if existing_conv.data[0]["status"] == "declined":
            raise HTTPException(status_code=400, detail="This conversation has been declined")
    else:
        conv_data = {
            "type": "application",
            "application_id": application_id,
            "job_id": job_data.get("id"),
            "candidate_id": application["candidate_id"],
            "company_member_id": member_id,
            "organization_id": job_data.get("organization_id"),
            "status": "active",
            "updated_at": now,
        }
        conv_result = supabase.table("conversations").insert(conv_data).execute()
        conv_id = conv_result.data[0]["id"]

    # Send the message
    sender_type = "candidate" if is_candidate else "employer"
    sender_id = user["id"] if is_candidate else member_id

    msg_data = {
        "conversation_id": conv_id,
        "sender_type": sender_type,
        "sender_id": sender_id,
        "content": message.content,
        "sent_at": now,
    }
    result = supabase.table("messages").insert(msg_data).execute()

    supabase.table("conversations").update({"updated_at": now}).eq("id", conv_id).execute()

    # Notify other party
    if is_candidate:
        member_record = supabase.table("company_members").select("email").eq("id", member_id).execute()
        if member_record.data:
            notify_org_admin(
                org_admin_email=member_record.data[0]["email"],
                type="new_message",
                title=f"New message on application for {job_data.get('title', 'a role')}",
                message=message.content[:100],
            )
    else:
        notify_user(
            user_id=application["candidate_id"],
            type="new_message",
            title=f"New message about {job_data.get('title', 'your application')}",
            message=message.content[:100],
        )

    return {
        "conversation_id": conv_id,
        "message": result.data[0] if result.data else msg_data,
    }
