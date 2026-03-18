from fastapi import APIRouter, HTTPException
from app.models.claims import CorrectAndVerifyAction, DisputeAction
from app.config import get_supabase
from app.services.notifications import notify_user
from app.services.audit import log_action
from datetime import datetime, timezone

router = APIRouter(prefix="/api/verify", tags=["verification"])


def _is_token_expired(claim: dict) -> bool:
    """Check if a verification token has expired."""
    expires_at = claim.get("token_expires_at")
    if not expires_at:
        return False  # No expiry set (legacy tokens) — allow
    if isinstance(expires_at, str):
        # Handle ISO format with timezone
        expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    return datetime.now(timezone.utc) > expires_at


def _find_claim_by_token(token: str) -> tuple[dict, str]:
    """Find a claim by verification token. Returns (claim, table_name).

    Also checks token expiry — expired tokens are rejected.
    """
    supabase = get_supabase()

    employment = (
        supabase.table("employment_claims")
        .select("*")
        .eq("verification_token", token)
        .execute()
    )
    if employment.data:
        claim = employment.data[0]
        if _is_token_expired(claim):
            raise HTTPException(status_code=410, detail="This verification link has expired. The candidate can request a new one from their dashboard.")
        return claim, "employment_claims"

    education = (
        supabase.table("education_claims")
        .select("*")
        .eq("verification_token", token)
        .execute()
    )
    if education.data:
        claim = education.data[0]
        if _is_token_expired(claim):
            raise HTTPException(status_code=410, detail="This verification link has expired. The candidate can request a new one from their dashboard.")
        return claim, "education_claims"

    raise HTTPException(status_code=404, detail="Verification link not found or expired")


def _get_org_for_claim(claim: dict, require_verified: bool = False) -> dict:
    """Look up the organization linked to a claim.

    If require_verified=True, also checks is_domain_verified.
    """
    if not claim.get("organization_id"):
        raise HTTPException(status_code=400, detail="This claim is not linked to an organization")
    supabase = get_supabase()
    result = supabase.table("organizations").select("*").eq("id", claim["organization_id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Organization not found")
    org = result.data[0]
    if require_verified and not org.get("is_domain_verified"):
        raise HTTPException(
            status_code=403,
            detail="This organization's domain has not been verified. Verification actions are disabled until domain verification is complete."
        )
    return org


@router.get("/{token}")
async def get_claim_for_verification(token: str):
    """Get claim details for review. No login required — token is the auth."""
    claim, table_name = _find_claim_by_token(token)
    org = _get_org_for_claim(claim)

    # Get claimer name
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
        "org_name": org["name"],
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
async def verify_claim_by_token(token: str):
    """Verify a claim. No login required — token is the auth."""
    claim, table_name = _find_claim_by_token(token)
    org = _get_org_for_claim(claim, require_verified=True)

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    supabase.table(table_name).update({
        "status": "verified",
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "verified_by_org": org["name"],
        "verification_token": None,
    }).eq("id", claim["id"]).execute()

    log_action(
        action="verified",
        resource_type="claim",
        resource_id=claim["id"],
        actor_type="system",
        metadata={"table": table_name, "org_name": org["name"], "via": "token"},
    )

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
):
    """Propose corrections. No login required — token is the auth."""
    claim, table_name = _find_claim_by_token(token)
    org = _get_org_for_claim(claim, require_verified=True)

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    claim_type = "employment" if table_name == "employment_claims" else "education"

    update_data = {
        "status": "correction_proposed",
        "corrected_by": org["verifier_email"],
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

    update_data["verification_token"] = None
    supabase.table(table_name).update(update_data).eq("id", claim["id"]).execute()

    log_action(
        action="correction_proposed",
        resource_type="claim",
        resource_id=claim["id"],
        actor_type="system",
        metadata={"table": table_name, "org_name": org["name"], "via": "token"},
    )

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
):
    """Dispute a claim. No login required — token is the auth.

    Tracks dispute_count. After 5 disputes, claim is permanently locked.
    """
    claim, table_name = _find_claim_by_token(token)
    org = _get_org_for_claim(claim, require_verified=True)

    if claim["status"] != "awaiting_verification":
        raise HTTPException(status_code=400, detail="This claim is not awaiting verification")

    supabase = get_supabase()
    new_dispute_count = (claim.get("dispute_count") or 0) + 1

    if new_dispute_count >= 5:
        supabase.table(table_name).update({
            "status": "permanently_locked",
            "disputed_reason": dispute.reason,
            "dispute_count": new_dispute_count,
            "verification_token": None,
        }).eq("id", claim["id"]).execute()

        log_action(
            action="claim_permanently_locked",
            resource_type="claim",
            resource_id=claim["id"],
            actor_type="system",
            metadata={"table": table_name, "org_name": org["name"], "dispute_count": new_dispute_count, "via": "token"},
        )

        notify_user(
            user_id=claim["user_id"],
            type="claim_locked",
            title="Your claim has been permanently locked",
            message=f"This claim has been disputed {new_dispute_count} times and can no longer be resubmitted.",
            claim_id=claim["id"],
            claim_table=table_name,
        )

        return {"detail": "Claim permanently locked after 5 disputes", "status": "permanently_locked"}

    supabase.table(table_name).update({
        "status": "disputed",
        "disputed_reason": dispute.reason,
        "dispute_count": new_dispute_count,
        "verification_token": None,
    }).eq("id", claim["id"]).execute()

    log_action(
        action="disputed",
        resource_type="claim",
        resource_id=claim["id"],
        actor_type="system",
        metadata={"table": table_name, "org_name": org["name"], "reason": dispute.reason, "dispute_count": new_dispute_count, "via": "token"},
    )

    notify_user(
        user_id=claim["user_id"],
        type="claim_disputed",
        title=f"Your claim was disputed by {org['name']}",
        message=f"Reason: {dispute.reason}. You can edit and resubmit ({5 - new_dispute_count} attempts remaining).",
        claim_id=claim["id"],
        claim_table=table_name,
    )

    return {"detail": "Claim disputed", "status": "disputed"}
