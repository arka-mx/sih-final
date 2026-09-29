import sys
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import DailyIndex
from app.schemas.anomalies import AnomalyResponse

# Ensure the repo-root `pipeline` package (the anomaly rules engine, shared
# with the scheduled index job in pipeline/runner.py) is importable regardless
# of process cwd, matching the pattern already used by app/db.py for index_math.
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.anomaly_tagger import run_anomaly_tagger

router = APIRouter(prefix="/api/public", tags=["Open Data / Public Transparency"])


@router.get(
    "/anomalies",
    response_model=AnomalyResponse,
    summary="Automated fare-index spike detection & cause tagging",
    description=(
        "Detects statistically significant day-over-day spikes in the daily Fisher index using the "
        "IQR/Z-score method (pipeline/outlier_detection.py) and cross-references each spike against a "
        "static Indian festival calendar and a manually-curated ATF fuel-price series to tag likely causes "
        "(pipeline/anomaly_tagger.py). Cause tags are rule-based hypotheses, not confirmed causation. "
        "No API key required."
    ),
)
async def get_index_anomalies(
    days: int = Query(90, ge=5, le=365, description="Lookback window in days"),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(DailyIndex.date, DailyIndex.fisher)
        .order_by(DailyIndex.date.desc())
        .limit(days)
    )
    result = await db.execute(query)
    rows = list(reversed(result.all()))
    series = [(row.date, float(row.fisher)) for row in rows]

    report = run_anomaly_tagger(series)
    return {"status": "success", **report.to_dict()}
