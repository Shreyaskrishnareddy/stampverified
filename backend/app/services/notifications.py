"""Notification service.

Creates in-app notifications and optionally sends email notifications
based on user preferences.

In-app notifications are always created (unless the user toggled them off).
Email notifications are only sent if the user opted in (default: off).
"""

from app.config import get_supabase, get_settings
from app.services.email import (
    send_new_application_email,
    send_application_status_email,
    send_new_message_email,
    send_outreach_email,
    send_claim_status_email,
)

# Maps notification types to preference keys
_TYPE_TO_PREF_KEY = {
    "claim_verified": "claim_update",
    "claim_disputed": "claim_update",
    "claim_locked": "claim_update",
    "correction_proposed": "claim_update",
    "new_application": "new_application",
    "application_shortlisted": "application_status",
    "application_rejected": "application_status",
    "new_message": "new_message",
    "new_outreach": "new_outreach",
    "member_joined": "member_joined",
    "claim_expired": "claim_update",
    "org_registered": "claim_update",
    "claim_resubmitted": "new_application",
    "correction_denied": "new_application",
    "employee_departed": "claim_update",
}

# Types that trigger email (maps to email function calls)
_EMAIL_TYPES = {
    "new_application", "application_shortlisted", "application_rejected",
    "new_message", "new_outreach",
    "claim_verified", "claim_disputed", "correction_proposed",
}


def _should_notify(preferences: dict | None, channel: str, notif_type: str) -> bool:
    """Check if a notification should be sent for the given channel and type."""
    if not preferences:
        # Default: in-app on, email off
        return channel == "in_app"

    pref_key = _TYPE_TO_PREF_KEY.get(notif_type)
    if not pref_key:
        return channel == "in_app"  # Unknown types: in-app only

    channel_prefs = preferences.get(channel, {})
    if channel == "in_app":
        return channel_prefs.get(pref_key, True)  # Default on
    else:
        return channel_prefs.get(pref_key, False)  # Default off


def notify_user(
    user_id: str,
    type: str,
    title: str,
    message: str = None,
    claim_id: str = None,
    claim_table: str = None,
):
    """Create an in-app notification for a regular user.

    Also sends an email notification if the user has opted in.
    Silently catches errors — notifications are secondary effects.
    """
    try:
        supabase = get_supabase()
        settings = get_settings()

        # Get user preferences + email
        profile = (
            supabase.table("profiles")
            .select("notification_preferences")
            .eq("id", user_id)
            .execute()
        )
        preferences = profile.data[0].get("notification_preferences") if profile.data else None

        # Get user email from auth
        user_data = supabase.auth.admin.get_user_by_id(user_id)
        user_email = user_data.user.email if user_data and user_data.user else None

        # In-app notification
        if _should_notify(preferences, "in_app", type):
            data = {
                "user_id": user_id,
                "type": type,
                "title": title,
                "message": message,
                "claim_id": claim_id,
                "claim_table": claim_table,
            }
            supabase.table("notifications").insert(data).execute()

        # Email notification
        if user_email and type in _EMAIL_TYPES and _should_notify(preferences, "email", type):
            frontend_url = settings.frontend_url

            if type in ("application_shortlisted", "application_rejected"):
                # Extract job title and org name from the notification title
                send_application_status_email(
                    to_email=user_email,
                    job_title=title.split("for ")[-1] if "for " in title else "a role",
                    org_name=message.split(" ")[0] if message else "",
                    status="shortlisted" if type == "application_shortlisted" else "rejected",
                    frontend_url=frontend_url,
                )
            elif type == "new_message":
                send_new_message_email(
                    to_email=user_email,
                    sender_name="Someone",
                    preview=message or "",
                    frontend_url=frontend_url,
                    is_employer=False,
                )
            elif type == "new_outreach":
                send_outreach_email(
                    to_email=user_email,
                    org_name=title.split(" reached")[0] if " reached" in title else "",
                    job_title=title.split("about ")[-1] if "about " in title else "a role",
                    message=message or "",
                    frontend_url=frontend_url,
                )
            elif type in ("claim_verified", "claim_disputed", "correction_proposed"):
                claim_type = "employment" if claim_table == "employment_claims" else "education"
                org_name = title.split("by ")[-1] if "by " in title else ""
                if not org_name and "suggested" in title:
                    org_name = title.split(" suggested")[0]
                send_claim_status_email(
                    to_email=user_email,
                    org_name=org_name,
                    claim_type=claim_type,
                    status=type.replace("claim_", ""),
                    frontend_url=frontend_url,
                )

    except Exception as e:
        print(f"[NOTIFY] Failed to notify user {user_id}: {e}")


def notify_org_admin(
    org_admin_email: str,
    type: str,
    title: str,
    message: str = None,
    claim_id: str = None,
    claim_table: str = None,
):
    """Create an in-app notification for an org admin.

    Also sends an email notification if the member has opted in.
    Silently catches errors — notifications are secondary effects.
    """
    try:
        supabase = get_supabase()
        settings = get_settings()

        # Get member preferences
        member = (
            supabase.table("company_members")
            .select("notification_preferences")
            .eq("email", org_admin_email)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        preferences = member.data[0].get("notification_preferences") if member.data else None

        # In-app notification
        if _should_notify(preferences, "in_app", type):
            data = {
                "org_admin_email": org_admin_email,
                "type": type,
                "title": title,
                "message": message,
                "claim_id": claim_id,
                "claim_table": claim_table,
            }
            supabase.table("notifications").insert(data).execute()

        # Email notification
        if type in _EMAIL_TYPES and _should_notify(preferences, "email", type):
            frontend_url = settings.frontend_url

            if type == "new_application":
                job_title = title.replace("New application for ", "") if title.startswith("New application") else "a role"
                candidate_name = message.split(" applied")[0] if message and " applied" in message else "Someone"
                send_new_application_email(
                    to_email=org_admin_email,
                    candidate_name=candidate_name,
                    job_title=job_title,
                    frontend_url=frontend_url,
                )
            elif type == "new_message":
                send_new_message_email(
                    to_email=org_admin_email,
                    sender_name="A candidate",
                    preview=message or "",
                    frontend_url=frontend_url,
                    is_employer=True,
                )

    except Exception as e:
        print(f"[NOTIFY] Failed to notify org admin {org_admin_email}: {e}")
