"""
Real live-fare client for the Travelpayouts / Aviasales Data API.

This API was adopted after Amadeus decommissioned its Self-Service tier on
17 July 2026. Free registration at https://www.travelpayouts.com, no payment details
required, and unlike this codebase's own indigo_direct/makemytrip scrapers
(which hit JS-rendered SPAs with a plain httpx GET and reliably 404/
selector-miss -- see docs/backtest_data.md's sibling investigation), this is
a documented, stable JSON API built for exactly this kind of integration. It
is registered as the FIRST live source this pipeline attempts each cycle
(see pipeline/runner.py) precisely because it is the one real source proven
to actually respond, rather than fall back to a fixture on every call.

METHODOLOGICAL LIMITATION, which matters for an official statistic and must
never be silently dropped: the
Data API serves prices from a cache built out of *what users searched for*,
held for up to seven days. That is a selection-biased sample with a
staleness window, not a designed panel:

  * a route nobody recently searched may return no offers at all
  * a returned price may be up to CACHE_STALENESS_DAYS old

Every record this module produces carries that caveat in its
simulation_disclaimer field (despite being real, non-simulated data) so it
can never be mistaken for a live, guaranteed-bookable quote downstream. When
this source returns nothing (unconfigured, no token, or a genuinely empty
cache for that route/date), callers fall back to this codebase's existing
scrapers -- see get_travelpayouts_scraper_if_configured().
"""

import datetime
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import httpx

from ingestion.raw_store import persist_raw_payload
from scrapers.base import BaseScraper, FailureClassification
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

TRAVELPAYOUTS_BASE_URL = "https://api.travelpayouts.com"
PRICES_FOR_DATES_URL = f"{TRAVELPAYOUTS_BASE_URL}/aviasales/v3/prices_for_dates"

# The cache window the upstream API documents, in days -- see module
# docstring. Surfaced in every record's disclaimer, not just here.
CACHE_STALENESS_DAYS = 7

# Travelpayouts returns the two-letter IATA carrier code (e.g. "6E"), not a
# display name. Mapped for the domestic carriers this basket tracks; an
# unmapped code is passed through as-is rather than guessed at.
CARRIER_CODE_NAMES: Dict[str, str] = {
    "6E": "IndiGo",
    "AI": "Air India",
    "SG": "SpiceJet",
    "UK": "Vistara",
    "I5": "Air India Express",
    "IX": "Air India Express",
    "QP": "Akasa Air",
    "G8": "Go First",
    "9I": "Alliance Air",
}


def is_configured() -> bool:
    return bool(os.environ.get("TRAVELPAYOUTS_TOKEN"))


class TravelpayoutsFareScraper(BaseScraper):
    """
    Real BaseScraper implementation backed by the Travelpayouts Aviasales
    Data API's `prices_for_dates` endpoint. The HTTP call is real and has
    been exercised against the live API from this environment (unlike
    Amadeus's adapter in this codebase, which has network access but no
    credentials to test with) -- see tests/test_travelpayouts_fare_scraper.py
    for the parser's contract tests, and pipeline/runner.py for where a
    genuine network hit gets counted in scrape_reliability stats.
    """

    def __init__(self, token: Optional[str] = None):
        super().__init__(source_name="travelpayouts_live", domain="api.travelpayouts.com", min_delay=1.0, max_delay=2.0)
        self.token = token or os.environ.get("TRAVELPAYOUTS_TOKEN")
        if not self.token:
            raise ValueError(
                "TravelpayoutsFareScraper requires TRAVELPAYOUTS_TOKEN; use "
                "get_travelpayouts_scraper_if_configured() to skip this source "
                "cleanly when it is not set, rather than constructing this "
                "class directly."
            )

    def search(
        self,
        origin: str,
        dest: str,
        departure_date: str,
        advance_purchase_days: int,
    ) -> List[RawFareRecord]:
        self.enforce_rate_limit()
        origin = origin.upper()
        dest = dest.upper()
        route_pair = f"{origin}-{dest}"

        try:
            response = httpx.get(
                PRICES_FOR_DATES_URL,
                params={
                    "origin": origin,
                    "destination": dest,
                    "departure_at": departure_date,
                    "currency": "inr",
                    "limit": 30,
                    "one_way": "true",
                    "direct": "false",
                    "sorting": "price",
                    "token": self.token,
                },
                headers={"User-Agent": "APIx/1.0 (MoSPI CPI augmentation research)"},
                timeout=20.0,
            )
        except Exception as exc:  # noqa: BLE001
            raise ConnectionError(
                f"[{FailureClassification.NETWORK_ERROR}] Travelpayouts request failed for "
                f"{route_pair} {departure_date}: {exc}"
            ) from exc

        if response.status_code == 401:
            raise ConnectionError(
                f"[{FailureClassification.BLOCKED}] Travelpayouts rejected the token"
            )
        if response.status_code != 200:
            raise ConnectionError(
                f"[{FailureClassification.NETWORK_ERROR}] Travelpayouts returned "
                f"{response.status_code} for {route_pair} {departure_date}: {response.text[:200]}"
            )

        try:
            payload = response.json()
        except Exception as exc:  # noqa: BLE001
            raise ValueError(
                f"[{FailureClassification.SELECTOR_MISS}] Travelpayouts response was not JSON: {exc}"
            ) from exc

        return parse_prices_for_dates(payload, route_pair, origin, dest, departure_date, advance_purchase_days)


