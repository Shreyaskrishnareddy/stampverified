import secrets
import html as html_lib
from datetime import datetime, timedelta, timezone
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


def _h(text: str) -> str:
    """HTML-escape a value for safe embedding in email HTML."""
    return html_lib.escape(str(text)) if text else ""


def _calc_duration(start_str: str, end_str: str | None, is_current: bool = False) -> str:
    """Calculate human-readable duration from date strings."""
    try:
        from datetime import date as date_type
        start = date_type.fromisoformat(str(start_str))
        end = date_type.today() if is_current else (date_type.fromisoformat(str(end_str)) if end_str else None)
        if not end:
            return ""
        months = (end.year - start.year) * 12 + (end.month - start.month)
        years = months // 12
        rem = months % 12
        if years > 0 and rem > 0:
            return f"{years}y {rem}m"
        if years > 0:
            return f"{years}y"
        return f"{max(months, 1)}m"
    except Exception:
        return ""

router = APIRouter(prefix="/api/claims", tags=["claims"])

TOKEN_TTL_DAYS = 30


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def token_expires_at() -> str:
    return (datetime.now(timezone.utc) + timedelta(days=TOKEN_TTL_DAYS)).isoformat()


MAX_PENDING_CLAIMS = 10


def _check_pending_claim_limit(user_id: str):
    """Prevent claim farming by limiting pending claims per user."""
    supabase = get_supabase()
    pending_statuses = ["awaiting_verification", "awaiting_org"]

    emp_count = (
        supabase.table("employment_claims")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .in_("status", pending_statuses)
        .execute()
    )
    edu_count = (
        supabase.table("education_claims")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .in_("status", pending_statuses)
        .execute()
    )
    total = (emp_count.count or 0) + (edu_count.count or 0)
    if total >= MAX_PENDING_CLAIMS:
        raise HTTPException(
            status_code=429,
            detail=f"You have {total} pending claims. Please wait for existing claims to be verified before submitting more (max {MAX_PENDING_CLAIMS})."
        )


def _normalize_domain(domain: str) -> str:
    """Normalize a domain by stripping common subdomains.

    e.g. mail.google.com → google.com, www.stanford.edu → stanford.edu
    """
    domain = domain.strip().lower()
    parts = domain.split(".")
    # If domain has 3+ parts (e.g. mail.google.com), try the root domain
    # Keep two-part TLDs like .co.uk, .co.in
    two_part_tlds = {"co.uk", "co.in", "co.jp", "com.au", "com.br", "ac.uk", "org.uk"}
    if len(parts) >= 3:
        potential_tld = ".".join(parts[-2:])
        if potential_tld in two_part_tlds and len(parts) >= 4:
            return ".".join(parts[-3:])
        elif potential_tld not in two_part_tlds:
            return ".".join(parts[-2:])
    return domain


