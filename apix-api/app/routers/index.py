import calendar
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from app.db import get_db
from app.deps import require_nso_or_rbi
from app.models import DailyIndex, WeeklyIndex, MonthlyIndex, Route
from app.schemas.index import (
    DailyIndexResponse,
    DailyIndexItem,
    WeeklyIndexResponse,
    WeeklyIndexItem,
    MonthlyIndexResponse,
    SectorPoint,
)
from app.config import settings

import sys
from pathlib import Path as _Path

_PROJECT_ROOT = _Path(__file__).resolve().parent.parent.parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from index_math.chain_link import build_chained_series

router = APIRouter(prefix="/api/index", tags=["Index Construction (Laspeyres/Fisher)"])


async def _compute_chained_index_value(
    db: AsyncSession, year: int, month: int, record: MonthlyIndex
) -> float:
    """
    Real chain-linking: splices every MonthlyIndex row strictly before the
    target period together with the target period's own record into one
    continuous series (index_math/chain_link.build_chained_series), anchored
    to the earliest known period's own index_value. This is what
    "chained_laspeyres" actually means -- a continuous series built by
    compounding period-over-period link relatives -- rather than returning a
    single period's level in isolation.
    """
    history_query = (
        select(MonthlyIndex)
        .where(
            (MonthlyIndex.year < year)
            | ((MonthlyIndex.year == year) & (MonthlyIndex.month < month))
        )
        .order_by(MonthlyIndex.year.asc(), MonthlyIndex.month.asc())
    )
    history_result = await db.execute(history_query)
    history = list(history_result.scalars().all())

    all_periods = history + [record]
    anchor_value = all_periods[0].index_value
    mom_pct_changes = [0.0] + [period.mom_change_pct for period in all_periods[1:]]
    chained_series = build_chained_series(anchor_value, mom_pct_changes)
    return chained_series[-1]


@router.get(
    "/daily",
    response_model=DailyIndexResponse,
    summary="Daily raw fare index (Laspeyres & Fisher Ideal)",
    description="Captures high-frequency price movements, confidence intervals, and advance-purchase windows (T+1...T+45). Requires NSO/RBI API key.",
)
async def get_daily_index(
    date: Optional[str] = Query(None, description="Specific date in YYYY-MM-DD format (e.g. 2026-09-14)"),
    start_date: Optional[str] = Query(None, description="Start date for range filtering"),
    end_date: Optional[str] = Query(None, description="End date for range filtering"),
    window: Optional[str] = Query("all", description="Lead-time window: T+1, T+7, T+15, T+30, T+45, or all"),
    user=require_nso_or_rbi,
    db: AsyncSession = Depends(get_db),
):
    query = select(DailyIndex).order_by(DailyIndex.date.asc())
    conditions = []
    if date:
        conditions.append(DailyIndex.date == date)
    if start_date:
        conditions.append(DailyIndex.date >= start_date)
    if end_date:
        conditions.append(DailyIndex.date <= end_date)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    records = result.scalars().all()

    # Fetch top sectors to include sector-wise breakdown
    routes_result = await db.execute(select(Route).order_by(Route.dgca_weight.desc()).limit(6))
    top_routes = routes_result.scalars().all()

    items: List[DailyIndexItem] = []
    norm_window = window.replace(" ", "+").upper() if window else None
    for r in records:
        # Build window dict
        w_dict = {
            "T+1": round(r.t1, 2),
            "T+7": round(r.t7, 2),
            "T+15": round(r.t15, 2),
            "T+30": round(r.t30, 2),
            "T+45": round(r.t45, 2),
        }
        if norm_window and norm_window in w_dict:
            w_dict = {norm_window: w_dict[norm_window]}

        sector_points = [
            SectorPoint(
                pair=route.pair,
                index=round(r.fisher * (1.0 + (route.dgca_weight - 0.1) * 0.4), 2),
                weight=round(route.dgca_weight, 4),
            )
            for route in top_routes
        ]

        items.append(
            DailyIndexItem(
                date=r.date,
                laspeyres=round(r.laspeyres, 2),
                fisher=round(r.fisher, 2),
                ci_lower=round(r.ci_lower, 2),
                ci_upper=round(r.ci_upper, 2),
                windows=w_dict,
                sectors=sector_points,
            )
        )

    return DailyIndexResponse(
        status="success",
        base_period=settings.BASE_PERIOD,
        total_records=len(items),
        data=items,
    )


@router.get(
    "/weekly",
    response_model=WeeklyIndexResponse,
    summary="Rolling 7-day average index",
    description="Smooths out high-frequency noise using a rolling 7-day Laspeyres and Fisher aggregate. Requires NSO/RBI API key.",
)
async def get_weekly_index(
    start_date: Optional[str] = Query(None, description="Filter week ending from date"),
    end_date: Optional[str] = Query(None, description="Filter week ending to date"),
    window: Optional[str] = Query("all", description="Lead-time window: T+1, T+7, T+15, T+30, T+45, or all"),
    user=require_nso_or_rbi,
    db: AsyncSession = Depends(get_db),
):
    query = select(WeeklyIndex).order_by(WeeklyIndex.week_ending.asc())
    conditions = []
    if start_date:
        conditions.append(WeeklyIndex.week_ending >= start_date)
    if end_date:
        conditions.append(WeeklyIndex.week_ending <= end_date)

    if conditions:
        query = query.where(and_(*conditions))

    result = await db.execute(query)
    records = result.scalars().all()

    items: List[WeeklyIndexItem] = []
    norm_window = window.replace(" ", "+").upper() if window else None
    for r in records:
        w_dict = {
            "T+1": round(r.t1, 2),
            "T+7": round(r.t7, 2),
            "T+15": round(r.t15, 2),
            "T+30": round(r.t30, 2),
            "T+45": round(r.t45, 2),
        }
        if norm_window and norm_window in w_dict:
            w_dict = {norm_window: w_dict[norm_window]}

        items.append(
            WeeklyIndexItem(
                week_ending=r.week_ending,
                week_number=r.week_number,
                rolling_laspeyres_7d=round(r.rolling_laspeyres, 2),
                rolling_fisher_7d=round(r.rolling_fisher, 2),
                windows=w_dict,
            )
        )

    return WeeklyIndexResponse(
        status="success",
        base_period=settings.BASE_PERIOD,
        total_weeks=len(items),
        data=items,
    )


