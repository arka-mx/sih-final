# APIx Data Dictionary
**Ministry of Statistics and Programme Implementation (MoSPI) — DIID**

Documents every field of the `Route`, `Fare`, and `DailyIndex` SQLAlchemy models
(`apix-api/app/models/__init__.py`) and the `CleanedFareRecord` /
`PipelineAuditSummary` dataclasses (`pipeline/schema.py`) that produce them. See
[`docs/architecture.md`](architecture.md) for how these fit into the overall
scrape → clean → index → dashboard/API flow, and
[`docs/methodology.md`](methodology.md) for the index formulas.

---

## 1. `Route` — `apix-api/app/models/__init__.py` (table: `routes`)

Static reference table of the DGCA-weighted route corridors tracked by the index.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | PK, autoincrement | Internal surrogate key. |
| `pair` | String(10) | unique, not null, indexed | Route pair code, e.g. `"DEL-BOM"`. |
| `origin` | String(5) | not null | Origin airport IATA code, e.g. `"DEL"`. |
| `origin_name` | String(100) | not null | Human-readable origin city/airport name. |
| `destination` | String(5) | not null | Destination airport IATA code, e.g. `"BOM"`. |
| `destination_name` | String(100) | not null | Human-readable destination city/airport name. |
| `dgca_weight` | Float | not null | Normalized DGCA passenger-traffic weight for this corridor (contributes to `sum(W_r) = 1.0000` in the Laspeyres/Fisher aggregation — see `index_math/weights.py`). |
| `monthly_volume` | String(20) | not null | Descriptive DGCA monthly passenger-volume band for the corridor (display/reference only, not used in index math). |
| `tier` | String(50) | default `"Metro-to-Metro"` | Corridor classification, e.g. `"Metro-to-Metro"`, `"Metro-to-Tier2"`. |

---

## 2. `Fare` — `apix-api/app/models/__init__.py` (table: `fares`)

One cleaned, persisted fare observation. Populated from
`CleanedFareRecord.to_db_dict()` (§4) by `pipeline/runner.py::persist_pipeline_outputs`.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | String(50) | PK (composite with `observed_at`) | Record ID, format `F_{scrape_id}_{pair}_{flight_no}_{advance_days}` (hyphens replaced with underscores) — see `pipeline/cleaning.py::clean_fare_record`. |
| `observed_at` | DateTime(tz) | PK (composite with `id`), not null, server default `now()`, indexed | Timestamp the observation was recorded, derived from `scrape_date` at midnight UTC (`pipeline/runner.py::_observation_time`). Composite PK with `id` allows the same logical record to be re-observed over time. |
| `pair` | String(10) | not null, indexed | Route pair, e.g. `"DEL-BOM"`. |
| `origin` | String(5) | not null | Origin airport IATA code. |
| `destination` | String(5) | not null | Destination airport IATA code. |
| `carrier` | String(50) | not null, indexed | Normalized carrier name, e.g. `"IndiGo"`, `"Air India"`, `"SpiceJet"`, `"Akasa Air"`. |
| `flight_no` | String(20) | not null | Flight number, e.g. `"6E-205"`. |
| `departure_date` | String(15) | not null | Scheduled departure date, `"YYYY-MM-DD"`. |
| `scrape_date` | String(15) | not null, indexed | Date the fare was observed/scraped, `"YYYY-MM-DD"`. |
| `advance_days` | Integer | not null, indexed | Advance-purchase window in days: one of `1, 7, 15, 30, 45` (`T+1`…`T+45`). |
| `fare_class` | String(20) | default `"Economy"` | Cabin/fare class. |
| `base_fare` | Float | not null | Base fare component (₹), before taxes/fees. Imputed as ≈78% of `total_fare` when missing from the raw source. |
| `taxes_udf` | Float | not null | Taxes + User Development Fee (UDF) + statutory charges (₹). Imputed as the remainder of `total_fare` when missing. |
| `convenience_fee` | Float | default `0.0` | OTA/platform convenience fee (₹). Negative values are clamped to `0.0` during cleaning. |
| `total_fare` | Float | not null | Total payable fare (₹) — `base_fare + taxes_udf + convenience_fee` when imputed, otherwise the source-reported total. This is the value used for index computation and outlier detection. |
| `seat_avail` | Boolean | default `True` | Whether the flight has bookable seats (`False` for `SOLD_OUT`/`CANCELLED`). |
| `source` | String(50) | default `"Direct Engine"` | Source platform, e.g. `"simulated_indigo"`, `"simulated_makemytrip"` — prefixed `simulated_` to make clear no live data is collected (see [`docs/ethics_compliance.md`](ethics_compliance.md)). |
| `audit_hash` | String(100) | not null | `sha256:`-prefixed cryptographic hash of `(id, carrier, flight_no, departure_date, total_fare)` for MoSPI auditability (`generate_audit_hash` / `generate_sha256_audit_hash`). |

