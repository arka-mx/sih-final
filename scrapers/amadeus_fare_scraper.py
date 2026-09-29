"""
Real live-fare client for the Amadeus for Developers Self-Service Flight
Offers Search API.

Unlike scraping an airline/OTA's own booking page, this is a documented,
stable, ToS-compliant REST API explicitly offered for third-party
integration (PRD section 6 endorses exactly this: "use official partner
APIs where offered (e.g., some OTAs have affiliate/data APIs)"). Amadeus has
a genuine free ("test environment") tier that returns real, live flight-offer
data -- not a fixture -- for a self-service signup, no payment details
required.

This module is fully built and unit-tested against Amadeus's documented,
stable response schema (mocked HTTP in tests/test_amadeus_fare_scraper.py),
but the live OAuth2 token exchange and flight-offer search calls have not
been executed against the real Amadeus API: that needs a real
AMADEUS_API_KEY/AMADEUS_API_SECRET pair, which requires a human to sign up
for (see https://developers.amadeus.com/register -- free, a few minutes, no
payment info for the test tier). Until those env vars are set,
`is_configured()` returns False and this source is skipped cleanly by
anything that calls `get_amadeus_scraper_if_configured()`, rather than
crashing the pipeline -- matching the PRD's "fallback manual-refresh queue
for blocked sessions" resilience principle.
"""

import datetime
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

from ingestion.raw_store import persist_raw_payload
from scrapers.base import BaseScraper, FailureClassification
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

# Amadeus's free/test-tier base URL. Switch to api.amadeus.com for a paid
# production key; left as an explicit constant rather than an env var so the
# test-vs-production distinction is never accidentally silent.
AMADEUS_BASE_URL = "https://test.api.amadeus.com"
TOKEN_URL = f"{AMADEUS_BASE_URL}/v1/security/oauth2/token"
FLIGHT_OFFERS_URL = f"{AMADEUS_BASE_URL}/v2/shopping/flight-offers"

# Refresh the cached token a minute before Amadeus's own stated expiry, to
# avoid a request racing an about-to-expire token.
TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS = 60


def is_configured() -> bool:
    return bool(os.environ.get("AMADEUS_API_KEY")) and bool(os.environ.get("AMADEUS_API_SECRET"))


