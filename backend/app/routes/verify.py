from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_org_admin
from app.models.claims import CorrectAndVerifyAction, DisputeAction
from app.config import get_supabase
from app.services.notifications import notify_user
from datetime import datetime

router = APIRouter(prefix="/api/verify", tags=["verification"])


def _find_claim_by_token(token: str) -> tuple[dict, str]:
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
async def get_claim_for_verification(
    token: str,
    user: dict = Depends(get_current_org_admin),
):
    """Get claim details for an org admin to review.

    Requires org admin auth. The org admin must belong to the org
    that the claim is linked to.
    """
    claim, table_name = _find_claim_by_token(token)
    org = user["org"]

    # Verify the claim belongs to this org
    if claim.get("organization_id") != org["id"]:
        raise HTTPException(status_code=403, detail="This claim is not for your organization")

    # Get claimer name (just name — Q43: no full profile)
    profile = (
        get_supabase()
        .table("profiles")
        .select("full_name")
        .eq("id", claim["user_id"])
        .execute()
    )
    claimer_name = profile.data[0]["full_name"] if profile.data else "Unknown"

    claim_type = "employment" if table_name == "employment_claims" else "education"

    response = {
        "claim_type": claim_type,
        "status": claim["status"],
        "claimer_name": claimer_name,
        "previous_dispute_reason": claim.get("previous_dispute_reason"),
        "user_denial_reason": claim.get("user_denial_reason"),
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
            "start_date": claim.get("start_date"),
            "end_date": claim.get("end_date"),
        })

    return response


@router.post("/{token}/verify")
async def verify_claim_by_token(
    token: str,
    user: dict = Depends(get_current_org_admin),
):
    """Verify a claim via email token link. Requires org admin auth."""
    claim, table_name = _find_claim_by_token(token)
    org = user["org"]

    if claim.get("organization_id") != org["id"]:
        raise HTTPException(status_code=403, detail="This claim is not for your organization")

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    supabase.table(table_name).update({
        "status": "verified",
        "verified_at": datetime.utcnow().isoformat(),
        "verified_by_org": org["name"],
    }).eq("id", claim["id"]).execute()

    notify_user(
        user_id=claim["user_id"],
        type="claim_verified",
        title=f"Your claim has been verified by {org['name']}",
        claim_id=claim["id"],
        claim_table=table_name,
    )

    return {"detail": "Claim verified", "status": "verified"}


@router.post("/{token}/correct")
async def correct_claim_by_token(
    token: str,
    correction: CorrectAndVerifyAction,
    user: dict = Depends(get_current_org_admin),
):
    """Propose corrections via email token link."""
    claim, table_name = _find_claim_by_token(token)
    org = user["org"]

    if claim.get("organization_id") != org["id"]:
        raise HTTPException(status_code=403, detail="This claim is not for your organization")

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    claim_type = "employment" if table_name == "employment_claims" else "education"

    update_data = {
        "status": "correction_proposed",
        "corrected_by": user["email"],
        "correction_reason": correction.reason,
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

    supabase.table(table_name).update(update_data).eq("id", claim["id"]).execute()

    notify_user(
        user_id=claim["user_id"],
        type="correction_proposed",
        title=f"{org['name']} suggested corrections to your claim",
        message="Review and accept or deny the proposed changes.",
        claim_id=claim["id"],
        claim_table=table_name,
    )

    return {"detail": "Correction proposed", "status": "correction_proposed"}


@router.post("/{token}/dispute")
async def dispute_claim_by_token(
    token: str,
    dispute: DisputeAction,
    user: dict = Depends(get_current_org_admin),
):
    """Dispute a claim via email token link."""
    claim, table_name = _find_claim_by_token(token)
    org = user["org"]

    if claim.get("organization_id") != org["id"]:
        raise HTTPException(status_code=403, detail="This claim is not for your organization")

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    supabase.table(table_name).update({
        "status": "disputed",
        "disputed_reason": dispute.reason,
    }).eq("id", claim["id"]).execute()

    notify_user(
        user_id=claim["user_id"],
        type="claim_disputed",
        title=f"Your claim was disputed by {org['name']}",
        message=f"Reason: {dispute.reason}. You can edit and resubmit.",
        claim_id=claim["id"],
        claim_table=table_name,
    )

    return {"detail": "Claim disputed", "status": "disputed"}
