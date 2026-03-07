from fastapi import APIRouter, HTTPException
from app.models.claims import VerificationAction
from app.config import get_supabase
from app.services.trust_score import calculate_trust_score
from datetime import datetime

router = APIRouter(prefix="/api/verify", tags=["verification"])


def find_claim_by_token(token: str) -> tuple[dict, str]:
    """Find a claim by verification token. Returns (claim, table_name)."""
    supabase = get_supabase()

    employment = (
        supabase.table("employment_claims")
        .select("*")
        .eq("verification_token", token)
        .execute()
    )
    if employment.data:
        return employment.data[0], "employment_claims"

    education = (
        supabase.table("education_claims")
        .select("*")
        .eq("verification_token", token)
        .execute()
    )
    if education.data:
        return education.data[0], "education_claims"

    raise HTTPException(status_code=404, detail="Verification link not found or expired")


@router.get("/{token}")
async def get_claim_for_verification(token: str):
    claim, table_name = find_claim_by_token(token)

    profile = (
        get_supabase()
        .table("profiles")
        .select("full_name,avatar_url")
        .eq("id", claim["user_id"])
        .execute()
    )

    claimer_name = profile.data[0]["full_name"] if profile.data else "Unknown"
    avatar_url = profile.data[0].get("avatar_url") if profile.data else None

    claim_type = "employment" if table_name == "employment_claims" else "education"

    response = {
        "claim_type": claim_type,
        "status": claim["status"],
        "claimer_name": claimer_name,
        "avatar_url": avatar_url,
    }

    if claim_type == "employment":
        response.update({
            "company_name": claim["company_name"],
            "title": claim["title"],
            "department": claim.get("department"),
            "employment_type": claim.get("employment_type"),
            "start_date": claim["start_date"],
            "end_date": claim.get("end_date"),
            "is_current": claim.get("is_current", False),
        })
    else:
        response.update({
            "institution": claim["institution"],
            "degree": claim["degree"],
            "field_of_study": claim.get("field_of_study"),
            "year_started": claim.get("year_started"),
            "year_completed": claim.get("year_completed"),
        })

    return response


@router.post("/{token}")
async def verify_or_dispute_claim(token: str, action: VerificationAction):
    claim, table_name = find_claim_by_token(token)

    if claim["status"] in ("verified", "disputed"):
        raise HTTPException(status_code=400, detail="This claim has already been reviewed")

    if action.action not in ("verify", "dispute"):
        raise HTTPException(status_code=400, detail="Action must be 'verify' or 'dispute'")

    if action.action == "dispute" and not action.reason:
        raise HTTPException(status_code=400, detail="Reason is required when disputing a claim")

    supabase = get_supabase()

    update_data = {
        "status": "verified" if action.action == "verify" else "disputed",
        "verified_at": datetime.utcnow().isoformat(),
    }

    if action.action == "dispute":
        update_data["disputed_reason"] = action.reason

    supabase.table(table_name).update(update_data).eq("id", claim["id"]).execute()

    calculate_trust_score(claim["user_id"])

    return {
        "detail": f"Claim has been {'verified' if action.action == 'verify' else 'disputed'}",
        "status": update_data["status"],
    }
