import os

import httpx
import pytest

from scrapers.amadeus_fare_scraper import (
    AmadeusFareScraper,
    is_configured,
    get_amadeus_scraper_if_configured,
    parse_flight_offers,
)
from scrapers.base import FailureClassification

# A realistic Amadeus Flight Offers Search v2 response, shaped exactly like
# the real, documented API contract (data[].price, data[].itineraries[].segments[]).
CANNED_AMADEUS_RESPONSE = {
    "data": [
        {
            "price": {
                "currency": "INR",
                "total": "4850.00",
                "base": "4200.00",
                "fees": [{"amount": "0.00", "type": "SUPPLIER"}],
            },
            "numberOfBookableSeats": 4,
            "itineraries": [
                {
                    "segments": [
                        {
                            "carrierCode": "6E",
                            "number": "2041",
                            "departure": {"iataCode": "DEL", "at": "2026-10-01T06:30:00"},
                            "arrival": {"iataCode": "BOM", "at": "2026-10-01T08:45:00"},
                        }
                    ]
                }
            ],
        },
        {
            "price": {"currency": "INR", "total": "6200.50", "base": "5600.00", "fees": []},
            "numberOfBookableSeats": 2,
            "itineraries": [
                {
                    "segments": [
                        {
                            "carrierCode": "AI",
                            "number": "802",
                            "departure": {"iataCode": "DEL", "at": "2026-10-01T09:00:00"},
                            "arrival": {"iataCode": "BOM", "at": "2026-10-01T11:15:00"},
                        }
                    ]
                }
            ],
        },
    ]
}


def test_is_configured_reflects_env_vars(monkeypatch):
    monkeypatch.delenv("AMADEUS_API_KEY", raising=False)
    monkeypatch.delenv("AMADEUS_API_SECRET", raising=False)
    assert is_configured() is False

    monkeypatch.setenv("AMADEUS_API_KEY", "test-key")
    monkeypatch.setenv("AMADEUS_API_SECRET", "test-secret")
    assert is_configured() is True


def test_get_amadeus_scraper_if_configured_returns_none_without_credentials(monkeypatch):
    monkeypatch.delenv("AMADEUS_API_KEY", raising=False)
    monkeypatch.delenv("AMADEUS_API_SECRET", raising=False)
    assert get_amadeus_scraper_if_configured() is None


def test_get_amadeus_scraper_if_configured_returns_real_scraper_with_credentials(monkeypatch):
    monkeypatch.setenv("AMADEUS_API_KEY", "test-key")
    monkeypatch.setenv("AMADEUS_API_SECRET", "test-secret")
    scraper = get_amadeus_scraper_if_configured()
    assert isinstance(scraper, AmadeusFareScraper)


def test_amadeus_fare_scraper_raises_without_credentials():
    with pytest.raises(ValueError):
        AmadeusFareScraper(api_key=None, api_secret=None)


def test_parse_flight_offers_maps_real_schema_to_raw_fare_records():
    records = parse_flight_offers(
        CANNED_AMADEUS_RESPONSE, "DEL-BOM", "DEL", "BOM", "2026-10-01", advance_purchase_days=7
    )
    assert len(records) == 2

    indigo, air_india = records
    assert indigo.carrier == "6E"
    assert indigo.flight_no == "6E-2041"
    assert indigo.total_fare == 4850.0
    assert indigo.base_fare == 4200.0
    assert indigo.departure_time == "2026-10-01T06:30:00"
    assert indigo.arrival_time == "2026-10-01T08:45:00"
    assert indigo.data_mode == "live"
    assert indigo.is_live_data is True
    assert indigo.seat_availability_flag == "AVAILABLE"

    assert air_india.carrier == "AI"
    assert air_india.flight_no == "AI-802"
    assert air_india.total_fare == 6200.50
    assert air_india.seat_availability_flag == "FEW_SEATS_LEFT"  # 2 seats left


def test_parse_flight_offers_returns_empty_list_for_no_offers():
    assert parse_flight_offers({"data": []}, "DEL-BOM", "DEL", "BOM", "2026-10-01", 7) == []


def test_parse_flight_offers_raises_selector_miss_on_malformed_offer():
    malformed = {"data": [{"price": {"total": "4850.00"}}]}  # missing itineraries
    with pytest.raises(ValueError) as exc_info:
        parse_flight_offers(malformed, "DEL-BOM", "DEL", "BOM", "2026-10-01", 7)
    assert FailureClassification.SELECTOR_MISS in str(exc_info.value)


def test_get_access_token_uses_real_oauth2_client_credentials_shape(monkeypatch):
    """
    No live network call: httpx.post is monkeypatched to return a canned
    response shaped exactly like Amadeus's real, documented OAuth2 token
    response, verifying the request itself is built correctly (grant_type,
    client_id/secret, form encoding) against that real contract.
    """
    monkeypatch.setenv("AMADEUS_API_KEY", "test-key")
    monkeypatch.setenv("AMADEUS_API_SECRET", "test-secret")

    captured = {}

    class _FakeTokenResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"access_token": "fake-bearer-token", "expires_in": 1799}

    def _fake_post(url, data=None, headers=None, timeout=None):
        captured["url"] = url
        captured["data"] = data
        return _FakeTokenResponse()

    monkeypatch.setattr(httpx, "post", _fake_post)

    scraper = AmadeusFareScraper()
    token = scraper._get_access_token()

    assert token == "fake-bearer-token"
    assert captured["url"].endswith("/v1/security/oauth2/token")
    assert captured["data"]["grant_type"] == "client_credentials"
    assert captured["data"]["client_id"] == "test-key"
    assert captured["data"]["client_secret"] == "test-secret"

    # Second call within the cache window should NOT re-request a token.
    def _fail_if_called(*args, **kwargs):
        raise AssertionError("Should not re-request a token while the cached one is still valid")

    monkeypatch.setattr(httpx, "post", _fail_if_called)
    assert scraper._get_access_token() == "fake-bearer-token"


def test_get_access_token_raises_connection_error_on_network_failure(monkeypatch):
    monkeypatch.setenv("AMADEUS_API_KEY", "test-key")
    monkeypatch.setenv("AMADEUS_API_SECRET", "test-secret")

    def _raise(*args, **kwargs):
        raise httpx.ConnectError("simulated network failure")

    monkeypatch.setattr(httpx, "post", _raise)
    scraper = AmadeusFareScraper()
    with pytest.raises(ConnectionError) as exc_info:
        scraper._get_access_token()
    assert FailureClassification.NETWORK_ERROR in str(exc_info.value)
