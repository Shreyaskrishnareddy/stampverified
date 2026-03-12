from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_user
from app.config import get_supabase

router = APIRouter(prefix="/api/settings", tags=["settings"])


class PasswordChange(BaseModel):
    new_password: str


@router.put("/password")
async def change_password(
    data: PasswordChange,
    user: dict = Depends(get_current_user),
):
    """Change the current user's password.

    Uses Supabase Admin API to update the password.
    """
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    supabase = get_supabase()
    try:
        supabase.auth.admin.update_user_by_id(
            user["id"],
            {"password": data.new_password},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update password: {str(e)}")

    return {"detail": "Password updated"}


@router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)):
    """Delete the current user's account and all associated data.

    Deletes: profile, all claims, all notifications, auth user.
    This is irreversible.
    """
    supabase = get_supabase()
    user_id = user["id"]

    # Delete claims (cascades from profile FK, but explicit for safety)
    supabase.table("employment_claims").delete().eq("user_id", user_id).execute()
    supabase.table("education_claims").delete().eq("user_id", user_id).execute()

    # Delete notifications
    supabase.table("notifications").delete().eq("user_id", user_id).execute()

    # Delete profile
    supabase.table("profiles").delete().eq("id", user_id).execute()

    # Delete auth user
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        print(f"[SETTINGS] Failed to delete auth user: {e}")

    return {"detail": "Account deleted"}
