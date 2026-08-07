"""
Agent tools for the schedule (built in the agent phase).
Planned tools:
- get_todays_schedule(date): who is assigned where today
- get_capacity(date): per-station DA count vs. okami (spare drivers)

Each will call a function in app/services/ so the same logic backs both the
HTTP routers and the agent tools (no duplication).
"""

from ..auth import CurrentUser
from ..supabase_client import user_client

GET_SCHEDULE_TOOL = {
    "type": "function",
    "function": {
        "name": "get_schedule",
        "description": (
            "Get the drivers scheduled to work on a specific date, including "
            "their station and role. Use this whenever the user asks who is "
            "working, scheduled, or assigned on a given day."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "work_date": {
                    "type": "string",
                    "description": "The date to look up, in YYYY-MM-DD format (e.g. 2026-08-07).",
                },
            },
            "required": ["work_date"],
        },
    },
}

def run_get_schedule(user: CurrentUser, work_date: str) -> list[dict]:
    supabase = user_client(user.token)
    result = (
        supabase.table("schedule_assignments")
        .select("work_date, role_assignment, assignment_status, drivers(first_name, last_name), stations(name)")
        .eq("work_date", work_date)
        .order("role_assignment")
        .execute()
    )

    return result.data
