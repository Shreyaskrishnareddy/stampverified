"""Cron endpoints for scheduled tasks.

Call POST /api/cron/expire-claims periodically (e.g., daily via cron-job.org)
to auto-expire claims that have been awaiting_verification for 30+ days.
"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Header, HTTPException
from app.config import get_supabase, get_settings
from app.services.notifications import notify_user

router = APIRouter(prefix="/api/cron", tags=["cron"])

EXPIRY_DAYS = 30


@router.post("/expire-claims")
async def expire_claims(
    authorization: str | None = Header(None),
):
    """Expire claims that have been awaiting_verification for 30+ days.

    Protected by a simple bearer token check — use SUPABASE_SERVICE_KEY
    or any shared secret. For cron services, set the Authorization header.
    """
    settings = get_settings()

    # Auth: require a dedicated cron secret (not the Supabase service key)
    if settings.environment == "production":
        if not settings.cron_secret:
            raise HTTPException(status_code=500, detail="CRON_SECRET not configured")
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Unauthorized")
        token = authorization.split(" ", 1)[1]
        if token != settings.cron_secret:
            raise HTTPException(status_code=401, detail="Unauthorized")

    supabase = get_supabase()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    cutoff = (now - timedelta(days=EXPIRY_DAYS)).isoformat()
    expired_count = 0

    # Expire employment claims (by token_expires_at or updated_at fallback)
    emp_by_token = (
        supabase.table("employment_claims")
        .select("id,user_id,company_name")
        .eq("status", "awaiting_verification")
        .lt("token_expires_at", now_iso)
        .execute()
    )
    emp_by_age = (
        supabase.table("employment_claims")
        .select("id,user_id,company_name")
        .eq("status", "awaiting_verification")
        .is_("token_expires_at", "null")
        .lt("updated_at", cutoff)
        .execute()
    )
    # Deduplicate
    seen_ids = set()
    emp_claims = []
    for claim in (emp_by_token.data or []) + (emp_by_age.data or []):
        if claim["id"] not in seen_ids:
            seen_ids.add(claim["id"])
            emp_claims.append(claim)

    for claim in emp_claims:
        supabase.table("employment_claims").update({
            "status": "expired",
            "expired_at": now_iso,
        }).eq("id", claim["id"]).execute()

        notify_user(
            user_id=claim["user_id"],
            type="claim_expired",
            title=f"Claim expired: {claim['company_name']}",
            message="Your verification request expired after 30 days. You can resend it.",
            claim_id=claim["id"],
            claim_table="employment_claims",
        )
        expired_count += 1

    # Expire education claims (by token_expires_at or updated_at fallback)
    edu_by_token = (
        supabase.table("education_claims")
        .select("id,user_id,institution")
        .eq("status", "awaiting_verification")
        .lt("token_expires_at", now_iso)
        .execute()
    )
    edu_by_age = (
        supabase.table("education_claims")
        .select("id,user_id,institution")
        .eq("status", "awaiting_verification")
        .is_("token_expires_at", "null")
        .lt("updated_at", cutoff)
        .execute()
    )
    seen_ids = set()
    edu_claims = []
    for claim in (edu_by_token.data or []) + (edu_by_age.data or []):
        if claim["id"] not in seen_ids:
            seen_ids.add(claim["id"])
            edu_claims.append(claim)

    for claim in edu_claims:
        supabase.table("education_claims").update({
            "status": "expired",
            "expired_at": now_iso,
        }).eq("id", claim["id"]).execute()

        notify_user(
            user_id=claim["user_id"],
            type="claim_expired",
            title=f"Claim expired: {claim['institution']}",
            message="Your verification request expired after 30 days. You can resend it.",
            claim_id=claim["id"],
            claim_table="education_claims",
        )
        expired_count += 1

    # Expire jobs past their expiry date
    expired_jobs = 0
    expired_jobs_result = (
        supabase.table("jobs")
        .select("id,title,organization_id")
        .eq("status", "active")
        .lt("expires_at", datetime.now(timezone.utc).isoformat())
        .execute()
    )
    for job in (expired_jobs_result.data or []):
        supabase.table("jobs").update({
            "status": "closed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job["id"]).execute()
        expired_jobs += 1

    return {"expired_claims": expired_count, "expired_jobs": expired_jobs}
