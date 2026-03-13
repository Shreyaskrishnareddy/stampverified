import secrets
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.models.claims import (
    EmploymentClaimCreate,
    EmploymentClaimUpdate,
    EmploymentClaimResponse,
    EducationClaimCreate,
    EducationClaimUpdate,
    EducationClaimResponse,
    CorrectionResponse,
)
from app.config import get_supabase, get_settings
from app.services.email import send_verification_email
from app.services.notifications import notify_user, notify_org_admin

router = APIRouter(prefix="/api/claims", tags=["claims"])


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def _lookup_org_by_domain(domain: str) -> dict | None:
    """Look up a registered organization by domain. Returns org dict or None."""
    if not domain:
        return None
    supabase = get_supabase()
    result = (
        supabase.table("organizations")
        .select("*")
        .eq("domain", domain.strip().lower())
        .execute()
    )
    return result.data[0] if result.data else None


def _send_claim_verification_email(org: dict, claimer_name: str, claim_type: str, claim_details: str, token: str):
    """Send verification request email to the org's designated verifier."""
    settings = get_settings()
    verification_url = f"{settings.frontend_url}/verify/{token}"

    try:
        send_verification_email(
            to_email=org["verifier_email"],
            claimer_name=claimer_name,
            claim_type=claim_type,
            claim_details=claim_details,
            verification_url=verification_url,
        )
    except Exception as e:
        print(f"[EMAIL] Failed to send verification email: {e}")
        # Don't fail the claim if email fails


# =============================================================================
# Employment Claims
# =============================================================================