class AmadeusFareScraper(BaseScraper):
    """
    Real BaseScraper implementation backed by the Amadeus Self-Service
    Flight Offers Search API. See module docstring for the live-verification
    caveat: the HTTP calls in this class are real, but unexercised against
    the live API in this codebase's development environment (no credentials,
    no network access there).
    """

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        super().__init__(source_name="amadeus_live", domain="test.api.amadeus.com", min_delay=0.5, max_delay=1.5)
        self.api_key = api_key or os.environ.get("AMADEUS_API_KEY")
        self.api_secret = api_secret or os.environ.get("AMADEUS_API_SECRET")
        if not self.api_key or not self.api_secret:
            raise ValueError(
                "AmadeusFareScraper requires AMADEUS_API_KEY and AMADEUS_API_SECRET; "
                "use get_amadeus_scraper_if_configured() to skip this source cleanly "
                "when they are not set, rather than constructing this class directly."
            )
        self._cached_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    def _get_access_token(self) -> str:
        """Real OAuth2 client-credentials token fetch, cached until near expiry."""
        if self._cached_token and time.time() < self._token_expires_at:
            return self._cached_token

        try:
            response = httpx.post(
                TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.api_key,
                    "client_secret": self.api_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=15.0,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:  # noqa: BLE001
            raise ConnectionError(
                f"[{FailureClassification.NETWORK_ERROR}] Amadeus OAuth2 token request failed: {exc}"
            ) from exc

        token = payload.get("access_token")
        expires_in = payload.get("expires_in", 1799)
        if not token:
            raise ValueError(
                f"[{FailureClassification.SELECTOR_MISS}] Amadeus token response missing 'access_token': {payload}"
            )

        self._cached_token = token
        self._token_expires_at = time.time() + expires_in - TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS
        return token

    def search(
        self,
        origin: str,
        dest: str,
        departure_date: str,
        advance_purchase_days: int,
    ) -> List[RawFareRecord]:
        self.enforce_rate_limit()
        token = self._get_access_token()
        route_pair = f"{origin.upper()}-{dest.upper()}"

        try:
            response = httpx.get(
                FLIGHT_OFFERS_URL,
                params={
                    "originLocationCode": origin.upper(),
                    "destinationLocationCode": dest.upper(),
                    "departureDate": departure_date,
                    "adults": 1,
                    "currencyCode": "INR",
                    "max": 5,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=20.0,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception as exc:  # noqa: BLE001
            raise ConnectionError(
                f"[{FailureClassification.NETWORK_ERROR}] Amadeus flight-offers request failed for "
                f"{route_pair} {departure_date}: {exc}"
            ) from exc

        return parse_flight_offers(payload, route_pair, origin, dest, departure_date, advance_purchase_days)


def parse_flight_offers(
    payload: Dict[str, Any],
    route_pair: str,
    origin: str,
    destination: str,
    departure_date: str,
    advance_purchase_days: int,
) -> List[RawFareRecord]:
    """
    Pure function: maps Amadeus's documented, stable flight-offer JSON shape
    (`data[].price`, `data[].itineraries[].segments[]`) into RawFareRecords.
    Separated from the network call above so it can be (and is, in
    tests/test_amadeus_fare_scraper.py) unit-tested against a canned response
    shaped exactly like Amadeus's real API contract, with no network
    dependency.
    """
    offers = payload.get("data", [])
    if not offers:
        return []

    scrape_id = f"AMADEUS_{uuid.uuid4().hex[:8]}"
    scrape_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_ref = persist_raw_payload(
        scrape_id=scrape_id,
        source_platform="amadeus_live",
        route_pair=route_pair,
        departure_date=departure_date,
        raw_content=payload,
        content_type="json",
    )

    records: List[RawFareRecord] = []
    for offer in offers:
        try:
            price = offer["price"]
            total_fare = float(price["total"])
            base_fare = float(price.get("base", price["total"]))
            fees = sum(float(fee.get("amount", 0.0)) for fee in price.get("fees", []))
            taxes_fees = round(total_fare - base_fare, 2) if fees == 0 else round(fees, 2)

            first_segment = offer["itineraries"][0]["segments"][0]
            carrier_code = first_segment["carrierCode"]
            flight_number = first_segment["number"]
            departure_time = first_segment["departure"]["at"]
            last_segment = offer["itineraries"][0]["segments"][-1]
            arrival_time = last_segment["arrival"]["at"]

            seats_left = offer.get("numberOfBookableSeats")
            seat_flag = "FEW_SEATS_LEFT" if isinstance(seats_left, int) and seats_left <= 3 else "AVAILABLE"
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise ValueError(
                f"[{FailureClassification.SELECTOR_MISS}] Amadeus flight-offer shape did not match "
                f"the expected schema: {exc}"
            ) from exc

        records.append(
            RawFareRecord(
                scrape_id=scrape_id,
                source_platform="amadeus_live",
                origin=origin.upper(),
                destination=destination.upper(),
                route_pair=route_pair,
                carrier=carrier_code,
                flight_no=f"{carrier_code}-{flight_number}",
                departure_date=departure_date,
                departure_time=departure_time,
                arrival_time=arrival_time,
                advance_purchase_days=advance_purchase_days,
                fare_class="Economy",
                base_fare=round(base_fare, 2),
                taxes_fees=round(taxes_fees, 2),
                convenience_fee=0.0,
                total_fare=round(total_fare, 2),
                currency=price.get("currency", "INR"),
                seat_availability_flag=seat_flag,
                scrape_timestamp=scrape_timestamp,
                raw_payload_ref=raw_ref,
                data_mode="live",
                is_live_data=True,
                simulation_disclaimer=(
                    "Real live flight offer from the Amadeus Self-Service Flight Offers Search API "
                    "(test environment); reflects Amadeus's own indicative pricing, not a guaranteed "
                    "bookable fare on the airline's own channel."
                ),
            )
        )
    return records


def get_amadeus_scraper_if_configured() -> Optional[AmadeusFareScraper]:
    """
    Factory used by the registry/pipeline: returns a real, ready-to-use
    scraper if AMADEUS_API_KEY/AMADEUS_API_SECRET are set, else None. Callers
    should skip this source cleanly on None rather than treating it as an
    error -- this is the "graceful, no-credentials-yet" fallback path, not a
    failure state.
    """
    if not is_configured():
        return None
    return AmadeusFareScraper()
