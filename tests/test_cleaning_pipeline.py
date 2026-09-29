import pytest
from pipeline.cleaning import (
    clean_currency_amount,
    normalize_airport_code,
    normalize_carrier_name,
    clean_fare_record,
)
from pipeline.outlier_detection import (
    deduplicate_fare_records,
    filter_sold_out_and_cancelled,
    detect_statistical_outliers,
    run_quality_pipeline,
)
from pipeline.schema import CleanedFareRecord


def test_clean_currency_amount():
    assert clean_currency_amount("₹ 3,450.50") == 3450.50
    assert clean_currency_amount("Rs. 4,200") == 4200.0
    assert clean_currency_amount("INR 5000") == 5000.0
    assert clean_currency_amount(3800) == 3800.0
    assert clean_currency_amount(None) == 0.0
    assert clean_currency_amount("invalid") == 0.0


def test_normalize_airport_and_carrier():
    assert normalize_airport_code("DELHI") == "DEL"
    assert normalize_airport_code("MUMBAI") == "BOM"
    assert normalize_airport_code("BLR") == "BLR"
    assert normalize_carrier_name("6e") == "IndiGo"
    assert normalize_carrier_name("air india") == "Air India"
    assert normalize_carrier_name("spicejet") == "SpiceJet"


def test_imputation_of_missing_base_fare():
    raw_quote = {
        "scrape_id": "TEST_01",
        "source_platform": "makemytrip",
        "origin": "DEL",
        "dest": "BOM",
        "carrier": "IndiGo",
        "flight_no": "6E-205",
        "departure_date": "2026-10-01",
        "advance_days": 7,
        "base_fare": 0.0,  # Missing!
        "taxes_fees": 0.0,
        "convenience_fee": 150.0,
        "total_fare": 5000.0,
        "seat_availability_flag": "AVAILABLE",
    }
    cleaned = clean_fare_record(raw_quote)
    assert cleaned.imputation_applied is True
    assert "base_fare" in cleaned.imputed_fields
    assert cleaned.base_fare == 3900.0  # 78% of 5000
    assert cleaned.taxes_udf == 950.0   # 5000 - 3900 - 150


def test_deduplicate_records():
    rec1 = clean_fare_record({
        "scrape_id": "S1", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
        "flight_no": "6E-205", "departure_date": "2026-10-01", "advance_days": 7,
        "total_fare": 4500.0, "source_platform": "makemytrip"
    })
    rec2 = clean_fare_record({
        "scrape_id": "S2", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
        "flight_no": "6E-205", "departure_date": "2026-10-01", "advance_days": 7,
        "total_fare": 4500.0, "source_platform": "makemytrip"
    })
    records, dup_count = deduplicate_fare_records([rec1, rec2])
    assert dup_count == 1
    assert rec1.is_duplicate is False
    assert rec2.is_duplicate is True
    assert rec2.include_in_cpi_index is False


def test_outlier_detection_iqr_and_extreme():
    # Normal cluster around ~4500
    fares = [4300, 4400, 4500, 4550, 4600, 4700]
    records = [
        clean_fare_record({
            "scrape_id": f"S{i}", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
            "flight_no": f"6E-{i}", "departure_date": "2026-10-01", "advance_days": 7,
            "total_fare": f, "source_platform": "makemytrip"
        })
        for i, f in enumerate(fares)
    ]
    # Add an extreme high outlier (e.g. ₹99,999 glitch) and low outlier (< ₹800 floor)
    high_outlier = clean_fare_record({
        "scrape_id": "S_HIGH", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
        "flight_no": "6E-999", "departure_date": "2026-10-01", "advance_days": 7,
        "total_fare": 52000.0, "source_platform": "makemytrip"
    })
    low_outlier = clean_fare_record({
        "scrape_id": "S_LOW", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
        "flight_no": "6E-001", "departure_date": "2026-10-01", "advance_days": 7,
        "total_fare": 100.0, "source_platform": "makemytrip"
    })

    all_records = records + [high_outlier, low_outlier]
    processed, outliers_count = detect_statistical_outliers(all_records)

    assert high_outlier.is_outlier is True
    assert high_outlier.include_in_cpi_index is False
    assert low_outlier.is_outlier is True
    assert low_outlier.include_in_cpi_index is False
    assert outliers_count >= 2


def test_sold_out_retained_but_excluded_from_index():
    sold_out = clean_fare_record({
        "scrape_id": "SO1", "origin": "DEL", "dest": "BOM", "carrier": "IndiGo",
        "flight_no": "6E-555", "departure_date": "2026-10-01", "advance_days": 7,
        "total_fare": 4500.0, "seat_availability_flag": "SOLD_OUT"
    })
    _, count = filter_sold_out_and_cancelled([sold_out])
    assert count == 1
    assert sold_out.include_in_cpi_index is False
