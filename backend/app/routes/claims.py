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
)
from app.config import get_supabase, get_settings
from app.services.email import send_verification_email
from app.services.trust_score import calculate_trust_score

router = APIRouter(prefix="/api/claims", tags=["claims"])


def generate_token() -> str:
    return secrets.token_urlsafe(32)


# --- Employment Claims ---


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
async def create_employment_claim(claim: EmploymentClaimCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    settings = get_settings()

    token = generate_token()

    data = {
        "user_id": user["id"],
        "company_name": claim.company_name,
        "title": claim.title,
        "department": claim.department,
        "employment_type": claim.employment_type,
        "start_date": claim.start_date.isoformat(),
        "end_date": claim.end_date.isoformat() if claim.end_date else None,
        "is_current": claim.is_current,
        "verifier_email": claim.verifier_email,
        "verification_token": token,
        "status": "pending",
    }

    result = supabase.table("employment_claims").insert(data).execute()

    if claim.verifier_email:
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

        verification_url = f"{settings.frontend_url}/verify/{token}"

        try:
            send_verification_email(
                to_email=claim.verifier_email,
                claimer_name=claimer_name,
                claim_type="employment",
                claim_details=claim_details,
                verification_url=verification_url,
            )
        except Exception:
            pass  # don't fail the claim if email fails

    calculate_trust_score(user["id"])
    return result.data[0]


@router.put("/employment/{claim_id}", response_model=EmploymentClaimResponse)
async def update_employment_claim(
    claim_id: str, claim: EmploymentClaimUpdate, user: dict = Depends(get_current_user)
):
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
    if existing.data[0]["status"] == "verified":
        raise HTTPException(status_code=400, detail="Cannot edit a verified claim")

    update_data = {}
    for k, v in claim.model_dump().items():
        if v is not None:
            if k in ("start_date", "end_date") and v:
                update_data[k] = v.isoformat()
            else:
                update_data[k] = v

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("employment_claims")
        .update(update_data)
        .eq("id", claim_id)
        .eq("user_id", user["id"])
        .execute()
    )
    return result.data[0]


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
    calculate_trust_score(user["id"])
    return {"detail": "Claim deleted"}


# --- Education Claims ---


@router.get("/education", response_model=list[EducationClaimResponse])
async def list_education_claims(user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    result = (
        supabase.table("education_claims")
        .select("*")
        .eq("user_id", user["id"])
        .order("year_completed", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/education", response_model=EducationClaimResponse)
async def create_education_claim(claim: EducationClaimCreate, user: dict = Depends(get_current_user)):
    supabase = get_supabase()
    settings = get_settings()

    token = generate_token()

    data = {
        "user_id": user["id"],
        "institution": claim.institution,
        "degree": claim.degree,
        "field_of_study": claim.field_of_study,
        "year_started": claim.year_started,
        "year_completed": claim.year_completed,
        "verifier_email": claim.verifier_email,
        "verification_token": token,
        "status": "pending",
    }

    result = supabase.table("education_claims").insert(data).execute()

    if claim.verifier_email:
        profile = supabase.table("profiles").select("full_name").eq("id", user["id"]).execute()
        claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

        claim_details = f"<strong>{claim.degree}</strong> from <strong>{claim.institution}</strong>"
        if claim.field_of_study:
            claim_details += f"<br>Field: {claim.field_of_study}"
        if claim.year_completed:
            claim_details += f"<br>Year: {claim.year_completed}"

        verification_url = f"{settings.frontend_url}/verify/{token}"

        try:
            send_verification_email(
                to_email=claim.verifier_email,
                claimer_name=claimer_name,
                claim_type="education",
                claim_details=claim_details,
                verification_url=verification_url,
            )
        except Exception:
            pass

    calculate_trust_score(user["id"])
    return result.data[0]


@router.put("/education/{claim_id}", response_model=EducationClaimResponse)
async def update_education_claim(
    claim_id: str, claim: EducationClaimUpdate, user: dict = Depends(get_current_user)
):
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
    if existing.data[0]["status"] == "verified":
        raise HTTPException(status_code=400, detail="Cannot edit a verified claim")

    update_data = {k: v for k, v in claim.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

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
    calculate_trust_score(user["id"])
    return {"detail": "Claim deleted"}