---

## 3. `DailyIndex` — `apix-api/app/models/__init__.py` (table: `index_daily`)

One computed daily aggregate index value, produced by
`pipeline/runner.py::compute_daily_index` from that day's CPI-eligible `Fare` records.

| Field | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer | not part of PK (legacy column, unused as a key) | Present in the table but superseded by the composite `(date, observed_at)` primary key below. |
| `date` | String(15) | PK (composite), not null, indexed | Index date, `"YYYY-MM-DD"`. |
| `observed_at` | DateTime(tz) | PK (composite), not null, server default `now()`, indexed | Timestamp the index was computed (midnight UTC of `date`). |
| `laspeyres` | Float | not null | Laspeyres (base-period-weighted) aggregate index value across all routes for `date`. |
| `fisher` | Float | not null | Fisher ideal index (geometric mean of Laspeyres and Paasche) for `date` — the headline reported index value. |
| `ci_lower` | Float | not null | Lower bound of the statistical confidence interval around the aggregate index. |
| `ci_upper` | Float | not null | Upper bound of the statistical confidence interval around the aggregate index. |
| `t1` | Float | not null | Fisher index restricted to `advance_days == 1` (T+1 booking window) fares. |
| `t7` | Float | not null | Fisher index restricted to `advance_days == 7` (T+7) fares. |
| `t15` | Float | not null | Fisher index restricted to `advance_days == 15` (T+15) fares. |
| `t30` | Float | not null | Fisher index restricted to `advance_days == 30` (T+30) fares. |
| `t45` | Float | not null | Fisher index restricted to `advance_days == 45` (T+45) fares. |

> `WeeklyIndex` and `MonthlyIndex` roll the same `t1`…`t45` / Laspeyres-Fisher shape up
> to week- and month-level granularity; see `apix-api/app/models/__init__.py` for their
> fields (`week_ending`/`week_number`, and `year`/`month`/`mom_change_pct`/
> `yoy_change_pct`/`cpi_transport_contrib` respectively) — out of scope for this
> dictionary, which covers `Route`/`Fare`/`DailyIndex` per the PRD deliverables list.

---

## 4. `CleanedFareRecord` — `pipeline/schema.py`

