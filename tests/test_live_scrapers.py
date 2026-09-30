import datetime
import pytest
from unittest.mock import patch, MagicMock

from scrapers.base import FailureClassification
from scrapers.indigo_direct import IndiGoDirectScraper, get_indigo_scraper
from scrapers.makemytrip import MakeMyTripScraper, get_makemytrip_scraper
from scrapers.models import RawFareRecord
from scrapers.registry import get_scraper, get_live_scraper, LIVE_SOURCE_KEYS


SAMPLE_INDIGO_HTML = """
<!DOCTYPE html>
<html>
<head><title>Flight Search | IndiGo</title></head>
<body>
  <script id="__NEXT_DATA__" type="application/json">
  {
    "props": {
      "pageProps": {
        "flightResults": [
          {
            "flightNumber": "6E-205",
            "baseFare": 3450.0,
            "taxesAndFees": 850.0,
            "totalFare": 4300.0,
            "departureTime": "06:00",
            "arrivalTime": "08:15",
            "seatsAvailable": 5
          },
          {
            "flightNumber": "6E-503",
            "baseFare": 3800.0,
            "taxesAndFees": 890.0,
            "totalFare": 4690.0,
            "departureTime": "09:30",
            "arrivalTime": "11:45",
            "seatsAvailable": 2
          }
        ]
      }
    }
  }
  </script>
</body>
</html>
"""

SAMPLE_MMT_HTML = """
<!DOCTYPE html>
<html>
<head><title>Flight Booking | MakeMyTrip</title></head>
<body>
  <script>
    window.__INITIAL_STATE__ = {
      "flights": {
        "searchResult": {
          "itineraries": [
            {
              "airlineName": "IndiGo",
              "flightNumber": "6E-205",
              "totalPrice": 4699.0,
              "departureTime": "06:00",
              "arrivalTime": "08:15",
              "seatsLeft": 2
            },
            {
              "airlineName": "Air India",
              "flightNumber": "AI-805",
              "totalPrice": 5150.0,
              "departureTime": "08:00",
              "arrivalTime": "10:15",
              "seatsLeft": 9
            }
          ]
        }
      }
    };
  </script>
</body>
</html>
"""


def test_indigo_scraper_parsing_embedded_json():
    scraper = IndiGoDirectScraper(min_delay=0.0, max_delay=0.0, prefer_live=False)
    records = scraper.parse_indigo_html(
        html_content=SAMPLE_INDIGO_HTML,
        origin="DEL",
        dest="BOM",
        departure_date="2026-10-15",
        advance_purchase_days=15,
        scrape_id="TEST_INDIGO_1",
        raw_ref="test/ref.html",
    )
    assert len(records) == 2
    r0 = records[0]
    assert r0.carrier == "IndiGo"
    assert r0.flight_no == "6E-205"
    assert r0.base_fare == 3450.0
    assert r0.taxes_fees == 850.0
    assert r0.convenience_fee == 0.0
    assert r0.total_fare == 4300.0
    assert r0.seat_availability_flag == "AVAILABLE"
    assert r0.is_live_data is True

    r1 = records[1]
    assert r1.seat_availability_flag == "FEW_SEATS_LEFT"


def test_indigo_scraper_fallback_on_network_block():
    scraper = IndiGoDirectScraper(min_delay=0.0, max_delay=0.0, prefer_live=True)
    with patch.object(scraper, "_fetch_live_page", return_value=(None, FailureClassification.BLOCKED, 403)):
        records = scraper.search("DEL", "BOM", "2026-10-15", 7)
        # Should gracefully fall back to calibrated fixture records
        assert len(records) > 0
        assert all(r.carrier == "IndiGo" for r in records)
        assert all(r.source_platform == "indigo_direct" for r in records)


def test_mmt_scraper_parsing_and_dark_patterns():
    scraper = MakeMyTripScraper(min_delay=0.0, max_delay=0.0, prefer_live=False)
    records = scraper.parse_mmt_html(
        html_content=SAMPLE_MMT_HTML,
        origin="DEL",
        dest="BOM",
        departure_date="2026-10-15",
        advance_purchase_days=7,
        scrape_id="TEST_MMT_1",
        raw_ref="test/mmt_ref.html",
    )
    assert len(records) == 2
    r0 = records[0]
    assert r0.carrier == "IndiGo"
    assert r0.flight_no == "6E-205"
    assert r0.total_fare == 4699.0
    assert r0.convenience_fee == 399.0
    assert r0.seat_availability_flag == "FEW_SEATS_LEFT"
    assert "Only 2 seats left" in (r0.listing_copy or "")

    r1 = records[1]
    assert r1.carrier == "Air India"
    assert r1.flight_no == "AI-805"
    assert r1.total_fare == 5150.0


def test_mmt_scraper_fallback():
    scraper = MakeMyTripScraper(min_delay=0.0, max_delay=0.0, prefer_live=True)
    with patch.object(scraper, "_fetch_live_page", return_value=(None, FailureClassification.NETWORK_ERROR, 0)):
        records = scraper.search("DEL", "BOM", "2026-10-15", 7)
        assert len(records) > 0
        assert any(r.carrier == "IndiGo" for r in records)
        assert any(r.carrier == "Air India" for r in records)


def test_registry_integration():
    assert "indigo_direct" in LIVE_SOURCE_KEYS
    assert "makemytrip" in LIVE_SOURCE_KEYS

    indigo = get_scraper("indigo_direct")
    assert isinstance(indigo, IndiGoDirectScraper)

    mmt = get_scraper("makemytrip")
    assert isinstance(mmt, MakeMyTripScraper)
