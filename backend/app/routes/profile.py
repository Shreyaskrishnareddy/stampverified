import re
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.middleware.auth import get_current_user
from app.models.profile import ProfileCreate, ProfileUpdate, ProfileResponse
from app.config import get_supabase
from app.services.storage import upload_avatar as storage_upload_avatar

router = APIRouter(prefix="/api/profile", tags=["profile"])

# Usernames that would conflict with frontend routes
RESERVED_USERNAMES = {
    "dashboard", "auth", "employer", "for-employers", "invite", "verify",
    "settings", "admin", "api", "login", "signup", "register", "about",
    "help", "support", "terms", "privacy", "contact", "blog", "pricing",
    "careers", "stamp", "home", "index", "app", "static", "public",
    "favicon", "robots", "sitemap", "not-found", "error", "404", "500",
}

USERNAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$")


def validate_username(username: str) -> str:
    """Validate and normalize a username. Raises HTTPException on failure."""
    username = username.strip().lower()

    if username in RESERVED_USERNAMES:
        raise HTTPException(status_code=400, detail="This username is reserved")

    if not USERNAME_PATTERN.match(username):
        raise HTTPException(
            status_code=400,
            detail="Username must be 3-30 characters, lowercase letters, numbers, dots, hyphens, or underscores"
        )

    return username


@router.post("/", response_model=ProfileResponse)
async def create_profile(profile: ProfileCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = supabase.table("profiles").select("id").eq("id", user["id"]).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Profile already exists")

    username = validate_username(profile.username)

    username_check = supabase.table("profiles").select("id").eq("username", username).execute()
    if username_check.data:
        raise HTTPException(status_code=400, detail="Username already taken")

    data = {
        "id": user["id"],
        "username": username,
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
        update_data["username"] = validate_username(update_data["username"])
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


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a profile avatar to Supabase Storage."""
    avatar_url = await storage_upload_avatar(user["id"], file)
    return {"avatar_url": avatar_url}


@router.get("/{username}", response_model=dict)
async def get_public_profile(username: str):
    """Public profile page. Returns profile + all claims with their statuses.

    Disputed claims are hidden (Q24). Shows per-claim status labels (Q30).
    Includes verified count for "X of Y verified" display.
    """
    supabase = get_supabase()

    profile = supabase.table("profiles").select("*").eq("username", username).execute()
    if not profile.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    user_id = profile.data[0]["id"]

    # Fetch employment claims — exclude disputed (hidden from profile)
    employment = (
        supabase.table("employment_claims")
        .select("id,company_name,company_domain,title,department,employment_type,start_date,end_date,is_current,status,verified_at,verified_by_org,corrected_title,corrected_start_date,corrected_end_date,organization_id")
        .eq("user_id", user_id)
        .neq("status", "disputed")
        .order("start_date", desc=True)
        .execute()
    )

    # Fetch education claims — exclude disputed
    education = (
        supabase.table("education_claims")
        .select("id,institution,institution_domain,degree,field_of_study,start_date,end_date,status,verified_at,verified_by_org,corrected_degree,corrected_field,corrected_start_date,corrected_end_date,organization_id")
        .eq("user_id", user_id)
        .neq("status", "disputed")
        .order("end_date", desc=True)
        .execute()
    )

    all_claims = (employment.data or []) + (education.data or [])
    verified_count = sum(1 for c in all_claims if c["status"] == "verified")
    total_count = len(all_claims)

    return {
        "profile": profile.data[0],
        "employment": employment.data or [],
        "education": education.data or [],
        "verified_count": verified_count,
        "total_count": total_count,
    }