In-memory dataclass produced by `pipeline/cleaning.py::clean_fare_record` from a raw
`RawFareRecord`/dict, enriched by `pipeline/outlier_detection.py`, and finally
persisted to `Fare` via `to_db_dict()` (which maps the fields below whose names match
`Fare` columns 1:1, dropping the pipeline-only metadata fields).

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | str | — | Same as `Fare.id`. |
| `pair` | str | — | Same as `Fare.pair`. |
| `origin` | str | — | Same as `Fare.origin`. |
| `destination` | str | — | Same as `Fare.destination`. |
| `carrier` | str | — | Same as `Fare.carrier`. |
| `flight_no` | str | — | Same as `Fare.flight_no`. |
| `departure_date` | str | — | Same as `Fare.departure_date`. |
| `scrape_date` | str | — | Same as `Fare.scrape_date`. |
| `advance_days` | int | — | Same as `Fare.advance_days`. |
| `fare_class` | str | `"Economy"` | Same as `Fare.fare_class`. |
| `base_fare` | float | `0.0` | Same as `Fare.base_fare`. |
| `taxes_udf` | float | `0.0` | Same as `Fare.taxes_udf`. |
| `convenience_fee` | float | `0.0` | Same as `Fare.convenience_fee`. |
| `total_fare` | float | `0.0` | Same as `Fare.total_fare`. |
| `seat_avail` | bool | `True` | Same as `Fare.seat_avail`. |
| `seat_availability_flag` | str | `"AVAILABLE"` | Fine-grained availability status: `"AVAILABLE"`, `"FEW_SEATS_LEFT"`, `"SOLD_OUT"`, `"CANCELLED"`. Not persisted to `Fare` (only the derived boolean `seat_avail` is). |
| `source` | str | `"Direct Engine"` | Same as `Fare.source`. |
| `audit_hash` | str | `""` | Same as `Fare.audit_hash`. |
| `raw_payload_ref` | str | `""` | Relative path to the raw payload in `ingestion/raw_store.py`, for audit trail. Not persisted to `Fare`. |
| `data_mode` | str | `"simulated"` | Always `"simulated"` in this repository; not persisted to `Fare`. |
| `is_live_data` | bool | `False` | Always `False` in this repository; not persisted to `Fare`. |
| `simulation_disclaimer` | str | *(fixed disclaimer text)* | Compliance disclaimer string; not persisted to `Fare`. |
| `imputation_applied` | bool | `False` | Whether `base_fare`/`taxes_udf`/`total_fare` were imputed during cleaning. Not persisted to `Fare`. |
| `imputed_fields` | List[str] | `[]` | Which specific fields were imputed. Not persisted to `Fare`. |
| `is_outlier` | bool | `False` | Set by `pipeline/outlier_detection.py::detect_statistical_outliers`. Not persisted to `Fare`. |
| `outlier_reason` | Optional[str] | `None` | Human-readable reason, e.g. `"IQR_HIGH_OUTLIER (...)"`, `"Z_SCORE_ANOMALY (...)"`, `"PRICE_BELOW_FLOOR (...)"`, `"PRICE_ABOVE_CEILING (...)"`. Not persisted to `Fare`. |
| `is_duplicate` | bool | `False` | Set by `deduplicate_fare_records` when a `(carrier, flight_no, departure_date, advance_days, source)` fingerprint repeats. Not persisted to `Fare`. |
| `include_in_cpi_index` | bool | `True` | Whether this record is eligible for index computation (`False` for duplicates, sold-out/cancelled, and outliers). Drives `pipeline/runner.py::_group_cpi_eligible_fares_by_route`. Not persisted to `Fare`. |
| `z_score` | float | `0.0` | Computed z-score of `total_fare` within its `(pair, advance_days)` partition. Not persisted to `Fare`. |

## 5. `PipelineAuditSummary` — `pipeline/schema.py`

Per-cycle summary returned by `pipeline/outlier_detection.py::run_quality_pipeline`,
surfaced in the pipeline's audit/status API and dashboard views.

| Field | Type | Default | Description |
|---|---|---|---|
| `total_raw_ingested` | int | `0` | Count of raw records entering the quality pipeline this cycle. |
| `valid_cleaned_records` | int | `0` | `total_raw_ingested` minus duplicates. |
| `duplicates_merged` | int | `0` | Count flagged by `deduplicate_fare_records`. |
| `outliers_flagged` | int | `0` | Count flagged by `detect_statistical_outliers` (floor/ceiling + IQR/z-score). |
| `imputed_records_count` | int | `0` | Count of records where `imputation_applied` is `True`. |
| `sold_out_excluded` | int | `0` | Count flagged by `filter_sold_out_and_cancelled`. |
| `cpi_eligible_records` | int | `0` | Count with `include_in_cpi_index == True` after all filters. |
| `data_quality_score_percent` | float | `100.0` | `cpi_eligible_records / total_raw_ingested * 100`, rounded to 2 decimal places. |
