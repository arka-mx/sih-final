"""
In-process scheduler for the APIx scrape -> clean -> index pipeline.

Runs pipeline/runner.py::run_scheduled_cycle on a fixed cadence, per
advance-purchase window (T+1/T+7/T+15/T+30/T+45), across all DGCA basket
routes. Each run's success/failure is persisted into the `pipeline_job_runs`
table in the shared PostgreSQL/TimescaleDB store so it can back the
">=95% successful scrape jobs/day" reliability metric.

Near-departure fares (T+1) move the most intraday, so that window is
scraped several times a day; longer lead-time windows (T+30/T+45) are
scraped once daily since they change slowly. Cadence is overridable via env
vars for ops tuning without a code change.

Usage
-----
Run as a long-lived process (systemd service, Docker sidecar, `pm2`, etc.):

    python -m pipeline.scheduler

Alternative (no long-lived process / no extra dependency): call the same
entrypoint from cron directly, once per desired window per day, e.g.

    # /etc/cron.d/apix-pipeline
    0,6,12,18 * * * apix cd /srv/apix && python -m pipeline.runner --window 1
    0 6        * * * apix cd /srv/apix && python -m pipeline.runner --window 7
    30 6       * * * apix cd /srv/apix && python -m pipeline.runner --window 15
    0 7        * * * apix cd /srv/apix && python -m pipeline.runner --window 30
    30 7       * * * apix cd /srv/apix && python -m pipeline.runner --window 45

See docs/scheduling.md for full deployment notes.
"""
import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Dict, List

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.runner import DEFAULT_ROUTES, run_scheduled_cycle  # noqa: E402

logger = logging.getLogger("APIx.Scheduler")


def _env_csv_ints(name: str, default: List[int]) -> List[int]:
    raw = os.environ.get(name)
    if not raw:
        return default
    return [int(v.strip()) for v in raw.split(",") if v.strip()]


# Advance-purchase window -> list of cron "hour" values (24h, local TZ of the
# scheduler process) it should be scraped at each day. T+1 runs every 4h
# since near-departure fares are the most volatile; longer lead windows are
# cheaper to sample once (T+7/T+15 twice) daily.
DEFAULT_CADENCE_HOURS: Dict[int, List[int]] = {
    1: _env_csv_ints("APIX_CADENCE_T1_HOURS", [0, 4, 8, 12, 16, 20]),
    7: _env_csv_ints("APIX_CADENCE_T7_HOURS", [1, 13]),
    15: _env_csv_ints("APIX_CADENCE_T15_HOURS", [2, 14]),
    30: _env_csv_ints("APIX_CADENCE_T30_HOURS", [3]),
    45: _env_csv_ints("APIX_CADENCE_T45_HOURS", [3]),
}


def _job(window: int) -> None:
    run_scheduled_cycle(job_label=f"T+{window}", routes=DEFAULT_ROUTES, windows=[window])


def build_scheduler(cadence: Dict[int, List[int]] = DEFAULT_CADENCE_HOURS):
    """Builds (but does not start) an APScheduler BlockingScheduler with one
    cron trigger per advance-purchase window per scheduled hour."""
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError as exc:
        raise SystemExit(
            "apscheduler is required to run the in-process scheduler "
            "(pip install apscheduler, or add it to requirements.txt). "
            "Alternatively invoke `python -m pipeline.runner --window N` "
            "from cron directly; see docs/scheduling.md."
        ) from exc

    scheduler = BlockingScheduler(timezone="UTC")
    for window, hours in cadence.items():
        if not hours:
            continue
        hour_expr = ",".join(str(h) for h in hours)
        scheduler.add_job(
            _job,
            trigger=CronTrigger(hour=hour_expr, minute=0),
            args=[window],
            id=f"apix-scrape-t{window}",
            name=f"APIx scrape/clean/index cycle - T+{window}",
            max_instances=1,
            coalesce=True,
            misfire_grace_time=1800,
        )
        logger.info(f"Scheduled T+{window} cycle at UTC hours: {hour_expr}")
    return scheduler


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    scheduler = build_scheduler()
    logger.info("APIx pipeline scheduler starting (Ctrl+C to stop)...")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("APIx pipeline scheduler stopped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the APIx pipeline scheduler in-process.")
    parser.add_argument(
        "--once",
        type=int,
        default=None,
        metavar="WINDOW",
        help="Run a single cycle for one advance-purchase window immediately and exit "
        "(e.g. --once 7), instead of starting the long-lived scheduler.",
    )
    args = parser.parse_args()

    if args.once is not None:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        )
        _job(args.once)
    else:
        main()
