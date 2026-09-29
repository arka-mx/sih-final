"""Registry of non-network, simulated fare providers.

Sources are auto-discovered from scrapers/configs/*.yaml -- adding a new
simulated airline/OTA source requires dropping one config file there (see
scrapers/configs/README.md), not editing this module.
"""

from typing import Tuple

from scrapers.base import BaseScraper
from scrapers.config_scraper import build_scraper, list_configured_source_keys

DEFAULT_SIMULATED_SOURCE_KEYS: Tuple[str, ...] = list_configured_source_keys()


def get_simulated_scraper(source_key: str) -> BaseScraper:
    """Builds one known fixture provider from its config; live providers are intentionally absent."""
    try:
        return build_scraper(source_key)
    except ValueError as exc:
        supported = ", ".join(DEFAULT_SIMULATED_SOURCE_KEYS)
        raise ValueError(f"Unknown simulated source '{source_key}'. Supported: {supported}") from exc
