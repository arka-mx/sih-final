import httpx
import pytest

from scrapers.travelpayouts_fare_scraper import (
    TravelpayoutsFareScraper,
    CACHE_STALENESS_DAYS,
    is_configured,
    get_travelpayouts_scraper_if_configured,
    parse_prices_for_dates,
)
from scrapers.base import FailureClassification

# A realistic Travelpayouts `prices_for_dates` v3 response, shaped exactly
# like the real, documented API contract (data[].price/.airline/
# .flight_number/.departure_at/.transfers, top-level currency).
CANNED_TRAVELPAYOUTS_RESPONSE = {
    "success": True,
    "data": [
        {
            "origin": "DEL",
            "destination": "BOM",
            "origin_airport": "DEL",
            "destination_airport": "BOM",
            "price": 3450,
            "airline": "6E",
            "flight_number": 2041,
            "departure_at": "2026-10-15T06:30:00+05:30",
            "transfers": 0,
            "duration_to": 130,
        },
        {
            "origin": "DEL",
            "destination": "BOM",
            "origin_airport": "DEL",
            "destination_airport": "BOM",
            "price": 6820.5,
            "airline": "AI",
            "flight_number": 802,
            "departure_at": "2026-10-15T09:00:00+05:30",
            "transfers": 1,
            "duration_to": 205,
        },
    ],
    "currency": "inr",
}


def test_is_configured_reflects_env_var(monkeypatch):
    monkeypatch.delenv("TRAVELPAYOUTS_TOKEN", raising=False)
    assert is_configured() is False

    monkeypatch.setenv("TRAVELPAYOUTS_TOKEN", "test-token")
    assert is_configured() is True


def test_get_travelpayouts_scraper_if_configured_returns_none_without_token(monkeypatch):
    monkeypatch.delenv("TRAVELPAYOUTS_TOKEN", raising=False)
    assert get_travelpayouts_scraper_if_configured() is None


def test_get_travelpayouts_scraper_if_configured_returns_real_scraper_with_token(monkeypatch):
    monkeypatch.setenv("TRAVELPAYOUTS_TOKEN", "test-token")
    scraper = get_travelpayouts_scraper_if_configured()
    assert isinstance(scraper, TravelpayoutsFareScraper)


def test_travelpayouts_fare_scraper_raises_without_token():
    with pytest.raises(ValueError):
        TravelpayoutsFareScraper(token=None)


def test_parse_prices_for_dates_maps_real_schema_to_raw_fare_records():
    records = parse_prices_for_dates(
        CANNED_TRAVELPAYOUTS_RESPONSE, "DEL-BOM", "DEL", "BOM", "2026-10-15", advance_purchase_days=15
    )
    assert len(records) == 2

    indigo, air_india = records
    assert indigo.carrier == "IndiGo"
    assert indigo.flight_no == "6E-2041"
    assert indigo.total_fare == 3450.0
    assert indigo.base_fare == 3450.0
    assert indigo.taxes_fees == 0.0
    assert indigo.currency == "INR"
    assert indigo.data_mode == "live"
    assert indigo.is_live_data is True
    assert str(CACHE_STALENESS_DAYS) in indigo.simulation_disclaimer

    assert air_india.carrier == "Air India"
    assert air_india.flight_no == "AI-802"
    assert air_india.total_fare == 6820.5


def test_parse_prices_for_dates_returns_empty_list_for_no_offers():
    assert parse_prices_for_dates({"data": [], "currency": "inr"}, "DEL-BOM", "DEL", "BOM", "2026-10-15", 15) == []


def test_parse_prices_for_dates_raises_selector_miss_without_data_key():
    with pytest.raises(ValueError) as exc_info:
        parse_prices_for_dates({"success": True}, "DEL-BOM", "DEL", "BOM", "2026-10-15", 15)
    assert FailureClassification.SELECTOR_MISS in str(exc_info.value)


def test_parse_prices_for_dates_raises_selector_miss_on_malformed_row():
    malformed = {"data": [{"airline": "6E"}], "currency": "inr"}  # missing price
    with pytest.raises(ValueError) as exc_info:
        parse_prices_for_dates(malformed, "DEL-BOM", "DEL", "BOM", "2026-10-15", 15)
    assert FailureClassification.SELECTOR_MISS in str(exc_info.value)


def test_search_uses_real_prices_for_dates_contract(monkeypatch):
    """
    No live network call: httpx.get is monkeypatched to return a canned
    response shaped exactly like Travelpayouts's real, documented
    prices_for_dates response, verifying the request itself is built
    correctly (endpoint, params, token) against that real contract.
    """
    monkeypatch.setenv("TRAVELPAYOUTS_TOKEN", "test-token")
    captured = {}

    class _FakeResponse:
        status_code = 200

        def json(self):
            return CANNED_TRAVELPAYOUTS_RESPONSE

    def _fake_get(url, params=None, headers=None, timeout=None):
        captured["url"] = url
        captured["params"] = params
        return _FakeResponse()

    monkeypatch.setattr(httpx, "get", _fake_get)

    scraper = TravelpayoutsFareScraper()
    records = scraper.search("DEL", "BOM", "2026-10-15", 15)

    assert captured["url"].endswith("/aviasales/v3/prices_for_dates")
    assert captured["params"]["origin"] == "DEL"
    assert captured["params"]["destination"] == "BOM"
    assert captured["params"]["departure_at"] == "2026-10-15"
    assert captured["params"]["token"] == "test-token"
    assert len(records) == 2


def test_search_raises_blocked_on_401(monkeypatch):
    monkeypatch.setenv("TRAVELPAYOUTS_TOKEN", "bad-token")

    class _FakeResponse:
        status_code = 401
        text = "invalid token"

    monkeypatch.setattr(httpx, "get", lambda *a, **kw: _FakeResponse())

    scraper = TravelpayoutsFareScraper()
    with pytest.raises(ConnectionError) as exc_info:
        scraper.search("DEL", "BOM", "2026-10-15", 15)
    assert FailureClassification.BLOCKED in str(exc_info.value)


def test_search_raises_network_error_on_connect_failure(monkeypatch):
    monkeypatch.setenv("TRAVELPAYOUTS_TOKEN", "test-token")

    def _raise(*args, **kwargs):
        raise httpx.ConnectError("simulated network failure")

    monkeypatch.setattr(httpx, "get", _raise)
    scraper = TravelpayoutsFareScraper()
    with pytest.raises(ConnectionError) as exc_info:
        scraper.search("DEL", "BOM", "2026-10-15", 15)
    assert FailureClassification.NETWORK_ERROR in str(exc_info.value)
