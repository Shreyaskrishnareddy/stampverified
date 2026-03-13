from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
    """Change the current user's password."""
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

    Uses an atomic PostgreSQL function — everything deletes in a single
    transaction, or nothing does. Then removes the auth user separately.
    This is irreversible.
    """
    supabase = get_supabase()
    user_id = user["id"]

    # Atomic deletion of all user data via PostgreSQL function
    try:
        supabase.rpc("delete_user_account", {"target_user_id": user_id}).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account deletion failed: {str(e)}")

    # Delete auth user (separate from DB transaction — Supabase Admin API)
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        print(f"[SETTINGS] Failed to delete auth user (DB data already deleted): {e}")

    return {"detail": "Account deleted"}
