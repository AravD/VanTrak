"""
Turn the Supabase access token into a `CurrentUser`.

The frontend logs in with Supabase, gets an access token (a JWT), and sends it
as `Authorization: Bearer <token>`. We verify the signature and read who the
user is.

Supabase signs modern tokens with ASYMMETRIC keys (ES256): a private key inside
Supabase signs, and matching PUBLIC keys are published at a JWKS URL. We fetch
those public keys, pick the one whose `kid` matches the token's header, and
verify with it. `PyJWKClient` caches the key set, so it isn't refetched on
every request.

`get_current_user` is a FastAPI dependency: any endpoint that lists it only runs
for a valid token and receives the decoded user. We keep the raw token so we can
later forward it to Supabase (preserving Row Level Security).
"""

import ssl

import certifi
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from pydantic import BaseModel

from ..config import settings

_bearer = HTTPBearer(auto_error=True)

# Trust the certifi CA bundle when making HTTPS calls. The python.org macOS build
# doesn't use the system trust store, so without this the JWKS fetch fails with
# "certificate verify failed". certifi is maintained + works the same in Docker.
_ssl_context = ssl.create_default_context(cafile=certifi.where())

# Supabase publishes its public signing keys here. PyJWKClient fetches this once
# and caches it; on each request it selects the right key by the token's `kid`.
_JWKS_URL = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
_jwks_client = PyJWKClient(_JWKS_URL, ssl_context=_ssl_context)

# Supabase currently uses ES256; RS256 is included so a future key change to RSA
# keeps working without a code edit.
_ALGORITHMS = ["ES256", "RS256"]


class CurrentUser(BaseModel):
    id: str                   # Supabase user id (JWT "sub")
    email: str | None = None
    role: str | None = None   # usually "authenticated"
    token: str                # raw token, forwarded to Supabase later


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CurrentUser:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL is not set in the API's .env.api file.",
        )

    token = creds.credentials
    try:
        # Find the public key that matches this token's `kid`, then verify.
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALGORITHMS,
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        )

    return CurrentUser(
        id=payload["sub"],
        email=payload.get("email"),
        role=payload.get("role"),
        token=token,
    )
