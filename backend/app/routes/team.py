"""Company workspace team management routes.

Endpoints for managing company workspace members: listing, inviting,
updating permissions, and deactivating. Also handles the self-service
workspace join flow for users with matching company email domains.

URL prefix: /api/employer/team
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import (
    get_current_user,
    get_current_company_member,
    require_admin,
)
from app.models.company_member import (
    CompanyMemberResponse,
    CompanyMemberInvite,
    CompanyMemberPermissionUpdate,
    NotificationPreferencesUpdate,
)
from app.config import get_supabase, get_settings
from app.services.notifications import notify_org_admin
from app.services.email import send_workspace_invite_email
from app.services.audit import log_action

router = APIRouter(prefix="/api/employer/team", tags=["team"])


# =============================================================================
# List team members
# =============================================================================


@router.get("/")
async def list_members(user: dict = Depends(get_current_company_member)):
    """List all members of the current user's company workspace.

    Any active member can see the team list. Deactivated members are
    excluded. Returns member info with role and permissions.
    """
    org = user["org"]
    supabase = get_supabase()

    result = (
        supabase.table("company_members")
        .select("id,organization_id,user_id,email,role,can_post_jobs,can_verify_claims,status,joined_at,created_at")
        .eq("organization_id", org["id"])
        .in_("status", ["active", "invited", "pending"])
        .order("created_at", desc=False)
        .execute()
    )

    return result.data or []


@router.get("/me")
async def get_my_membership(user: dict = Depends(get_current_company_member)):
    """Get the current user's own membership details.

    Returns the full member record including permissions and org info.
    Used by the frontend to determine what UI elements to show.
    """
    member = user["member"]
    org = user["org"]

    return {
        **member,
        "org_name": org.get("name"),
        "org_domain": org.get("domain"),
        "org_logo_url": org.get("logo_url"),
        "is_domain_verified": org.get("is_domain_verified", False),
    }


# =============================================================================
# Invite a new member
# =============================================================================


@router.post("/invite")
async def invite_member(
    invite: CompanyMemberInvite,
    user: dict = Depends(get_current_company_member),
):
    """Invite a new member to the company workspace.

    Admin only. The invited email must match the company's domain.
    Creates a company_member record with status='invited'.
    The invitee completes signup via /for-employers and auto-joins.
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    # Validate email domain matches company domain
    email = invite.email.strip().lower()
    email_domain = email.rsplit("@", 1)[-1]
    if email_domain != org["domain"]:
        raise HTTPException(
            status_code=400,
            detail=f"Email domain must match your company domain ({org['domain']})"
        )

    # Check if this email already has a membership
    existing = (
        supabase.table("company_members")
        .select("id,status")
        .eq("organization_id", org["id"])
        .eq("email", email)
        .execute()
    )
    if existing.data:
        existing_member = existing.data[0]
        if existing_member["status"] == "active":
            raise HTTPException(
                status_code=400,
                detail="This person is already an active member of your workspace"
            )
        if existing_member["status"] == "invited":
            raise HTTPException(
                status_code=400,
                detail="This person has already been invited"
            )
        # If deactivated, allow re-invite by updating the existing record
        supabase.table("company_members").update({
            "status": "invited",
            "can_post_jobs": invite.can_post_jobs,
            "can_verify_claims": invite.can_verify_claims,
            "invited_by": user["member"]["id"],
        }).eq("id", existing_member["id"]).execute()

        # Send re-invite email
        settings = get_settings()
        try:
            send_workspace_invite_email(
                to_email=email,
                org_name=org["name"],
                inviter_email=user["email"],
                frontend_url=settings.frontend_url,
            )
        except Exception:
            pass

        return {"detail": f"Re-invited {email}", "status": "invited"}

    # Create the invited member record
    import uuid
    member_data = {
        "organization_id": org["id"],
        "user_id": str(uuid.uuid4()),  # unique placeholder until signup replaces it
        "email": email,
        "role": "member",
        "can_post_jobs": invite.can_post_jobs,
        "can_verify_claims": invite.can_verify_claims,
        "status": "invited",
        "invited_by": user["member"]["id"],
    }

    result = supabase.table("company_members").insert(member_data).execute()

    # Send invitation email
    settings = get_settings()
    try:
        send_workspace_invite_email(
            to_email=email,
            org_name=org["name"],
            inviter_email=user["email"],
            frontend_url=settings.frontend_url,
        )
    except Exception as e:
        print(f"[TEAM] Warning: Failed to send invite email to {email}: {e}")

    return {
        "detail": f"Invited {email} to {org['name']}",
        "status": "invited",
        "member": result.data[0],
    }


# =============================================================================
# Update member permissions
# =============================================================================


