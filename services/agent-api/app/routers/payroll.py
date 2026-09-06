from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query # pyright: ignore[reportMissingImports]
from pydantic import BaseModel # pyright: ignore[reportMissingImports]

from ..auth import CurrentUser, get_current_user
from ..services.payroll_data import (
    add_rate,
    build_payroll_week,
    fetch_rates,
    fetch_settings,
    update_settings,
)

router = APIRouter(tags=["payroll"], prefix="/payroll")


class SettingsUpdate(BaseModel):
    default_hourly_rate: Decimal | None = None
    overtime_multiplier: Decimal | None = None
    doubletime_multiplier: Decimal | None = None
    daily_ot_threshold: Decimal | None = None
    daily_dt_threshold: Decimal | None = None
    weekly_ot_threshold: Decimal | None = None
    seventh_day_rule_enabled: bool | None = None
    minimum_wage_floor: Decimal | None = None


class NewRate(BaseModel):
    driver_id: str
    hourly_rate: Decimal
    effective_from: date
    overtime_multiplier: Decimal | None = None
    note: str | None = None


@router.get("/week")
def payroll_week(
    start: date = Query(..., description="Week start date (YYYY-MM-DD)"),
    user: CurrentUser = Depends(get_current_user),
):
    return build_payroll_week(user, start)


@router.get("/settings")
def payroll_settings(user: CurrentUser = Depends(get_current_user)):
    return fetch_settings(user)


@router.get("/rates")
def payroll_rates(user: CurrentUser = Depends(get_current_user)):
    return fetch_rates(user)


@router.put("/settings")
def save_payroll_settings(
    body: SettingsUpdate, user: CurrentUser = Depends(get_current_user)
):
    changes = {
        key: str(value) if isinstance(value, Decimal) else value
        for key, value in body.model_dump(exclude_unset=True).items()
    }

    current = fetch_settings(user)

    submitted_floor = changes.get("minimum_wage_floor")
    floor = (
        Decimal(submitted_floor)
        if submitted_floor is not None
        else current.minimum_wage_floor
    )

    submitted_rate = changes.get("default_hourly_rate")
    rate = (
        Decimal(submitted_rate)
        if submitted_rate is not None
        else current.default_hourly_rate
    )

    if floor is None or floor <= 0:
        raise HTTPException(
            status_code=400,
            detail="Set the minimum wage floor for your jurisdiction before saving a wage.",
        )

    if rate < floor:
        raise HTTPException(
            status_code=400,
            detail=f"Hourly rate cannot be below the minimum wage floor ({floor}).",
        )

    return update_settings(user, changes)


@router.post("/rates")
def create_payroll_rate(
    body: NewRate, user: CurrentUser = Depends(get_current_user)
):
    settings = fetch_settings(user)

    if settings.minimum_wage_floor is None or settings.minimum_wage_floor <= 0:
        raise HTTPException(
            status_code=400,
            detail="Set the minimum wage floor in Manage wages before assigning custom rates.",
        )

    if body.hourly_rate < settings.minimum_wage_floor:
        raise HTTPException(
            status_code=400,
            detail=f"Rate cannot be below the minimum wage floor ({settings.minimum_wage_floor}).",
        )

    return add_rate(
        user,
        driver_id=body.driver_id,
        hourly_rate=body.hourly_rate,
        effective_from=body.effective_from,
        overtime_multiplier=body.overtime_multiplier,
        note=body.note,
    )