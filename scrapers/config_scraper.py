"""Generic, config-driven fare scraper.

Loads a per-source YAML config (routes/fixtures, fee model, rate limits,
selectors, dark-pattern simulation rules -- see scrapers/configs/README.md
for the schema) and produces RawFareRecords without requiring a bespoke
Python subclass per source. Adding a new simulated airline/OTA is a matter
of dropping a new YAML file into scrapers/configs/.
"""

import datetime
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from ingestion.raw_store import persist_raw_payload
from scrapers.base import BaseScraper, FailureClassification
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).parent / "configs"

DEFAULT_WINDOW_MULTIPLIER = {1: 1.85, 7: 1.25, 15: 1.0, 30: 0.9, 45: 0.88}


class ConfigDrivenScraper(BaseScraper):
    """BaseScraper implementation driven entirely by a source config dict."""

    def __init__(self, config: Dict[str, Any]) -> None:
        rate_limit = config.get("rate_limit", {})
        super().__init__(
            source_name=config["source_key"],
            domain=config.get("base_url", "simulated.local"),
            min_delay=rate_limit.get("min_delay", 0.0),
            max_delay=rate_limit.get("max_delay", 0.0),
        )
        self.config = config
        self.provider_label = config.get("provider_label", self.source_name)
        self.routes: Dict[str, List[Dict[str, Any]]] = config.get("routes", {}) or {}
        self.window_multiplier: Dict[int, float] = {
            int(k): v for k, v in (config.get("window_multiplier") or DEFAULT_WINDOW_MULTIPLIER).items()
        }
        self.fee_model: Dict[str, Any] = config.get("fee_model", {}) or {}
        self.dark_patterns: Dict[str, int] = config.get("dark_patterns", {}) or {}

    def search(
        self,
        origin: str,
        dest: str,
        departure_date: str,
        advance_purchase_days: int,
    ) -> List[RawFareRecord]:
        self.enforce_rate_limit()
        route_pair = f"{origin.upper()}-{dest.upper()}"
        flights = self.routes.get(route_pair, [])
        if not flights:
            logger.warning(
                "[%s] %s: No fixture for %s", self.source_name, FailureClassification.NO_AVAILABILITY, route_pair
            )
            return []

        scrape_id = f"{self.source_name.upper()}_{uuid.uuid4().hex[:8]}"
        scrape_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
        multiplier = self.window_multiplier.get(advance_purchase_days, 1.0)

        raw_payload = {
            "source": self.source_name,
            "provider_label": self.provider_label,
            "data_mode": "simulated",
            "is_live_data": False,
            "scrape_id": scrape_id,
            "origin": origin,
            "dest": dest,
            "departure_date": departure_date,
            "advance_days": advance_purchase_days,
            "flights_data": flights,
        }
        raw_ref = persist_raw_payload(
            scrape_id=scrape_id,
            source_platform=self.source_name,
            route_pair=route_pair,
            departure_date=departure_date,
            raw_content=raw_payload,
            content_type="json",
        )

        records: List[RawFareRecord] = []
        for idx, flight in enumerate(flights):
            base = round(float(flight["base"]) * multiplier, 2)
            taxes = round(float(flight["tax"]), 2)
            fee = round(float(flight.get("fee", self.fee_model.get("convenience_fee", 0.0))), 2)
            total = round(base + taxes + fee, 2)

            seat_flag, listing_copy = self._simulate_scarcity_copy(idx)
            repeat_view_fare_history = self._simulate_fare_cookie(idx, total)

            records.append(
                RawFareRecord(
                    scrape_id=scrape_id,
                    source_platform=self.source_name,
                    origin=origin.upper(),
                    destination=dest.upper(),
                    route_pair=route_pair,
                    carrier=str(flight["carrier"]),
                    flight_no=str(flight["flight_no"]),
                    departure_date=departure_date,
                    departure_time=str(flight["dep"]),
                    arrival_time=str(flight["arr"]),
                    advance_purchase_days=advance_purchase_days,
                    fare_class="Economy",
                    base_fare=base,
                    taxes_fees=taxes,
                    convenience_fee=fee,
                    total_fare=total,
                    currency="INR",
                    seat_availability_flag=seat_flag,
                    scrape_timestamp=scrape_timestamp,
                    raw_payload_ref=raw_ref,
                    listing_copy=listing_copy,
                    repeat_view_fare_history=repeat_view_fare_history,
                )
            )

        logger.info(
            "[%s] Parsed %d records for %s (T+%d)", self.source_name, len(records), route_pair, advance_purchase_days
        )
        return records

    def _simulate_scarcity_copy(self, idx: int) -> Tuple[str, Optional[str]]:
        """Deterministic, index-keyed scarcity/high-demand listing copy per dark_patterns config."""
        scarcity_n = self.dark_patterns.get("scarcity_copy_every")
        high_demand_n = self.dark_patterns.get("high_demand_every")

        if scarcity_n and idx % scarcity_n == scarcity_n - 1:
            fake_seats_left = 1 + (idx % scarcity_n)
            return "AVAILABLE", f"Hurry! Only {fake_seats_left} seats left at this price."
        if high_demand_n and idx % high_demand_n == high_demand_n - 1:
            return "FEW_SEATS_LEFT", "Selling fast - high demand on this route."
        return "AVAILABLE", None

    def _simulate_fare_cookie(self, idx: int, total: float) -> Optional[List[float]]:
        """Deterministic, index-keyed repeat-view fare escalation per dark_patterns config."""
        cookie_n = self.dark_patterns.get("fare_cookie_every")
        if cookie_n and idx % cookie_n == cookie_n - 1:
            return [round(total * 0.96, 2), round(total * 0.99, 2), round(total, 2)]
        return None


def load_config(source_key: str) -> Dict[str, Any]:
    """Loads and validates one source's YAML config file."""
    path = CONFIG_DIR / f"{source_key}.yaml"
    if not path.exists():
        raise ValueError(f"No config file found for source '{source_key}' at {path}")
    with path.open("r", encoding="utf-8") as fh:
        config = yaml.safe_load(fh)
    if not isinstance(config, dict) or config.get("source_key") != source_key:
        raise ValueError(
            f"Config file {path} is missing or has a mismatched 'source_key' (expected '{source_key}')"
        )
    return config


def list_configured_source_keys() -> Tuple[str, ...]:
    """Every source with a config file in scrapers/configs/, sorted for stable ordering."""
    if not CONFIG_DIR.exists():
        return ()
    return tuple(sorted(p.stem for p in CONFIG_DIR.glob("*.yaml")))


def build_scraper(source_key: str) -> ConfigDrivenScraper:
    return ConfigDrivenScraper(load_config(source_key))