@router.get("/employment", response_model=list[EmploymentClaimResponse])
async def list_employment_claims(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("employment_claims")
        .select("*")
        .eq("user_id", user["id"])
        .order("start_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/employment", response_model=EmploymentClaimResponse)
async def create_employment_claim(
    claim: EmploymentClaimCreate,
    user: dict = Depends(get_current_user),
):
    """Create an employment claim.

    System automatically checks if the company is registered on Stamp:
    - If registered: status = 'awaiting_verification', email sent to org verifier
    - If not registered: status = 'awaiting_org', user gets invite link
    """
    supabase = get_supabase()

    # Look up organization by domain
    domain = claim.company_domain.strip().lower() if claim.company_domain else None
    org = _lookup_org_by_domain(domain)

    token = generate_token()

    data = {
        "user_id": user["id"],
        "company_name": claim.company_name,
        "company_domain": domain,
        "title": claim.title,
        "department": claim.department,
        "employment_type": claim.employment_type,
        "start_date": claim.start_date.isoformat(),
        "end_date": claim.end_date.isoformat() if claim.end_date else None,
        "is_current": claim.is_current,
        "verification_token": token,
    }

    if org:
        data["organization_id"] = org["id"]
        data["status"] = "awaiting_verification"
    else:
        data["status"] = "awaiting_org"

    result = supabase.table("employment_claims").insert(data).execute()
    new_claim = result.data[0]

    # If org is registered, send verification email
    if org:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        period = f"{claim.start_date}"
        if claim.end_date:
            period += f" to {claim.end_date}"
        elif claim.is_current:
            period += " to Present"

        claim_details = f"<strong>{claim.title}</strong> at <strong>{claim.company_name}</strong><br>{period}"
        if claim.department:
            claim_details += f"<br>Department: {claim.department}"

        _send_claim_verification_email(org, claimer_name, "employment", claim_details, token)

        # Notify org admin
        notify_org_admin(
            org_admin_email=org["admin_email"],
            type="new_verification_request",
            title=f"New verification request from {claimer_name}",
            message=f"{claimer_name} claims {claim.title} at {claim.company_name}",
            claim_id=new_claim["id"],
            claim_table="employment_claims",
        )

    return new_claim


@router.put("/employment/{claim_id}", response_model=EmploymentClaimResponse)
async def update_employment_claim(
    claim_id: str,
    claim: EmploymentClaimUpdate,
    user: dict = Depends(get_current_user),
):
    """Update an employment claim.

    If the claim was previously verified, editing resets it to
    awaiting_verification and re-sends the verification request.
    """
    supabase = get_supabase()

    existing = (
        supabase.table("employment_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    old_claim = existing.data[0]
    was_verified = old_claim["status"] == "verified"

    # Block resubmission if permanently locked
    if old_claim["status"] == "permanently_locked":
        raise HTTPException(status_code=400, detail="This claim has been permanently locked after 5 disputes and cannot be resubmitted")

    # Block resubmission if dispute limit reached
    if old_claim["status"] == "disputed" and (old_claim.get("dispute_count") or 0) >= 5:
        raise HTTPException(status_code=400, detail="This claim has been permanently locked after 5 disputes and cannot be resubmitted")

    update_data = {}
    for k, v in claim.model_dump().items():
        if v is not None:
            if k in ("start_date", "end_date") and v:
                update_data[k] = v.isoformat()
            elif k == "company_domain" and v:
                update_data[k] = v.strip().lower()
            else:
                update_data[k] = v

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Re-link org if domain changed
    new_domain = update_data.get("company_domain")
    if new_domain and new_domain != (old_claim.get("company_domain") or ""):
        new_org = _lookup_org_by_domain(new_domain)
        if new_org:
            update_data["organization_id"] = new_org["id"]
        else:
            update_data["organization_id"] = None

    # Determine effective org_id after potential re-link
    effective_org_id = update_data.get("organization_id", old_claim.get("organization_id"))

    # If claim was verified or had corrections, reset verification
    if old_claim["status"] in ("verified", "correction_proposed", "disputed"):
        update_data["status"] = "awaiting_verification" if effective_org_id else "awaiting_org"
        update_data["verified_at"] = None
        update_data["verified_by_org"] = None
        update_data["corrected_title"] = None
        update_data["corrected_start_date"] = None
        update_data["corrected_end_date"] = None
        update_data["corrected_by"] = None
        update_data["correction_reason"] = None
        update_data["user_denial_reason"] = None
        # Preserve dispute reason for org context on resubmit
        if old_claim["status"] == "disputed":
            update_data["previous_dispute_reason"] = old_claim.get("disputed_reason")
        update_data["disputed_reason"] = None
        # Generate new verification token
        new_token = generate_token()
        update_data["verification_token"] = new_token

    result = (
        supabase.table("employment_claims")
        .update(update_data)
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )

    updated_claim = result.data[0]

    # If was verified/disputed and org exists, re-send verification email
    if old_claim["status"] in ("verified", "correction_proposed", "disputed") and effective_org_id:
        org = supabase.table("organizations").select("*").eq("id", effective_org_id).execute()
        if org.data:
            profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
            claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

            title = update_data.get("title", old_claim["title"])
            company = update_data.get("company_name", old_claim["company_name"])

            claim_details = f"<strong>{title}</strong> at <strong>{company}</strong> (updated claim — please re-verify)"

            _send_claim_verification_email(org.data[0], claimer_name, "employment", claim_details, new_token)

            notify_org_admin(
                org_admin_email=org.data[0]["admin_email"],
                type="claim_resubmitted",
                title=f"{claimer_name} updated their claim",
                message=f"Previously {'verified' if was_verified else old_claim['status']}. Please re-verify.",
                claim_id=claim_id,
                claim_table="employment_claims",
            )

    return updated_claim


@router.delete("/employment/{claim_id}")
async def delete_employment_claim(claim_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = (
        supabase.table("employment_claims")
        .select("id")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    supabase.table("employment_claims").delete().eq("id", claim_id).execute()
    return {"detail": "Claim deleted"}


@router.post("/employment/{claim_id}/accept-correction", response_model=EmploymentClaimResponse)
async def accept_employment_correction(claim_id: str, user: dict = Depends(get_current_user)):
    """User accepts the org's proposed corrections. Claim becomes verified with corrected values."""
    supabase = get_supabase()

    existing = (
        supabase.table("employment_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "correction_proposed":
        raise HTTPException(status_code=400, detail="No pending correction to accept")

    from datetime import datetime
    update_data = {
        "status": "verified",
        "verified_at": datetime.utcnow().isoformat(),
    }

    # Apply corrections to the main fields
    if claim.get("corrected_title"):
        update_data["title"] = claim["corrected_title"]
    if claim.get("corrected_start_date"):
        update_data["start_date"] = claim["corrected_start_date"]
    if claim.get("corrected_end_date"):
        update_data["end_date"] = claim["corrected_end_date"]

    result = (
        supabase.table("employment_claims")
        .update(update_data)
        .eq("id", claim_id)
        .execute()
    )

    # Notify org admin that user accepted
    if claim.get("organization_id"):
        org = supabase.table("organizations").select("admin_email,name").eq("id", claim["organization_id"]).execute()
        if org.data:
            notify_org_admin(
                org_admin_email=org.data[0]["admin_email"],
                type="correction_accepted",
                title="Correction accepted",
                message=f"The user accepted your corrections for their claim at {org.data[0]['name']}.",
                claim_id=claim_id,
                claim_table="employment_claims",
            )

    return result.data[0]


@router.post("/employment/{claim_id}/deny-correction", response_model=EmploymentClaimResponse)
async def deny_employment_correction(
    claim_id: str,
    response: CorrectionResponse,
    user: dict = Depends(get_current_user),
):
    """User denies the org's proposed corrections and resubmits with reason."""
    supabase = get_supabase()

    existing = (
        supabase.table("employment_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "correction_proposed":
        raise HTTPException(status_code=400, detail="No pending correction to deny")

    if not response.denial_reason:
        raise HTTPException(status_code=400, detail="Reason is required when denying a correction")

    # Reset to awaiting_verification with new token
    new_token = generate_token()
    update_data = {
        "status": "awaiting_verification",
        "user_denial_reason": response.denial_reason,
        "verification_token": new_token,
        # Clear correction fields
        "corrected_title": None,
        "corrected_start_date": None,
        "corrected_end_date": None,
        "corrected_by": None,
        "correction_reason": None,
    }

    result = (
        supabase.table("employment_claims")
        .update(update_data)
        .eq("id", claim_id)
        .execute()
    )

    # Notify org admin and re-send verification
    if claim.get("organization_id"):
        org = supabase.table("organizations").select("*").eq("id", claim["organization_id"]).execute()
        if org.data:
            profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
            claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

            notify_org_admin(
                org_admin_email=org.data[0]["admin_email"],
                type="correction_denied",
                title=f"{claimer_name} denied your correction",
                message=f"Reason: {response.denial_reason}",
                claim_id=claim_id,
                claim_table="employment_claims",
            )

            claim_details = f"<strong>{claim['title']}</strong> at <strong>{claim['company_name']}</strong> (resubmitted after correction denial)"
            _send_claim_verification_email(org.data[0], claimer_name, "employment", claim_details, new_token)

    return result.data[0]


@router.post("/employment/{claim_id}/resend")
async def resend_employment_verification(claim_id: str, user: dict = Depends(get_current_user)):
    """Resend verification request for an expired claim."""
    supabase = get_supabase()

    existing = (
        supabase.table("employment_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "expired":
        raise HTTPException(status_code=400, detail="Can only resend for expired claims")

    if not claim.get("organization_id"):
        raise HTTPException(status_code=400, detail="Organization is not registered on Stamp")

    new_token = generate_token()
    supabase.table("employment_claims").update({
        "status": "awaiting_verification",
        "verification_token": new_token,
        "expired_at": None,
    }).eq("id", claim_id).execute()

    org = supabase.table("organizations").select("*").eq("id", claim["organization_id"]).execute()
    if org.data:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        period = f"{claim['start_date']}"
        if claim.get("end_date"):
            period += f" to {claim['end_date']}"
        elif claim.get("is_current"):
            period += " to Present"

        claim_details = f"<strong>{claim['title']}</strong> at <strong>{claim['company_name']}</strong><br>{period}"
        _send_claim_verification_email(org.data[0], claimer_name, "employment", claim_details, new_token)

    return {"detail": "Verification request resent"}


# =============================================================================
# Education Claims
# =============================================================================


@router.get("/education", response_model=list[EducationClaimResponse])
async def list_education_claims(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("education_claims")
        .select("*")
        .eq("user_id", user["id"])
        .order("end_date", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/education", response_model=EducationClaimResponse)
async def create_education_claim(
    claim: EducationClaimCreate,
    user: dict = Depends(get_current_user),
):
    """Create an education claim. Same org-matching logic as employment."""
    supabase = get_supabase()

    domain = claim.institution_domain.strip().lower() if claim.institution_domain else None
    org = _lookup_org_by_domain(domain)

    token = generate_token()

    data = {
        "user_id": user["id"],
        "institution": claim.institution,
        "institution_domain": domain,
        "degree": claim.degree,
        "field_of_study": claim.field_of_study,
        "start_date": str(claim.start_date) if claim.start_date else None,
        "end_date": str(claim.end_date) if claim.end_date else None,
        "verification_token": token,
    }

    if org:
        data["organization_id"] = org["id"]
        data["status"] = "awaiting_verification"
    else:
        data["status"] = "awaiting_org"

    result = supabase.table("education_claims").insert(data).execute()
    new_claim = result.data[0]

    if org:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        claim_details = f"<strong>{claim.degree}</strong> from <strong>{claim.institution}</strong>"
        if claim.field_of_study:
            claim_details += f"<br>Field: {claim.field_of_study}"
        if claim.end_date:
            claim_details += f"<br>Ended: {claim.end_date}"

        _send_claim_verification_email(org, claimer_name, "education", claim_details, token)

        notify_org_admin(
            org_admin_email=org["admin_email"],
            type="new_verification_request",
            title=f"New verification request from {claimer_name}",
            message=f"{claimer_name} claims {claim.degree} from {claim.institution}",
            claim_id=new_claim["id"],
            claim_table="education_claims",
        )

    return new_claim


@router.put("/education/{claim_id}", response_model=EducationClaimResponse)
async def update_education_claim(
    claim_id: str,
    claim: EducationClaimUpdate,
    user: dict = Depends(get_current_user),
):
    """Update an education claim. Resets verification if previously verified."""
    supabase = get_supabase()

    existing = (
        supabase.table("education_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    old_claim = existing.data[0]

    # Block resubmission if permanently locked
    if old_claim["status"] == "permanently_locked":
        raise HTTPException(status_code=400, detail="This claim has been permanently locked after 5 disputes and cannot be resubmitted")

    # Block resubmission if dispute limit reached
    if old_claim["status"] == "disputed" and (old_claim.get("dispute_count") or 0) >= 5:
        raise HTTPException(status_code=400, detail="This claim has been permanently locked after 5 disputes and cannot be resubmitted")

    update_data = {k: v for k, v in claim.model_dump().items() if v is not None}
    if "institution_domain" in update_data:
        update_data["institution_domain"] = update_data["institution_domain"].strip().lower()

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Re-link org if domain changed
    new_domain = update_data.get("institution_domain")
    if new_domain and new_domain != (old_claim.get("institution_domain") or ""):
        new_org = _lookup_org_by_domain(new_domain)
        if new_org:
            update_data["organization_id"] = new_org["id"]
        else:
            update_data["organization_id"] = None

    # Determine effective org_id after potential re-link
    effective_org_id = update_data.get("organization_id", old_claim.get("organization_id"))

    # Reset verification if claim was in a reviewed state
    if old_claim["status"] in ("verified", "correction_proposed", "disputed"):
        update_data["status"] = "awaiting_verification" if effective_org_id else "awaiting_org"
        update_data["verified_at"] = None
        update_data["verified_by_org"] = None
        update_data["corrected_degree"] = None
        update_data["corrected_field"] = None
        update_data["corrected_start_date"] = None
        update_data["corrected_end_date"] = None
        update_data["corrected_by"] = None
        update_data["correction_reason"] = None
        update_data["user_denial_reason"] = None
        if old_claim["status"] == "disputed":
            update_data["previous_dispute_reason"] = old_claim.get("disputed_reason")
        update_data["disputed_reason"] = None
        new_token = generate_token()
        update_data["verification_token"] = new_token

    result = (
        supabase.table("education_claims")
        .update(update_data)
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    return result.data[0]


@router.delete("/education/{claim_id}")
async def delete_education_claim(claim_id: str, user: dict = Depends(get_current_user)):
    supabase = get_supabase()

    existing = (
        supabase.table("education_claims")
        .select("id")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    supabase.table("education_claims").delete().eq("id", claim_id).execute()
    return {"detail": "Claim deleted"}


@router.post("/education/{claim_id}/accept-correction", response_model=EducationClaimResponse)
async def accept_education_correction(claim_id: str, user: dict = Depends(get_current_user)):
    """User accepts org's corrections to education claim."""
    supabase = get_supabase()

    existing = (
        supabase.table("education_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "correction_proposed":
        raise HTTPException(status_code=400, detail="No pending correction to accept")

    from datetime import datetime
    update_data = {
        "status": "verified",
        "verified_at": datetime.utcnow().isoformat(),
    }

    if claim.get("corrected_degree"):
        update_data["degree"] = claim["corrected_degree"]
    if claim.get("corrected_field"):
        update_data["field_of_study"] = claim["corrected_field"]
    if claim.get("corrected_start_date"):
        update_data["start_date"] = claim["corrected_start_date"]
    if claim.get("corrected_end_date"):
        update_data["end_date"] = claim["corrected_end_date"]

    result = (
        supabase.table("education_claims")
        .update(update_data)
        .eq("id", claim_id)
        .execute()
    )
    return result.data[0]


@router.post("/education/{claim_id}/deny-correction", response_model=EducationClaimResponse)
async def deny_education_correction(
    claim_id: str,
    response: CorrectionResponse,
    user: dict = Depends(get_current_user),
):
    """User denies org's correction and resubmits."""
    supabase = get_supabase()

    existing = (
        supabase.table("education_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "correction_proposed":
        raise HTTPException(status_code=400, detail="No pending correction to deny")

    if not response.denial_reason:
        raise HTTPException(status_code=400, detail="Reason is required when denying a correction")

    new_token = generate_token()
    update_data = {
        "status": "awaiting_verification",
        "user_denial_reason": response.denial_reason,
        "verification_token": new_token,
        "corrected_degree": None,
        "corrected_field": None,
        "corrected_start_date": None,
        "corrected_end_date": None,
        "corrected_by": None,
        "correction_reason": None,
    }

    result = (
        supabase.table("education_claims")
        .update(update_data)
        .eq("id", claim_id)
        .execute()
    )
    return result.data[0]


@router.post("/education/{claim_id}/resend")
async def resend_education_verification(claim_id: str, user: dict = Depends(get_current_user)):
    """Resend verification for an expired education claim."""
    supabase = get_supabase()

    existing = (
        supabase.table("education_claims")
        .select("*")
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Claim not found")

    claim = existing.data[0]
    if claim["status"] != "expired":
        raise HTTPException(status_code=400, detail="Can only resend for expired claims")

    if not claim.get("organization_id"):
        raise HTTPException(status_code=400, detail="Organization is not registered on Stamp")

    new_token = generate_token()
    supabase.table("education_claims").update({
        "status": "awaiting_verification",
        "verification_token": new_token,
        "expired_at": None,
    }).eq("id", claim_id).execute()

    org = supabase.table("organizations").select("*").eq("id", claim["organization_id"]).execute()
    if org.data:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        claim_details = f"<strong>{claim['degree']}</strong> from <strong>{claim['institution']}</strong>"
        _send_claim_verification_email(org.data[0], claimer_name, "education", claim_details, new_token)

    return {"detail": "Verification request resent"}
