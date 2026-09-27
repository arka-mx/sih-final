from abc import ABC, abstractmethod
from typing import List, Optional
import time
import random
import logging
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

class FailureClassification:
    NO_AVAILABILITY = "no_availability"  # Valid empty response (no matching seats)
    BLOCKED = "blocked"                  # Rate limited, CAPTCHA, 403/429
    SELECTOR_MISS = "selector_miss"      # DOM/JSON layout changed, parser found nothing
    NETWORK_ERROR = "network_error"      # Timeout or DNS issue

class BaseScraper(ABC):
    """
    Abstract Scraper Interface:
    search(origin, dest, date, advance_purchase_days) -> List[RawFareRecord]
    
    Adheres strictly to MoSPI IT Act Sec 43/66 compliance:
    - Conservative crawl delay (1.5s - 3.5s randomized jitter)
    - Concurrency of 1 per domain
    - No CAPTCHA defeat
    - Distinct classification of failures (no_availability vs blocked vs selector_miss)
    """

    def __init__(self, source_name: str, domain: str, min_delay: float = 1.5, max_delay: float = 3.5):
        self.source_name = source_name
        self.domain = domain
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.last_request_time = 0.0

    def enforce_rate_limit(self):
        """Randomized rate-limit delay per domain to respect server health."""
        now = time.time()
        elapsed = now - self.last_request_time
        target_delay = random.uniform(self.min_delay, self.max_delay)
        if elapsed < target_delay:
            sleep_time = target_delay - elapsed
            logger.info(f"[{self.source_name}] Rate-limiting: sleeping {sleep_time:.2f}s")
            time.sleep(sleep_time)
        self.last_request_time = time.time()

    @abstractmethod
    def search(
        self,
        origin: str,
        dest: str,
        departure_date: str,
        advance_purchase_days: int,
    ) -> List[RawFareRecord]:
        """
        Executes search for a given route and date.
        Must persist raw payload to ingestion.raw_store BEFORE returning parsed records.
        """
        pass
