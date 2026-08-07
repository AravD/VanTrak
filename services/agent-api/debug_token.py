"""
Dev tool: decode a Supabase access token WITHOUT verifying the signature,
so you can inspect what's inside it. Run it, then paste your token when asked.

    .venv/bin/python debug_token.py

It prints the JWT header (which signing algorithm was used) and the claims
(who you are, when it expires). It never checks the secret — this is purely
for looking, so an expired or wrong-secret token still decodes here.
"""

import datetime as dt
import json

import jwt

token = input("Paste your access token (input hidden from history): ").strip()

# Strip an accidental "Bearer " prefix if it's there.
if token.lower().startswith("bearer "):
    token = token[len("bearer "):]

header = jwt.get_unverified_header(token)
claims = jwt.decode(token, options={"verify_signature": False})

print("\n--- HEADER (how it was signed) ---")
print(json.dumps(header, indent=2))
print("  alg == HS256  -> our shared-secret verification is correct")
print("  alg == ES256/RS256 -> project uses ASYMMETRIC keys; HS256 secret can't verify it")

print("\n--- CLAIMS (who / when) ---")
print(f"  sub  (user id): {claims.get('sub')}")
print(f"  role          : {claims.get('role')}")
print(f"  aud           : {claims.get('aud')}   (must be 'authenticated')")

exp = claims.get("exp")
if exp:
    when = dt.datetime.fromtimestamp(exp, dt.timezone.utc)
    now = dt.datetime.now(dt.timezone.utc)
    state = "EXPIRED" if when < now else "still valid"
    print(f"  exp           : {when.isoformat()}  ({state})")
