from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    message: Optional[str] = None
    claim_id: Optional[str] = None
    claim_table: Optional[str] = None
    is_read: bool = False
    created_at: Optional[datetime] = None


class UnreadCountResponse(BaseModel):
    count: int