def parse_prices_for_dates(
    payload: Dict[str, Any],
    route_pair: str,
    origin: str,
    destination: str,
    departure_date: str,
    advance_purchase_days: int,
) -> List[RawFareRecord]:
    """
    Pure function: maps Travelpayouts's documented `prices_for_dates` JSON
    shape (`data[].price`, `.airline`, `.flight_number`, `.departure_at`,
    `.transfers`) into RawFareRecords. Separated from the network call above
    so it is unit-tested (tests/test_travelpayouts_fare_scraper.py) against a
    canned response shaped exactly like the real API contract, with no
    network dependency -- mirroring scrapers/amadeus_fare_scraper.py.

    Travelpayouts does not break a fare into base/taxes the way a GDS does;
    `price` is the all-inclusive total. base_fare is set equal to total_fare
    and taxes_fees to 0.0 rather than inventing a split.
    """
    if "data" not in payload:
        raise ValueError(
            f"[{FailureClassification.SELECTOR_MISS}] Travelpayouts response missing 'data' key; "
            f"keys were {sorted(payload)[:6]}"
        )
    rows = payload.get("data") or []
    if not rows:
        return []

    currency = str(payload.get("currency") or "inr").upper()
    scrape_id = f"TRAVELPAYOUTS_{uuid.uuid4().hex[:8]}"
    scrape_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_ref = persist_raw_payload(
        scrape_id=scrape_id,
        source_platform="travelpayouts_live",
        route_pair=route_pair,
        departure_date=departure_date,
        raw_content=payload,
        content_type="json",
    )

    records: List[RawFareRecord] = []
    for row in rows:
        try:
            total_fare = float(row["price"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(
                f"[{FailureClassification.SELECTOR_MISS}] Travelpayouts row missing/invalid 'price': {exc}"
            ) from exc
        if total_fare <= 0:
            continue

        carrier_code = str(row.get("airline") or "").upper() or "??"
        carrier_name = CARRIER_CODE_NAMES.get(carrier_code, carrier_code)
        flight_number = row.get("flight_number")
        flight_no = f"{carrier_code}-{flight_number}" if flight_number else carrier_code

        departure_at = row.get("departure_at") or ""
        transfers = row.get("transfers")
        try:
            stops = int(transfers) if transfers is not None else 0
        except (TypeError, ValueError):
            stops = 0
        seat_flag = "AVAILABLE"  # the Data API is a fare cache; it does not report live seat counts

        records.append(
            RawFareRecord(
                scrape_id=scrape_id,
                source_platform="travelpayouts_live",
                origin=origin,
                destination=destination,
                route_pair=route_pair,
                carrier=carrier_name,
                flight_no=flight_no,
                departure_date=departure_date,
                departure_time=departure_at or None,
                arrival_time=None,  # not provided by prices_for_dates
                advance_purchase_days=advance_purchase_days,
                fare_class="Economy",
                base_fare=round(total_fare, 2),
                taxes_fees=0.0,
                convenience_fee=0.0,
                total_fare=round(total_fare, 2),
                currency=currency,
                seat_availability_flag=seat_flag,
                scrape_timestamp=scrape_timestamp,
                raw_payload_ref=raw_ref,
                data_mode="live",
                is_live_data=True,
                simulation_disclaimer=(
                    "Real fare from the Travelpayouts/Aviasales Data API cache "
                    f"(built from user searches, held up to {CACHE_STALENESS_DAYS} days -- "
                    "a selection-biased, possibly-stale sample, not a guaranteed bookable "
                    "fare on the airline's own channel). Stops reported: "
                    f"{stops}."
                ),
            )
        )
    return records


def get_travelpayouts_scraper_if_configured() -> Optional[TravelpayoutsFareScraper]:
    """
    Factory used by pipeline/runner.py: returns a real, ready-to-use scraper
    if TRAVELPAYOUTS_TOKEN is set, else None. Callers should skip this source
    cleanly on None -- the "graceful, no-token-yet" fallback path, not a
    failure state -- and fall back to this codebase's other live/simulated
    sources, exactly as already happens for scrapers/amadeus_fare_scraper.py.
    """
    if not is_configured():
        return None
    return TravelpayoutsFareScraper()
