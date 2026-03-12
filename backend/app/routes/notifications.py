from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.models.notification import NotificationResponse, UnreadCountResponse
from app.config import get_supabase

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationResponse])
async def list_notifications(user: dict = Depends(get_current_user)):
    """Get all notifications for the current user, newest first."""
    supabase = get_supabase()
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data or []


@router.get("/org", response_model=list[NotificationResponse])
async def list_org_notifications(user: dict = Depends(get_current_user)):
    """Get notifications for the current user as an org admin (by email)."""
    supabase = get_supabase()
    result = (
        supabase.table("notifications")
        .select("*")
        .eq("org_admin_email", user["email"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return result.data or []


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(user: dict = Depends(get_current_user)):
    """Get count of unread notifications for the bell icon."""
    supabase = get_supabase()

    # Count user notifications
    user_notifs = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user["id"])
        .eq("is_read", False)
        .execute()
    )

    # Also count org admin notifications if applicable
    org_notifs = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("org_admin_email", user["email"])
        .eq("is_read", False)
        .execute()
    )

    total = (user_notifs.count or 0) + (org_notifs.count or 0)
    return {"count": total}


@router.put("/{notification_id}/read")
async def mark_as_read(notification_id: str, user: dict = Depends(get_current_user)):
    """Mark a single notification as read."""
    supabase = get_supabase()
    supabase.table("notifications").update({"is_read": True}).eq("id", notification_id).execute()
    return {"detail": "Marked as read"}


@router.put("/read-all")
async def mark_all_as_read(user: dict = Depends(get_current_user)):
    """Mark all notifications as read for the current user."""
    supabase = get_supabase()

    # Mark user notifications
    supabase.table("notifications").update({"is_read": True}).eq("user_id", user["id"]).eq("is_read", False).execute()

    # Mark org admin notifications
    supabase.table("notifications").update({"is_read": True}).eq("org_admin_email", user["email"]).eq("is_read", False).execute()

    return {"detail": "All notifications marked as read"}
