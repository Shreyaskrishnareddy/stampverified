import re
import secrets
import socket
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.middleware.auth import get_current_user, get_current_company_member, require_admin
from app.services.storage import upload_org_logo
from app.services.email import send_verification_email
from app.models.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationPublic,
)
from app.config import get_supabase, get_settings
from app.services.notifications import notify_user, notify_org_admin

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

# Role-based email prefixes accepted for org registration.
# Primary tier: standard HR/recruiting inboxes.
# Fallback tier: authority/institutional addresses common at early-stage companies.
ALLOWED_ROLE_PREFIXES = {
    # Primary: HR / recruiting
    "hr", "people", "careers", "recruiting", "talent",
    "registrar", "admissions", "humanresources", "team",
    # Fallback: authority / institutional (early-stage companies)
    "founder", "founders", "admin", "ceo", "coo", "cto",
    "office", "info", "contact", "hello", "support",
    "ops", "operations",
}

# Public email domains that cannot be registered as organizations
PUBLIC_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "yahoo.co.in", "hotmail.com", "outlook.com",
    "live.com", "aol.com", "icloud.com", "me.com", "mac.com",
    "mail.com", "protonmail.com", "proton.me", "zoho.com",
    "yandex.com", "gmx.com", "gmx.net", "fastmail.com",
    "tutanota.com", "inbox.com", "msn.com", "att.net",
    "comcast.net", "verizon.net", "sbcglobal.net", "cox.net",
    "earthlink.net", "charter.net", "optonline.net",
    "rediffmail.com", "qq.com", "163.com", "126.com",
    "naver.com", "daum.net", "hanmail.net",
}


def _validate_role_based_email(email: str, expected_domain: str):
    """Validate that verifier email is a role-based address at the org's domain.

    Accepts patterns like hr@company.com, people@company.com, careers@company.com.
    Rejects personal emails like john@company.com.
    """
    email = email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    local_part, email_domain = email.rsplit("@", 1)

    # Domain must match the organization's domain
    if email_domain != expected_domain:
        raise HTTPException(
            status_code=400,
            detail=f"Verifier email domain must match the organization domain ({expected_domain})"
        )

    # Local part must be a recognized role-based prefix
    # Strip dots/hyphens for matching (e.g. "human.resources" -> "humanresources")
    normalized = re.sub(r"[.\-_]", "", local_part)
    if normalized not in ALLOWED_ROLE_PREFIXES:
        raise HTTPException(
            status_code=400,
            detail="Verifier email must be an organizational address (e.g. hr@, people@, careers@, founder@, admin@, team@). Personal emails like john@company.com are not accepted."
        )


def _check_no_self_verification(user_id: str, domain: str):
    """Prevent org registrant from having claims at the same company.

    This is an anti-fraud measure — you can't verify your own claims.
    """
    supabase = get_supabase()

    emp_claims = (
        supabase.table("employment_claims")
        .select("id")
        .eq("user_id", user_id)
        .eq("company_domain", domain)
        .limit(1)
        .execute()
    )
    if emp_claims.data:
        raise HTTPException(
            status_code=400,
            detail="You cannot register an organization where you have employment claims. This prevents self-verification."
        )

    edu_claims = (
        supabase.table("education_claims")
        .select("id")
        .eq("user_id", user_id)
        .eq("institution_domain", domain)
        .limit(1)
        .execute()
    )
    if edu_claims.data:
        raise HTTPException(
            status_code=400,
            detail="You cannot register an organization where you have education claims. This prevents self-verification."
        )


