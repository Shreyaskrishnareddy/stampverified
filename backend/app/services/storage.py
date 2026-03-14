"""Supabase Storage service for avatars and organization logos.

Required Supabase Storage buckets (create via Supabase dashboard):
  - "avatars" — public bucket for user profile pictures
  - "logos"   — public bucket for organization logos

Both buckets should have:
  - Public access: enabled
  - Max file size: 5MB
  - Allowed MIME types: image/jpeg, image/png, image/webp, image/gif
"""

import time
from fastapi import UploadFile, HTTPException
from app.config import get_supabase, get_settings


MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


async def upload_file(bucket: str, file_path: str, file: UploadFile) -> str:
    """Upload a file to Supabase Storage and return its public URL.

    Args:
        bucket: Storage bucket name ("avatars" or "logos")
        file_path: Path within bucket (e.g., "user-id.jpg")
        file: The uploaded file

    Returns:
        Public URL of the uploaded file
    """
    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="File must be a JPEG, PNG, WebP, or GIF image")

    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5MB")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5MB")
    supabase = get_supabase()
    settings = get_settings()

    try:
        supabase.storage.from_(bucket).upload(
            file_path,
            content,
            file_options={"content-type": file.content_type, "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    ts = int(time.time())
    return f"{settings.supabase_url}/storage/v1/object/public/{bucket}/{file_path}?v={ts}"


async def upload_avatar(user_id: str, file: UploadFile) -> str:
    """Upload a user avatar. Returns the public URL."""
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    file_path = f"{user_id}.{ext}"
    url = await upload_file("avatars", file_path, file)

    # Update profile with new avatar URL
    supabase = get_supabase()
    supabase.table("profiles").update({"avatar_url": url}).eq("id", user_id).execute()

    return url


async def upload_org_logo(org_id: str, file: UploadFile) -> str:
    """Upload an organization logo. Returns the public URL."""
    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    file_path = f"{org_id}.{ext}"
    url = await upload_file("logos", file_path, file)

    # Update organization with new logo URL
    supabase = get_supabase()
    supabase.table("organizations").update({"logo_url": url}).eq("id", org_id).execute()

    return url
