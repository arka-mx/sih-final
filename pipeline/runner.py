"""Scheduled fixture pipeline backed exclusively by the API SQLAlchemy store."""

import asyncio
import datetime
import json
import logging
import os
import sys
import time
import traceback
import uuid
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_ROOT = PROJECT_ROOT / "apix-api"
for path in (PROJECT_ROOT, API_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

# Windows' default ProactorEventLoop tears down asyncpg's SSL transport
# asynchronously; a second top-level asyncio.run() call later in the same
# process (this module makes two per cycle: one for persist_pipeline_outputs,
# one for _record_job_run) can then race a pending SSL callback against an
# already-closed loop and raise "RuntimeError: Event loop is closed". The
# selector loop doesn't have this asyncpg/Proactor interaction.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.db import AsyncSessionLocal, engine, init_db
from app.models import DailyIndex, Fare, PipelineJobRun
from index_math.engine import BASE_PERIOD_ROUTE_FARES, compute_daily_aggregate_indices
from index_math.weights import DGCA_ROUTE_TRAFFIC_SHARE
from pipeline.cleaning import clean_fare_batch
from pipeline.dark_pattern_detector import run_dark_pattern_detector
from pipeline.decompose import decompose_matched_flights
from pipeline.outlier_detection import run_quality_pipeline
from pipeline.rollup import persist_weekly_rollup
from pipeline.schema import CleanedFareRecord
from scrapers.amadeus_fare_scraper import get_amadeus_scraper_if_configured
from scrapers.base import FailureClassification
from scrapers.health_check import run_all_health_checks
from scrapers.models import RawFareRecord
from scrapers.registry import DEFAULT_SIMULATED_SOURCE_KEYS, get_simulated_scraper

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("APIx.PipelineRunner")

DEFAULT_ROUTES = [tuple(pair.split("-")) for pair in DGCA_ROUTE_TRAFFIC_SHARE]
DEFAULT_WINDOWS = [1, 7, 15, 30, 45]

# Resilience knobs backing the PRD's "≥95% successful scrape jobs/day" target.
SCRAPE_MAX_RETRIES = 3
SCRAPE_BACKOFF_BASE_SECONDS = 0.5
SOURCE_FAILURE_RATE_ALERT_THRESHOLD = 0.05  # alert once a source's per-cycle failure rate exceeds 5%


def _scrape_with_retry(
    scraper: Any,
    origin: str,
    destination: str,
    departure_date: str,
    advance_days: int,
    max_retries: int = SCRAPE_MAX_RETRIES,
    backoff_base: float = SCRAPE_BACKOFF_BASE_SECONDS,
) -> List[RawFareRecord]:
    """Calls scraper.search() with exponential-backoff retries on failure."""
    attempt = 0
    while True:
        try:
            return scraper.search(origin, destination, departure_date, advance_days)
        except Exception as exc:
            attempt += 1
            if attempt > max_retries:
                raise
            sleep_seconds = backoff_base * (2 ** (attempt - 1))
            logger.warning(
                "[%s] search failed for %s-%s T+%d (attempt %d/%d): %s. Retrying in %.2fs",
                getattr(scraper, "source_name", scraper.__class__.__name__),
                origin, destination, advance_days, attempt, max_retries, exc, sleep_seconds,
            )
            time.sleep(sleep_seconds)


def _scrape_with_tracking(
    scraper: Any,
    origin: str,
    destination: str,
    departure_date: str,
    advance_days: int,
    source_call_stats: Dict[str, Dict[str, int]],
) -> List[RawFareRecord]:
    """Wraps a single scrape call with retry-with-backoff and per-source failure tracking."""
    source_name = getattr(scraper, "source_name", scraper.__class__.__name__)
    stats = source_call_stats[source_name]
    stats["calls"] += 1
    try:
        return _scrape_with_retry(scraper, origin, destination, departure_date, advance_days)
    except Exception as exc:
        stats["failures"] += 1
        logger.error(
            "[%s] search permanently failed for %s-%s T+%d after %d retries: %s",
            source_name, origin, destination, advance_days, SCRAPE_MAX_RETRIES, exc,
        )
        return []


def _send_alert_webhook(alert: Dict[str, Any]) -> None:
    """Best-effort webhook delivery. The structured PIPELINE_ALERT log line is the
    alert of record; set APIX_ALERT_WEBHOOK_URL to also POST it to an incident
    channel (e.g. a Slack incoming webhook) once one is wired up."""
    webhook_url = os.environ.get("APIX_ALERT_WEBHOOK_URL")
    if not webhook_url:
        return
    try:
        import urllib.request

        request = urllib.request.Request(
            webhook_url,
            data=json.dumps(alert).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(request, timeout=5)
    except Exception as exc:
        logger.warning("Failed to deliver alert webhook for %s: %s", alert.get("source"), exc)


def _raise_source_failure_alerts(
    source_call_stats: Dict[str, Dict[str, int]],
    threshold: float = SOURCE_FAILURE_RATE_ALERT_THRESHOLD,
) -> List[Dict[str, Any]]:
    """Emits a structured alert (log line + optional webhook) for any source whose
    per-cycle failure rate crosses the resilience threshold."""
    alerts: List[Dict[str, Any]] = []
    for source_name, stats in source_call_stats.items():
        calls = stats["calls"]
        if calls == 0:
            continue
        failure_rate = stats["failures"] / calls
        if failure_rate > threshold:
            alert = {
                "alert": "SOURCE_FAILURE_RATE_EXCEEDED",
                "source": source_name,
                "calls": calls,
                "failures": stats["failures"],
                "failure_rate_pct": round(failure_rate * 100, 2),
                "threshold_pct": round(threshold * 100, 2),
            }
            alerts.append(alert)
            logger.error("PIPELINE_ALERT %s", json.dumps(alert))
            _send_alert_webhook(alert)
    return alerts


def _observation_time(date_value: str) -> datetime.datetime:
    return datetime.datetime.combine(
        datetime.date.fromisoformat(date_value[:10]),
        datetime.time.min,
        tzinfo=datetime.timezone.utc,
    )


def _group_cpi_eligible_fares_by_route(
    records: List[CleanedFareRecord], advance_days: Optional[int] = None
) -> Dict[str, List[float]]:
    grouped: Dict[str, List[float]] = defaultdict(list)
    for record in records:
        if not record.include_in_cpi_index or record.pair not in BASE_PERIOD_ROUTE_FARES:
            continue
        if advance_days is not None and record.advance_days != advance_days:
            continue
        grouped[record.pair].append(record.total_fare)
    return grouped


def compute_daily_index(records: List[CleanedFareRecord], index_date: str) -> Optional[Dict[str, Any]]:
    """Compute the daily aggregate without choosing a database implementation."""
    try:
        overall = compute_daily_aggregate_indices(_group_cpi_eligible_fares_by_route(records))
    except ValueError as exc:
        logger.warning("Skipping daily index computation for %s: %s", index_date, exc)
        return None

    window_fisher: Dict[int, float] = {}
    for window in DEFAULT_WINDOWS:
        try:
            window_fisher[window] = compute_daily_aggregate_indices(
                _group_cpi_eligible_fares_by_route(records, advance_days=window)
            )["fisher"]
        except ValueError:
            window_fisher[window] = overall["fisher"]

    return {
        **overall,
        "date": index_date,
        "t1": window_fisher[1],
        "t7": window_fisher[7],
        "t15": window_fisher[15],
        "t30": window_fisher[30],
        "t45": window_fisher[45],
    }


async def persist_pipeline_outputs(
    records: List[CleanedFareRecord], index_payload: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Persist pipeline output through the same SQLAlchemy models as the API."""
    await init_db()
    weekly_rollup = None
    async with AsyncSessionLocal() as session:
        for record in records:
            fare_data = record.to_db_dict()
            await session.merge(Fare(**fare_data, observed_at=_observation_time(record.scrape_date)))

        if index_payload:
            await session.merge(
                DailyIndex(
                    date=index_payload["date"],
                    observed_at=_observation_time(index_payload["date"]),
                    laspeyres=index_payload["laspeyres"],
                    fisher=index_payload["fisher"],
                    ci_lower=index_payload["ci_lower"],
                    ci_upper=index_payload["ci_upper"],
                    t1=index_payload["t1"],
                    t7=index_payload["t7"],
                    t15=index_payload["t15"],
                    t30=index_payload["t30"],
                    t45=index_payload["t45"],
                )
            )
            await session.flush()
            weekly_row = await persist_weekly_rollup(session, index_payload["date"])
            if weekly_row is not None:
                weekly_rollup = {
                    "week_ending": weekly_row.week_ending,
                    "week_number": weekly_row.week_number,
                    "rolling_laspeyres": weekly_row.rolling_laspeyres,
                    "rolling_fisher": weekly_row.rolling_fisher,
                }
        await session.commit()
    # Dispose the pool before this coroutine's asyncio.run() closes its event
    # loop: leaving pooled connections open lets the *next* asyncio.run() call
    # in this process (see run_scheduled_cycle) reuse a connection created on
    # a now-dead loop, which asyncpg/SQLAlchemy rejects with "Future attached
    # to a different loop".
    await engine.dispose()
    return {"records_saved": len(records), "weekly_rollup": weekly_rollup}


def execute_pipeline_cycle(
    routes: Optional[List[tuple]] = None,
    windows: Optional[List[int]] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """Generate, clean, compute, and persist one cycle through PostgreSQL."""
    routes = routes or DEFAULT_ROUTES
    windows = windows or DEFAULT_WINDOWS
    today = datetime.date.today()
    scrape_date = today.isoformat()

    # Selector/schema-change health check: probe every source before trusting
    # its output this cycle, and flag SELECTOR_MISS loudly rather than letting
    # a drifted/empty payload flow silently into cleaning and indexing.
    health_report = run_all_health_checks()
    unhealthy = {
        key: status for key, status in health_report.items()
        if status.status == FailureClassification.SELECTOR_MISS
    }
    if unhealthy:
        logger.error(
            "Selector health check flagged %d source(s) before scrape: %s",
            len(unhealthy), {k: v.detail for k, v in unhealthy.items()},
        )

    prefer_live = os.environ.get("APIX_LIVE_SCRAPING", "").lower() in {"1", "true"}
    if prefer_live:
        from scrapers.registry import get_live_scraper
        indigo_scraper = get_live_scraper("indigo_direct", prefer_live=True)
        mmt_scraper = get_live_scraper("makemytrip", prefer_live=True)
        logger.info("APIX_LIVE_SCRAPING is active: running live IndiGo and MakeMyTrip scrapers with resilient fallback.")
    else:
        indigo_scraper = get_simulated_scraper("simulated_indigo")
        mmt_scraper = get_simulated_scraper("simulated_makemytrip")
    additional_scrapers = [
        get_simulated_scraper(key)
        for key in DEFAULT_SIMULATED_SOURCE_KEYS
        if key not in {"simulated_indigo", "simulated_makemytrip"}
    ]
    # Real live source: participates automatically once AMADEUS_API_KEY/
    # AMADEUS_API_SECRET are set (see scrapers/amadeus_fare_scraper.py);
    # cleanly absent from the cycle otherwise, not an error.
    amadeus_scraper = get_amadeus_scraper_if_configured()
    if amadeus_scraper is not None:
        additional_scrapers.append(amadeus_scraper)
        logger.info("Amadeus live-fare source is configured; including it in this cycle.")
    raw_indigo: List[RawFareRecord] = []
    raw_mmt: List[RawFareRecord] = []
    raw_additional: List[RawFareRecord] = []
    source_call_stats: Dict[str, Dict[str, int]] = defaultdict(lambda: {"calls": 0, "failures": 0})

    for origin, destination in routes:
        for advance_days in windows:
            departure_date = (today + datetime.timedelta(days=advance_days)).isoformat()
            raw_indigo.extend(_scrape_with_tracking(indigo_scraper, origin, destination, departure_date, advance_days, source_call_stats))
            raw_mmt.extend(_scrape_with_tracking(mmt_scraper, origin, destination, departure_date, advance_days, source_call_stats))
            for scraper in additional_scrapers:
                raw_additional.extend(_scrape_with_tracking(scraper, origin, destination, departure_date, advance_days, source_call_stats))

    scrape_alerts = _raise_source_failure_alerts(source_call_stats)
    all_raw = raw_indigo + raw_mmt + raw_additional
    cleaned = clean_fare_batch(all_raw, default_scrape_date=scrape_date)
    filtered_records, summary = run_quality_pipeline(cleaned)
    index_payload = compute_daily_index(filtered_records, scrape_date)
    persist_result = (
        asyncio.run(persist_pipeline_outputs(filtered_records, index_payload))
        if save_to_db
        else {"records_saved": 0, "weekly_rollup": None}
    )
    decomposition_results = decompose_matched_flights(raw_indigo, raw_mmt)
    dark_pattern_report = run_dark_pattern_detector(raw_mmt + raw_additional)

    return {
        "status": "success",
        "scrape_date": scrape_date,
        "total_scraped": len(all_raw),
        "audit_summary": summary.to_dict(),
        "matched_decompositions": len(decomposition_results),
        "dark_pattern_flags": len(dark_pattern_report.flags),
        "db_records_saved": persist_result["records_saved"],
        "computed_index": index_payload,
        "weekly_rollup": persist_result["weekly_rollup"],
        "source_health": {key: status.to_dict() for key, status in health_report.items()},
        "scrape_reliability": dict(source_call_stats),
        "scrape_alerts": scrape_alerts,
    }


async def _record_job_run(
    job_label: str,
    windows: List[int],
    started_at: datetime.datetime,
    finished_at: datetime.datetime,
    status: str,
    total_scraped: Optional[int] = None,
    db_records_saved: Optional[int] = None,
    error_message: Optional[str] = None,
) -> None:
    await init_db()
    async with AsyncSessionLocal() as session:
        session.add(PipelineJobRun(
            id=str(uuid.uuid4()),
            job_label=job_label,
            windows=",".join(f"T+{window}" for window in windows),
            started_at=started_at,
            finished_at=finished_at,
            duration_seconds=(finished_at - started_at).total_seconds(),
            status=status,
            total_scraped=total_scraped,
            db_records_saved=db_records_saved,
            error_message=error_message,
        ))
        await session.commit()
    await engine.dispose()


def run_scheduled_cycle(
    job_label: str,
    routes: Optional[List[tuple]] = None,
    windows: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Scheduler entrypoint that records its outcome in the shared database."""
    windows = windows or DEFAULT_WINDOWS
    started_at = datetime.datetime.now(datetime.timezone.utc)
    try:
        result = execute_pipeline_cycle(routes=routes, windows=windows)
    except Exception as exc:
        finished_at = datetime.datetime.now(datetime.timezone.utc)
        logger.error("[%s] Pipeline cycle failed: %s\n%s", job_label, exc, traceback.format_exc())
        asyncio.run(_record_job_run(job_label, windows, started_at, finished_at, "failure", error_message=str(exc)))
        return {"status": "failure", "job_label": job_label, "error": str(exc)}

    finished_at = datetime.datetime.now(datetime.timezone.utc)
    asyncio.run(_record_job_run(
        job_label, windows, started_at, finished_at, "success",
        total_scraped=result["total_scraped"], db_records_saved=result["db_records_saved"],
    ))
    return {**result, "job_label": job_label}


async def get_job_run_stats(since_date: Optional[str] = None) -> Dict[str, Any]:
    """Aggregate scheduled job reliability metrics from PostgreSQL."""
    from sqlalchemy import func, select

    since_date = since_date or datetime.date.today().isoformat()
    since = _observation_time(since_date)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PipelineJobRun.status, func.count(PipelineJobRun.id))
            .where(PipelineJobRun.started_at >= since)
            .group_by(PipelineJobRun.status)
        )
        counts = {status: count for status, count in result.all()}
    total = sum(counts.values())
    succeeded = counts.get("success", 0)
    success_rate = (succeeded / total * 100.0) if total else None
    return {
        "since_date": since_date,
        "total_jobs": total,
        "succeeded": succeeded,
        "failed": counts.get("failure", 0),
        "success_rate_percent": round(success_rate, 2) if success_rate is not None else None,
        "meets_95pct_target": (success_rate >= 95.0) if success_rate is not None else None,
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run one APIx fixture -> clean -> index PostgreSQL pipeline cycle.")
    parser.add_argument("--window", type=int, default=None, metavar="ADVANCE_DAYS")
    args = parser.parse_args()
    selected_windows = [args.window] if args.window is not None else None
    label = f"T+{args.window}" if args.window is not None else "manual"
    print(run_scheduled_cycle(job_label=label, windows=selected_windows))
