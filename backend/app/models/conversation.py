from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


class OutreachCreate(BaseModel):
    """Recruiter initiating outreach to a candidate."""
    candidate_id: str
    job_id: str
    message: str

    @field_validator("message")
    @classmethod
    def message_length(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 300:
            raise ValueError("Outreach message must be under 300 characters")
        return v


class MessageCreate(BaseModel):
    """Sending a message in an existing conversation."""
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 5000:
            raise ValueError("Message must be under 5,000 characters")
        return v


class ConversationResponse(BaseModel):
    """Conversation summary for the conversations list."""
    id: str
    type: str                                       # application | outreach
    status: str = "active"
    application_id: Optional[str] = None
    job_id: Optional[str] = None
    candidate_id: str
    company_member_id: str
    organization_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Enriched fields
    other_party_name: Optional[str] = None
    other_party_email: Optional[str] = None
    org_name: Optional[str] = None
    org_domain: Optional[str] = None
    job_title: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_sender: Optional[str] = None
    unread_count: int = 0


class MessageResponse(BaseModel):
    """Individual message in a conversation thread."""
    id: str
    conversation_id: str
    sender_type: str
    sender_id: str
    content: str
    sent_at: Optional[datetime] = None
    read_at: Optional[datetime] = None

    # Enriched
    sender_name: Optional[str] = None
