from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.middleware.auth import get_current_user
from app.config import get_supabase

router = APIRouter(prefix="/api/settings", tags=["settings"])


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class AccountDeleteConfirm(BaseModel):
    confirmation: str  # Must be "deletemyaccount"


@router.put("/password")
async def change_password(
    data: PasswordChange,
    user: dict = Depends(get_current_user),
):
    """Change the current user's password.

    Requires the current password for security — prevents account
    takeover with a stolen JWT.
    """
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    supabase = get_supabase()

    # Verify current password by attempting to sign in
    try:
        supabase.auth.sign_in_with_password({
            "email": user["email"],
            "password": data.current_password,
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update to new password
    try:
        supabase.auth.admin.update_user_by_id(
            user["id"],
            {"password": data.new_password},
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to update password")

    return {"detail": "Password updated"}


@router.delete("/account")
async def delete_account(
    data: AccountDeleteConfirm,
    user: dict = Depends(get_current_user),
):
    """Delete the current user's account and all associated data.

    Requires typing "deletemyaccount" to confirm. Uses an atomic
    PostgreSQL function — everything deletes in a single transaction,
    or nothing does. Then removes the auth user separately.
    This is irreversible.
    """
    if data.confirmation != "deletemyaccount":
        raise HTTPException(status_code=400, detail='Type "deletemyaccount" to confirm')

    supabase = get_supabase()
    user_id = user["id"]

    # Atomic deletion of all user data via PostgreSQL function
    try:
        supabase.rpc("delete_user_account", {"target_user_id": user_id}).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Account deletion failed. Please try again.")

    # Delete auth user (separate from DB transaction — Supabase Admin API)
    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        print(f"[SETTINGS] Failed to delete auth user (DB data already deleted): {e}")

    return {"detail": "Account deleted"}
