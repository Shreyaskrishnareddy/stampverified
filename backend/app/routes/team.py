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
from app.config import get_supabase
from app.services.notifications import notify_org_admin

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
        .in_("status", ["active", "invited"])
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

    return {"detail": f"Member {target_member['email']} has been removed"}


# =============================================================================
# Self-service workspace join
# =============================================================================


@router.post("/join")
async def join_workspace(user: dict = Depends(get_current_user)):
    """Join a company workspace based on email domain matching.

    Any authenticated user whose email domain matches a registered
    organization's domain can join that workspace. First member auto-
    becomes admin. Subsequent members join with no permissions.

    If there's a pending invite for this email, it's fulfilled automatically.
    """
    supabase = get_supabase()
    email = user["email"].strip().lower()

    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

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
        # Check if there are any existing active members
        active_members = (
            supabase.table("company_members")
            .select("id", count="exact")
            .eq("organization_id", org["id"])
            .eq("status", "active")
            .execute()
        )

        is_first_member = (active_members.count or 0) == 0

        # Self-service join
        member_data = {
            "organization_id": org["id"],
            "user_id": user["id"],
            "email": email,
            "role": "admin" if is_first_member else "member",
            "can_post_jobs": is_first_member,      # First member gets all permissions
            "can_verify_claims": is_first_member,
            "status": "active",
            "joined_at": now,
        }

        result = supabase.table("company_members").insert(member_data).execute()
        member = result.data[0]

    # Notify existing admins that someone joined
    if member["role"] != "admin":
        admins = (
            supabase.table("company_members")
            .select("email")
            .eq("organization_id", org["id"])
            .eq("role", "admin")
            .eq("status", "active")
            .execute()
        )
        for admin in (admins.data or []):
            notify_org_admin(
                org_admin_email=admin["email"],
                type="member_joined",
                title=f"{email} joined your workspace",
                message=f"A new member joined {org['name']}. Review their permissions in Team settings.",
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
