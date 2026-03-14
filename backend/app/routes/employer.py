from datetime import datetime, date, timezone
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.middleware.auth import get_current_company_member, require_permission
from app.models.claims import CorrectAndVerifyAction, DisputeAction
from app.config import get_supabase
from app.services.notifications import notify_user

router = APIRouter(prefix="/api/employer", tags=["employer"])


class DepartureRequest(BaseModel):
    end_date: date


# =============================================================================
# Dashboard views
# =============================================================================


@router.get("/claims")
async def get_pending_claims(user: dict = Depends(get_current_company_member)):
    """Get all claims pending verification for this org.

    Any active member can view pending claims. Only members with
    can_verify_claims permission can take action on them.
    """
    org = user["org"]
    supabase = get_supabase()

    employment = (
        supabase.table("employment_claims")
        .select("id,user_id,company_name,title,department,employment_type,start_date,end_date,is_current,status,previous_dispute_reason,user_denial_reason,created_at")
        .eq("organization_id", org["id"])
        .in_("status", ["awaiting_verification"])
        .order("created_at", desc=True)
        .execute()
    )

    education = (
        supabase.table("education_claims")
        .select("id,user_id,institution,degree,field_of_study,start_date,end_date,status,previous_dispute_reason,user_denial_reason,created_at")
        .eq("organization_id", org["id"])
        .in_("status", ["awaiting_verification"])
        .order("created_at", desc=True)
        .execute()
    )

    # Enrich with claimer names (just name, not full profile — Q43)
    claims = []
    for claim in (employment.data or []):
        profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
        claim["claimer_name"] = profile.data[0]["full_name"] if profile.data else "Unknown"
        claim["claim_type"] = "employment"
        claims.append(claim)

    for claim in (education.data or []):
        profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
        claim["claimer_name"] = profile.data[0]["full_name"] if profile.data else "Unknown"
        claim["claim_type"] = "education"
        claims.append(claim)

    return claims


@router.get("/employees")
async def get_verified_employees(user: dict = Depends(get_current_company_member)):
    """Get all verified employees/graduates for this org.

    Any active member can view verified employees.
    """
    org = user["org"]
    supabase = get_supabase()

    employment = (
        supabase.table("employment_claims")
        .select("id,user_id,company_name,title,department,start_date,end_date,is_current,verified_at")
        .eq("organization_id", org["id"])
        .eq("status", "verified")
        .order("verified_at", desc=True)
        .execute()
    )

    education = (
        supabase.table("education_claims")
        .select("id,user_id,institution,degree,field_of_study,start_date,end_date,verified_at")
        .eq("organization_id", org["id"])
        .eq("status", "verified")
        .order("verified_at", desc=True)
        .execute()
    )

    employees = []
    for claim in (employment.data or []):
        profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
        claim["claimer_name"] = profile.data[0]["full_name"] if profile.data else "Unknown"
        claim["claim_type"] = "employment"
        employees.append(claim)

    for claim in (education.data or []):
        profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
        claim["claimer_name"] = profile.data[0]["full_name"] if profile.data else "Unknown"
        claim["claim_type"] = "education"
        employees.append(claim)

    return employees


# =============================================================================
# Verification actions
# =============================================================================


