"""Shared driver lookup.

Tools receive a driver NAME from the model, but every table keys on driver_id,
so all name-based tools resolve through here.

Matching happens in Python rather than inside a PostgREST filter string: the
roster is small, and it avoids building query filters out of model-supplied
text. Ambiguity is reported instead of silently picking the first match.
"""

from ..auth import CurrentUser
from ..supabase_client import user_client

DRIVER_FIELDS = (
    "id, first_name, last_name, status, van_number, email, phone, notes,"
    " sun, mon, tue, wed, thu, fri, sat"
)


def resolve_driver(user: CurrentUser, name: str) -> dict:
    """Find exactly one driver by full or partial name."""
    needle = (name or "").strip().lower()
    if not needle:
        return {"status": "not_found", "message": "No driver name was given."}

    supabase = user_client(user.token)
    result = supabase.table("drivers").select(DRIVER_FIELDS).execute()

    matches = [
        row
        for row in result.data
        if needle in f"{row['first_name']} {row['last_name']}".lower()
    ]

    if not matches:
        return {"status": "not_found", "message": f"No driver matches '{name}'."}

    if len(matches) > 1:
        return {
            "status": "ambiguous",
            "message": f"Several drivers match '{name}'. Ask which one is meant.",
            "matches": [f"{m['first_name']} {m['last_name']}" for m in matches],
        }

    return {"status": "ok", "driver": matches[0]}
