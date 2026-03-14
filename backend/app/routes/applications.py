"""Application flow routes.

Three sections:
  1. Candidate preferences & resume (/api/candidate/*)
  2. Candidate applications (/api/applications/*)
  3. Employer application review (/api/employer/applications/*)

Also handles saved jobs bookmarking.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.middleware.auth import (
    get_current_user,
    get_current_company_member,
    require_permission,
)
from app.models.application import (
    ApplicationCreate,
    ApplicationStatusUpdate,
    CandidatePreferencesUpdate,
)
from app.config import get_supabase
from app.services.notifications import notify_user, notify_org_admin

router = APIRouter(tags=["applications"])


# =============================================================================
# Candidate Preferences & Resume
# =============================================================================


@router.get("/api/candidate/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    """Get the current candidate's preferences."""
    supabase = get_supabase()
    result = (
        supabase.table("candidate_preferences")
        .select("*")
        .eq("user_id", user["id"])
        .execute()
    )

    if result.data:
        return result.data[0]

    # Create default preferences if none exist
    default = {
        "user_id": user["id"],
        "open_to_work": False,
        "resume_visible": True,
        "preferred_functions": [],
    }
    supabase.table("candidate_preferences").insert(default).execute()
    return default


@router.put("/api/candidate/preferences")
async def update_preferences(
    updates: CandidatePreferencesUpdate,
    user: dict = Depends(get_current_user),
):
    """Update candidate preferences (open_to_work, resume_visible, preferred_functions)."""
    supabase = get_supabase()

    # Ensure preferences row exists
    existing = (
        supabase.table("candidate_preferences")
        .select("user_id")
        .eq("user_id", user["id"])
        .execute()
    )
    if not existing.data:
        supabase.table("candidate_preferences").insert({
            "user_id": user["id"],
        }).execute()

    update_data: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if updates.open_to_work is not None:
        update_data["open_to_work"] = updates.open_to_work
    if updates.resume_visible is not None:
        update_data["resume_visible"] = updates.resume_visible
    if updates.preferred_functions is not None:
        update_data["preferred_functions"] = updates.preferred_functions

    result = (
        supabase.table("candidate_preferences")
        .update(update_data)
        .eq("user_id", user["id"])
        .execute()
    )

    return result.data[0] if result.data else update_data


