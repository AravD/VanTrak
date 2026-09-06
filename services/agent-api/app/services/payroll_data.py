"""Data access for payroll.

Reads Supabase and converts rows into the plain values the pure engine in
payroll.py expects. Kept separate so payroll.py stays free of any database
dependency and remains trivially unit-testable.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from ..supabase_client import user_client
from .payroll import ZERO, DayPay, PayrollSettings, RateRow, compute_driver_week


def to_decimal(value):
    return None if value is None else Decimal(value)

def to_date(value):
    return None if value is None else date.fromisoformat(value)

def fetch_settings(user):
    supabase = user_client(user.token)
    result = supabase.table("payroll_settings").select("*").limit(1).execute()

    if not result.data:
        return PayrollSettings()

    row = result.data[0]
    return PayrollSettings(
        default_hourly_rate=Decimal(row["default_hourly_rate"]),
        overtime_multiplier=Decimal(row["overtime_multiplier"]),
        doubletime_multiplier=Decimal(row["doubletime_multiplier"]),
        daily_ot_threshold=Decimal(row["daily_ot_threshold"]),
        daily_dt_threshold=Decimal(row["daily_dt_threshold"]),
        weekly_ot_threshold=Decimal(row["weekly_ot_threshold"]),
        seventh_day_rule_enabled=row["seventh_day_rule_enabled"],
        minimum_wage_floor=to_decimal(row["minimum_wage_floor"]),
    )


def fetch_rates(user):
    """Every effective-dated rate override for this business."""
    supabase = user_client(user.token)
    result = (
        supabase.table("driver_pay_rates")
        .select("driver_id, hourly_rate, overtime_multiplier, effective_from, effective_to, note")
        .execute()
    )

    return [
        RateRow(
            driver_id=row["driver_id"],
            hourly_rate=Decimal(row["hourly_rate"]),
            effective_from=date.fromisoformat(row["effective_from"]),
            effective_to=to_date(row["effective_to"]),
            overtime_multiplier=to_decimal(row["overtime_multiplier"]),
            note=row.get("note"),
        )
        for row in result.data
    ]


def fetch_week_hours(user, week_start, week_end):
    """Hours per driver for the week, plus days that are missing a clock-out."""
    supabase = user_client(user.token)
    result = (
        supabase.table("daily_roll_call")
        .select("driver_id, report_date, total_hours_worked")
        .gte("report_date", week_start.isoformat())
        .lte("report_date", week_end.isoformat())
        .order("report_date")
        .execute()
    )

    hours_by_driver = defaultdict(list)
    missing_clock_outs = []

    for row in result.data:
        driver_id = row["driver_id"]
        if driver_id is None:
            continue

        work_date = date.fromisoformat(row["report_date"])
        hours = to_decimal(row["total_hours_worked"])

        if hours is None:
            missing_clock_outs.append((driver_id, work_date))

        hours_by_driver[driver_id].append(
            DayPay(work_date=work_date, hours=hours or ZERO)
        )

    return hours_by_driver, missing_clock_outs

def current_business_id(user):
    supabase = user_client(user.token)
    result = supabase.table("business_members").select("business_id").limit(1).execute()

    if not result.data:
        raise ValueError("User is not a member of any business")

    return result.data[0]["business_id"]


def update_settings(user, changes):
    supabase = user_client(user.token)
    business_id = current_business_id(user)

    supabase.table("payroll_settings").update(changes).eq(
        "business_id", business_id
    ).execute()

    return fetch_settings(user)


def add_rate(user, driver_id, hourly_rate, effective_from, overtime_multiplier, note):
    supabase = user_client(user.token)
    business_id = current_business_id(user)

    supabase.table("driver_pay_rates").update(
        {"effective_to": effective_from.isoformat()}
    ).eq("driver_id", driver_id).is_("effective_to", "null").execute()

    result = supabase.table("driver_pay_rates").insert(
        {
            "business_id": business_id,
            "driver_id": driver_id,
            "hourly_rate": str(hourly_rate),
            "overtime_multiplier": None
            if overtime_multiplier is None
            else str(overtime_multiplier),
            "effective_from": effective_from.isoformat(),
            "note": note,
        }
    ).execute()

    return result.data[0] if result.data else None


def fetch_driver_names(user):
    supabase = user_client(user.token)
    result = supabase.table("drivers").select("id, first_name, last_name").execute()

    return {
        row["id"]: f"{row['first_name']} {row['last_name']}".strip()
        for row in result.data
    }


def build_payroll_week(user, week_start):
    """Fetch everything, run the engine, shape the response for the UI."""
    week_end = week_start + timedelta(days=6)

    settings = fetch_settings(user)
    rate_rows = fetch_rates(user)
    names = fetch_driver_names(user)
    hours_by_driver, missing_clock_outs = fetch_week_hours(user, week_start, week_end)

    driver_weeks = [
        compute_driver_week(driver_id, days, rate_rows, settings)
        for driver_id, days in hours_by_driver.items()
    ]

    totals_by_date = {week_start + timedelta(days=n): [ZERO, ZERO] for n in range(7)}

    for week in driver_weeks:
        for entry in week.days:
            if entry.work_date in totals_by_date:
                totals_by_date[entry.work_date][0] += (
                    entry.regular_hours + entry.overtime_hours + entry.doubletime_hours
                )
                totals_by_date[entry.work_date][1] += entry.total_pay

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "days": [
            {"date": day.isoformat(), "hours": str(hours), "pay": str(pay)}
            for day, (hours, pay) in totals_by_date.items()
        ],
        "drivers": [
            {
                "driver_id": week.driver_id,
                "name": names.get(week.driver_id, "Unknown"),
                "regular_hours": str(week.regular_hours),
                "overtime_hours": str(week.overtime_hours),
                "doubletime_hours": str(week.doubletime_hours),
                "hourly_rate": str(week.days[-1].hourly_rate) if week.days else "0",
                "regular_pay": str(week.regular_pay),
                "overtime_pay": str(week.overtime_pay),
                "doubletime_pay": str(week.doubletime_pay),
                "total_pay": str(week.total_pay),
                "days": [
                    {
                        "date": day.work_date.isoformat(),
                        "hours": str(day.hours),
                        "regular_hours": str(day.regular_hours),
                        "overtime_hours": str(day.overtime_hours),
                        "doubletime_hours": str(day.doubletime_hours),
                        "hourly_rate": str(day.hourly_rate),
                        "regular_pay": str(day.regular_pay),
                        "overtime_pay": str(day.overtime_pay),
                        "doubletime_pay": str(day.doubletime_pay),
                        "total_pay": str(day.total_pay),
                    }
                    for day in week.days
                ],
            }
            for week in sorted(driver_weeks, key=lambda w: names.get(w.driver_id, ""))
        ],
        "total_pay": str(sum((week.total_pay for week in driver_weeks), ZERO)),
        "rates": {
            "default_hourly_rate": str(settings.default_hourly_rate),
            "overtime_multiplier": str(settings.overtime_multiplier),
            "doubletime_multiplier": str(settings.doubletime_multiplier),
            "minimum_wage_floor": (
                None
                if settings.minimum_wage_floor is None
                else str(settings.minimum_wage_floor)
            ),
            "custom_rate_drivers": len({row.driver_id for row in rate_rows}),
        },
        "exceptions": [
            {"driver_id": driver_id, "date": day.isoformat(), "issue": "missing clock-out"}
            for driver_id, day in missing_clock_outs
        ],
    }
