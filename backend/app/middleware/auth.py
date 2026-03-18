import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicNumbers, SECP256R1
from cryptography.hazmat.backends import default_backend
import base64
import time
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings, get_supabase

security = HTTPBearer()

# JWKS cache with TTL (replaces @lru_cache which cached forever — BF.10)
_jwks_cache = {"key": None, "fetched_at": 0}
_JWKS_TTL_SECONDS = 3600  # Re-fetch JWKS key every hour


def _base64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def _get_jwks_key():
    """Fetch the JWKS public key from Supabase with TTL-based caching.

    Keys are cached for 1 hour. If Supabase rotates keys, the cache
    refreshes on the next request after the TTL expires.
    """
    now = time.monotonic()
    if _jwks_cache["key"] is not None and (now - _jwks_cache["fetched_at"]) < _JWKS_TTL_SECONDS:
        return _jwks_cache["key"]

    import requests
    settings = get_settings()
    url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    jwks = resp.json()

    for key_data in jwks["keys"]:
        if key_data["kty"] == "EC" and key_data["alg"] == "ES256":
            x = _base64url_decode(key_data["x"])
            y = _base64url_decode(key_data["y"])

            x_int = int.from_bytes(x, "big")
            y_int = int.from_bytes(y, "big")

            public_numbers = EllipticCurvePublicNumbers(x_int, y_int, SECP256R1())
            key = public_numbers.public_key(default_backend())

            _jwks_cache["key"] = key
            _jwks_cache["fetched_at"] = now
            return key

    raise ValueError("No ES256 key found in JWKS")


def _decode_token(token: str) -> dict:
    """Decode and validate a Supabase JWT token. Returns the payload."""
    try:
        public_key = _get_jwks_key()
        payload = pyjwt.decode(
            token,
            public_key,
            algorithms=["ES256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_id, "email": payload.get("email", "")}
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Authenticate a regular user (candidate). Returns {"id": ..., "email": ...}."""
    return _decode_token(credentials.credentials)


async def get_current_company_member(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Authenticate a company workspace member.

    Returns a dict with:
        - id: auth user ID
        - email: auth email
        - member: full company_members row
        - org: full organizations row

    All workspace access goes through the company_members table.
    """
    user = _decode_token(credentials.credentials)
    supabase = get_supabase()

    # Primary path: look up company_members by user_id
    result = (
        supabase.table("company_members")
        .select("*, organizations(*)")
        .eq("user_id", user["id"])
        .eq("status", "active")
        .limit(1)
        .execute()
    )

    if result.data:
        row = result.data[0]
        org_data = row.pop("organizations")
        user["member"] = row
        user["org"] = org_data
        return user

    raise HTTPException(
        status_code=403,
        detail="Not a member of any company workspace"
    )


def require_permission(member: dict, permission: str):
    """Check that a company member has a specific permission.

    Admins always have all permissions. Members need the explicit flag.
    Raises 403 if permission is denied.

    Usage:
        member = await get_current_company_member(credentials)
        require_permission(member["member"], "can_post_jobs")
    """
    if member["role"] == "admin":
        return  # Admins can do everything

    if not member.get(permission):
        permission_label = permission.replace("_", " ").replace("can ", "")
        raise HTTPException(
            status_code=403,
            detail=f"You don't have permission to {permission_label}. Ask your workspace admin to grant access."
        )


def require_admin(member: dict):
    """Check that a company member is an admin. Raises 403 if not."""
    if member["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only workspace admins can perform this action"
        )


def require_domain_verified(org: dict):
    """Check that the organization's domain has been verified.

    Unverified orgs cannot post jobs, verify claims, or appear in search.
    Raises 403 if domain is not verified.
    """
    if not org.get("is_domain_verified"):
        raise HTTPException(
            status_code=403,
            detail="Your organization's domain must be verified before performing this action. Contact support for domain verification."
        )
