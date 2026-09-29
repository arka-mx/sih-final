from scrapers.models import RawFareRecord
from pipeline.decompose import decompose_matched_flights


def _raw(scrape_id, source_platform, carrier, flight_no, departure_date, advance_days,
         base_fare, taxes_fees, convenience_fee, total_fare, route_pair="DEL-BOM"):
    origin, destination = route_pair.split("-")
    return RawFareRecord(
        scrape_id=scrape_id,
        source_platform=source_platform,
        origin=origin,
        destination=destination,
        route_pair=route_pair,
        carrier=carrier,
        flight_no=flight_no,
        departure_date=departure_date,
        departure_time="08:00",
        arrival_time="10:00",
        advance_purchase_days=advance_days,
        fare_class="Economy",
        base_fare=base_fare,
        taxes_fees=taxes_fees,
        convenience_fee=convenience_fee,
        total_fare=total_fare,
        currency="INR",
        seat_availability_flag="AVAILABLE",
        scrape_timestamp="2026-10-01T00:00:00Z",
        raw_payload_ref=f"{source_platform}/{scrape_id}.json",
    )


def test_matched_flight_infers_convenience_fee_and_base_diff():
    direct = _raw("D1", "simulated_indigo", "IndiGo", "6E-205", "2026-10-15", 7,
                   base_fare=3500.0, taxes_fees=800.0, convenience_fee=0.0, total_fare=4300.0)
    ota = _raw("M1", "simulated_makemytrip", "IndiGo", "6E-205", "2026-10-15", 7,
                base_fare=3500.0, taxes_fees=800.0, convenience_fee=250.0, total_fare=4550.0)

    results = decompose_matched_flights([direct], [ota])

    assert len(results) == 1
    result = results[0].to_dict()
    assert result["inferred_convenience_fee"] == 250.0
    assert result["base_fare_diff"] == 0.0
    assert result["direct_total"] == 4300.0
    assert result["mmt_total"] == 4550.0
    assert result["raw_direct_ref"] == "simulated_indigo/D1.json"
    assert result["raw_mmt_ref"] == "simulated_makemytrip/M1.json"


def test_unmatched_flights_produce_no_decomposition():
    direct = _raw("D1", "simulated_indigo", "IndiGo", "6E-205", "2026-10-15", 7,
                   base_fare=3500.0, taxes_fees=800.0, convenience_fee=0.0, total_fare=4300.0)
    # Different flight number: should not match.
    ota = _raw("M1", "simulated_makemytrip", "IndiGo", "6E-999", "2026-10-15", 7,
                base_fare=3500.0, taxes_fees=800.0, convenience_fee=250.0, total_fare=4550.0)

    results = decompose_matched_flights([direct], [ota])
    assert results == []


def test_matching_is_case_insensitive_on_carrier_and_flight_no():
    direct = _raw("D1", "simulated_indigo", "indigo", "6e-205", "2026-10-15", 7,
                   base_fare=3500.0, taxes_fees=800.0, convenience_fee=0.0, total_fare=4300.0)
    ota = _raw("M1", "simulated_makemytrip", "INDIGO", "6E-205", "2026-10-15", 7,
                base_fare=3500.0, taxes_fees=800.0, convenience_fee=250.0, total_fare=4550.0)

    results = decompose_matched_flights([direct], [ota])
    assert len(results) == 1


def test_multiple_direct_records_last_one_wins_index():
    # decompose_matched_flights indexes direct records by key, so if two
    # direct-channel quotes exist for the same key, the later one in the
    # list is what gets matched against.
    direct_first = _raw("D1", "simulated_indigo", "IndiGo", "6E-205", "2026-10-15", 7,
                         base_fare=3400.0, taxes_fees=800.0, convenience_fee=0.0, total_fare=4200.0)
    direct_second = _raw("D2", "simulated_indigo", "IndiGo", "6E-205", "2026-10-15", 7,
                          base_fare=3500.0, taxes_fees=800.0, convenience_fee=0.0, total_fare=4300.0)
    ota = _raw("M1", "simulated_makemytrip", "IndiGo", "6E-205", "2026-10-15", 7,
                base_fare=3500.0, taxes_fees=800.0, convenience_fee=250.0, total_fare=4550.0)

    results = decompose_matched_flights([direct_first, direct_second], [ota])

    assert len(results) == 1
    assert results[0].to_dict()["direct_total"] == 4300.0
    assert results[0].to_dict()["raw_direct_ref"] == "simulated_indigo/D2.json"
