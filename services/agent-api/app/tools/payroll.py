"""Agent tool for payroll — labour cost for a week.

Payroll tables are permission-gated (payroll.view / payroll.manage). RLS would
silently return no rows to someone without access, which the engine would then
report as zeros — a wrong answer that looks like a real one. So this tool checks
access explicitly and refuses instead.
"""

from datetime import date, timedelta

from ..auth import CurrentUser
from ..services.payroll_data import build_payroll_week
from ..supabase_client import user_client

PAYROLL_PERMISSIONS = ("*", "payroll.view", "payroll.manage")


def _may_view_payroll(user: CurrentUser) -> bool:
    supabase = user_client(user.token)
    result = supabase.table("business_members").select("permissions").limit(1).execute()

    if not result.data:
        return False

    granted = result.data[0].get("permissions") or []
    return any(permission in granted for permission in PAYROLL_PERMISSIONS)


def _week_start_for(day: str) -> date:
    """The Sunday that starts the week containing `day`."""
    parsed = date.fromisoformat(day)
    return parsed - timedelta(days=(parsed.weekday() + 1) % 7)


GET_PAYROLL_WEEK_TOOL = {
    "type": "function",
    "function": {
        "name": "get_payroll_week",
        "description": (
            "Get estimated labour cost for the week containing a date: totals "
            "per day, per driver regular/overtime/double-time hours and pay, and "
            "any data problems. Use this for questions about labour cost, wages, "
            "payroll, or who worked overtime. These are gross estimates, not "
            "official payroll. If `status` is 'forbidden', tell the user they do "
            "not have permission to view payroll — do not report zeros."
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


def run_get_payroll_week(user: CurrentUser, week_start: str) -> dict:
    if not _may_view_payroll(user):
        return {
            "status": "forbidden",
            "message": (
                "This user does not have permission to view payroll. Say so "
                "plainly; do not report any figures."
            ),
        }

    week = build_payroll_week(user, _week_start_for(week_start))
    return {"status": "ok", **week}
