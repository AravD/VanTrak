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
from .lookup import resolve_driver

GET_SCHEDULE_TOOL = {
    "type": "function",
    "function": {
        "name": "get_schedule",
        "description": (
            "Get the drivers scheduled to work on a specific date, including "
            "their station and role. Use this whenever the user asks who is "
            "working, scheduled, or assigned on a given day. "
            "Check the `status` field in the result: 'ok' means the schedule "
            "exists, so report `assignments` (an empty list genuinely means "
            "nobody is assigned that day). 'week_not_created' means that week "
            "has not been generated yet — say so and suggest opening the week in "
            "Master Schedule. Never claim nobody is working when the status is "
            "'week_not_created'."
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

def run_get_schedule(user: CurrentUser, work_date: str) -> dict:
    """Assignments for a date, or a clear signal that the week does not exist.

    Weeks are materialised lazily: the Master Schedule page calls
    ensure_weekly_schedule when you navigate to a week, and that is what seeds
    schedule_assignments. A week nobody has opened simply has no rows, which is
    NOT the same as "nobody is working" — so we distinguish the two rather than
    letting the model state something false.

    This tool stays read-only: it reports the gap instead of creating the week.
    """
    supabase = user_client(user.token)

    week = (
        supabase.table("weekly_schedules")
        .select("id")
        .lte("week_start_date", work_date)
        .gte("week_end_date", work_date)
        .limit(1)
        .execute()
    )

    if not week.data:
        return {
            "status": "week_not_created",
            "work_date": work_date,
            "message": (
                "That week has not been generated yet, so no assignments exist "
                "for it. Someone needs to open the week in Master Schedule to "
                "create it. This does not mean nobody is working."
            ),
        }

    result = (
        supabase.table("schedule_assignments")
        .select("work_date, role_assignment, assignment_status, drivers(first_name, last_name), stations(name)")
        .eq("work_date", work_date)
        .order("role_assignment")
        .execute()
    )

    return {
        "status": "ok",
        "work_date": work_date,
        "assignments": result.data,
    }


ASSIGNMENT_FIELDS = (
    "work_date, role_assignment, assignment_status,"
    " drivers(first_name, last_name), stations(name)"
)

GET_WEEK_SCHEDULE_TOOL = {
    "type": "function",
    "function": {
        "name": "get_week_schedule",
        "description": (
            "Get a whole week of assignments at once, grouped by day. Prefer "
            "this over calling get_schedule seven times when the user asks "
            "about a week. Check `status`: 'week_not_created' means that week "
            "has not been generated yet — say so rather than claiming nobody "
            "is working."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "week_start": {
                    "type": "string",
                    "description": "Any date inside the week of interest, YYYY-MM-DD.",
                },
            },
            "required": ["week_start"],
        },
    },
}


def run_get_week_schedule(user: CurrentUser, week_start: str) -> dict:
    supabase = user_client(user.token)

    week = (
        supabase.table("weekly_schedules")
        .select("week_start_date, week_end_date, status")
        .lte("week_start_date", week_start)
        .gte("week_end_date", week_start)
        .limit(1)
        .execute()
    )

    if not week.data:
        return {
            "status": "week_not_created",
            "week_start": week_start,
            "message": (
                "That week has not been generated yet, so no assignments exist "
                "for it. Someone needs to open the week in Master Schedule. "
                "This does not mean nobody is working."
            ),
        }

    row = week.data[0]
    result = (
        supabase.table("schedule_assignments")
        .select(ASSIGNMENT_FIELDS)
        .gte("work_date", row["week_start_date"])
        .lte("work_date", row["week_end_date"])
        .order("work_date")
        .execute()
    )

    by_day: dict[str, list] = {}
    for assignment in result.data:
        by_day.setdefault(assignment["work_date"], []).append(assignment)

    return {
        "status": "ok",
        "week_start": row["week_start_date"],
        "week_end": row["week_end_date"],
        "schedule_status": row["status"],
        "days": by_day,
    }


GET_DRIVER_SCHEDULE_TOOL = {
    "type": "function",
    "function": {
        "name": "get_driver_schedule",
        "description": (
            "Get the shifts one driver is assigned across a date range, with "
            "station, role and shift times. Use this for questions like when a "
            "specific driver is next working. Check `status` for 'ambiguous', "
            "'not_found' and 'week_not_created'."
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


def run_get_driver_schedule(user: CurrentUser, name: str, start: str, end: str) -> dict:
    found = resolve_driver(user, name)
    if found["status"] != "ok":
        return found

    driver = found["driver"]
    supabase = user_client(user.token)

    # Same overlap test as time off: any week touching the requested range.
    weeks = (
        supabase.table("weekly_schedules")
        .select("id")
        .lte("week_start_date", end)
        .gte("week_end_date", start)
        .execute()
    )

    if not weeks.data:
        return {
            "status": "week_not_created",
            "message": (
                "No schedule has been generated for any week in that range, so "
                "there are no shifts to report. This does not mean the driver "
                "is not working."
            ),
        }

    result = (
        supabase.table("schedule_assignments")
        .select("work_date, role_assignment, assignment_status, shift_start, shift_end, stations(name)")
        .eq("driver_id", driver["id"])
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date")
        .execute()
    )

    return {
        "status": "ok",
        "name": f"{driver['first_name']} {driver['last_name']}",
        "shifts": result.data,
    }
