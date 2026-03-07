from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.models.profile import ProfileCreate, ProfileUpdate, ProfileResponse
from app.config import get_supabase

router = APIRouter(prefix="/api/profile", tags=["profile"])


@router.post("/", response_model=ProfileResponse)
async def create_profile(profile: ProfileCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = supabase.table("profiles").select("id").eq("id", user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Profile already exists")

    username_check = supabase.table("profiles").select("id").eq("username", profile.username).execute()
    if username_check.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    data = {
        "id": user["id"],
        "username": profile.username,
        "full_name": profile.full_name,
        "headline": profile.headline,
        "location": profile.location,
    }

    result = supabase.table("profiles").insert(data).execute()
    return result.data[0]


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = supabase.table("profiles").select("*").eq("id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.put("/me", response_model=ProfileResponse)
async def update_my_profile(profile: ProfileUpdate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    update_data = {k: v for k, v in profile.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "username" in update_data:
        username_check = (
            supabase.table("profiles")
            .select("id")
            .eq("username", update_data["username"])
            .neq("id", user["id"])
            .execute()
        )
        if username_check.data:
            raise HTTPException(status_code=400, detail="Username already taken")

    result = supabase.table("profiles").update(update_data).eq("id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return result.data[0]


@router.get("/{username}", response_model=dict)
async def get_public_profile(username: str):
    supabase = get_supabase()

    profile = supabase.table("profiles").select("*").eq("username", username).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    user_id = profile.data[0]["id"]

    employment = (
        supabase.table("employment_claims")
        .select("id,company_name,title,department,employment_type,start_date,end_date,is_current,status,verified_at")
        .eq("user_id", user_id)
        .order("start_date", desc=True)
        .execute()
    )

    education = (
        supabase.table("education_claims")
        .select("id,institution,degree,field_of_study,year_started,year_completed,status,verified_at")
        .eq("user_id", user_id)
        .order("year_completed", desc=True)
        .execute()
    )

    return {
        "profile": profile.data[0],
        "employment": employment.data or [],
        "education": education.data or [],
    }
