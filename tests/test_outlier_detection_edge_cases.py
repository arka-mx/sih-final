from pipeline.cleaning import clean_fare_record
from pipeline.outlier_detection import (
    detect_statistical_outliers,
    MIN_REALISTIC_DOMESTIC_FARE,
    MAX_REALISTIC_DOMESTIC_FARE,
)


def _fare_record(scrape_id, fare, pair_suffix="DEL-BOM", advance_days=7, **overrides):
    origin, dest = pair_suffix.split("-")
    payload = {
        "scrape_id": scrape_id,
        "origin": origin,
        "dest": dest,
        "carrier": "IndiGo",
        "flight_no": f"6E-{scrape_id}",
        "departure_date": "2026-10-01",
        "advance_days": advance_days,
        "total_fare": fare,
        "source_platform": "makemytrip",
    }
    payload.update(overrides)
    return clean_fare_record(payload)


def test_small_partition_below_sample_floor_is_kept_as_is():
    # Fewer than 3 eligible quotes in a (pair, advance_days) partition: no
    # statistical bound can be computed, so nothing gets flagged purely on
    # dispersion grounds even though 9000 is far from 4500.
    records = [_fare_record("A", 4500.0), _fare_record("B", 9000.0)]
    processed, outliers_count = detect_statistical_outliers(records)
    assert outliers_count == 0
    assert all(not r.is_outlier for r in processed)


def test_price_floor_and_ceiling_apply_regardless_of_partition_size():
    below_floor = _fare_record("LOW", MIN_REALISTIC_DOMESTIC_FARE - 1)
    above_ceiling = _fare_record("HIGH", MAX_REALISTIC_DOMESTIC_FARE + 1)
    processed, outliers_count = detect_statistical_outliers([below_floor, above_ceiling])
    assert outliers_count == 2
    assert below_floor.is_outlier is True
    assert "PRICE_BELOW_FLOOR" in below_floor.outlier_reason
    assert above_ceiling.is_outlier is True
    assert "PRICE_ABOVE_CEILING" in above_ceiling.outlier_reason


def test_z_score_outlier_flagged_in_tight_low_variance_cluster():
    # A tight, low-variance cluster where one point sits far enough away to
    # trip either the z-score or IQR fence; the record must get a non-zero
    # z_score computed and be excluded from the CPI index either way.
    fares = [4500.0, 4510.0, 4490.0, 4505.0, 4495.0]
    records = [_fare_record(f"N{i}", f) for i, f in enumerate(fares)]
    spike = _fare_record("SPIKE", 5200.0)
    processed, outliers_count = detect_statistical_outliers(records + [spike])
    assert spike.is_outlier is True
    assert spike.include_in_cpi_index is False
    assert spike.z_score != 0.0
    assert outliers_count >= 1
    assert all(not r.is_outlier for r in records)


def test_sold_out_and_duplicate_records_excluded_from_partitioning():
    # Sold-out / duplicate quotes shouldn't count toward or against the
    # statistical bounds of the eligible partition.
    eligible = [_fare_record(f"E{i}", f) for i, f in enumerate([4300, 4400, 4500, 4600])]
    sold_out = _fare_record("SOLD", 4550.0, seat_availability_flag="SOLD_OUT")
    sold_out.seat_avail = False
    duplicate = _fare_record("DUP", 4550.0)
    duplicate.is_duplicate = True

    processed, outliers_count = detect_statistical_outliers(eligible + [sold_out, duplicate])

    assert sold_out.is_outlier is False
    assert duplicate.is_outlier is False


def test_different_advance_day_windows_are_partitioned_separately():
    # A fare that's normal for T+30 but wildly high relative to a T+1
    # cluster must not contaminate the T+1 partition's bounds.
    t1_fares = [_fare_record(f"T1_{i}", f, advance_days=1) for i, f in enumerate([4000, 4100, 4200, 4300])]
    t30_fares = [_fare_record(f"T30_{i}", f, advance_days=30) for i, f in enumerate([9000, 9100, 9200, 9300])]

    processed, outliers_count = detect_statistical_outliers(t1_fares + t30_fares)

    assert outliers_count == 0
    assert all(not r.is_outlier for r in processed)
