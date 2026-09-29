# Automated Scrape Scheduling

The simulated-fixture generation -> clean -> index cycle (`pipeline/runner.py::execute_pipeline_cycle`)
previously only ran when invoked manually (`python -m pipeline.runner`).
This document covers the two supported ways to run it automatically, on a
recurring cadence, per advance-purchase window (T+1 / T+7 / T+15 / T+30 / T+45).

All scheduled source outputs are deterministic simulated fixtures, not live airline or OTA quotes.

## Option A - in-process scheduler (`pipeline/scheduler.py`)

A lightweight [APScheduler](https://apscheduler.readthedocs.io/) `BlockingScheduler`
that lives in a single long-running process. This is the simplest option for a
VM, container, or `systemd` service that doesn't already have a cron daemon.

```bash
pip install -r apix-api/requirements.txt   # includes apscheduler
python -m pipeline.scheduler
```

It runs one cron-triggered job per advance-purchase window, all in UTC:

| Window | Default cadence (UTC hours) | Rationale |
|--------|------------------------------|-----------|
| T+1  | 00, 04, 08, 12, 16, 20 | Near-departure fares move the most intraday |
| T+7  | 01, 13 | Twice daily |
| T+15 | 02, 14 | Twice daily |
| T+30 | 03 | Long lead time, changes slowly |
| T+45 | 03 | Long lead time, changes slowly |

Each of these is independently overridable via env var, as a comma-separated
list of hours, without touching code:

```bash
APIX_CADENCE_T1_HOURS=0,6,12,18
APIX_CADENCE_T7_HOURS=2
APIX_CADENCE_T15_HOURS=2
APIX_CADENCE_T30_HOURS=3
APIX_CADENCE_T45_HOURS=3
```

To run a single window immediately (e.g. for testing or a manual backfill)
without starting the long-lived scheduler:

```bash
python -m pipeline.scheduler --once 7   # runs the T+7 cycle once and exits
```

### systemd unit (example)

```ini
[Unit]
Description=APIx pipeline scheduler
After=network.target

[Service]
WorkingDirectory=/srv/apix
ExecStart=/srv/apix/.venv/bin/python -m pipeline.scheduler
Restart=on-failure
User=apix

[Install]
WantedBy=multi-user.target
```

## Option C - Apache Airflow (`dags/apix_pipeline_dag.py`)

The PRD's recommended stack (section 9) names Airflow as the primary
scheduling tool, with APScheduler/Celery+Redis (Option A above) as an
explicit "simpler prototype" fallback. `dags/apix_pipeline_dag.py` is the
Airflow-native alternative: one DAG per advance-purchase window, on the exact
same cadence as Option A's table above, each calling the same
`pipeline.runner.run_scheduled_cycle` entrypoint — switching between Option A
and Option C changes only *what orchestrates* the pipeline, never the
pipeline logic itself.

```bash
pip install apache-airflow   # not part of apix-api/requirements.txt -- a
                              # separate, dedicated Airflow environment is the
                              # normal deployment pattern, not bundled into the
                              # FastAPI app's dependencies
airflow standalone           # or point an existing Airflow's dags_folder at ./dags
```

**Not run against a live Airflow instance in this repository's development
environment** (Airflow was not installed there). The DAG is written directly
against Airflow's stable `DAG`/`PythonOperator` API; verify it loads cleanly
(`airflow dags list`) after installing Airflow before relying on it.

## Option B - cron entrypoint (`python -m pipeline.runner`)

If you'd rather not run an extra long-lived process, `pipeline/runner.py`
accepts a `--window` flag and can be invoked directly from cron/Task
Scheduler, one line per advance-purchase window:

```cron
# /etc/cron.d/apix-pipeline
0,6,12,18 * * * apix cd /srv/apix && python -m pipeline.runner --window 1  >> /var/log/apix/pipeline.log 2>&1
0 6        * * * apix cd /srv/apix && python -m pipeline.runner --window 7  >> /var/log/apix/pipeline.log 2>&1
30 6       * * * apix cd /srv/apix && python -m pipeline.runner --window 15 >> /var/log/apix/pipeline.log 2>&1
0 7        * * * apix cd /srv/apix && python -m pipeline.runner --window 30 >> /var/log/apix/pipeline.log 2>&1
30 7       * * * apix cd /srv/apix && python -m pipeline.runner --window 45 >> /var/log/apix/pipeline.log 2>&1
```

Running `python -m pipeline.runner` with no `--window` runs every window in
one cycle (the original manual behavior), logged under job label `manual`.

## Run logging & the success-rate metric

Every run made through `run_scheduled_cycle()` (used by both the scheduler
and the `--window` cron entrypoint) is wrapped so a failure never crashes the
process - it's caught, logged, and persisted into a `pipeline_job_runs` row
in the same PostgreSQL database used by the API (a Supabase project by default):

| column | meaning |
|---|---|
| `job_label` | which window this run was for, e.g. `T+7` |
| `started_at` / `finished_at` / `duration_seconds` | timing |
| `status` | `success` or `failure` |
| `total_scraped` / `db_records_saved` | volume, on success |
| `error_message` | exception text, on failure |

This backs the "≥95% successful scrape jobs/day" reliability metric. Query it via:

- **API**: `GET /api/pipeline/jobs` (recent runs, optionally filtered by `job_label`)
  and `GET /api/pipeline/jobs/stats?date=YYYY-MM-DD` (daily success rate;
  both require an NSO/RBI API key).
- **Python**: `pipeline.runner.get_job_run_stats(since_date="2026-09-29")`.