def _get_claim_for_org(claim_id: str, table: str, org_id: str) -> dict:
    """Fetch a claim and verify it belongs to this org."""
    supabase = get_supabase()
    result = (
        supabase.table(table)
        .select("*")
        .eq("id", claim_id)
        .eq("organization_id", org_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Claim not found for your organization")
    return result.data[0]


@router.post("/claims/{claim_id}/verify")
async def verify_claim(
    claim_id: str,
    claim_type: Literal["employment", "education"],
    user: dict = Depends(get_current_company_member),
):
    """Verify a claim as-is. No corrections needed.

    Requires can_verify_claims permission.
    """
    require_permission(user["member"], "can_verify_claims")

    org = user["org"]
    table = f"{claim_type}_claims"
    claim = _get_claim_for_org(claim_id, table, org["id"])

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="Claim is not awaiting verification")

    supabase = get_supabase()
    supabase.table(table).update({
        "status": "verified",
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verified_by_org": org["name"],
    }).eq("id", claim_id).execute()

    notify_user(
        user_id=claim["user_id"],
        type="claim_verified",
        title=f"Your claim has been verified by {org['name']}",
        message=f"Your {claim_type} claim has been confirmed.",
        claim_id=claim_id,
        claim_table=table,
    )

    return {"detail": "Claim verified", "status": "verified"}


@router.post("/claims/{claim_id}/correct")
async def correct_and_verify_claim(
    claim_id: str,
    claim_type: Literal["employment", "education"],
    correction: CorrectAndVerifyAction,
    user: dict = Depends(get_current_company_member),
):
    """Propose corrections to a claim. Sent back to user for acceptance.

    Requires can_verify_claims permission.
    """
    require_permission(user["member"], "can_verify_claims")

    org = user["org"]
    table = f"{claim_type}_claims"
    claim = _get_claim_for_org(claim_id, table, org["id"])

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="Claim is not awaiting verification")

    supabase = get_supabase()

    update_data = {
        "status": "correction_proposed",
        "corrected_by": user["email"],
        "correction_reason": correction.correction_reason,
    }

    if claim_type == "employment":
        if correction.corrected_title:
            update_data["corrected_title"] = correction.corrected_title
        if correction.corrected_start_date:
            update_data["corrected_start_date"] = correction.corrected_start_date.isoformat()
        if correction.corrected_end_date:
            update_data["corrected_end_date"] = correction.corrected_end_date.isoformat()
    else:
        if correction.corrected_degree:
            update_data["corrected_degree"] = correction.corrected_degree
        if correction.corrected_field:
            update_data["corrected_field"] = correction.corrected_field
        if correction.corrected_start_date:
            update_data["corrected_start_date"] = correction.corrected_start_date.isoformat()
        if correction.corrected_end_date:
            update_data["corrected_end_date"] = correction.corrected_end_date.isoformat()

    supabase.table(table).update(update_data).eq("id", claim_id).execute()

    notify_user(
        user_id=claim["user_id"],
        type="correction_proposed",
        title=f"{org['name']} suggested corrections to your claim",
        message="Review and accept or deny the proposed changes.",
        claim_id=claim_id,
        claim_table=table,
    )

    return {"detail": "Correction proposed", "status": "correction_proposed"}


@router.post("/claims/{claim_id}/dispute")
async def dispute_claim(
    claim_id: str,
    claim_type: Literal["employment", "education"],
    dispute: DisputeAction,
    user: dict = Depends(get_current_company_member),
):
    """Dispute a claim entirely. Claim is hidden from public profile.

    Requires can_verify_claims permission.
    """
    require_permission(user["member"], "can_verify_claims")

    org = user["org"]
    table = f"{claim_type}_claims"
    claim = _get_claim_for_org(claim_id, table, org["id"])

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="Claim is not awaiting verification")

    supabase = get_supabase()
    new_dispute_count = (claim.get("dispute_count") or 0) + 1

    if new_dispute_count >= 5:
        supabase.table(table).update({
            "status": "permanently_locked",
            "disputed_reason": dispute.reason,
            "dispute_count": new_dispute_count,
        }).eq("id", claim_id).execute()

        notify_user(
            user_id=claim["user_id"],
            type="claim_locked",
            title="Your claim has been permanently locked",
            message=f"This claim has been disputed {new_dispute_count} times and can no longer be resubmitted.",
            claim_id=claim_id,
            claim_table=table,
        )

        return {"detail": "Claim permanently locked after 5 disputes", "status": "permanently_locked"}

    supabase.table(table).update({
        "status": "disputed",
        "disputed_reason": dispute.reason,
        "dispute_count": new_dispute_count,
    }).eq("id", claim_id).execute()

    notify_user(
        user_id=claim["user_id"],
        type="claim_disputed",
        title=f"Your claim was disputed by {org['name']}",
        message=f"Reason: {dispute.reason}. You can edit and resubmit ({5 - new_dispute_count} attempts remaining).",
        claim_id=claim_id,
        claim_table=table,
    )

    return {"detail": "Claim disputed", "status": "disputed"}


# =============================================================================
# Departure tracking
# =============================================================================


@router.post("/employees/{claim_id}/depart")
async def mark_as_departed(
    claim_id: str,
    departure: DepartureRequest,
    user: dict = Depends(get_current_company_member),
):
    """Mark a verified employee as departed. Updates end date, sets is_current to false.
    Only works on employment claims (not education).

    Requires can_verify_claims permission.
    """
    require_permission(user["member"], "can_verify_claims")

    org = user["org"]
    claim = _get_claim_for_org(claim_id, "employment_claims", org["id"])

    if claim["status"] != "verified":
        raise HTTPException(status_code=400, detail="Can only mark departed on verified claims")

    supabase = get_supabase()
    supabase.table("employment_claims").update({
        "end_date": departure.end_date.isoformat(),
        "is_current": False,
    }).eq("id", claim_id).execute()

    notify_user(
        user_id=claim["user_id"],
        type="employee_departed",
        title=f"{org['name']} updated your employment end date",
        message=f"Your employment has been marked as ended on {departure.end_date}. Your verification remains valid.",
        claim_id=claim_id,
        claim_table="employment_claims",
    )

    return {"detail": "Employee marked as departed"}