@router.post("/", response_model=OrganizationResponse)
async def register_organization(
    org: OrganizationCreate,
    user: dict = Depends(get_current_user),
):
    """Register a new organization.

    The user's email (from their JWT) becomes the admin_email.
    Domain must be unique — one registration per domain.
    Verifier email must be role-based (hr@, people@, careers@, etc.).
    Registrant cannot have claims at the same company (no self-verification).
    """
    supabase = get_supabase()

    # Normalize domain to lowercase
    domain = org.domain.strip().lower()

    # Block public email domains
    if domain in PUBLIC_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"{domain} is a public email provider and cannot be registered as a company"
        )

    # Check if domain is already registered
    existing = (
        supabase.table("organizations")
        .select("id")
        .eq("domain", domain)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="An organization with this domain is already registered"
        )

    # Validate the domain looks legitimate (has DNS records)
    try:
        socket.getaddrinfo(domain, None)
    except socket.gaierror:
        raise HTTPException(
            status_code=400,
            detail=f"Domain '{domain}' does not appear to be a real domain. Please use a registered company domain."
        )

    # Registrant's email domain must match the org domain
    registrant_domain = user["email"].rsplit("@", 1)[-1].lower() if "@" in user["email"] else ""
    if registrant_domain != domain:
        raise HTTPException(
            status_code=400,
            detail=f"Your email domain ({registrant_domain}) must match the organization domain ({domain})"
        )

    # Verifier email is required and must be role-based
    verifier_email = (org.verifier_email or "").strip().lower()
    if not verifier_email:
        raise HTTPException(
            status_code=400,
            detail="A role-based verifier email is required (e.g. hr@company.com)"
        )
    _validate_role_based_email(verifier_email, domain)

    # Anti-fraud: registrant cannot have claims at this company
    _check_no_self_verification(user["id"], domain)

    data = {
        "name": org.name.strip(),
        "domain": domain,
        "org_type": org.org_type,
        "admin_email": user["email"],
        "verifier_name": org.verifier_name,
        "verifier_email": verifier_email,
        "logo_url": org.logo_url,
        "website_url": f"https://{domain}",
    }

    result = supabase.table("organizations").insert(data).execute()
    new_org = result.data[0]

    # Create the founding company_member with admin role and all permissions
    now = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("company_members").insert({
            "organization_id": new_org["id"],
            "user_id": user["id"],
            "email": user["email"],
            "role": "admin",
            "can_post_jobs": True,
            "can_verify_claims": True,
            "status": "active",
            "joined_at": now,
        }).execute()
    except Exception as e:
        print(f"[ORG] Warning: Failed to create company_member for founding admin: {e}")

    # Auto-surface any existing claims that were awaiting this org
    _link_pending_claims(domain, new_org["id"], new_org["name"], user["email"])

    return new_org


