"""
Agent tool: list_drivers — the driver roster for the logged-in user's business.
Every tool has two halves:
1. TOOL DEFINITION (JSON) — what we describe to the model so it knows the tool
   exists and when to use it.
2. The Python FUNCTION — what actually runs when the model asks for the tool.
"""

from ..auth import CurrentUser
from ..supabase_client import user_client

# 1. Tool definition which is given to the model
LIST_DRIVERS_TOOL = {
    "type": "function",
    "function": {
        "name": "list_drivers",
        "description" : ("Get the roster of drivers for the current user's business. Use this "
            "whenever the user asks who their drivers are, how many they have, or "
            "about drivers' employment statuses."),
            "parameters": {
                "type": "object",
                "properties": {
                "status": {
                    "type": "string",
                    "enum": ["Active", "Probation", "W/C", "Inactive"],
                    "description": "Optional filter — only return drivers with this status.",
                },
            },
            "required": [],
        },
    },
}

# 2. The actual python function that runs once model calls for it to run
def run_list_drivers(user: CurrentUser, status: str | None = None) -> list[dict]:
    supabase = user_client(user.token)

    query = (
        supabase.table("drivers")
        .select("id, first_name, last_name, status, van_number")
        .order("first_name")
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    return result.data
