import math
import logging
from collections import defaultdict
from typing import Dict, List, Tuple

from pipeline.schema import CleanedFareRecord, PipelineAuditSummary

logger = logging.getLogger(__name__)

# Absolute sanity limits for Indian domestic economy airfares
MIN_REALISTIC_DOMESTIC_FARE = 800.0   # Scrape errors or ₹0 placeholders
MAX_REALISTIC_DOMESTIC_FARE = 45000.0 # Extreme placeholders (e.g. ₹99,999) or international misparses


def deduplicate_fare_records(records: List[CleanedFareRecord]) -> Tuple[List[CleanedFareRecord], int]:
    """
    Eliminates redundant quote records scraped from the same source within the same window.
    Fingerprint: (carrier, flight_no, departure_date, advance_days, source)
    """
    seen_keys = set()
    duplicates_count = 0

    for rec in records:
        key = (
            rec.carrier.upper(),
            rec.flight_no.upper(),
            rec.departure_date,
            rec.advance_days,
            rec.source.lower(),
        )
        if key in seen_keys:
            rec.is_duplicate = True
            rec.include_in_cpi_index = False
            duplicates_count += 1
            logger.debug(f"Duplicate detected and flagged: {rec.flight_no} on {rec.departure_date} ({rec.source})")
        else:
            seen_keys.add(key)

    return records, duplicates_count


def filter_sold_out_and_cancelled(records: List[CleanedFareRecord]) -> Tuple[List[CleanedFareRecord], int]:
    """
    Flags sold-out and cancelled flights.
    Important PRD requirement: Exclude from index calculation to avoid distortion,
    but retain in records for capacity/availability analytics.
    """
    sold_out_count = 0
    for rec in records:
        if not rec.seat_avail or rec.seat_availability_flag in ("SOLD_OUT", "CANCELLED"):
            rec.include_in_cpi_index = False
            sold_out_count += 1

    return records, sold_out_count


def _percentile(data: List[float], p: float) -> float:
    """Compute percentile value using linear interpolation."""
    if not data:
        return 0.0
    k = (len(data) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data[int(k)]
    d0 = data[int(f)] * (c - k)
    d1 = data[int(c)] * (k - f)
    return d0 + d1


def detect_statistical_outliers(
    records: List[CleanedFareRecord],
    z_threshold: float = 2.5,
    iqr_multiplier: float = 1.5,
) -> Tuple[List[CleanedFareRecord], int]:
    """
    Detects pricing anomalies using a hybrid IQR (Interquartile Range) and Z-score filter
    partitioned by route corridor and advance-purchase window (pair, advance_days).
    """
    outliers_count = 0

    # Partition eligible candidate fares by (pair, advance_days)
    partitions: Dict[Tuple[str, int], List[CleanedFareRecord]] = defaultdict(list)
    for rec in records:
        # Sanity boundary check first
        if rec.total_fare < MIN_REALISTIC_DOMESTIC_FARE:
            rec.is_outlier = True
            rec.outlier_reason = f"PRICE_BELOW_FLOOR (₹{rec.total_fare} < ₹{MIN_REALISTIC_DOMESTIC_FARE})"
            rec.include_in_cpi_index = False
            outliers_count += 1
            continue
        elif rec.total_fare > MAX_REALISTIC_DOMESTIC_FARE:
            rec.is_outlier = True
            rec.outlier_reason = f"PRICE_ABOVE_CEILING (₹{rec.total_fare} > ₹{MAX_REALISTIC_DOMESTIC_FARE})"
            rec.include_in_cpi_index = False
            outliers_count += 1
            continue

        if not rec.is_duplicate and rec.seat_avail:
            partitions[(rec.pair, rec.advance_days)].append(rec)

    # Process each partition
    for (pair, adv_days), group in partitions.items():
        if len(group) < 3:
            # Not enough samples for statistical bounds; keep all that passed sanity check
            continue

        fares = sorted([r.total_fare for r in group])
        n = len(fares)
        mean_val = sum(fares) / n
        variance = sum((x - mean_val) ** 2 for x in fares) / max(1, n - 1)
        std_val = math.sqrt(variance)

        # IQR computation
        q1 = _percentile(fares, 0.25)
        q3 = _percentile(fares, 0.75)
        iqr = q3 - q1
        lower_bound = max(MIN_REALISTIC_DOMESTIC_FARE, q1 - iqr_multiplier * iqr)
        upper_bound = q3 + iqr_multiplier * iqr

        for rec in group:
            z_score = round((rec.total_fare - mean_val) / std_val, 2) if std_val > 0 else 0.0
            rec.z_score = z_score

            is_iqr_outlier = (rec.total_fare < lower_bound) or (rec.total_fare > upper_bound)
            is_z_outlier = abs(z_score) > z_threshold

            if is_iqr_outlier or is_z_outlier:
                rec.is_outlier = True
                rec.include_in_cpi_index = False
                outliers_count += 1
                if rec.total_fare > upper_bound:
                    rec.outlier_reason = f"IQR_HIGH_OUTLIER (₹{rec.total_fare} > upper bound ₹{round(upper_bound, 2)})"
                elif rec.total_fare < lower_bound:
                    rec.outlier_reason = f"IQR_LOW_OUTLIER (₹{rec.total_fare} < lower bound ₹{round(lower_bound, 2)})"
                else:
                    rec.outlier_reason = f"Z_SCORE_ANOMALY (z={z_score} > {z_threshold})"
                logger.warning(f"Outlier flagged on {pair} (T+{adv_days}): {rec.flight_no} fare={rec.total_fare} [{rec.outlier_reason}]")

    return records, outliers_count


def run_quality_pipeline(records: List[CleanedFareRecord]) -> Tuple[List[CleanedFareRecord], PipelineAuditSummary]:
    """
    Executes the complete end-to-end data cleaning, deduplication, and outlier detection pipeline.
    Produces clean, auditable records and an audit summary for MoSPI/DIID reporting.
    """
    total_raw = len(records)
    imputed_count = sum(1 for r in records if r.imputation_applied)

    # Step 1: Deduplication
    records, dup_count = deduplicate_fare_records(records)

    # Step 2: Sold-out and cancellation handling
    records, sold_out_count = filter_sold_out_and_cancelled(records)

    # Step 3: Statistical Outlier Detection (IQR + Z-score)
    records, outliers_count = detect_statistical_outliers(records)

    # Step 4: Summary calculations
    cpi_eligible_count = sum(1 for r in records if r.include_in_cpi_index)
    valid_cleaned = total_raw - dup_count

    # Quality score = percentage of non-outlier, non-duplicate records
    quality_score = round(
        (cpi_eligible_count / max(1, total_raw)) * 100.0, 2
    )

    summary = PipelineAuditSummary(
        total_raw_ingested=total_raw,
        valid_cleaned_records=valid_cleaned,
        duplicates_merged=dup_count,
        outliers_flagged=outliers_count,
        imputed_records_count=imputed_count,
        sold_out_excluded=sold_out_count,
        cpi_eligible_records=cpi_eligible_count,
        data_quality_score_percent=quality_score,
    )

    logger.info(
        f"Pipeline Quality Audit Complete: {total_raw} raw -> {cpi_eligible_count} CPI eligible "
        f"({dup_count} dups, {outliers_count} outliers, {sold_out_count} sold-out, Quality={quality_score}%)"
    )

    return records, summary
