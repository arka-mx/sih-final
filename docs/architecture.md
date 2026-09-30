# APIx System Architecture
**Ministry of Statistics and Programme Implementation (MoSPI) - DIID**

This document maps the PRD's target architecture (Section 6, "System Architecture -
High-Level Flow") onto what is actually implemented in this repository today. Where the
current implementation deliberately simplifies or diverges from the PRD's live-data
target architecture - chiefly because scraping runs in **simulated fixture mode**, see
[`docs/ethics_compliance.md`](ethics_compliance.md) - that is called out explicitly.

## 1. High-Level Flow

```
┌─────────────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│   Scraping Layer     │     │  Ingestion & Raw      │     │  Cleaning & Quality    │
│   scrapers/*.py       │---->│  Data Store            │---->│  Pipeline               │
│   (config-driven       │     │  ingestion/raw_store.py│     │  pipeline/cleaning.py   │
│   simulated fixtures)  │     │  (raw JSON on disk)     │     │  pipeline/outlier_      │
└──────────┬───────────┘     └──────────────────────┘     │  detection.py           │
           ▲                                                └───────────┬───────────┘
           │                                                            │
┌──────────┴───────────┐                                    ┌───────────▼───────────┐
│   Scheduler            │                                    │  Structured Fare DB    │
│   pipeline/scheduler.py│                                    │  Postgres via          │
│   (APScheduler cron)   │                                    │  apix-api/app/models   │
└──────────┬───────────┘                                    └───────────┬───────────┘
           │                                                            │
           └───────────────────────┬────────────────────────────────────┘
                                    ▼
                        ┌───────────────────────────┐
                        │  Index Construction Engine  │
                        │  index_math/* (Jevons,       │
                        │  Laspeyres, Fisher,           │
                        │  chain-linking via             │
                        │  pipeline/decompose.py for     │
                        │  fee decomposition)            │
                        └─────────────┬─────────────┘
                                      │
                  ┌───────────────────┴───────────────────┐
                  ▼                                         ▼
     ┌─────────────────────────┐             ┌───────────────────────────┐
     │  Web Dashboard            │             │  Public/Restricted REST API │
     │  Next.js app (app/*.tsx,   │◄───calls───│  FastAPI apix-api/app/main.py│
     │  components/*.tsx)          │             │  + apix-api/app/routers/*.py │
     └─────────────────────────┘             └───────────────────────────┘
```

## 2. Module Breakdown

### 2.1 Scraping Layer
- Implemented as **config-driven simulated scrapers**: `scrapers/base.py` defines the
  abstract `BaseScraper` interface (`search(origin, dest, departure_date,
  advance_purchase_days)`), `scrapers/config_scraper.py` builds a generic
  `ConfigDrivenScraper` from a YAML fixture file, and `scrapers/registry.py` /
  `scrapers/configs/*.yaml` enumerate the five simulated sources (IndiGo, Air India
  direct channels; MakeMyTrip, Cleartrip, ixigo OTA fixtures).
- `scrapers/health_check.py` runs a selector/schema-change health probe
  (`FailureClassification.SELECTOR_MISS` vs `NO_AVAILABILITY` vs `BLOCKED` vs
  `NETWORK_ERROR`) before each pipeline cycle trusts a source's output.
- **PRD divergence:** the PRD's target architecture uses live Playwright/Selenium/Scrapy
  scraping with proxy rotation and CAPTCHA-avoidance. The default daily pipeline cycle
  does not perform any live network scraping against a commercial site - every fare in
  it is generated from deterministic fixture data (`data_mode="simulated"`,
  `is_live_data=False`, source IDs prefixed `simulated_`).
  `BaseScraper.enforce_rate_limit()` (1.5–3.5s randomized per-domain delay,
  concurrency-of-1) exists as the common control point a future live provider would
  plug into. See [`docs/ethics_compliance.md`](ethics_compliance.md) §1–2.
- `scrapers/wayback_fare_scraper.py` is the one real exception: a standalone,
  CLI-driven (`python -m scrapers.wayback_fare_scraper --url ... --from ... --to ...`)
  historical-backfill scraper that fetches real archived OTA/airline page snapshots
  from the Internet Archive's public Wayback Machine CDX API (`data_mode="archived"`).
  Not wired into the default automatic cycle, which only produces `today`-dated
  observations; see `docs/ethics_compliance.md` §1 for its provenance model.

### 2.2 Scheduler
- `pipeline/scheduler.py` drives periodic pipeline cycles (`pipeline/runner.py::
  run_scheduled_cycle`) per advance-purchase window (T+1/7/15/30/45), recording each
  run's outcome (`PipelineJobRun` - status, duration, records saved, error message) for
  the ≥95%-successful-jobs/day resilience target.
- `pipeline/runner.py::_scrape_with_tracking` wraps each source's `search()` call with
  exponential-backoff retries (`_scrape_with_retry`) and per-source call/failure
  counters; `_raise_source_failure_alerts` emits a structured `PIPELINE_ALERT` log line
  (and an optional webhook via `APIX_ALERT_WEBHOOK_URL`) once a source's failure rate
  in a cycle exceeds 5%.

### 2.3 Ingestion & Raw Data Store
- `ingestion/raw_store.py::persist_raw_payload` writes the raw scrape payload to disk
  (`<RAW_STORE_DIR>/<source_platform>/<date>/<scrape_id>_<route_pair>_<departure_date>.
  json`) before any parsing touches it, for full auditability back to MoSPI/DIID.
  `read_raw_payload` retrieves it for audit trails and `raw_payload_ref` on
  `CleanedFareRecord`/`Fare` rows.
