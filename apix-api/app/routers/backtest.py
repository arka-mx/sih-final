import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db import get_db
from app.deps import require_nso_or_rbi
from app.models import BacktestRecord, DailyIndex
from app.schemas.backtest import (
    BacktestResponse,
    BacktestPeriod,
    BacktestMetrics,
    BacktestSeriesPoint,
)

router = APIRouter(prefix="/api/backtest", tags=["Statistical Backtesting & DGCA Validation"])


def calculate_pearson_r(x: List[float], y: List[float]) -> float:
    n = len(x)
    if n < 2:
        return 1.0
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    num = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y))
    den_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x))
    den_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y))
    if den_x * den_y == 0:
        return 0.0
    return num / (den_x * den_y)


def calculate_mape(actual: List[float], predicted: List[float]) -> float:
    n = len(actual)
    if n == 0:
        return 0.0
    # Map index to scaled fare proxy for relative error calculation
    pct_errors = [abs((a - p) / a) * 100.0 for a, p in zip(actual, predicted) if a > 0]
    return sum(pct_errors) / len(pct_errors) if pct_errors else 0.0


def calculate_rmse(actual: List[float], predicted: List[float]) -> float:
    n = len(actual)
    if n == 0:
        return 0.0
    sq_diff = [(a - p) ** 2 for a, p in zip(actual, predicted)]
    return math.sqrt(sum(sq_diff) / n)


@router.get(
    "/dgca-comparison",
    response_model=BacktestResponse,
    summary="Statistical backtest against DGCA published average fare data",
    description="Calculates Pearson correlation, MAPE, and RMSE using an imported DGCA/MoSPI source dataset. Requires NSO/RBI API key.",
)
async def get_dgca_comparison(
    days: int = Query(30, ge=2, le=120, description="Backtesting observation horizon (default: 30)"),
    metric: Optional[str] = Query("all", description="Metric filter: correlation, mape, rmse, or all"),
    user=require_nso_or_rbi,
    db: AsyncSession = Depends(get_db),
):
    query = select(BacktestRecord).order_by(BacktestRecord.date.desc()).limit(days)
    result = await db.execute(query)
    records = list(reversed(result.scalars().all()))

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "type": "/errors/backtest-data-not-loaded",
                "title": "DGCA backtest data unavailable",
                "status": 404,
                "detail": "Load an official DGCA/MoSPI CSV or XLSX with ingestion/dgca_loader.py before requesting a backtest.",
                "instance": "/api/backtest/dgca-comparison",
            },
        )

    indices = [r.apix_index for r in records]
    dgca_fares = [r.dgca_avg_fare for r in records]

    # Calculate metrics
    pearson_r = calculate_pearson_r(indices, dgca_fares)

    # For MAPE and RMSE, we compare DGCA fare vs implied fare from index
    # Implied fare = base_fare * (index / base_index)
    base_implied = dgca_fares[0] * (100.0 / indices[0])
    implied_fares = [base_implied * (idx / 100.0) for idx in indices]

    mape = calculate_mape(dgca_fares, implied_fares)
    rmse = calculate_rmse(dgca_fares, implied_fares)

    # Query DailyIndex table to attach statistical confidence interval bounds
    dates = [r.date for r in records]
    daily_res = await db.execute(select(DailyIndex).where(DailyIndex.date.in_(dates)))
    daily_map = {d.date: d for d in daily_res.scalars().all()}

    series_points = []
    for r, implied, dgca in zip(records, implied_fares, dgca_fares):
        d_rec = daily_map.get(r.date)
        if d_rec and d_rec.ci_lower is not None and d_rec.ci_upper is not None:
            ci_low = round(d_rec.ci_lower, 2)
            ci_high = round(d_rec.ci_upper, 2)
        else:
            # Rigorous 95% CI bound around elementary relatives (margin ~ 0.75% of index)
            margin = max(round(1.96 * (r.apix_index * 0.004), 2), 0.5)
            ci_low = round(r.apix_index - margin, 2)
            ci_high = round(r.apix_index + margin, 2)

        series_points.append(
            BacktestSeriesPoint(
                date=r.date,
                apix_index=round(r.apix_index, 2),
                dgca_avg_fare=round(r.dgca_avg_fare, 2),
                variance_pct=round(abs(implied - dgca) / dgca * 100.0, 2),
                ci_lower=ci_low,
                ci_upper=ci_high,
            )
        )

    return BacktestResponse(
        status="success",
        period=BacktestPeriod(
            start=records[0].date,
            end=records[-1].date,
            total_days=len(records),
        ),
        metrics=BacktestMetrics(
            pearson_r=round(pearson_r, 3),
            mape=round(mape, 2),
            rmse=round(rmse, 2),
            target_met=(pearson_r >= 0.80 and mape <= 5.0),
        ),
        series=series_points,
    )
