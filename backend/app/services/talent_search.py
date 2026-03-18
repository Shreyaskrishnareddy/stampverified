"""Talent search engine.

Finds discoverable candidates matching search criteria.
Powers three surfaces:
  1. /employer/talent — standalone talent search
  2. Matching Candidates tab — per-job matches
  3. Outreach candidate discovery

A candidate is discoverable if:
  - open_to_work = true
  - Has at least 1 verified claim
  - Current employer ≠ searching company (auto-block)
"""

from app.config import get_supabase


def search_candidates(
    org_domain: str,
    org_id: str | None = None,
    job_function_id: str | None = None,
    title_query: str | None = None,
    company_query: str | None = None,
    degree_query: str | None = None,
    location_query: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Search discoverable candidates.

    Args:
        org_domain: The searching company's domain (for auto-blocking current employees)
        org_id: The searching company's ID (for filtering out candidates who blocked this company)
        job_function_id: Filter by preferred job function
        title_query: Search verified job titles (partial match)
        company_query: Search verified company names (partial match)
        degree_query: Search verified degrees/institutions (partial match)
        location_query: Search candidate location (partial match)
        limit: Max results
        offset: Pagination offset

    Returns:
        List of candidate dicts with profile + verified claims summary.
    """
    supabase = get_supabase()

    # Step 1: Get candidates who are open to work
    prefs_query = (
        supabase.table("candidate_preferences")
        .select("user_id, resume_url, resume_visible, preferred_functions")
        .eq("open_to_work", True)
    )

    if job_function_id:
        prefs_query = prefs_query.contains("preferred_functions", [job_function_id])

    prefs_result = prefs_query.execute()
    open_candidates = {p["user_id"]: p for p in (prefs_result.data or [])}

    if not open_candidates:
        return []

    candidate_ids = list(open_candidates.keys())

    # Filter out candidates who blocked this company
    if org_id and candidate_ids:
        blocked = (
            supabase.table("blocked_companies")
            .select("user_id")
            .eq("organization_id", org_id)
            .in_("user_id", candidate_ids)
            .execute()
        )
        blocked_ids = {b["user_id"] for b in (blocked.data or [])}
        if blocked_ids:
            candidate_ids = [uid for uid in candidate_ids if uid not in blocked_ids]
            open_candidates = {uid: p for uid, p in open_candidates.items() if uid not in blocked_ids}

    if not candidate_ids:
        return []

    # Step 2: Get profiles for these candidates
    profiles_result = (
        supabase.table("profiles")
        .select("id, full_name, username, headline, location, avatar_url")
        .in_("id", candidate_ids)
        .execute()
    )
    profiles = {p["id"]: p for p in (profiles_result.data or [])}

    # Apply location filter
    if location_query:
        loc_lower = location_query.lower()
        profiles = {
            pid: p for pid, p in profiles.items()
            if p.get("location") and loc_lower in p["location"].lower()
        }
        candidate_ids = list(profiles.keys())
        if not candidate_ids:
            return []

    # Step 3: Get verified employment claims for these candidates
    emp_result = (
        supabase.table("employment_claims")
        .select("user_id, company_name, company_domain, title, is_current, start_date, end_date, verified_at")
        .in_("user_id", candidate_ids)
        .eq("status", "verified")
        .execute()
    )

    # Step 4: Get verified education claims
    edu_result = (
        supabase.table("education_claims")
        .select("user_id, institution, institution_domain, degree, field_of_study, verified_at")
        .in_("user_id", candidate_ids)
        .eq("status", "verified")
        .execute()
    )

    # Build per-candidate claim maps
    emp_by_user: dict[str, list] = {}
    for claim in (emp_result.data or []):
        emp_by_user.setdefault(claim["user_id"], []).append(claim)

    edu_by_user: dict[str, list] = {}
    for claim in (edu_result.data or []):
        edu_by_user.setdefault(claim["user_id"], []).append(claim)

    # Step 5: Filter and build results
    results = []
    for user_id in candidate_ids:
        profile = profiles.get(user_id)
        if not profile:
            continue

        emp_claims = emp_by_user.get(user_id, [])
        edu_claims = edu_by_user.get(user_id, [])

        # Must have at least 1 verified claim
        if not emp_claims and not edu_claims:
            continue

        # Current employer auto-block
        current_employers = [c["company_domain"] for c in emp_claims if c.get("is_current")]
        if org_domain in current_employers:
            continue

        # Title filter
        if title_query:
            title_lower = title_query.lower()
            if not any(title_lower in (c.get("title") or "").lower() for c in emp_claims):
                continue

        # Company filter
        if company_query:
            company_lower = company_query.lower()
            if not any(company_lower in (c.get("company_name") or "").lower() for c in emp_claims):
                continue

        # Degree filter
        if degree_query:
            degree_lower = degree_query.lower()
            if not any(
                degree_lower in (c.get("degree") or "").lower() or
                degree_lower in (c.get("institution") or "").lower()
                for c in edu_claims
            ):
                continue

        prefs = open_candidates.get(user_id, {})
        results.append({
            "user_id": user_id,
            "full_name": profile.get("full_name"),
            "username": profile.get("username"),
            "headline": profile.get("headline"),
            "location": profile.get("location"),
            "avatar_url": profile.get("avatar_url"),
            "resume_available": bool(prefs.get("resume_url")) and prefs.get("resume_visible", True),
            "verified_employment": emp_claims,
            "verified_education": edu_claims,
            "verified_count": len(emp_claims) + len(edu_claims),
        })

    # Sort by verified count descending
    results.sort(key=lambda r: r["verified_count"], reverse=True)

    # Paginate
    return results[offset:offset + limit]


def get_matching_candidates_for_job(
    job_id: str,
    org_domain: str,
    limit: int = 50,
) -> list[dict]:
    """Get candidates matching a specific job.

    Returns candidates who:
      - Are open to work
      - Have preferred functions matching the job's function
      - Have at least 1 verified claim
      - Are not currently employed at the searching company

    Also includes candidates who already applied (marked with applied=True).
    """
    supabase = get_supabase()

    # Get the job's function
    job_result = (
        supabase.table("jobs")
        .select("id, job_function_id, title")
        .eq("id", job_id)
        .execute()
    )
    if not job_result.data:
        return []

    job = job_result.data[0]
    job_function_id = job.get("job_function_id")

    # Get who already applied
    apps_result = (
        supabase.table("applications")
        .select("candidate_id, status")
        .eq("job_id", job_id)
        .neq("status", "withdrawn")
        .execute()
    )
    applied_map = {a["candidate_id"]: a["status"] for a in (apps_result.data or [])}

    # Search matching candidates (open to work + function match)
    matches = search_candidates(
        org_domain=org_domain,
        job_function_id=job_function_id,
        limit=limit,
    )

    # Merge applied status
    for match in matches:
        uid = match["user_id"]
        if uid in applied_map:
            match["applied"] = True
            match["application_status"] = applied_map[uid]
        else:
            match["applied"] = False
            match["application_status"] = None

    # Also add applicants who aren't in the matching results
    # (they applied but may not be open_to_work or match function)
    match_ids = {m["user_id"] for m in matches}
    for candidate_id, app_status in applied_map.items():
        if candidate_id not in match_ids:
            # Fetch their profile + claims
            profile = (
                supabase.table("profiles")
                .select("id, full_name, username, headline, location")
                .eq("id", candidate_id)
                .execute()
            )
            if not profile.data:
                continue

            emp = (
                supabase.table("employment_claims")
                .select("company_name, company_domain, title, is_current, verified_at")
                .eq("user_id", candidate_id)
                .eq("status", "verified")
                .execute()
            )
            edu = (
                supabase.table("education_claims")
                .select("institution, degree, field_of_study, verified_at")
                .eq("user_id", candidate_id)
                .eq("status", "verified")
                .execute()
            )

            p = profile.data[0]
            matches.append({
                "user_id": candidate_id,
                "full_name": p.get("full_name"),
                "username": p.get("username"),
                "headline": p.get("headline"),
                "location": p.get("location"),
                "resume_available": False,
                "verified_employment": emp.data or [],
                "verified_education": edu.data or [],
                "verified_count": len(emp.data or []) + len(edu.data or []),
                "applied": True,
                "application_status": app_status,
            })

    # Sort: applied first, then by verified count
    matches.sort(key=lambda r: (not r.get("applied", False), -r["verified_count"]))

    return matches