@router.put("/{member_id}")
async def update_member(
    member_id: str,
    updates: CompanyMemberPermissionUpdate,
    user: dict = Depends(get_current_company_member),
):
    """Update a member's permissions or role.

    Admin only. Cannot modify your own record (prevents self-demotion
    that would lock everyone out).
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    # Cannot modify yourself
    if member_id == user["member"]["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot modify your own permissions. Ask another admin."
        )

    # Verify the target member belongs to the same org
    target = (
        supabase.table("company_members")
        .select("*")
        .eq("id", member_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found in your workspace")

    target_member = target.data[0]
    if target_member["status"] == "deactivated":
        raise HTTPException(status_code=400, detail="Cannot update a deactivated member")

    # Build update payload
    update_data = {}
    if updates.can_post_jobs is not None:
        update_data["can_post_jobs"] = updates.can_post_jobs
    if updates.can_verify_claims is not None:
        update_data["can_verify_claims"] = updates.can_verify_claims
    if updates.role is not None:
        update_data["role"] = updates.role
        # Promoting to admin automatically grants all permissions
        if updates.role == "admin":
            update_data["can_post_jobs"] = True
            update_data["can_verify_claims"] = True

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("company_members")
        .update(update_data)
        .eq("id", member_id)
        .execute()
    )

    log_action(
        action="permission_updated",
        resource_type="member",
        resource_id=member_id,
        actor_id=user["id"],
        actor_type="member",
        metadata={"changes": update_data, "target_email": target_member["email"]},
    )

    return result.data[0]


# =============================================================================
# Deactivate a member
# =============================================================================


@router.delete("/{member_id}")
async def deactivate_member(
    member_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Remove a member from the workspace.

    Admin only. Sets status to 'deactivated'. Cannot deactivate yourself.
    Cannot deactivate the last admin (would lock everyone out).
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    # Cannot deactivate yourself
    if member_id == user["member"]["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove yourself. Transfer admin to another member first."
        )

    # Verify the target member belongs to the same org
    target = (
        supabase.table("company_members")
        .select("*")
        .eq("id", member_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Member not found in your workspace")

    target_member = target.data[0]

    # If deactivating an admin, ensure at least one admin remains
    if target_member["role"] == "admin":
        admin_count = (
            supabase.table("company_members")
            .select("id", count="exact")
            .eq("organization_id", org["id"])
            .eq("role", "admin")
            .eq("status", "active")
            .execute()
        )
        if (admin_count.count or 0) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last admin. Promote another member to admin first."
            )

    supabase.table("company_members").update({
        "status": "deactivated",
    }).eq("id", member_id).execute()

    log_action(
        action="member_deactivated",
        resource_type="member",
        resource_id=member_id,
        actor_id=user["id"],
        actor_type="member",
        metadata={"target_email": target_member["email"]},
    )

    return {"detail": f"Member {target_member['email']} has been removed"}


# =============================================================================
# Self-service workspace join
# =============================================================================


@router.post("/join")
async def join_workspace(user: dict = Depends(get_current_user)):
    """Join a company workspace based on email domain matching.

    Requires verified email. Domain match creates pending membership
    that requires admin approval. Pending invites are fulfilled automatically.
    """
    supabase = get_supabase()
    email = user["email"].strip().lower()

    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    # Require verified email
    try:
        auth_user = supabase.auth.admin.get_user_by_id(user["id"])
        if not auth_user or not auth_user.user or not auth_user.user.email_confirmed_at:
            raise HTTPException(
                status_code=403,
                detail="You must verify your email address before joining a workspace. Check your inbox for a confirmation link."
            )
    except HTTPException:
        raise
    except Exception as e:
        # Auth lookup failed — block the join for safety
        print(f"[TEAM] Warning: Could not verify email for {user['id']}: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to verify your email right now. Please try again in a few minutes."
        )

    email_domain = email.rsplit("@", 1)[-1]

    # Find the organization matching this email domain
    org_result = (
        supabase.table("organizations")
        .select("*")
        .eq("domain", email_domain)
        .limit(1)
        .execute()
    )

    if not org_result.data:
        raise HTTPException(
            status_code=404,
            detail="No company registered for this email domain. Register your company first."
        )

    org = org_result.data[0]

    # Check if already a member
    existing = (
        supabase.table("company_members")
        .select("id,status")
        .eq("organization_id", org["id"])
        .eq("user_id", user["id"])
        .execute()
    )

    if existing.data:
        member = existing.data[0]
        if member["status"] == "active":
            raise HTTPException(status_code=400, detail="You are already a member of this workspace")
        if member["status"] == "pending":
            raise HTTPException(status_code=400, detail="Your join request is pending admin approval")
        if member["status"] == "deactivated":
            raise HTTPException(
                status_code=403,
                detail="Your access to this workspace has been revoked. Contact your workspace admin."
            )

    # Check if there's a pending invite for this email
    invite_result = (
        supabase.table("company_members")
        .select("*")
        .eq("organization_id", org["id"])
        .eq("email", email)
        .eq("status", "invited")
        .limit(1)
        .execute()
    )

    now = datetime.now(timezone.utc).isoformat()

    if invite_result.data:
        # Fulfill the existing invite
        invited_record = invite_result.data[0]
        result = (
            supabase.table("company_members")
            .update({
                "user_id": user["id"],
                "status": "active",
                "joined_at": now,
            })
            .eq("id", invited_record["id"])
            .execute()
        )
        member = result.data[0]
    else:
        # Self-service join: requires admin approval (pending status)
        member_data = {
            "organization_id": org["id"],
            "user_id": user["id"],
            "email": email,
            "role": "member",
            "can_post_jobs": False,
            "can_verify_claims": False,
            "status": "pending",
        }

        result = supabase.table("company_members").insert(member_data).execute()
        member = result.data[0]

    # Notify existing admins about the join/pending request
    admins = (
        supabase.table("company_members")
        .select("email")
        .eq("organization_id", org["id"])
        .eq("role", "admin")
        .eq("status", "active")
        .execute()
    )
    if member["status"] == "pending":
        for admin in (admins.data or []):
            notify_org_admin(
                org_admin_email=admin["email"],
                type="member_joined",
                title=f"{email} wants to join your workspace",
                message=f"{email} requested to join {org['name']}. Approve or deny in Team settings.",
            )
        return {
            "detail": f"Join request sent to {org['name']}. An admin will review your request.",
            "member": member,
            "org": {
                "id": org["id"],
                "name": org["name"],
                "domain": org["domain"],
                "logo_url": org.get("logo_url"),
            },
        }
    else:
        for admin in (admins.data or []):
            if admin["email"] != email:
                notify_org_admin(
                    org_admin_email=admin["email"],
                    type="member_joined",
                    title=f"{email} joined your workspace",
                    message=f"A new member joined {org['name']} via invitation.",
                )

    return {
        "detail": f"Joined {org['name']}",
        "member": member,
        "org": {
            "id": org["id"],
            "name": org["name"],
            "domain": org["domain"],
            "logo_url": org.get("logo_url"),
        },
    }


# =============================================================================
# Approve / deny pending join requests
# =============================================================================


@router.put("/{member_id}/approve")
async def approve_member(
    member_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Approve a pending join request.

    Admin only. Sets status to 'active' with no permissions (admin grants later).
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    target = (
        supabase.table("company_members")
        .select("*")
        .eq("id", member_id)
        .eq("organization_id", org["id"])
        .eq("status", "pending")
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Pending member not found")

    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("company_members")
        .update({"status": "active", "joined_at": now})
        .eq("id", member_id)
        .execute()
    )

    log_action(
        action="member_approved",
        resource_type="member",
        resource_id=member_id,
        actor_id=user["id"],
        actor_type="member",
        metadata={"email": target.data[0]["email"]},
    )

    return {"detail": f"Approved {target.data[0]['email']}", "member": result.data[0]}


@router.put("/{member_id}/deny")
async def deny_member(
    member_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Deny a pending join request.

    Admin only. Sets status to 'deactivated'.
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    target = (
        supabase.table("company_members")
        .select("*")
        .eq("id", member_id)
        .eq("organization_id", org["id"])
        .eq("status", "pending")
        .execute()
    )
    if not target.data:
        raise HTTPException(status_code=404, detail="Pending member not found")

    supabase.table("company_members").update({
        "status": "deactivated",
    }).eq("id", member_id).execute()

    log_action(
        action="member_denied",
        resource_type="member",
        resource_id=member_id,
        actor_id=user["id"],
        actor_type="member",
        metadata={"email": target.data[0]["email"]},
    )

    return {"detail": f"Denied {target.data[0]['email']}"}


# =============================================================================
# Notification preferences
# =============================================================================


@router.put("/notifications")
async def update_notification_preferences(
    prefs: NotificationPreferencesUpdate,
    user: dict = Depends(get_current_company_member),
):
    """Update the current member's notification preferences.

    Partial update — only include the channels/events you want to change.
    Merges with existing preferences.
    """
    member = user["member"]
    supabase = get_supabase()

    current_prefs = member.get("notification_preferences") or {}

    if prefs.in_app is not None:
        current_in_app = current_prefs.get("in_app", {})
        current_in_app.update(prefs.in_app)
        current_prefs["in_app"] = current_in_app

    if prefs.email is not None:
        current_email = current_prefs.get("email", {})
        current_email.update(prefs.email)
        current_prefs["email"] = current_email

    supabase.table("company_members").update({
        "notification_preferences": current_prefs,
    }).eq("id", member["id"]).execute()

    return current_prefs
