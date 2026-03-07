import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.ec import EllipticCurvePublicNumbers, SECP256R1
from cryptography.hazmat.backends import default_backend
import base64
import struct
import requests
from functools import lru_cache
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

security = HTTPBearer()


def _base64url_decode(data: str) -> bytes:
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


@lru_cache()
def _get_jwks_key():
    """Fetch and cache the JWKS public key from Supabase."""
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
            return public_numbers.public_key(default_backend())

    raise ValueError("No ES256 key found in JWKS")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials

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
    except pyjwt.InvalidTokenError as e:
        print(f"[AUTH] JWT validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")
