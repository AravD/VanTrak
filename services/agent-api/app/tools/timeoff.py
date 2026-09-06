from ..auth import CurrentUser
from ..supabase_client import user_client

GET_TIME_OFF_TOOL = {
    "type": "function",
    "function": {
        "name": "get_time_off",
        "description": (
            "Find drivers who are off during a date range — time off, sick days, "
            "or other absences. Use this whenever the user asks who is off, away, "
            "on vacation, or unavailable. Returns any absence that overlaps the "
            "range, including ones that started earlier or end later."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start": {
                    "type": "string",
                    "description": "First date of the range, YYYY-MM-DD.",
                },
                "end": {
                    "type": "string",
                    "description": "Last date of the range, YYYY-MM-DD.",
                },
                "exception_type": {
                    "type": "string",
                    "enum": ["Time Off", "Sick", "Other"],
                    "description": "Optional filter to one kind of absence.",
                },
            },
            "required": ["start", "end"],
        },
    },
}

def run_get_time_off(user: CurrentUser, start: str, end: str, exception_type: str | None = None) -> list[dict]:

    supabase = user_client(user.token)
    query = (
        supabase.table("schedule_exceptions")
        .select(
            "exception_type, start_date, end_date, status, makeup_required,"
            " notes, drivers(first_name, last_name)"
        )
        .lte("start_date", end)
        .gte("end_date", start)
    )
    
    if exception_type:
        query = query.eq("exception_type", exception_type)

    result = query.order("start_date").execute()

    return result.data


GET_MAKEUP_DAYS_TOOL = {
    "type": "function",
    "function": {
        "name": "get_makeup_days",
        "description": (
            "List absences that still owe a makeup day — where a makeup was "
            "required and has not been applied yet. Use this when asked who owes "
            "makeup days or which makeups are outstanding."
        ),
        "parameters": {"type": "object", "properties": {}, "required": []},
    },
}


def run_get_makeup_days(user: CurrentUser) -> list[dict]:
    supabase = user_client(user.token)

    result = (
        supabase.table("schedule_exceptions")
        .select(
            "exception_type, start_date, end_date, makeup_start_date,"
            " makeup_end_date, status, notes, drivers(first_name, last_name)"
        )
        .eq("makeup_required", True)
        .eq("status", "Pending")
        .order("start_date")
        .execute()
    )

    return result.data
