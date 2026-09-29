"""Selector / schema-change health checks for scraper fixture providers.

Every provider under `scrapers/` is a deterministic, non-network fixture, so
there is no live DOM/JSON layout to drift out from under us today. This module
is the hook that stands in for that check: it runs a small probe query against
each registered scraper and verifies the returned records still expose the
fields the rest of the pipeline (cleaning, decomposition, indexing) depends on.

If a source's fixture ever changes shape -- a renamed/missing key, an empty
payload, a malformed value -- the probe raises or fails validation, and this
module classifies it as `FailureClassification.SELECTOR_MISS` and logs an
alert, instead of letting bad or empty data flow downstream silently. The same
probe function is what a real scraper's selector check would call once a live
provider (parsing real HTML/JSON) replaces a fixture.
"""

import datetime
import logging
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

from scrapers.base import FailureClassification
from scrapers.models import RawFareRecord
from scrapers.registry import DEFAULT_SIMULATED_SOURCE_KEYS, get_simulated_scraper

logger = logging.getLogger(__name__)

# Canonical probe route/window: every registered source ships fixtures for
# DEL-BOM, so a miss here is always a genuine shape problem, not a missing route.
PROBE_ORIGIN = "DEL"
PROBE_DEST = "BOM"
PROBE_ADVANCE_DAYS = 7

# Fields a downstream consumer (cleaning, decomposition, indexing) treats as
# non-negotiable. Any of these being absent/blank/non-positive means the
# source's payload shape no longer matches what the parser expects.
REQUIRED_STRING_FIELDS: Sequence[str] = ("carrier", "flight_no", "departure_time", "arrival_time", "currency")
REQUIRED_POSITIVE_NUMERIC_FIELDS: Sequence[str] = ("base_fare", "taxes_fees", "total_fare")


@dataclass
class SourceHealthStatus:
    source_key: str
    status: str  # "ok" | FailureClassification.SELECTOR_MISS | FailureClassification.NO_AVAILABILITY
    checked_at: str
    records_found: int
    missing_or_invalid_fields: List[str] = field(default_factory=list)
    detail: Optional[str] = None

    def to_dict(self) -> Dict[str, object]:
        return {
            "source_key": self.source_key,
            "status": self.status,
            "checked_at": self.checked_at,
            "records_found": self.records_found,
            "missing_or_invalid_fields": self.missing_or_invalid_fields,
            "detail": self.detail,
        }


def _validate_record(record: RawFareRecord) -> List[str]:
    """Returns the list of expected-field problems found on a single record."""
    data = record.to_dict()
    problems: List[str] = []

    for name in REQUIRED_STRING_FIELDS:
        value = data.get(name)
        if not isinstance(value, str) or not value.strip():
            problems.append(f"missing_field:{name}")

    for name in REQUIRED_POSITIVE_NUMERIC_FIELDS:
        value = data.get(name)
        if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
            problems.append(f"invalid_value:{name}")

    return problems


def check_source_health(source_key: str) -> SourceHealthStatus:
    """Runs one probe scrape and classifies the result as ok / SELECTOR_MISS / no_availability."""
    checked_at = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        scraper = get_simulated_scraper(source_key)
        records = scraper.search(PROBE_ORIGIN, PROBE_DEST, _probe_date(), PROBE_ADVANCE_DAYS)
    except Exception as exc:  # noqa: BLE001 - any parse failure means the shape drifted
        logger.error(
            "[%s] %s: selector health probe raised %s: %s",
            source_key, FailureClassification.SELECTOR_MISS, type(exc).__name__, exc,
        )
        return SourceHealthStatus(
            source_key=source_key,
            status=FailureClassification.SELECTOR_MISS,
            checked_at=checked_at,
            records_found=0,
            detail=f"{type(exc).__name__}: {exc}",
        )

    if not records:
        logger.warning(
            "[%s] %s: selector health probe returned zero records for %s-%s",
            source_key, FailureClassification.NO_AVAILABILITY, PROBE_ORIGIN, PROBE_DEST,
        )
        return SourceHealthStatus(
            source_key=source_key,
            status=FailureClassification.NO_AVAILABILITY,
            checked_at=checked_at,
            records_found=0,
            detail="Probe route returned no fixture records",
        )

    problems: List[str] = []
    for record in records:
        for problem in _validate_record(record):
            if problem not in problems:
                problems.append(problem)

    if problems:
        logger.error(
            "[%s] %s: expected fields missing/invalid on probe records: %s",
            source_key, FailureClassification.SELECTOR_MISS, problems,
        )
        return SourceHealthStatus(
            source_key=source_key,
            status=FailureClassification.SELECTOR_MISS,
            checked_at=checked_at,
            records_found=len(records),
            missing_or_invalid_fields=problems,
            detail="One or more expected fields were missing or invalid; source schema may have changed.",
        )

    return SourceHealthStatus(
        source_key=source_key,
        status="ok",
        checked_at=checked_at,
        records_found=len(records),
    )


def _probe_date() -> str:
    return (datetime.date.today() + datetime.timedelta(days=PROBE_ADVANCE_DAYS)).isoformat()


_last_report_lock = threading.Lock()
_last_report: Dict[str, SourceHealthStatus] = {}


def run_all_health_checks(source_keys: Sequence[str] = DEFAULT_SIMULATED_SOURCE_KEYS) -> Dict[str, SourceHealthStatus]:
    """Runs the selector health probe for every given source and caches the result."""
    report = {key: check_source_health(key) for key in source_keys}
    with _last_report_lock:
        _last_report.update(report)
    return report


def get_last_report(refresh: bool = False) -> Dict[str, SourceHealthStatus]:
    """Returns the most recent health report, running one first if none exists yet."""
    with _last_report_lock:
        cached = dict(_last_report)
    if refresh or not cached:
        return run_all_health_checks()
    return cached
