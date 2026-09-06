"""
Agent tool: list_drivers — the driver roster for the logged-in user's business.
Every tool has two halves:
1. TOOL DEFINITION (JSON) — what we describe to the model so it knows the tool
   exists and when to use it.
2. The Python FUNCTION — what actually runs when the model asks for the tool.
"""

from ..auth import CurrentUser
from ..supabase_client import user_client
from .lookup import resolve_driver

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


WEEKDAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")

GET_DRIVER_TOOL = {
    "type": "function",
    "function": {
        "name": "get_driver",
        "description": (
            "Get one driver's full profile: employment status, van number, "
            "contact details, notes, and which weekdays they are available to "
            "work. Use this whenever the user asks about a specific driver by "
            "name. Check `status`: 'ambiguous' means several drivers matched — "
            "ask the user which one before answering. 'not_found' means no such "
            "driver; do not invent one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Driver name, full or partial (e.g. 'Ana' or 'Ana Reyes').",
                },
            },
            "required": ["name"],
        },
    },
}


def run_get_driver(user: CurrentUser, name: str) -> dict:
    found = resolve_driver(user, name)
    if found["status"] != "ok":
        return found

    driver = found["driver"]

    return {
        "status": "ok",
        "name": f"{driver['first_name']} {driver['last_name']}",
        "employment_status": driver["status"],
        "van_number": driver["van_number"],
        "email": driver["email"],
        "phone": driver["phone"],
        "notes": driver["notes"],
        "available_days": [day for day in WEEKDAYS if driver.get(day)],
    }


GET_DRIVER_ATTENDANCE_TOOL = {
    "type": "function",
    "function": {
        "name": "get_driver_attendance",
        "description": (
            "Get one driver's attendance history over a date range from daily "
            "roll call — how many days were recorded, a tally by attendance "
            "status, and the day-by-day detail. Use this when asked how "
            "reliable, punctual, or frequently late a driver has been."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Driver name, full or partial."},
                "start": {"type": "string", "description": "First date, YYYY-MM-DD."},
                "end": {"type": "string", "description": "Last date, YYYY-MM-DD."},
            },
            "required": ["name", "start", "end"],
        },
    },
}


def run_get_driver_attendance(user: CurrentUser, name: str, start: str, end: str) -> dict:
    found = resolve_driver(user, name)
    if found["status"] != "ok":
        return found

    driver = found["driver"]
    supabase = user_client(user.token)

    result = (
        supabase.table("daily_roll_call")
        .select("report_date, attendance_status, arrival_time, route_status, total_hours_worked")
        .eq("driver_id", driver["id"])
        .gte("report_date", start)
        .lte("report_date", end)
        .order("report_date")
        .execute()
    )

    tally: dict[str, int] = {}
    for row in result.data:
        label = row.get("attendance_status") or "Unrecorded"
        tally[label] = tally.get(label, 0) + 1

    return {
        "status": "ok",
        "name": f"{driver['first_name']} {driver['last_name']}",
        "days_recorded": len(result.data),
        "by_attendance_status": tally,
        "days": result.data,
    }
