import re
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

# Phrases commonly used on OTA listing pages to manufacture urgency. Matched
# case-insensitively against `RawFareRecord.listing_copy`. This is a
# consumer-protection heuristic, not a legal determination of deception.
SCARCITY_PHRASES = [
    re.compile(r"only\s+\d+\s+seats?\s+left", re.IGNORECASE),
    re.compile(r"\d+\s+seats?\s+left", re.IGNORECASE),
    re.compile(r"hurry", re.IGNORECASE),
    re.compile(r"selling\s+fast", re.IGNORECASE),
    re.compile(r"high\s+demand", re.IGNORECASE),
    re.compile(r"prices?\s+(may|will|could)\s+(increase|rise|go\s+up)\s+soon", re.IGNORECASE),
    re.compile(r"\d+\s+(people|users|travellers|travelers)\s+(looking|viewing|booked)", re.IGNORECASE),
    re.compile(r"limited\s+time", re.IGNORECASE),
]

# Repeat-view fare must climb at least this fraction from first to last
# recorded view before it's treated as a signal rather than routine noise.
REPEAT_VIEW_ESCALATION_THRESHOLD_PCT = 2.0


@dataclass
class DarkPatternFlag:
    scrape_id: str
    source_platform: str
    route_pair: str
    carrier: str
    flight_no: str
    departure_date: str
    advance_days: int
    pattern_type: str  # "SCARCITY_COPY_MISMATCH" | "SCARCITY_MESSAGING" | "REPEAT_VIEW_PRICE_ESCALATION"
    severity: str       # "HIGH" | "MEDIUM" | "LOW"
    message: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    raw_payload_ref: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scrape_id": self.scrape_id,
            "source_platform": self.source_platform,
            "route_pair": self.route_pair,
            "carrier": self.carrier,
            "flight_no": self.flight_no,
            "departure_date": self.departure_date,
            "advance_days": self.advance_days,
            "pattern_type": self.pattern_type,
            "severity": self.severity,
            "message": self.message,
            "evidence": self.evidence,
            "raw_payload_ref": self.raw_payload_ref,
        }


@dataclass
class DarkPatternReport:
    total_listings_scanned: int
    flags: List[DarkPatternFlag]

    def to_dict(self) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {}
        for flag in self.flags:
            by_type[flag.pattern_type] = by_type.get(flag.pattern_type, 0) + 1
            by_severity[flag.severity] = by_severity.get(flag.severity, 0) + 1
        return {
            "total_listings_scanned": self.total_listings_scanned,
            "total_flagged": len(self.flags),
            "flagged_by_pattern_type": by_type,
            "flagged_by_severity": by_severity,
            "flags": [f.to_dict() for f in self.flags],
        }


def _matches_scarcity_copy(listing_copy: Optional[str]) -> Optional[str]:
    """Returns the first matched scarcity phrase, or None."""
    if not listing_copy:
        return None
    for pattern in SCARCITY_PHRASES:
        match = pattern.search(listing_copy)
        if match:
            return match.group(0)
    return None


def detect_scarcity_messaging(records: List[RawFareRecord]) -> List[DarkPatternFlag]:
    """
    Flags listings whose page copy uses artificial-scarcity language.

    Two tiers:
    - SCARCITY_COPY_MISMATCH (HIGH): copy claims urgency/scarcity while the
      underlying seat_availability_flag still reports AVAILABLE - the
      strongest signal that the messaging isn't backed by real inventory
      state.
    - SCARCITY_MESSAGING (MEDIUM): copy claims urgency and the availability
      flag is consistent with it (FEW_SEATS_LEFT). Still surfaced for
      transparency since scarcity framing is a pressure tactic regardless of
      whether the underlying flag happens to agree.
    """
    flags: List[DarkPatternFlag] = []
    for r in records:
        matched_phrase = _matches_scarcity_copy(r.listing_copy)
        if not matched_phrase:
            continue

        mismatch = r.seat_availability_flag == "AVAILABLE"
        flags.append(
            DarkPatternFlag(
                scrape_id=r.scrape_id,
                source_platform=r.source_platform,
                route_pair=r.route_pair,
                carrier=r.carrier,
                flight_no=r.flight_no,
                departure_date=r.departure_date,
                advance_days=r.advance_purchase_days,
                pattern_type="SCARCITY_COPY_MISMATCH" if mismatch else "SCARCITY_MESSAGING",
                severity="HIGH" if mismatch else "MEDIUM",
                message=(
                    f'Listing copy "{r.listing_copy}" implies scarcity but seat_availability_flag='
                    f'"{r.seat_availability_flag}" reports normal availability.'
                    if mismatch
                    else f'Listing copy "{r.listing_copy}" uses scarcity/urgency framing.'
                ),
                evidence={
                    "listing_copy": r.listing_copy,
                    "matched_phrase": matched_phrase,
                    "seat_availability_flag": r.seat_availability_flag,
                },
                raw_payload_ref=r.raw_payload_ref,
            )
        )
        if mismatch:
            logger.info(
                f"[DARK_PATTERN] Scarcity copy/flag mismatch: {r.flight_no} ({r.route_pair}) "
                f"copy='{r.listing_copy}' flag={r.seat_availability_flag}"
            )
    return flags


def detect_repeat_view_price_escalation(records: List[RawFareRecord]) -> List[DarkPatternFlag]:
    """
    Flags listings whose simulated repeat-view fare history (a fare-cookie /
    price-tracking simulation: the same listing's shown total fare across
    successive page views within one browsing session) climbs by more than
    REPEAT_VIEW_ESCALATION_THRESHOLD_PCT from first to last view.
    """
    flags: List[DarkPatternFlag] = []
    for r in records:
        history = r.repeat_view_fare_history
        if not history or len(history) < 2:
            continue

        first_view, last_view = history[0], history[-1]
        if first_view <= 0:
            continue

        pct_change = round((last_view - first_view) / first_view * 100.0, 2)
        if pct_change < REPEAT_VIEW_ESCALATION_THRESHOLD_PCT:
            continue

        severity = "HIGH" if pct_change >= 5.0 else "MEDIUM"
        flags.append(
            DarkPatternFlag(
                scrape_id=r.scrape_id,
                source_platform=r.source_platform,
                route_pair=r.route_pair,
                carrier=r.carrier,
                flight_no=r.flight_no,
                departure_date=r.departure_date,
                advance_days=r.advance_purchase_days,
                pattern_type="REPEAT_VIEW_PRICE_ESCALATION",
                severity=severity,
                message=(
                    f"Fare shown for this listing rose {pct_change}% "
                    f"(₹{first_view} → ₹{last_view}) across {len(history)} simulated repeat views "
                    "of the same session, consistent with fare-cookie/price-tracking markup."
                ),
                evidence={
                    "repeat_view_fare_history": history,
                    "pct_change": pct_change,
                },
                raw_payload_ref=r.raw_payload_ref,
            )
        )
        logger.info(
            f"[DARK_PATTERN] Repeat-view price escalation: {r.flight_no} ({r.route_pair}) "
            f"history={history} pct_change={pct_change}%"
        )
    return flags


def run_dark_pattern_detector(records: List[RawFareRecord]) -> DarkPatternReport:
    """
    Runs all dark-pattern checks over a batch of scraped OTA listing records
    and returns a combined, deduplicated report.
    """
    flags = detect_scarcity_messaging(records) + detect_repeat_view_price_escalation(records)
    return DarkPatternReport(total_listings_scanned=len(records), flags=flags)
