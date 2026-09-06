"""Agent tools for the daily report: attendance, routes, issues and rescues."""

from ..auth import CurrentUser
from ..supabase_client import user_client

GET_DAILY_REPORT_TOOL = {
    "type": "function",
    "function": {
        "name": "get_daily_report",
        "description": (
            "Get the daily report for a date: each driver's attendance, arrival "
            "time, route status, stops and packages, plus tallies by attendance "
            "and route status. Use this for questions about who showed up, who "
            "was late, how many routes are finished, or how the day is going. An "
            "empty result means roll call has not been filled in for that date."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "report_date": {
                    "type": "string",
                    "description": "The date, YYYY-MM-DD.",
                },
            },
            "required": ["report_date"],
        },
    },
}


def run_get_daily_report(user: CurrentUser, report_date: str) -> dict:
    supabase = user_client(user.token)

    result = (
        supabase.table("daily_roll_call")
        .select(
            "attendance_status, arrival_time, route_status, route_number,"
            " stops_count, packages_count, total_hours_worked,"
            " drivers(first_name, last_name), stations(name)"
        )
        .eq("report_date", report_date)
        .execute()
    )

    attendance_tally: dict[str, int] = {}
    route_tally: dict[str, int] = {}

    for row in result.data:
        attended = row.get("attendance_status") or "Unrecorded"
        routed = row.get("route_status") or "Unrecorded"
        attendance_tally[attended] = attendance_tally.get(attended, 0) + 1
        route_tally[routed] = route_tally.get(routed, 0) + 1

    return {
        "status": "ok",
        "report_date": report_date,
        "drivers_recorded": len(result.data),
        "by_attendance_status": attendance_tally,
        "by_route_status": route_tally,
        "rows": result.data,
    }


GET_OPEN_ISSUES_TOOL = {
    "type": "function",
    "function": {
        "name": "get_open_issues",
        "description": (
            "Get issues logged during a date range — type, notes, the driver and "
            "station involved. Use this when asked about problems, incidents, "
            "complaints or what went wrong."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start": {"type": "string", "description": "First date, YYYY-MM-DD."},
                "end": {"type": "string", "description": "Last date, YYYY-MM-DD."},
            },
            "required": ["start", "end"],
        },
    },
}


def run_get_open_issues(user: CurrentUser, start: str, end: str) -> list[dict]:
    supabase = user_client(user.token)

    result = (
        supabase.table("daily_issues")
        .select("issue_date, issue_type, notes, drivers(first_name, last_name), stations(name)")
        .gte("issue_date", start)
        .lte("issue_date", end)
        .order("issue_date")
        .execute()
    )

    return result.data


GET_RESCUES_TOOL = {
    "type": "function",
    "function": {
        "name": "get_rescues",
        "description": (
            "Get rescues on a date — which driver rescued which, at what "
            "station, and how many stops and packages were taken over. Use this "
            "when asked who rescued whom, or how much rescue work happened."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "report_date": {"type": "string", "description": "The date, YYYY-MM-DD."},
            },
            "required": ["report_date"],
        },
    },
}


def run_get_rescues(user: CurrentUser, report_date: str) -> list[dict]:
    supabase = user_client(user.token)

    result = (
        supabase.table("rescues")
        .select(
            "report_date, stops, packages, notes,"
            " rescuer:rescuer_id(first_name, last_name),"
            " rescuee:rescuee_id(first_name, last_name),"
            " stations(name)"
        )
        .eq("report_date", report_date)
        .execute()
    )

    return result.data
