"""Agent tools for staffing: who can work, and where we are short."""

from datetime import date

from ..auth import CurrentUser
from ..supabase_client import user_client

# date.weekday() is Mon=0 ... Sun=6; drivers store one availability column per day.
WEEKDAY_COLUMN = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")

# Probation is a tag only — it must not affect scheduling.
SCHEDULABLE_STATUSES = ["Active", "Probation"]


FIND_AVAILABLE_DRIVERS_TOOL = {
    "type": "function",
    "function": {
        "name": "find_available_drivers",
        "description": (
            "Find which drivers could cover a shift on a given date. Returns "
            "three groups: `available` (marked that weekday as available, not "
            "off, not already scheduled), `on_leave`, and `already_scheduled`. "
            "Use this when someone calls out or the user asks who can cover, "
            "who is free, or who could take a route."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "work_date": {
                    "type": "string",
                    "description": "The date to check, YYYY-MM-DD.",
                },
            },
            "required": ["work_date"],
        },
    },
}


def run_find_available_drivers(user: CurrentUser, work_date: str) -> dict:
    supabase = user_client(user.token)
    day_column = WEEKDAY_COLUMN[date.fromisoformat(work_date).weekday()]

    drivers = (
        supabase.table("drivers")
        .select("id, first_name, last_name, status, van_number")
        .in_("status", SCHEDULABLE_STATUSES)
        .eq(day_column, True)
        .order("first_name")
        .execute()
    )

    # Absences overlapping the date — same overlap test used by get_time_off.
    away = (
        supabase.table("schedule_exceptions")
        .select("driver_id, exception_type")
        .lte("start_date", work_date)
        .gte("end_date", work_date)
        .execute()
    )
    away_by_id = {row["driver_id"]: row["exception_type"] for row in away.data}

    assigned = (
        supabase.table("schedule_assignments")
        .select("driver_id, stations(name)")
        .eq("work_date", work_date)
        .neq("assignment_status", "Removed")
        .execute()
    )
    assigned_by_id = {row["driver_id"]: row for row in assigned.data}

    available, on_leave, already_scheduled = [], [], []

    for driver in drivers.data:
        label = f"{driver['first_name']} {driver['last_name']}"

        if driver["id"] in away_by_id:
            on_leave.append({"name": label, "reason": away_by_id[driver["id"]]})
        elif driver["id"] in assigned_by_id:
            station = (assigned_by_id[driver["id"]].get("stations") or {}).get("name")
            already_scheduled.append({"name": label, "station": station})
        else:
            available.append(
                {
                    "name": label,
                    "employment_status": driver["status"],
                    "van_number": driver["van_number"],
                }
            )

    return {
        "status": "ok",
        "work_date": work_date,
        "weekday": day_column,
        "available": available,
        "on_leave": on_leave,
        "already_scheduled": already_scheduled,
        "note": (
            "Only drivers who marked this weekday as available are considered. "
            "Drivers who did not mark it do not appear in any group."
        ),
    }


GET_STAFFING_GAPS_TOOL = {
    "type": "function",
    "function": {
        "name": "get_staffing_gaps",
        "description": (
            "Compare how many drivers each station needs against how many are "
            "scheduled on a date. Use this when asked whether we are short, "
            "covered, over-staffed, or how many more drivers are needed. A "
            "positive `gap` means that many drivers are still needed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "work_date": {
                    "type": "string",
                    "description": "The date to check, YYYY-MM-DD.",
                },
            },
            "required": ["work_date"],
        },
    },
}


def run_get_staffing_gaps(user: CurrentUser, work_date: str) -> dict:
    supabase = user_client(user.token)

    requirements = (
        supabase.table("station_requirements")
        .select("da_count, okami, capacity, stations(name)")
        .eq("work_date", work_date)
        .execute()
    )

    if not requirements.data:
        return {
            "status": "week_not_created",
            "work_date": work_date,
            "message": (
                "No staffing requirements exist for that date, which usually "
                "means the week has not been generated in Master Schedule yet."
            ),
        }

    assigned = (
        supabase.table("schedule_assignments")
        .select("stations(name)")
        .eq("work_date", work_date)
        .neq("assignment_status", "Removed")
        .execute()
    )

    scheduled_per_station: dict[str, int] = {}
    for row in assigned.data:
        station = (row.get("stations") or {}).get("name") or "Unassigned"
        scheduled_per_station[station] = scheduled_per_station.get(station, 0) + 1

    stations = []
    for row in requirements.data:
        name = (row.get("stations") or {}).get("name") or "Unknown"
        needed = row.get("da_count") or 0
        scheduled = scheduled_per_station.get(name, 0)

        stations.append(
            {
                "station": name,
                "drivers_needed": needed,
                "drivers_scheduled": scheduled,
                "gap": needed - scheduled,
                "okami_spares": row.get("okami"),
                "capacity": row.get("capacity"),
            }
        )

    return {"status": "ok", "work_date": work_date, "stations": stations}