def _lookup_org_by_domain(domain: str) -> dict | None:
    """Look up a registered organization by domain. Returns org dict or None.

    Tries exact match first, then normalized (subdomain-stripped) match.
    """
    if not domain:
        return None
    supabase = get_supabase()
    clean = domain.strip().lower()

    # Try exact match first
    result = (
        supabase.table("organizations")
        .select("*")
        .eq("domain", clean)
        .execute()
    )
    if result.data:
        return result.data[0]

    # Try normalized (root) domain
    normalized = _normalize_domain(clean)
    if normalized != clean:
        result = (
            supabase.table("organizations")
            .select("*")
            .eq("domain", normalized)
            .execute()
        )
        if result.data:
            return result.data[0]

    return None


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

    Limited to 10 pending claims per user.
    """
    supabase = get_supabase()
    _check_pending_claim_limit(user["id"])

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
        "token_expires_at": token_expires_at(),
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
        duration = _calc_duration(str(claim.start_date), str(claim.end_date) if claim.end_date else None, claim.is_current)

        claim_details = f"<strong>{_h(claim.title)}</strong> at <strong>{_h(claim.company_name)}</strong><br>{period}"
        if duration:
            claim_details += f" ({duration})"
        if claim.department:
            claim_details += f"<br>Department: {_h(claim.department)}"

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

    # If claim was in a reviewed state, reset verification
    # Also promote awaiting_org → awaiting_verification if org is now linked
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
        update_data["token_expires_at"] = token_expires_at()
    elif old_claim["status"] == "awaiting_org" and effective_org_id:
        # Promote: org is now registered, move to awaiting_verification
        update_data["status"] = "awaiting_verification"
        new_token = generate_token()
        update_data["verification_token"] = new_token
        update_data["token_expires_at"] = token_expires_at()

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

            claim_details = f"<strong>{_h(title)}</strong> at <strong>{_h(company)}</strong> (updated claim — please re-verify)"

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


@router.get("/employment/{claim_id}/correction-diff")
async def get_employment_correction_diff(claim_id: str, user: dict = Depends(get_current_user)):
    """Get the proposed correction diff for review before accepting."""
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
        raise HTTPException(status_code=400, detail="No pending correction to review")

    changes = []
    if claim.get("corrected_title") and claim["corrected_title"] != claim["title"]:
        changes.append({"field": "Title", "current": claim["title"], "proposed": claim["corrected_title"]})
    if claim.get("corrected_start_date") and claim["corrected_start_date"] != claim["start_date"]:
        changes.append({"field": "Start Date", "current": claim["start_date"], "proposed": claim["corrected_start_date"]})
    if claim.get("corrected_end_date") and claim.get("corrected_end_date") != claim.get("end_date"):
        changes.append({"field": "End Date", "current": claim.get("end_date"), "proposed": claim["corrected_end_date"]})

    return {
        "claim_id": claim_id,
        "correction_reason": claim.get("correction_reason"),
        "corrected_by": claim.get("corrected_by"),
        "changes": changes,
    }


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

    update_data = {
        "status": "verified",
        "verified_at": datetime.now(timezone.utc).isoformat(),
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
        "token_expires_at": token_expires_at(),
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

            claim_details = f"<strong>{_h(claim['title'])}</strong> at <strong>{_h(claim['company_name'])}</strong> (resubmitted after correction denial)"
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
        "token_expires_at": token_expires_at(),
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

        claim_details = f"<strong>{_h(claim['title'])}</strong> at <strong>{_h(claim['company_name'])}</strong><br>{period}"
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
    """Create an education claim. Same org-matching logic as employment.

    Limited to 10 pending claims per user.
    """
    supabase = get_supabase()
    _check_pending_claim_limit(user["id"])

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
        "token_expires_at": token_expires_at(),
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

        claim_details = f"<strong>{_h(claim.degree)}</strong> from <strong>{_h(claim.institution)}</strong>"
        if claim.field_of_study:
            claim_details += f"<br>Field: {_h(claim.field_of_study)}"
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
    # Serialize date fields to ISO format (same as employment claims)
    for date_field in ("start_date", "end_date"):
        if date_field in update_data and update_data[date_field]:
            update_data[date_field] = update_data[date_field].isoformat()

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
        update_data["token_expires_at"] = token_expires_at()
    elif old_claim["status"] == "awaiting_org" and effective_org_id:
        # Promote: org is now registered, move to awaiting_verification
        update_data["status"] = "awaiting_verification"
        new_token = generate_token()
        update_data["verification_token"] = new_token
        update_data["token_expires_at"] = token_expires_at()

    result = (
        supabase.table("education_claims")
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

            degree = update_data.get("degree", old_claim["degree"])
            institution = update_data.get("institution", old_claim["institution"])

            claim_details = f"<strong>{_h(degree)}</strong> from <strong>{_h(institution)}</strong> (updated claim — please re-verify)"

            _send_claim_verification_email(org.data[0], claimer_name, "education", claim_details, new_token)

            notify_org_admin(
                org_admin_email=org.data[0]["admin_email"],
                type="claim_resubmitted",
                title=f"{claimer_name} updated their education claim",
                message=f"Previously {old_claim['status']}. Please re-verify.",
                claim_id=claim_id,
                claim_table="education_claims",
            )

    return updated_claim


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


@router.get("/education/{claim_id}/correction-diff")
async def get_education_correction_diff(claim_id: str, user: dict = Depends(get_current_user)):
    """Get the proposed correction diff for review before accepting."""
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
        raise HTTPException(status_code=400, detail="No pending correction to review")

    changes = []
    if claim.get("corrected_degree") and claim["corrected_degree"] != claim["degree"]:
        changes.append({"field": "Degree", "current": claim["degree"], "proposed": claim["corrected_degree"]})
    if claim.get("corrected_field") and claim["corrected_field"] != claim.get("field_of_study"):
        changes.append({"field": "Field of Study", "current": claim.get("field_of_study"), "proposed": claim["corrected_field"]})
    if claim.get("corrected_start_date") and claim["corrected_start_date"] != claim.get("start_date"):
        changes.append({"field": "Start Date", "current": claim.get("start_date"), "proposed": claim["corrected_start_date"]})
    if claim.get("corrected_end_date") and claim.get("corrected_end_date") != claim.get("end_date"):
        changes.append({"field": "End Date", "current": claim.get("end_date"), "proposed": claim["corrected_end_date"]})

    return {
        "claim_id": claim_id,
        "correction_reason": claim.get("correction_reason"),
        "corrected_by": claim.get("corrected_by"),
        "changes": changes,
    }


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

    update_data = {
        "status": "verified",
        "verified_at": datetime.now(timezone.utc).isoformat(),
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
        "token_expires_at": token_expires_at(),
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

    # Notify org admin and re-send verification email
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
                claim_table="education_claims",
            )

            claim_details = f"<strong>{_h(claim['degree'])}</strong> from <strong>{_h(claim['institution'])}</strong> (resubmitted after correction denial)"
            _send_claim_verification_email(org.data[0], claimer_name, "education", claim_details, new_token)

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
        "token_expires_at": token_expires_at(),
        "expired_at": None,
    }).eq("id", claim_id).execute()

    org = supabase.table("organizations").select("*").eq("id", claim["organization_id"]).execute()
    if org.data:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        claim_details = f"<strong>{_h(claim['degree'])}</strong> from <strong>{_h(claim['institution'])}</strong>"
        _send_claim_verification_email(org.data[0], claimer_name, "education", claim_details, new_token)

    return {"detail": "Verification request resent"}
