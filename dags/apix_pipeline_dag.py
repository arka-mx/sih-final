"""
Airflow DAG for the APIx scrape -> clean -> index pipeline.

The PRD's recommended tech stack (section 9) names Apache Airflow as the
scheduler, with "Celery+Redis for simpler prototype" as an explicit
fallback. This repository's default scheduler is `pipeline/scheduler.py`
(APScheduler, the simpler prototype option) -- this DAG is the Airflow-native
alternative for a deployment that wants Airflow's own UI, retries, alerting,
and backfill tooling instead.

One DAG, one task per advance-purchase window (T+1/7/15/30/45), each on its
own schedule -- mirroring pipeline/scheduler.py's DEFAULT_CADENCE_HOURS
exactly, so switching between the two schedulers doesn't change *when*
scrapes happen, only *what* orchestrates them. Each task calls the exact
same `pipeline.runner.run_scheduled_cycle` entrypoint the APScheduler-based
scheduler uses, so there is no duplicated pipeline logic between the two --
only the orchestration layer differs.

NOT executable or testable in this codebase's development environment:
Apache Airflow is a large dependency (its own metadata database, webserver,
scheduler process) deliberately not added to apix-api/requirements.txt,
since Airflow is normally deployed as its own dedicated environment rather
than bundled into the FastAPI app's dependencies. This file is written
directly against Airflow's stable, well-documented DAG/PythonOperator API,
but was not run against a live Airflow instance during development. See
docs/scheduling.md for install/deploy notes.

To use: point Airflow's `dags_folder` at (or symlink this file into) this
project's `dags/` directory, and ensure the Airflow worker's Python
environment has this repository's root on `sys.path` (or is installed as a
package) so `pipeline.runner` is importable.
"""

import datetime
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from airflow import DAG
from airflow.operators.python import PythonOperator

# Mirrors pipeline/scheduler.py::DEFAULT_CADENCE_HOURS exactly: T+1 (the most
# volatile window) runs every 4 hours, longer lead-time windows run once or
# twice daily since they change slowly.
WINDOW_CADENCE_CRON = {
    1: "0 0,4,8,12,16,20 * * *",
    7: "0 1,13 * * *",
    15: "0 2,14 * * *",
    30: "0 3 * * *",
    45: "0 3 * * *",
}

DEFAULT_ARGS = {
    "owner": "apix-diid",
    "retries": 3,
    "retry_delay": datetime.timedelta(minutes=5),
}


def _run_pipeline_cycle(window: int) -> None:
    """Airflow task entrypoint. Calls the same function the APScheduler-based
    scheduler uses (pipeline/scheduler.py::_job), so the two orchestration
    layers stay behaviorally identical."""
    from pipeline.runner import DEFAULT_ROUTES, run_scheduled_cycle

    result = run_scheduled_cycle(job_label=f"T+{window}", routes=DEFAULT_ROUTES, windows=[window])
    if result.get("status") == "failure":
        # Raising surfaces the failure in Airflow's UI/alerting and triggers
        # the configured retry policy, instead of a silently "green" task
        # whose pipeline run actually failed.
        raise RuntimeError(f"APIx pipeline cycle T+{window} failed: {result.get('error')}")


dags = {}
for window, cron_expression in WINDOW_CADENCE_CRON.items():
    dag_id = f"apix_pipeline_t{window}"
    with DAG(
        dag_id=dag_id,
        description=f"APIx scrape -> clean -> index cycle for the T+{window} advance-purchase window",
        default_args=DEFAULT_ARGS,
        schedule_interval=cron_expression,
        start_date=datetime.datetime(2026, 1, 1),
        catchup=False,
        tags=["apix", "mospi", f"t{window}"],
    ) as dag:
        PythonOperator(
            task_id=f"run_pipeline_cycle_t{window}",
            python_callable=_run_pipeline_cycle,
            op_kwargs={"window": window},
        )
    dags[dag_id] = dag
    globals()[dag_id] = dag  # Airflow discovers module-level DAG objects by name
