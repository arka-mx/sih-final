import datetime

import httpx
import pytest

from scrapers.base import FailureClassification
from scrapers.wayback_fare_scraper import SnapshotRef, find_snapshots, parse_fare_snapshot

SNAPSHOT = SnapshotRef(timestamp="20240315103000", original_url="https://example-ota.test/flights/DEL-BOM")

# A realistic archived OTA fare-listing page: unstructured HTML text with
# flight numbers, rupee prices, and a departure date, roughly as a real
# archived MakeMyTrip/Cleartrip-style page might render server-side.
FIXTURE_HTML = """
<html><body>
<div class="flight-card">
  <span class="flight-no">6E 205</span>
  <span class="date">15 Mar 2024</span>
  <span class="fare">₹4,850</span>
</div>
<div class="flight-card">
  <span class="flight-no">AI 802</span>
  <span class="date">15 Mar 2024</span>
  <span class="fare">Rs. 6200</span>
</div>
<div class="flight-card">
  <span class="flight-no">SG 118</span>
  <span class="date">15 Mar 2024</span>
  <span class="fare">INR 3999</span>
</div>
</body></html>
"""

NO_FARE_HTML = "<html><body><h1>Page not found</h1></body></html>"


def test_parse_fare_snapshot_extracts_real_prices_and_carriers():
    records = parse_fare_snapshot(FIXTURE_HTML, SNAPSHOT, "DEL-BOM", "DEL", "BOM")

    assert len(records) == 3
    totals = sorted(r.total_fare for r in records)
    assert totals == [3999.0, 4850.0, 6200.0]

    carriers = {r.carrier for r in records}
    assert carriers == {"IndiGo", "Air India", "SpiceJet"}

    for record in records:
        assert record.data_mode == "archived"
        assert record.is_live_data is False
        assert record.route_pair == "DEL-BOM"
        assert SNAPSHOT.archived_url in record.simulation_disclaimer
        assert record.base_fare + record.taxes_fees == pytest.approx(record.total_fare)


def test_parse_fare_snapshot_uses_real_extracted_departure_date():
    records = parse_fare_snapshot(FIXTURE_HTML, SNAPSHOT, "DEL-BOM", "DEL", "BOM")
    assert all(r.departure_date == "2024-03-15" for r in records)
    # Capture date is also 2024-03-15, so the same-day listing means a 0-day
    # advance-purchase window.
    assert all(r.advance_purchase_days == 0 for r in records)


def test_parse_fare_snapshot_falls_back_to_capture_date_plus_one_without_a_parsed_date():
    html_without_date = '<div class="fare">₹5000</div><span class="flight-no">6E 100</span>'
    records = parse_fare_snapshot(html_without_date, SNAPSHOT, "DEL-BOM", "DEL", "BOM")
    expected_departure = (SNAPSHOT.capture_date + datetime.timedelta(days=1)).isoformat()
    assert records[0].departure_date == expected_departure
    assert records[0].advance_purchase_days == 1


def test_parse_fare_snapshot_raises_selector_miss_with_no_price_figures():
    with pytest.raises(ValueError) as exc_info:
        parse_fare_snapshot(NO_FARE_HTML, SNAPSHOT, "DEL-BOM", "DEL", "BOM")
    assert FailureClassification.SELECTOR_MISS in str(exc_info.value)


def test_parse_fare_snapshot_ignores_implausible_amounts():
    # A price outside the plausible domestic-fare range should be dropped,
    # and since it's the only "fare" present, this should raise SELECTOR_MISS
    # rather than fabricate an entry.
    html = '<span class="fare">₹99</span><span class="flight-no">6E 205</span>'
    with pytest.raises(ValueError):
        parse_fare_snapshot(html, SNAPSHOT, "DEL-BOM", "DEL", "BOM")


def test_snapshot_ref_archived_url_and_capture_date():
    assert SNAPSHOT.archived_url == "http://web.archive.org/web/20240315103000/https://example-ota.test/flights/DEL-BOM"
    assert SNAPSHOT.capture_date == datetime.date(2024, 3, 15)


def test_find_snapshots_parses_real_cdx_json_shape(monkeypatch):
    """
    No network access is used here: httpx.get is monkeypatched to return a
    canned response shaped exactly like the real, documented Wayback CDX API
    JSON contract (a header row followed by data rows).
    """
    canned_rows = [
        ["urlkey", "timestamp", "original", "mimetype", "statuscode", "digest", "length"],
        ["test)/flights/del-bom", "20240301120000", "https://example-ota.test/flights/DEL-BOM", "text/html", "200", "ABC123", "5000"],
        ["test)/flights/del-bom", "20240315103000", "https://example-ota.test/flights/DEL-BOM", "text/html", "200", "DEF456", "5100"],
    ]

    class _FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return canned_rows

    def _fake_get(url, params=None, timeout=None, headers=None):
        assert "cdx/search/cdx" in url
        return _FakeResponse()

    monkeypatch.setattr(httpx, "get", _fake_get)

    snapshots = find_snapshots("https://example-ota.test/flights/DEL-BOM", "2024-01-01", "2024-12-31")
    assert len(snapshots) == 2
    assert snapshots[0].timestamp == "20240301120000"
    assert snapshots[1].timestamp == "20240315103000"
    assert all(s.original_url == "https://example-ota.test/flights/DEL-BOM" for s in snapshots)


def test_find_snapshots_returns_empty_list_with_no_data_rows(monkeypatch):
    class _FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return []

    monkeypatch.setattr(httpx, "get", lambda *a, **k: _FakeResponse())
    assert find_snapshots("https://example-ota.test/x", "2024-01-01", "2024-12-31") == []


def test_find_snapshots_raises_connection_error_on_network_failure(monkeypatch):
    def _raise(*args, **kwargs):
        raise httpx.ConnectError("simulated network failure")

    monkeypatch.setattr(httpx, "get", _raise)
    with pytest.raises(ConnectionError) as exc_info:
        find_snapshots("https://example-ota.test/x", "2024-01-01", "2024-12-31")
    assert FailureClassification.NETWORK_ERROR in str(exc_info.value)
