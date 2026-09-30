"""Registry of non-network, simulated fare providers.

Sources are auto-discovered from scrapers/configs/*.yaml -- adding a new
simulated airline/OTA source requires dropping one config file there (see
scrapers/configs/README.md), not editing this module.
"""

from typing import Tuple

from scrapers.base import BaseScraper
from scrapers.config_scraper import build_scraper, list_configured_source_keys

DEFAULT_SIMULATED_SOURCE_KEYS: Tuple[str, ...] = list_configured_source_keys()


from scrapers.indigo_direct import get_indigo_scraper
from scrapers.makemytrip import get_makemytrip_scraper

LIVE_SOURCE_MAP = {
    "indigo_direct": get_indigo_scraper,
    "makemytrip": get_makemytrip_scraper,
}

LIVE_SOURCE_KEYS: Tuple[str, ...] = tuple(LIVE_SOURCE_MAP.keys())


def get_live_scraper(source_key: str, prefer_live: bool = True) -> BaseScraper:
    """Builds a real live/resilient scraper with network execution capabilities."""
    if source_key in LIVE_SOURCE_MAP:
        return LIVE_SOURCE_MAP[source_key](prefer_live=prefer_live)
    raise ValueError(f"Unknown live source '{source_key}'. Supported: {', '.join(LIVE_SOURCE_KEYS)}")


def get_scraper(source_key: str, prefer_live: bool = False) -> BaseScraper:
    """Unified provider lookup for both live scrapers and simulated fixtures."""
    if prefer_live and source_key in LIVE_SOURCE_MAP:
        return get_live_scraper(source_key, prefer_live=True)
    if source_key in LIVE_SOURCE_MAP:
        return get_live_scraper(source_key, prefer_live=prefer_live)
    return get_simulated_scraper(source_key)


def get_simulated_scraper(source_key: str) -> BaseScraper:
    """Builds one known fixture provider from its config; live providers are intentionally absent."""
    try:
        return build_scraper(source_key)
    except ValueError as exc:
        supported = ", ".join(DEFAULT_SIMULATED_SOURCE_KEYS)
        raise ValueError(f"Unknown simulated source '{source_key}'. Supported: {supported}") from exc

