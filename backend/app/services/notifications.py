from app.config import get_supabase


def notify_user(
    user_id: str,
    type: str,
    title: str,
    message: str = None,
    claim_id: str = None,
    claim_table: str = None,
):
    """Create an in-app notification for a regular user."""
    supabase = get_supabase()
    data = {
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "claim_id": claim_id,
        "claim_table": claim_table,
    }
    supabase.table("notifications").insert(data).execute()


def notify_org_admin(
    org_admin_email: str,
    type: str,
    title: str,
    message: str = None,
    claim_id: str = None,
    claim_table: str = None,
):
    """Create an in-app notification for an org admin."""
    supabase = get_supabase()
    data = {
        "org_admin_email": org_admin_email,
        "type": type,
        "title": title,
        "message": message,
        "claim_id": claim_id,
        "claim_table": claim_table,
    }
    supabase.table("notifications").insert(data).execute()