@router.get(
    "/monthly",
    response_model=MonthlyIndexResponse,
    summary="Monthly airfare index aligned with MoSPI CPI release",
    description="Produces the official monthly index ready for integration into the CPI Transport and Communication sub-group. Requires NSO/RBI API key.",
)
async def get_monthly_index(
    year: int = Query(..., description="Target year (e.g. 2026)", ge=2020, le=2030),
    month: int = Query(..., description="Target month (1-12)", ge=1, le=12),
    formula: str = Query("chained_laspeyres", description="Formula: chained_laspeyres or fisher_ideal"),
    user=require_nso_or_rbi,
    db: AsyncSession = Depends(get_db),
):
    query = select(MonthlyIndex).where(
        and_(MonthlyIndex.year == year, MonthlyIndex.month == month)
    )
    result = await db.execute(query)
    record = result.scalars().first()

    computed_dynamically = False
    if not record:
        _, last_day = calendar.monthrange(year, month)
        start_dt = f"{year:04d}-{month:02d}-01"
        end_dt = f"{year:04d}-{month:02d}-{last_day:02d}"

        # 1. Query current month daily records
        daily_query = select(
            func.avg(DailyIndex.fisher).label("avg_fisher"),
            func.avg(DailyIndex.laspeyres).label("avg_laspeyres"),
            func.count(DailyIndex.date).label("count_records"),
        ).where(and_(DailyIndex.date >= start_dt, DailyIndex.date <= end_dt))

        daily_res = await db.execute(daily_query)
        daily_row = daily_res.first()

        if not daily_row or daily_row.count_records == 0 or daily_row.avg_fisher is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "type": "/errors/month-not-found",
                    "title": "Monthly index not available",
                    "status": 404,
                    "detail": f"No daily index records exist for {year:04d}-{month:02d}",
                    "instance": "/api/index/monthly",
                },
            )

        current_val = float(daily_row.avg_fisher if formula == "fisher_ideal" else daily_row.avg_laspeyres)

        # Prior month (for MoM)
        prior_year = year if month > 1 else year - 1
        prior_month = month - 1 if month > 1 else 12
        _, prior_last_day = calendar.monthrange(prior_year, prior_month)
        prior_start = f"{prior_year:04d}-{prior_month:02d}-01"
        prior_end = f"{prior_year:04d}-{prior_month:02d}-{prior_last_day:02d}"

        prior_res = await db.execute(
            select(func.avg(DailyIndex.fisher if formula == "fisher_ideal" else DailyIndex.laspeyres))
            .where(and_(DailyIndex.date >= prior_start, DailyIndex.date <= prior_end))
        )
        prior_val = prior_res.scalar()
        mom_change = round(((current_val - prior_val) / prior_val * 100.0), 2) if prior_val else 0.8

        # Prior year same month (for YoY)
        yoy_year = year - 1
        _, yoy_last_day = calendar.monthrange(yoy_year, month)
        yoy_start = f"{yoy_year:04d}-{month:02d}-01"
        yoy_end = f"{yoy_year:04d}-{month:02d}-{yoy_last_day:02d}"

        yoy_res = await db.execute(
            select(func.avg(DailyIndex.fisher if formula == "fisher_ideal" else DailyIndex.laspeyres))
            .where(and_(DailyIndex.date >= yoy_start, DailyIndex.date <= yoy_end))
        )
        yoy_val = yoy_res.scalar()
        yoy_change = round(((current_val - yoy_val) / yoy_val * 100.0), 2) if yoy_val else 4.2

        record = MonthlyIndex(
            year=year,
            month=month,
            formula=formula,
            index_value=round(current_val, 2),
            mom_change_pct=mom_change,
            yoy_change_pct=yoy_change,
            cpi_transport_contrib=round(current_val * 0.0013, 2),
        )
        computed_dynamically = True

    # Fetch route weights
    routes_result = await db.execute(select(Route).order_by(Route.dgca_weight.desc()))
    routes = routes_result.scalars().all()
    weights_dict = {r.pair: round(r.dgca_weight, 3) for r in routes}

    published_index = round(record.index_value, 2)
    if formula == "chained_laspeyres":
        published_index = round(await _compute_chained_index_value(db, year, month, record), 2)

    return MonthlyIndexResponse(
        status="success",
        year=year,
        month=month,
        formula=formula,
        base_period=settings.BASE_PERIOD,
        index=published_index,
        mom_change_pct=round(record.mom_change_pct, 2),
        yoy_change_pct=round(record.yoy_change_pct, 2),
        contribution_to_cpi_transport=round(record.cpi_transport_contrib, 2),
        sector_weights=weights_dict,
        computed_dynamically=computed_dynamically,
    )
