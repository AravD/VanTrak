"""California payroll engine.

Pure calculation only — nothing here touches the database. Callers fetch rows
and hand plain values in, which is what makes every rule below unit-testable.

Estimation of gross labor cost. Paycom remains the system of record.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

ZERO = Decimal("0")
CENTS = Decimal("0.01")


@dataclass(frozen=True)
class PayrollSettings:
    default_hourly_rate: Decimal = Decimal("0")
    overtime_multiplier: Decimal = Decimal("1.5")
    doubletime_multiplier: Decimal = Decimal("2.0")
    daily_ot_threshold: Decimal = Decimal("8")
    daily_dt_threshold: Decimal = Decimal("12")
    weekly_ot_threshold: Decimal = Decimal("40")
    seventh_day_rule_enabled: bool = True
    minimum_wage_floor: Decimal | None = None


@dataclass(frozen=True)
class RateRow:
    driver_id: str
    hourly_rate: Decimal
    effective_from: date
    effective_to: date | None = None
    overtime_multiplier: Decimal | None = None
    note: str | None = None


@dataclass
class DayPay:
    work_date: date
    hours: Decimal
    regular_hours: Decimal = ZERO
    overtime_hours: Decimal = ZERO
    doubletime_hours: Decimal = ZERO
    hourly_rate: Decimal = ZERO
    regular_pay: Decimal = ZERO
    overtime_pay: Decimal = ZERO
    doubletime_pay: Decimal = ZERO
    total_pay: Decimal = ZERO


@dataclass
class DriverWeekPay:
    driver_id: str
    days: list[DayPay]
    regular_hours: Decimal
    overtime_hours: Decimal
    doubletime_hours: Decimal
    regular_pay: Decimal
    overtime_pay: Decimal
    doubletime_pay: Decimal
    total_pay: Decimal


def to_money(amount):
    """Round to cents, half-up, the way payroll is expected to round."""
    return amount.quantize(CENTS, rounding=ROUND_HALF_UP)


def split_day_hours(hours, is_seventh_day, settings):
    """Split one day's hours into (regular, overtime, doubletime)."""
    worked_hours = max(Decimal(hours), ZERO)
    overtime_starts_at = settings.daily_ot_threshold
    doubletime_starts_at = settings.daily_dt_threshold

    if is_seventh_day and settings.seventh_day_rule_enabled:
        overtime_starts_at, doubletime_starts_at = ZERO, overtime_starts_at

    hours_past_regular = max(worked_hours - overtime_starts_at, ZERO)
    overtime_band_size = doubletime_starts_at - overtime_starts_at

    regular_hours = min(worked_hours, overtime_starts_at)
    overtime_hours = min(hours_past_regular, overtime_band_size)
    doubletime_hours = max(worked_hours - doubletime_starts_at, ZERO)

    return regular_hours, overtime_hours, doubletime_hours


def flag_seventh_days(days):
    """Which days are the 7th consecutive worked day. A day off resets the streak."""
    flags = []
    consecutive_worked = 0

    for day in days:
        consecutive_worked = consecutive_worked + 1 if day.hours > ZERO else 0
        flags.append(consecutive_worked >= 7)

    return flags


def apply_weekly_overtime(days, settings):
    """Move straight-time hours beyond the weekly threshold into overtime.

    Only regular hours count toward the 40 — hours already paid as daily
    overtime must not be counted twice. The latest hours in the week are the
    ones that pushed past the threshold, so they convert first.
    """
    straight_time = sum((day.regular_hours for day in days), ZERO)
    hours_over_threshold = straight_time - settings.weekly_ot_threshold

    if hours_over_threshold <= ZERO:
        return

    for day in reversed(days):
        if hours_over_threshold <= ZERO:
            break
        moved = min(day.regular_hours, hours_over_threshold)
        day.regular_hours -= moved
        day.overtime_hours += moved
        hours_over_threshold -= moved


def resolve_rate(driver_id, on_date, rate_rows, settings):
    """The (hourly_rate, overtime_multiplier) in effect for a driver on a date."""
    active_rows = [
        row
        for row in rate_rows
        if row.driver_id == driver_id
        and row.effective_from <= on_date
        and (row.effective_to is None or on_date < row.effective_to)
    ]

    if not active_rows:
        return settings.default_hourly_rate, settings.overtime_multiplier

    newest = max(active_rows, key=lambda row: row.effective_from)
    multiplier = (
        settings.overtime_multiplier
        if newest.overtime_multiplier is None
        else newest.overtime_multiplier
    )
    return newest.hourly_rate, multiplier


def compute_driver_week(driver_id, days, rate_rows, settings):
    """Compute one driver's full week: hours split by rule, then priced."""
    days = sorted(days, key=lambda day: day.work_date)

    for day, is_seventh_day in zip(days, flag_seventh_days(days)):
        (
            day.regular_hours,
            day.overtime_hours,
            day.doubletime_hours,
        ) = split_day_hours(day.hours, is_seventh_day, settings)

    apply_weekly_overtime(days, settings)

    for day in days:
        rate, overtime_multiplier = resolve_rate(
            driver_id, day.work_date, rate_rows, settings
        )
        day.hourly_rate = rate
        day.regular_pay = to_money(day.regular_hours * rate)
        day.overtime_pay = to_money(day.overtime_hours * rate * overtime_multiplier)
        day.doubletime_pay = to_money(
            day.doubletime_hours * rate * settings.doubletime_multiplier
        )
        day.total_pay = day.regular_pay + day.overtime_pay + day.doubletime_pay

    def total(attribute):
        return sum((getattr(day, attribute) for day in days), ZERO)

    return DriverWeekPay(
        driver_id=driver_id,
        days=days,
        regular_hours=total("regular_hours"),
        overtime_hours=total("overtime_hours"),
        doubletime_hours=total("doubletime_hours"),
        regular_pay=total("regular_pay"),
        overtime_pay=total("overtime_pay"),
        doubletime_pay=total("doubletime_pay"),
        total_pay=total("total_pay"),
    )
