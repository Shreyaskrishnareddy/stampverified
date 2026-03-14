from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProfileCreate(BaseModel):
    username: str
    full_name: str
    headline: Optional[str] = None
    location: Optional[str] = None


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    headline: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    notification_preferences: Optional[dict] = None


class ProfileResponse(BaseModel):
    id: str
    username: Optional[str] = None
    full_name: str
    headline: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    notification_preferences: Optional[dict] = None
    created_at: Optional[datetime] = None
