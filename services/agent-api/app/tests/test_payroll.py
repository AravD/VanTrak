"""California overtime rules, proven."""

from datetime import date, timedelta
from decimal import Decimal as D

from app.services.payroll import (
    DayPay,
    PayrollSettings,
    RateRow,
    apply_weekly_overtime,
    compute_driver_week,
    flag_seventh_days,
    resolve_rate,
    split_day_hours,
)

SETTINGS = PayrollSettings(default_hourly_rate=D("20"))
WEEK_START = date(2026, 9, 6)


def make_days(hours_per_day):
    return [
        DayPay(work_date=WEEK_START + timedelta(days=offset), hours=D(str(hours)))
        for offset, hours in enumerate(hours_per_day)
    ]


def split_all(days):
    for day in days:
        (
            day.regular_hours,
            day.overtime_hours,
            day.doubletime_hours,
        ) = split_day_hours(day.hours, False, SETTINGS)
    return days


def test_short_day_is_all_regular():
    assert split_day_hours(D(6), False, SETTINGS) == (D(6), D(0), D(0))


def test_exactly_eight_hours_has_no_overtime():
    assert split_day_hours(D(8), False, SETTINGS) == (D(8), D(0), D(0))


def test_ten_hour_day_gets_two_hours_overtime():
    assert split_day_hours(D(10), False, SETTINGS) == (D(8), D(2), D(0))


def test_past_twelve_hours_becomes_doubletime():
    assert split_day_hours(D(13), False, SETTINGS) == (D(8), D(4), D(1))


def test_seventh_day_has_no_regular_time():
    assert split_day_hours(D(10), True, SETTINGS) == (D(0), D(8), D(2))


def test_seventh_day_flagged_only_after_seven_in_a_row():
    assert flag_seventh_days(make_days([8] * 7))[-1] is True


def test_day_off_resets_the_consecutive_streak():
    assert True not in flag_seventh_days(make_days([8, 8, 0, 8, 8, 8, 8]))


def test_weekly_rule_moves_hours_past_forty_into_overtime():
    days = split_all(make_days([8] * 6))  # 48 h, all straight time
    apply_weekly_overtime(days, SETTINGS)

    assert sum(day.regular_hours for day in days) == D(40)
    assert sum(day.overtime_hours for day in days) == D(8)


def test_daily_overtime_is_not_counted_again_weekly():
    # 4 x 10h = 40h -> 32 regular + 8 daily OT. Straight time is only 32,
    # so the weekly-40 rule must add nothing on top.
    week = compute_driver_week("d1", make_days([10] * 4), [], SETTINGS)

    assert week.regular_hours == D(32)
    assert week.overtime_hours == D(8)
    assert week.total_pay == D("880.00")  # 32*20 + 8*20*1.5


def test_full_seven_day_week_prices_the_seventh_day_correctly():
    week = compute_driver_week("d1", make_days([8] * 7), [], SETTINGS)

    # Days 1-6 are regular (48h), but the weekly rule pulls 8 back to OT,
    # and day 7 is entirely overtime under the 7th-day rule.
    assert week.doubletime_hours == D(0)
    assert week.regular_hours == D(40)
    assert week.overtime_hours == D(16)


def test_driver_override_beats_the_business_default():
    rates = [RateRow("d1", D("25"), effective_from=date(2026, 9, 1))]
    rate, multiplier = resolve_rate("d1", date(2026, 9, 8), rates, SETTINGS)

    assert rate == D("25")
    assert multiplier == D("1.5")


def test_rate_before_its_effective_date_falls_back_to_default():
    rates = [RateRow("d1", D("25"), effective_from=date(2026, 9, 1))]
    rate, _ = resolve_rate("d1", date(2026, 8, 20), rates, SETTINGS)

    assert rate == D("20")


def test_newest_effective_rate_wins():
    rates = [
        RateRow("d1", D("20"), effective_from=date(2026, 1, 1), effective_to=date(2026, 6, 1)),
        RateRow("d1", D("28"), effective_from=date(2026, 6, 1)),
    ]
    rate, _ = resolve_rate("d1", date(2026, 9, 8), rates, SETTINGS)

    assert rate == D("28")