- `ingestion/dgca_loader.py` separately ingests the DGCA backtest dataset used by
  `apix-api/app/routers/backtest.py`.

### 2.4 Cleaning & Quality Pipeline
- `pipeline/cleaning.py::clean_fare_record` normalizes currency amounts, airport codes,
  carrier names, and availability status; imputes missing `base_fare`/`taxes_udf`/
  `total_fare` (see [`pipeline/schema.py`](../pipeline/schema.py)); computes the
  cryptographic audit hash (`generate_sha256_audit_hash`).
- `pipeline/outlier_detection.py::run_quality_pipeline` runs, in order:
  deduplication (`deduplicate_fare_records`), sold-out/cancelled exclusion
  (`filter_sold_out_and_cancelled`), and hybrid IQR + z-score outlier detection
  partitioned by `(pair, advance_days)` (`detect_statistical_outliers`) - matching the
  PRD's per-route-window IQR/z-score requirement - producing a `PipelineAuditSummary`.
- `pipeline/decompose.py::decompose_matched_flights` matches simulated direct-channel
  vs OTA fixture quotes on `(carrier, flight_no, departure_date, advance_days)` to
  infer the OTA convenience fee (`mmt_total - direct_total`), the repo's centerpiece
  fee-decomposition feature.
- `pipeline/dark_pattern_detector.py` flags OTA dark-pattern signals (e.g. repeat-view
  fare inflation) from `RawFareRecord.repeat_view_fare_history`/`listing_copy`.

### 2.5 Structured Fare Database
- `apix-api/app/models/__init__.py` defines the SQLAlchemy models persisted to
  Postgres: `Route`, `Fare`, `DailyIndex`, `WeeklyIndex`, `MonthlyIndex`,
  `BacktestRecord`, `BacktestDataset`, `PipelineJobRun`. See
  [`docs/data_dictionary.md`](data_dictionary.md) for every field.
- `apix-api/app/db.py` owns the async SQLAlchemy engine/session factory
  (`AsyncSessionLocal`, `init_db`) shared by both the FastAPI app and
  `pipeline/runner.py::persist_pipeline_outputs`, so the pipeline and the API read/write
  through the same schema - no separate ETL/sync step.
- **PRD divergence:** the PRD's target adds a TimescaleDB extension for fast
  time-series index computation; this repository uses plain Postgres tables.

### 2.6 Index Construction Engine
- `index_math/jevons.py` - elementary route-level index (geometric mean of price
  relatives).
- `index_math/laspeyres.py`, `index_math/fisher.py` - Laspeyres/Paasche/Fisher
  corridor-weighted aggregation using `index_math/weights.py`'s DGCA traffic-share
  basket.
- `index_math/engine.py::compute_daily_aggregate_indices` ties the above together per
  `pipeline/runner.py::compute_daily_index`, producing the `laspeyres`, `fisher`,
  confidence interval, and T+1/7/15/30/45 window values persisted to `DailyIndex`.
- `index_math/chain_link.py` - splices `MonthlyIndex.mom_change_pct` into a real
  chained series for `GET /api/index/monthly?formula=chained_laspeyres` (the default),
  plus an overlap-linking helper for a future basket-weight revision.
- `pipeline/rollup.py::persist_weekly_rollup` - runs after every daily pipeline cycle
  (`pipeline/runner.py::persist_pipeline_outputs`) and upserts a trailing-7-day rolling
  average `WeeklyIndex` row for `week_ending = today`, so `GET /api/index/weekly` is a
  genuine daily-recomputed rolling average, not a once-a-week snapshot.
- Full formula derivations and worked examples: [`docs/methodology.md`](methodology.md).

### 2.7 Web Dashboard
- Next.js app under `app/` and `components/` (`HomeView`, `MarketAnalysisView`,
  `DataExplorerView`, `RouteExplorerView`, `BacktestView`, `ScrapingEngineView`,
  `DataPipelineView`) renders the index, route explorer, backtest comparison, and
  pipeline/scraping-engine operational views, calling the Next.js API routes under
  `app/api/*` which in turn proxy to the FastAPI backend.

### 2.8 Public/Restricted REST API
- `apix-api/app/main.py` wires up the FastAPI app; `apix-api/app/routers/*.py` expose
  `index` (daily/weekly/monthly index), `routes` (per-route fare series), `backtest`
  (DGCA comparison), `sources` (source-comparison/decomposition), `anomalies`,
  `dark_patterns`, `pipeline` (job-run stats), `health`, `metadata`, and `public`
  (rate-limited, unauthenticated summary) endpoints.
- `apix-api/app/rate_limit.py` provides the `RateLimitMiddleware` distinguishing public
  vs authenticated request budgets, matching the PRD's "public/restricted" split.

## 3. Data Flow Summary

1. **Scheduler** triggers `execute_pipeline_cycle()` per advance-purchase window.
2. **Scraping layer** returns `RawFareRecord`s from the simulated fixture sources, with
   retry/backoff and failure tracking around each call.
3. **Ingestion** persists the raw payload to `ingestion/raw_store.py` before parsing
   (implemented at the scraper/config layer, not shown as a separate pipeline step
   above for brevity).
4. **Cleaning & quality pipeline** turns raw records into `CleanedFareRecord`s, flags
   duplicates/outliers/sold-out fares, and produces a `PipelineAuditSummary`.
5. **Index engine** computes `DailyIndex` from CPI-eligible cleaned records.
6. **Persistence** writes `Fare` and `DailyIndex` rows (and a `PipelineJobRun` audit
   row) to Postgres via the shared SQLAlchemy models.
7. **Dashboard & API** read the same Postgres tables to serve the web UI and the
   NSO/RBI-facing REST API.