def _link_pending_claims(domain: str, org_id: str, org_name: str, admin_email: str):
    """When an org registers, find all 'awaiting_org' claims that match
    this domain, link them, generate verification tokens, and send
    verification emails to the org's verifier."""
    supabase = get_supabase()
    settings = get_settings()
    frontend_url = settings.frontend_url

    # Get org details for the verifier email
    org_result = supabase.table("organizations").select("*").eq("id", org_id).execute()
    org = org_result.data[0] if org_result.data else None

    # Match employment claims by company_domain
    emp_claims = (
        supabase.table("employment_claims")
        .select("id,user_id,company_name,title,start_date,end_date,is_current")
        .eq("company_domain", domain)
        .eq("status", "awaiting_org")
        .execute()
    )
    if emp_claims.data:
        for claim in emp_claims.data:
            # Generate a verification token for this claim
            new_token = secrets.token_urlsafe(32)

            supabase.table("employment_claims").update({
                "organization_id": org_id,
                "status": "awaiting_verification",
                "verification_token": new_token,
                "token_expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            }).eq("id", claim["id"]).execute()

            # Notify the user that their company has joined
            notify_user(
                user_id=claim["user_id"],
                type="org_registered",
                title=f"{org_name} has joined Stamp",
                message="Your claim has been sent for verification.",
                claim_id=claim["id"],
                claim_table="employment_claims",
            )

            # Send verification email to the org's verifier
            if org:
                profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
                claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

                period = str(claim.get("start_date", ""))
                if claim.get("is_current"):
                    period += " to Present"
                elif claim.get("end_date"):
                    period += f" to {claim['end_date']}"

                claim_details = f"{claim['title']} at {claim['company_name']} ({period})"
                verification_url = f"{frontend_url}/verify/{new_token}"

                try:
                    send_verification_email(
                        to_email=org["verifier_email"],
                        claimer_name=claimer_name,
                        claim_type="employment",
                        claim_details=claim_details,
                        verification_url=verification_url,
                    )
                except Exception as e:
                    print(f"[ORG] Warning: Failed to send verification email for claim {claim['id']}: {e}")

    # Match education claims by institution_domain
    edu_claims = (
        supabase.table("education_claims")
        .select("id,user_id,institution,degree,field_of_study,end_date")
        .eq("institution_domain", domain)
        .eq("status", "awaiting_org")
        .execute()
    )
    if edu_claims.data:
        for claim in edu_claims.data:
            new_token = secrets.token_urlsafe(32)

            supabase.table("education_claims").update({
                "organization_id": org_id,
                "status": "awaiting_verification",
                "verification_token": new_token,
                "token_expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            }).eq("id", claim["id"]).execute()

            notify_user(
                user_id=claim["user_id"],
                type="org_registered",
                title=f"{org_name} has joined Stamp",
                message="Your claim has been sent for verification.",
                claim_id=claim["id"],
                claim_table="education_claims",
            )

            # Send verification email to the org's verifier
            if org:
                profile = supabase.table("profiles").select("full_name").eq("id", claim["user_id"]).execute()
                claimer_name = profile.data[0]["full_name"] if profile.data else "Someone"

                claim_details = f"{claim['degree']} from {claim['institution']}"
                if claim.get("field_of_study"):
                    claim_details += f" ({claim['field_of_study']})"
                verification_url = f"{frontend_url}/verify/{new_token}"

                try:
                    send_verification_email(
                        to_email=org["verifier_email"],
                        claimer_name=claimer_name,
                        claim_type="education",
                        claim_details=claim_details,
                        verification_url=verification_url,
                    )
                except Exception as e:
                    print(f"[ORG] Warning: Failed to send verification email for claim {claim['id']}: {e}")

    # Notify the org admin about pending claims
    total_pending = len(emp_claims.data or []) + len(edu_claims.data or [])
    if total_pending > 0:
        notify_org_admin(
            org_admin_email=admin_email,
            type="new_verification_request",
            title=f"You have {total_pending} pending verification request{'s' if total_pending > 1 else ''}",
            message="Review them in your employer dashboard.",
        )


@router.get("/mine", response_model=OrganizationResponse)
async def get_my_organization(user: dict = Depends(get_current_company_member)):
    """Get the org that the current member belongs to.

    Any active member can view org details.
    """
    return user["org"]


@router.put("/mine", response_model=OrganizationResponse)
async def update_my_organization(
    updates: OrganizationUpdate,
    user: dict = Depends(get_current_company_member),
):
    """Update org details (name, verifier contact, logo).

    Admin only.
    """
    require_admin(user["member"])

    supabase = get_supabase()
    org = user["org"]

    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "verifier_email" in update_data:
        update_data["verifier_email"] = update_data["verifier_email"].strip().lower()
        _validate_role_based_email(update_data["verifier_email"], org["domain"])

    result = (
        supabase.table("organizations")
        .update(update_data)
        .eq("id", org["id"])
        .execute()
    )
    return result.data[0]


@router.post("/mine/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_company_member),
):
    """Upload organization logo to Supabase Storage.

    Admin only.
    """
    require_admin(user["member"])

    org = user["org"]
    logo_url = await upload_org_logo(org["id"], file)
    return {"logo_url": logo_url}


# =============================================================================
# DNS Domain Verification
# =============================================================================


@router.post("/mine/dns-verify/start")
async def start_dns_verification(user: dict = Depends(get_current_company_member)):
    """Generate a DNS TXT verification token for the organization's domain.

    Admin only. Returns a token that must be added as a DNS TXT record:
      stamp-verify=TOKEN

    If a token already exists and isn't verified, returns the existing one.
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    if org.get("is_domain_verified"):
        return {
            "detail": "Domain is already verified",
            "is_domain_verified": True,
            "dns_verified_at": org.get("dns_verified_at"),
        }

    # Reuse existing token if one exists
    if org.get("dns_verification_token"):
        return {
            "domain": org["domain"],
            "txt_record": f"stamp-verify={org['dns_verification_token']}",
            "instruction": f"Add a TXT record to {org['domain']} with the value above, then call the verify endpoint.",
        }

    # Generate new token
    token = secrets.token_urlsafe(24)
    supabase.table("organizations").update({
        "dns_verification_token": token,
    }).eq("id", org["id"]).execute()

    return {
        "domain": org["domain"],
        "txt_record": f"stamp-verify={token}",
        "instruction": f"Add a TXT record to {org['domain']} with the value above, then call the verify endpoint.",
    }


@router.post("/mine/dns-verify/check")
async def check_dns_verification(user: dict = Depends(get_current_company_member)):
    """Check if the DNS TXT record has been set and verify the domain.

    Admin only. Looks up TXT records for the org's domain and checks
    for the stamp-verify=TOKEN record.
    """
    require_admin(user["member"])

    org = user["org"]
    supabase = get_supabase()

    if org.get("is_domain_verified"):
        return {"detail": "Domain is already verified", "is_domain_verified": True}

    expected_token = org.get("dns_verification_token")
    if not expected_token:
        raise HTTPException(status_code=400, detail="Start DNS verification first by calling the start endpoint")

    # Look up TXT records
    import dns.resolver
    expected_value = f"stamp-verify={expected_token}"
    domain = org["domain"]

    try:
        answers = dns.resolver.resolve(domain, "TXT")
        txt_values = []
        for rdata in answers:
            for txt_string in rdata.strings:
                txt_values.append(txt_string.decode("utf-8", errors="ignore"))

        if expected_value in txt_values:
            # Verified
            now = datetime.now(timezone.utc).isoformat()
            supabase.table("organizations").update({
                "is_domain_verified": True,
                "dns_verified_at": now,
            }).eq("id", org["id"]).execute()

            from app.services.audit import log_action
            log_action(
                action="domain_verified",
                resource_type="organization",
                resource_id=org["id"],
                actor_id=user["id"],
                actor_type="member",
                metadata={"domain": domain, "method": "dns_txt"},
            )

            return {
                "detail": "Domain verified successfully",
                "is_domain_verified": True,
                "dns_verified_at": now,
            }
        else:
            return {
                "detail": "TXT record not found yet",
                "is_domain_verified": False,
                "expected": expected_value,
                "found": txt_values[:5],
                "instruction": f"Add a TXT record to {domain} with value: {expected_value}",
            }
    except dns.resolver.NXDOMAIN:
        raise HTTPException(status_code=400, detail=f"Domain {domain} does not exist")
    except dns.resolver.NoAnswer:
        return {
            "detail": "No TXT records found for this domain",
            "is_domain_verified": False,
            "expected": expected_value,
            "instruction": f"Add a TXT record to {domain} with value: {expected_value}",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DNS lookup failed: {str(e)}")


@router.get("/search")
async def search_organizations(q: str):
    """Search registered orgs by name or domain.

    If query contains a dot (looks like a domain), search by exact domain first.
    Otherwise search by name. Returns public info only — no admin emails.
    """
    if not q or len(q) < 2:
        return []

    try:
        supabase = get_supabase()
        q_clean = q.strip().lower()

        # If it looks like a domain (contains a dot), try exact domain match first
        if "." in q_clean:
            domain_result = (
                supabase.table("organizations")
                .select("id,name,domain,org_type,logo_url,is_domain_verified")
                .eq("domain", q_clean)
                .execute()
            )
            if domain_result.data:
                return domain_result.data

        # Search by name (ilike) and domain (ilike) combined
        name_results = (
            supabase.table("organizations")
            .select("id,name,domain,org_type,logo_url,is_domain_verified")
            .ilike("name", f"%{q_clean}%")
            .limit(10)
            .execute()
        )

        domain_results = (
            supabase.table("organizations")
            .select("id,name,domain,org_type,logo_url,is_domain_verified")
            .ilike("domain", f"%{q_clean}%")
            .limit(10)
            .execute()
        )

        # Merge and deduplicate (domain matches may overlap with name matches)
        seen = set()
        combined = []
        for org in (domain_results.data or []) + (name_results.data or []):
            if org["id"] not in seen:
                seen.add(org["id"])
                combined.append(org)

        return combined[:10]
    except Exception:
        return []
