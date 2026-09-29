import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_nso_or_rbi
from app.models import PipelineJobRun
from app.schemas.pipeline import (
    PipelineCleanResponse,
    PipelineJobRunItem,
    PipelineJobStatsResponse,
)
from scrapers.registry import DEFAULT_SIMULATED_SOURCE_KEYS, get_simulated_scraper
from pipeline.cleaning import clean_fare_batch
from pipeline.outlier_detection import run_quality_pipeline
from pipeline.runner import get_job_run_stats

router = APIRouter(prefix="/api/pipeline", tags=["Data Cleaning Pipeline"])

simulated_scrapers = [get_simulated_scraper(source_key) for source_key in DEFAULT_SIMULATED_SOURCE_KEYS]

DEFAULT_ROUTES: List[Tuple[str, str]] = [("DEL", "BOM"), ("DEL", "BLR"), ("BOM", "BLR")]
DEFAULT_WINDOWS = [1, 7, 15, 30, 45]


def _scrape_batch(routes: List[Tuple[str, str]], windows: List[int]) -> List[Any]:
    today = datetime.date.today()
    raw: List[Any] = []
    for origin, dest in routes:
        for advance_days in windows:
            dep_date = (today + datetime.timedelta(days=advance_days)).isoformat()
            for scraper in simulated_scrapers:
                raw.extend(scraper.search(origin, dest, dep_date, advance_days))
    return raw


def _run_pipeline(raw_records: List[Any]) -> PipelineCleanResponse:
    scrape_date_str = datetime.date.today().isoformat()
    cleaned = clean_fare_batch(raw_records, default_scrape_date=scrape_date_str)
    processed, summary = run_quality_pipeline(cleaned)

    return PipelineCleanResponse(
        status="success",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        audit_summary=summary.to_dict(),
        cleaned_records=[r.to_dict() for r in processed],
    )


@router.get(
    "/clean",
    response_model=PipelineCleanResponse,
    summary="Run the real cleaning, de-duplication & IQR/Z-score outlier pipeline",
    description=(
        "Generates a demo batch from five deterministic simulated source fixtures "
        "and runs it through the same normalization, imputation (78/22 base/tax split), "
        "de-duplication and statistical outlier pipeline (pipeline/cleaning.py, "
        "pipeline/outlier_detection.py) used by the production ingestion runner. "
        "Requires NSO/RBI API key."
    ),
)
async def get_pipeline_clean(
    route: Optional[str] = Query(None, description="Restrict the demo batch to one corridor, e.g. DEL-BOM"),
    user=require_nso_or_rbi,
):
    routes = DEFAULT_ROUTES
    if route:
        parts = route.upper().strip().split("-")
        if len(parts) == 2:
            routes = [(parts[0], parts[1])]

    raw_records = _scrape_batch(routes, DEFAULT_WINDOWS)
    return _run_pipeline(raw_records)


@router.post(
    "/clean",
    response_model=PipelineCleanResponse,
    summary="Run the cleaning pipeline over supplied raw fare records",
    description=(
        "Accepts a batch of raw scrape payloads ({\"records\": [...]}) and runs them "
        "through the real cleaning/imputation/outlier pipeline. If no records are "
        "supplied, falls back to a deterministic simulated demo batch. Requires NSO/RBI API key."
    ),
)
async def post_pipeline_clean(
    body: Optional[Dict[str, Any]] = Body(default=None),
    user=require_nso_or_rbi,
):
    records = (body or {}).get("records")
    raw_records: List[Any] = records if records else _scrape_batch(DEFAULT_ROUTES, DEFAULT_WINDOWS)
    return _run_pipeline(raw_records)


@router.get(
    "/jobs",
    response_model=List[PipelineJobRunItem],
    summary="List recent scheduled scrape job runs",
    description=(
        "Returns the most recent entries from `pipeline_job_runs`, the audit log written "
        "by the scheduler (pipeline/scheduler.py) and cron entrypoint (pipeline/runner.py) "
        "for every scrape->clean->index cycle, per advance-purchase window. "
        "Requires NSO/RBI API key."
    ),
)
async def get_pipeline_jobs(
    limit: int = Query(50, ge=1, le=500),
    job_label: Optional[str] = Query(None, description="Filter to one window label, e.g. T+7"),
    user=require_nso_or_rbi,
    db: AsyncSession = Depends(get_db),
):
    query = select(PipelineJobRun).order_by(PipelineJobRun.started_at.desc()).limit(limit)
    if job_label:
        query = query.where(PipelineJobRun.job_label == job_label)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": row.id,
            "job_label": row.job_label,
            "windows": row.windows,
            "started_at": row.started_at.isoformat(),
            "finished_at": row.finished_at.isoformat() if row.finished_at else None,
            "duration_seconds": row.duration_seconds,
            "status": row.status,
            "total_scraped": row.total_scraped,
            "db_records_saved": row.db_records_saved,
            "error_message": row.error_message,
        }
        for row in rows
    ]


@router.get(
    "/jobs/stats",
    response_model=PipelineJobStatsResponse,
    summary="Daily scrape job success-rate metric",
    description=(
        "Aggregates `pipeline_job_runs` for a given day into the success/failure counts "
        "backing the >=95% successful scrape jobs/day reliability target. "
        "Requires NSO/RBI API key."
    ),
)
async def get_pipeline_job_stats(
    date: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD); defaults to today"),
    user=require_nso_or_rbi,
):
    return await get_job_run_stats(since_date=date)
