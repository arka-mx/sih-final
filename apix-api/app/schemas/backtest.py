from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class BacktestPeriod(BaseModel):
    start: str = Field(..., examples=["2026-06-01"])
    end: str = Field(..., examples=["2026-08-31"])
    total_days: int = Field(..., examples=[30])


class BacktestSeriesPoint(BaseModel):
    date: str = Field(..., examples=["2026-08-15"])
    apix_index: float = Field(..., examples=[98.2])
    dgca_avg_fare: float = Field(..., examples=[4380.0])
    variance_pct: float = Field(..., examples=[0.91])
    ci_lower: Optional[float] = Field(None, examples=[97.40], description="Lower bound of 95% confidence interval")
    ci_upper: Optional[float] = Field(None, examples=[99.00], description="Upper bound of 95% confidence interval")


class BacktestMetrics(BaseModel):
    pearson_r: float = Field(
        ..., examples=[0.892], description="Pearson correlation coefficient against DGCA official benchmark (target >= 0.80)"
    )
    mape: float = Field(
        ..., examples=[3.12], description="Mean Absolute Percentage Error in % (target < 5.0%)"
    )
    rmse: float = Field(
        ..., examples=[142.50], description="Root Mean Square Error in index points"
    )
    target_met: bool = Field(default=True, examples=[True])


class BacktestResponse(BaseModel):
    status: str = "success"
    period: BacktestPeriod
    metrics: BacktestMetrics
    series: List[BacktestSeriesPoint]
    methodology_note: str = Field(
        default="APIx index normalized to 2025-01-01=100 using DGCA traffic-weighted Fisher Ideal formula. Ground-truth benchmark pulled from DGCA domestic scheduled operations statistics."
    )