@router.post("/api/candidate/resume")
async def upload_resume(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload a resume to private storage.

    Accepts PDF files only. Max 5MB. Stored in the private 'resumes' bucket
    under the user's ID. Returns the storage path (not a public URL).
    """
    supabase = get_supabase()

    # Validate file type
    if not file.content_type or file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    # Read file content
    content = await file.read()

    # Validate size (5MB max)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Resume must be under 5MB")

    # Upload to private bucket: resumes/{user_id}/resume.pdf
    storage_path = f"{user['id']}/resume.pdf"

    try:
        # Remove existing resume first
        try:
            supabase.storage.from_("resumes").remove([storage_path])
        except Exception:
            pass  # No existing file

        supabase.storage.from_("resumes").upload(
            storage_path,
            content,
            {"content-type": "application/pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    # Update preferences with resume path
    existing = (
        supabase.table("candidate_preferences")
        .select("user_id")
        .eq("user_id", user["id"])
        .execute()
    )

    if existing.data:
        supabase.table("candidate_preferences").update({
            "resume_url": storage_path,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("user_id", user["id"]).execute()
    else:
        supabase.table("candidate_preferences").insert({
            "user_id": user["id"],
            "resume_url": storage_path,
        }).execute()

    return {"resume_url": storage_path, "detail": "Resume uploaded"}


@router.delete("/api/candidate/resume")
async def delete_resume(user: dict = Depends(get_current_user)):
    """Delete the candidate's resume."""
    supabase = get_supabase()
    storage_path = f"{user['id']}/resume.pdf"

    try:
        supabase.storage.from_("resumes").remove([storage_path])
    except Exception:
        pass

    supabase.table("candidate_preferences").update({
        "resume_url": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", user["id"]).execute()

    return {"detail": "Resume deleted"}


# =============================================================================
# Candidate Applications
# =============================================================================


@router.post("/api/applications")
async def apply_to_job(
    application: ApplicationCreate,
    user: dict = Depends(get_current_user),
):
    """Apply to a job.

    Requirements:
      1. Candidate must have a profile
      2. Candidate must have at least 1 verified claim
      3. Candidate must have a resume uploaded
      4. Job must be active
      5. Cannot apply to the same job twice
    """
    supabase = get_supabase()

    # Check profile exists
    profile = (
        supabase.table("profiles")
        .select("id,full_name,username")
        .eq("id", user["id"])
        .execute()
    )
    if not profile.data:
        raise HTTPException(status_code=400, detail="Create your profile first")

    # Check at least 1 verified claim
    emp_verified = (
        supabase.table("employment_claims")
        .select("id", count="exact")
        .eq("user_id", user["id"])
        .eq("status", "verified")
        .execute()
    )
    edu_verified = (
        supabase.table("education_claims")
        .select("id", count="exact")
        .eq("user_id", user["id"])
        .eq("status", "verified")
        .execute()
    )
    total_verified = (emp_verified.count or 0) + (edu_verified.count or 0)
    if total_verified == 0:
        raise HTTPException(
            status_code=400,
            detail="You need at least 1 confirmed claim to apply. Add and verify a claim first."
        )

    # Check resume exists
    prefs = (
        supabase.table("candidate_preferences")
        .select("resume_url")
        .eq("user_id", user["id"])
        .execute()
    )
    resume_url = prefs.data[0].get("resume_url") if prefs.data else None
    if not resume_url:
        raise HTTPException(
            status_code=400,
            detail="Upload your resume before applying"
        )

    # Check job exists and is active
    job = (
        supabase.table("jobs")
        .select("id,title,organization_id,status, organizations(name,domain)")
        .eq("id", application.job_id)
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    job_data = job.data[0]
    if job_data["status"] != "active":
        raise HTTPException(status_code=400, detail="This job is no longer accepting applications")

    # Check duplicate application
    existing = (
        supabase.table("applications")
        .select("id")
        .eq("job_id", application.job_id)
        .eq("candidate_id", user["id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="You have already applied to this job")

    # Create resume snapshot (signed URL at apply time)
    resume_snapshot_url = resume_url  # Store the path; signed URL generated on read

    # Create application
    now = datetime.now(timezone.utc).isoformat()
    app_data = {
        "job_id": application.job_id,
        "candidate_id": user["id"],
        "resume_snapshot_url": resume_snapshot_url,
        "cover_note": application.cover_note,
        "status": "applied",
        "applied_at": now,
    }

    result = supabase.table("applications").insert(app_data).execute()

    # Notify the job's org admin
    org_data = job_data.get("organizations") or {}
    org_name = org_data.get("name", "")

    # Find company members who should be notified (poster + POC)
    members = (
        supabase.table("company_members")
        .select("email")
        .eq("organization_id", job_data["organization_id"])
        .eq("status", "active")
        .in_("role", ["admin"])
        .execute()
    )
    candidate_name = profile.data[0].get("full_name", "Someone")
    for member in (members.data or []):
        notify_org_admin(
            org_admin_email=member["email"],
            type="new_application",
            title=f"New application for {job_data['title']}",
            message=f"{candidate_name} applied with a confirmed Stamp profile.",
        )

    return {
        "detail": "Application submitted",
        "application": result.data[0],
        "job_title": job_data["title"],
        "org_name": org_name,
    }


@router.get("/api/applications")
async def get_my_applications(user: dict = Depends(get_current_user)):
    """Get the current candidate's applications with job details."""
    supabase = get_supabase()

    result = (
        supabase.table("applications")
        .select("*, jobs(title,status,location,location_type,salary_min,salary_max,salary_currency, organizations(name,domain,logo_url))")
        .eq("candidate_id", user["id"])
        .order("applied_at", desc=True)
        .execute()
    )

    applications = []
    for app in (result.data or []):
        job_data = app.pop("jobs", None) or {}
        org_data = job_data.pop("organizations", None) or {}
        applications.append({
            **app,
            "job_title": job_data.get("title"),
            "job_status": job_data.get("status"),
            "job_location": job_data.get("location"),
            "job_location_type": job_data.get("location_type"),
            "salary_min": job_data.get("salary_min"),
            "salary_max": job_data.get("salary_max"),
            "salary_currency": job_data.get("salary_currency"),
            "org_name": org_data.get("name"),
            "org_domain": org_data.get("domain"),
            "org_logo_url": org_data.get("logo_url"),
        })

    return applications


@router.put("/api/applications/{application_id}/withdraw")
async def withdraw_application(
    application_id: str,
    user: dict = Depends(get_current_user),
):
    """Withdraw a submitted application."""
    supabase = get_supabase()

    existing = (
        supabase.table("applications")
        .select("id,status,candidate_id")
        .eq("id", application_id)
        .eq("candidate_id", user["id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Application not found")

    if existing.data[0]["status"] == "withdrawn":
        raise HTTPException(status_code=400, detail="Already withdrawn")

    supabase.table("applications").update({
        "status": "withdrawn",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", application_id).execute()

    return {"detail": "Application withdrawn"}


# =============================================================================
# Saved Jobs
# =============================================================================


@router.post("/api/jobs/{job_id}/save")
async def save_job(job_id: str, user: dict = Depends(get_current_user)):
    """Save/bookmark a job."""
    supabase = get_supabase()

    # Check job exists
    job = supabase.table("jobs").select("id").eq("id", job_id).execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if already saved
    existing = (
        supabase.table("saved_jobs")
        .select("id")
        .eq("user_id", user["id"])
        .eq("job_id", job_id)
        .execute()
    )
    if existing.data:
        return {"detail": "Already saved", "saved": True}

    supabase.table("saved_jobs").insert({
        "user_id": user["id"],
        "job_id": job_id,
    }).execute()

    return {"detail": "Job saved", "saved": True}


@router.delete("/api/jobs/{job_id}/save")
async def unsave_job(job_id: str, user: dict = Depends(get_current_user)):
    """Remove a saved job bookmark."""
    supabase = get_supabase()

    supabase.table("saved_jobs").delete().eq(
        "user_id", user["id"]
    ).eq("job_id", job_id).execute()

    return {"detail": "Bookmark removed", "saved": False}


@router.get("/api/jobs/saved")
async def get_saved_jobs(user: dict = Depends(get_current_user)):
    """Get the candidate's saved/bookmarked jobs."""
    supabase = get_supabase()

    result = (
        supabase.table("saved_jobs")
        .select("job_id, jobs(id,title,location,location_type,employment_type,experience_level,salary_min,salary_max,salary_currency,status,posted_at, organizations(name,domain,logo_url), job_functions(name,slug))")
        .eq("user_id", user["id"])
        .order("saved_at", desc=True)
        .execute()
    )

    saved = []
    for row in (result.data or []):
        job = row.get("jobs") or {}
        org = job.pop("organizations", None) or {}
        func = job.pop("job_functions", None) or {}
        saved.append({
            **job,
            "org_name": org.get("name"),
            "org_domain": org.get("domain"),
            "org_logo_url": org.get("logo_url"),
            "job_function_name": func.get("name"),
        })

    return saved


# =============================================================================
# Employer Application Review
# =============================================================================


@router.get("/api/employer/applications")
async def get_applications_by_job(
    job_id: str,
    user: dict = Depends(get_current_company_member),
):
    """Get all applications for a specific job.

    Returns candidate info with verified claims prominently.
    Any active company member can view applications.
    """
    org = user["org"]
    supabase = get_supabase()

    # Verify the job belongs to this org
    job = (
        supabase.table("jobs")
        .select("id,title")
        .eq("id", job_id)
        .eq("organization_id", org["id"])
        .execute()
    )
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get applications
    apps = (
        supabase.table("applications")
        .select("*")
        .eq("job_id", job_id)
        .neq("status", "withdrawn")
        .order("applied_at", desc=True)
        .execute()
    )

    # Enrich with candidate info and verified claims
    applications = []
    for app in (apps.data or []):
        candidate_id = app["candidate_id"]

        # Get profile
        profile = (
            supabase.table("profiles")
            .select("full_name,username,headline,location,avatar_url")
            .eq("id", candidate_id)
            .execute()
        )
        profile_data = profile.data[0] if profile.data else {}

        # Get verified employment claims
        emp_claims = (
            supabase.table("employment_claims")
            .select("company_name,title,start_date,end_date,is_current,verified_at")
            .eq("user_id", candidate_id)
            .eq("status", "verified")
            .order("start_date", desc=True)
            .execute()
        )

        # Get verified education claims
        edu_claims = (
            supabase.table("education_claims")
            .select("institution,degree,field_of_study,start_date,end_date,verified_at")
            .eq("user_id", candidate_id)
            .eq("status", "verified")
            .order("start_date", desc=True)
            .execute()
        )

        # Generate signed URL for resume snapshot
        resume_signed_url = None
        if app.get("resume_snapshot_url"):
            try:
                url_result = supabase.storage.from_("resumes").create_signed_url(
                    app["resume_snapshot_url"], 3600  # 1 hour expiry
                )
                resume_signed_url = url_result.get("signedURL") or url_result.get("signedUrl")
            except Exception:
                pass

        applications.append({
            **app,
            "resume_signed_url": resume_signed_url,
            "candidate": {
                **profile_data,
                "verified_employment": emp_claims.data or [],
                "verified_education": edu_claims.data or [],
                "verified_count": len(emp_claims.data or []) + len(edu_claims.data or []),
            },
        })

    return {
        "job": job.data[0],
        "applications": applications,
    }


@router.put("/api/employer/applications/{application_id}")
async def update_application_status(
    application_id: str,
    update: ApplicationStatusUpdate,
    user: dict = Depends(get_current_company_member),
):
    """Shortlist or reject an application.

    Any active member can take action. Candidate is notified of status change.
    """
    org = user["org"]
    supabase = get_supabase()

    # Get the application and verify it belongs to a job at this org
    app = (
        supabase.table("applications")
        .select("*, jobs(title,organization_id)")
        .eq("id", application_id)
        .execute()
    )
    if not app.data:
        raise HTTPException(status_code=404, detail="Application not found")

    app_data = app.data[0]
    job_data = app_data.get("jobs") or {}

    if job_data.get("organization_id") != org["id"]:
        raise HTTPException(status_code=403, detail="This application does not belong to your organization")

    if app_data["status"] == "withdrawn":
        raise HTTPException(status_code=400, detail="Cannot update a withdrawn application")

    # Update status
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("applications").update({
        "status": update.status,
        "updated_at": now,
    }).eq("id", application_id).execute()

    # Notify the candidate
    job_title = job_data.get("title", "a role")
    if update.status == "shortlisted":
        notify_user(
            user_id=app_data["candidate_id"],
            type="application_shortlisted",
            title=f"You've been shortlisted for {job_title}",
            message=f"{org['name']} is interested in your application.",
        )
    elif update.status == "rejected":
        notify_user(
            user_id=app_data["candidate_id"],
            type="application_rejected",
            title=f"Update on your application to {job_title}",
            message=f"{org['name']} has decided not to move forward at this time.",
        )

    return {"detail": f"Application {update.status}", "status": update.status}
