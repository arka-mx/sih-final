from pipeline.dark_pattern_detector import (
    detect_scarcity_messaging,
    detect_repeat_view_price_escalation,
    run_dark_pattern_detector,
)
from scrapers.models import RawFareRecord


def _base_record(**overrides) -> RawFareRecord:
    defaults = dict(
        scrape_id="TEST_01",
        source_platform="simulated_makemytrip",
        origin="DEL",
        destination="BOM",
        route_pair="DEL-BOM",
        carrier="IndiGo",
        flight_no="6E-205",
        departure_date="2026-10-06",
        departure_time="06:00",
        arrival_time="08:15",
        advance_purchase_days=7,
        fare_class="Economy",
        base_fare=3450.0,
        taxes_fees=850.0,
        convenience_fee=399.0,
        total_fare=4699.0,
        currency="INR",
        seat_availability_flag="AVAILABLE",
        scrape_timestamp="2026-09-29T00:00:00Z",
        raw_payload_ref="raw/TEST_01.json",
    )
    defaults.update(overrides)
    return RawFareRecord(**defaults)


def test_scarcity_copy_mismatch_flagged_high_when_available():
    rec = _base_record(listing_copy="Hurry! Only 2 seats left at this price.", seat_availability_flag="AVAILABLE")
    flags = detect_scarcity_messaging([rec])
    assert len(flags) == 1
    assert flags[0].pattern_type == "SCARCITY_COPY_MISMATCH"
    assert flags[0].severity == "HIGH"


def test_scarcity_copy_consistent_flagged_medium_when_few_seats_left():
    rec = _base_record(listing_copy="Selling fast - high demand on this route.", seat_availability_flag="FEW_SEATS_LEFT")
    flags = detect_scarcity_messaging([rec])
    assert len(flags) == 1
    assert flags[0].pattern_type == "SCARCITY_MESSAGING"
    assert flags[0].severity == "MEDIUM"


def test_no_listing_copy_not_flagged():
    rec = _base_record(listing_copy=None)
    assert detect_scarcity_messaging([rec]) == []


def test_non_scarcity_copy_not_flagged():
    rec = _base_record(listing_copy="Free cancellation within 24 hours.")
    assert detect_scarcity_messaging([rec]) == []


def test_repeat_view_price_escalation_flagged():
    rec = _base_record(repeat_view_fare_history=[4500.0, 4600.0, 4700.0])
    flags = detect_repeat_view_price_escalation([rec])
    assert len(flags) == 1
    assert flags[0].pattern_type == "REPEAT_VIEW_PRICE_ESCALATION"
    assert flags[0].evidence["pct_change"] > 2.0


def test_repeat_view_price_escalation_below_threshold_not_flagged():
    rec = _base_record(repeat_view_fare_history=[4500.0, 4505.0, 4510.0])
    assert detect_repeat_view_price_escalation([rec]) == []


def test_repeat_view_no_history_not_flagged():
    rec = _base_record(repeat_view_fare_history=None)
    assert detect_repeat_view_price_escalation([rec]) == []


def test_run_dark_pattern_detector_combines_both_checks():
    scarcity_rec = _base_record(
        scrape_id="A", flight_no="6E-205", listing_copy="Hurry! Only 1 seat left at this price.",
    )
    escalation_rec = _base_record(
        scrape_id="B", flight_no="AI-805", repeat_view_fare_history=[4000.0, 4100.0, 4300.0],
    )
    clean_rec = _base_record(scrape_id="C", flight_no="SG-153")

    report = run_dark_pattern_detector([scarcity_rec, escalation_rec, clean_rec])
    assert report.total_listings_scanned == 3
    assert len(report.flags) == 2
    pattern_types = {f.pattern_type for f in report.flags}
    assert pattern_types == {"SCARCITY_COPY_MISMATCH", "REPEAT_VIEW_PRICE_ESCALATION"}

    report_dict = report.to_dict()
    assert report_dict["total_flagged"] == 2
    assert report_dict["flagged_by_pattern_type"]["SCARCITY_COPY_MISMATCH"] == 1
