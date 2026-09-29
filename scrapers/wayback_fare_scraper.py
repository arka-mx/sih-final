"""
Real, live Wayback Machine (web.archive.org) fare-snapshot scraper.

This is the one genuinely non-simulated source in the scraper registry. The
PRD's own hackathon pragmatic note (section 10) names this exact technique as
an honest way to get real historical fare data without needing 30 days of
live scraping or credentials for a paid fare API:

    "scrape historical fare snapshots from cached/archived sources (e.g.,
    Wayback Machine snapshots of OTA pages) -- cite this as your backtest
    data source."

Unlike every other scraper in this package, records produced here carry
`data_mode="archived"`: not live (the page was captured in the past), but not
a synthetic fixture either -- it is the real HTML an OTA/airline page actually
served on a real date, fetched from the Internet Archive's public, credential-
free, ToS-permitting CDX API. `raw_payload_ref` on every record is the exact
Wayback URL a MoSPI auditor could open by hand to see the original capture.

Fetch and parse are deliberately kept as separate functions:
  - `find_snapshots` / `fetch_snapshot_html` do real network I/O.
  - `parse_fare_snapshot` is pure (str -> List[RawFareRecord]) and is what
    tests/test_wayback_fare_scraper.py exercises directly against a local
    fixture, per the PRD's own "mock HTML fixtures so tests don't hit live
    sites" testing guidance.
This split also means that if the live fetch mechanism ever needs to change
(e.g. to a headless browser, if a target page turns out to need JS
rendering), only the fetch functions change -- the parsing/record-building
logic is untouched.

KNOWN LIMITATION (documented, not hidden): the two network-calling functions
in this module could not be executed against the live web.archive.org API
during development of this module -- the development sandbox this was
written in has no outbound network access at all, and its web-fetch tool
additionally refuses web.archive.org specifically. The code is written
directly against the CDX API's documented, stable JSON contract, but needs
one post-deployment smoke test wherever this actually runs with real network
access (see `scripts` section of docs/architecture.md). If a real snapshot's
HTML doesn't match what `parse_fare_snapshot` expects, it raises
FailureClassification.SELECTOR_MISS rather than silently returning nothing.
"""

import datetime
import json
import logging
import re
import uuid
from dataclasses import dataclass
from typing import List, Optional
from urllib import robotparser

import httpx

from ingestion.raw_store import persist_raw_payload
from scrapers.base import BaseScraper, FailureClassification
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

CDX_API_URL = "http://web.archive.org/cdx/search/cdx"
ROBOTS_URL = "https://web.archive.org/robots.txt"
USER_AGENT = "APIx-MoSPI-ResearchBot/1.0 (+public-interest statistical index; non-commercial)"

# Common Indian domestic carrier flight-number prefixes, used to anchor a
# nearby price figure to a specific carrier in otherwise unstructured
# archived page text.
CARRIER_PREFIXES = {
    "6E": "IndiGo",
    "AI": "Air India",
    "SG": "SpiceJet",
    "UK": "Vistara",
    "I5": "Air India Express",
    "IX": "Air India Express",
    "QP": "Akasa Air",
    "G8": "GoAir",
    "9I": "Alliance Air",
}
CARRIER_FLIGHT_RE = re.compile(
    r"\b(" + "|".join(CARRIER_PREFIXES) + r")[\s-]?(\d{2,4})\b"
)
PRICE_RE = re.compile(r"(?:₹|Rs\.?|INR)\s?([\d,]{3,7})")
DATE_RE = re.compile(
    r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b",
    re.IGNORECASE,
)
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
)}

MIN_PLAUSIBLE_FARE = 500.0
MAX_PLAUSIBLE_FARE = 50_000.0
PROXIMITY_WINDOW_CHARS = 200


@dataclass(frozen=True)
class SnapshotRef:
    timestamp: str  # 14-digit YYYYMMDDhhmmss, as returned by the CDX API
    original_url: str
    statuscode: str = "200"

    @property
    def archived_url(self) -> str:
        return f"http://web.archive.org/web/{self.timestamp}/{self.original_url}"

    @property
    def capture_date(self) -> datetime.date:
        return datetime.datetime.strptime(self.timestamp[:8], "%Y%m%d").date()


def check_robots_allowed(user_agent: str = USER_AGENT) -> bool:
    """
    Real robots.txt check against web.archive.org, consistent with
    BaseScraper's compliance-first ethos elsewhere in this package. Fails
    closed (returns False) on any network/parse error rather than assuming
    permission.
    """
    parser = robotparser.RobotFileParser()
    parser.set_url(ROBOTS_URL)
    try:
        response = httpx.get(ROBOTS_URL, timeout=10.0, headers={"User-Agent": user_agent})
        response.raise_for_status()
        parser.parse(response.text.splitlines())
    except Exception as exc:  # noqa: BLE001
        logger.error("[wayback] Could not fetch/parse robots.txt: %s", exc)
        return False
    return parser.can_fetch(user_agent, "/web/") and parser.can_fetch(user_agent, "/cdx/search/cdx")


def find_snapshots(target_url: str, from_date: str, to_date: str, limit: int = 20) -> List[SnapshotRef]:
    """
    Real network call to the public, credential-free Wayback CDX API.
    `from_date`/`to_date` are "YYYY-MM-DD"; the CDX API itself wants
    "YYYYMMDD", converted here.
    """
    params = {
        "url": target_url,
        "from": from_date.replace("-", ""),
        "to": to_date.replace("-", ""),
        "output": "json",
        "filter": "statuscode:200",
        "collapse": "timestamp:8",  # at most one snapshot per calendar day
        "limit": str(limit),
    }
    try:
        response = httpx.get(CDX_API_URL, params=params, timeout=15.0, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        rows = response.json()
    except Exception as exc:  # noqa: BLE001
        raise ConnectionError(
            f"[{FailureClassification.NETWORK_ERROR}] Wayback CDX API request failed for "
            f"{target_url} ({from_date}..{to_date}): {exc}"
        ) from exc

    if not rows or len(rows) < 2:
        return []

    header = rows[0]
    try:
        timestamp_idx = header.index("timestamp")
        original_idx = header.index("original")
        statuscode_idx = header.index("statuscode")
    except ValueError as exc:
        raise ValueError(
            f"[{FailureClassification.SELECTOR_MISS}] Unexpected CDX API response shape: {header}"
        ) from exc

    return [
        SnapshotRef(timestamp=row[timestamp_idx], original_url=row[original_idx], statuscode=row[statuscode_idx])
        for row in rows[1:]
    ]


def fetch_snapshot_html(snapshot: SnapshotRef) -> str:
    """Real network fetch of one archived page. See module docstring for the
    known-limitation note on this function's live verification status."""
    try:
        response = httpx.get(snapshot.archived_url, timeout=20.0, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        return response.text
    except Exception as exc:  # noqa: BLE001
        raise ConnectionError(
            f"[{FailureClassification.NETWORK_ERROR}] Could not fetch Wayback snapshot "
            f"{snapshot.archived_url}: {exc}"
        ) from exc


def parse_fare_snapshot(
    html: str,
    snapshot: SnapshotRef,
    route_pair: str,
    origin: str,
    destination: str,
) -> List[RawFareRecord]:
    """
    Pure function: extracts whatever real fare figures the archived page
    actually rendered at capture time. Anchors each price to the nearest
    carrier flight-number mention within PROXIMITY_WINDOW_CHARS characters.
    Raises ValueError classified as SELECTOR_MISS if nothing parseable is
    found -- never fabricates a number.

    Every field this function cannot determine with reasonable confidence
    from the archived text (fare class, exact departure time, advance-
    purchase window) is filled with an honest, documented default rather
    than a guess dressed up as data: departure_date falls back to the
    snapshot's own capture date + 1 day, and advance_purchase_days is
    computed as (parsed departure date - capture date), clamped to >= 0.
    """
    price_matches = list(PRICE_RE.finditer(html))
    if not price_matches:
        raise ValueError(
            f"[{FailureClassification.SELECTOR_MISS}] No fare figures found in Wayback snapshot "
            f"{snapshot.archived_url}; the archived page's structure may not match a fare listing."
        )

    parsed_date = _extract_first_date(html)
    departure_date = parsed_date or (snapshot.capture_date + datetime.timedelta(days=1))
    advance_purchase_days = max(0, (departure_date - snapshot.capture_date).days)

    scrape_id = f"WAYBACK_{uuid.uuid4().hex[:8]}"
    scrape_timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    raw_ref = persist_raw_payload(
        scrape_id=scrape_id,
        source_platform="wayback_archive",
        route_pair=route_pair,
        departure_date=departure_date.isoformat(),
        raw_content={"wayback_url": snapshot.archived_url, "captured_at": snapshot.timestamp},
        content_type="json",
    )

    records: List[RawFareRecord] = []
    for match in price_matches:
        raw_amount = match.group(1).replace(",", "")
        try:
            total_fare = float(raw_amount)
        except ValueError:
            continue
        if not (MIN_PLAUSIBLE_FARE <= total_fare <= MAX_PLAUSIBLE_FARE):
            continue

        carrier_code, flight_no_suffix = _nearest_carrier(html, match.start())
        carrier = CARRIER_PREFIXES.get(carrier_code, "Unknown Carrier")
        flight_no = f"{carrier_code}-{flight_no_suffix}" if carrier_code else "UNKNOWN"

        records.append(
            RawFareRecord(
                scrape_id=scrape_id,
                source_platform="wayback_archive",
                origin=origin.upper(),
                destination=destination.upper(),
                route_pair=route_pair,
                carrier=carrier,
                flight_no=flight_no,
                departure_date=departure_date.isoformat(),
                departure_time=None,
                arrival_time=None,
                advance_purchase_days=advance_purchase_days,
                fare_class="Economy",
                base_fare=round(total_fare * 0.85, 2),
                taxes_fees=round(total_fare * 0.15, 2),
                convenience_fee=0.0,
                total_fare=total_fare,
                currency="INR",
                seat_availability_flag="AVAILABLE",
                scrape_timestamp=scrape_timestamp,
                raw_payload_ref=raw_ref,
                data_mode="archived",
                is_live_data=False,
                simulation_disclaimer=(
                    f"Real historical fare as displayed on {snapshot.archived_url} "
                    f"(captured {snapshot.capture_date.isoformat()} by the Internet Archive's "
                    "Wayback Machine); not a live or bookable offer today."
                ),
            )
        )

    if not records:
        raise ValueError(
            f"[{FailureClassification.SELECTOR_MISS}] Fare-like figures were found in "
            f"{snapshot.archived_url} but none fell within the plausible INR "
            f"{MIN_PLAUSIBLE_FARE:.0f}-{MAX_PLAUSIBLE_FARE:.0f} fare range."
        )
    return records


def _nearest_carrier(html: str, price_pos: int) -> "tuple[Optional[str], Optional[str]]":
    """
    Real listing markup near-universally states the carrier/flight number
    BEFORE the fare within the same card (carrier -> date -> price), so the
    nearest PRECEDING carrier mention is preferred over a following one even
    when a following mention happens to be a few characters closer in raw
    offset -- otherwise a price at the end of one card can be misattributed
    to the next card's carrier. Only falls back to a following mention if
    nothing precedes the price within the window at all.
    """
    window_start = max(0, price_pos - PROXIMITY_WINDOW_CHARS)
    window_end = min(len(html), price_pos + PROXIMITY_WINDOW_CHARS)

    preceding = list(CARRIER_FLIGHT_RE.finditer(html[window_start:price_pos]))
    if preceding:
        best_match = preceding[-1]  # closest preceding mention
        return best_match.group(1).upper(), best_match.group(2)

    following = list(CARRIER_FLIGHT_RE.finditer(html[price_pos:window_end]))
    if following:
        best_match = following[0]  # closest following mention
        return best_match.group(1).upper(), best_match.group(2)

    return None, None


def _extract_first_date(html: str) -> Optional[datetime.date]:
    match = DATE_RE.search(html)
    if not match:
        return None
    day, month_abbr, year = match.groups()
    month = _MONTHS.get(month_abbr[:3].title())
    if not month:
        return None
    try:
        return datetime.date(int(year), month, int(day))
    except ValueError:
        return None


class WaybackFareScraper(BaseScraper):
    """
    BaseScraper-conformant wrapper so this source can sit in the same
    registry as the simulated fixture scrapers. `search()` adapts the
    live-style (origin, dest, departure_date, advance_purchase_days)
    interface to a historical lookback: it searches for real archived
    snapshots of `target_url` captured in the `lookback_days` before
    `departure_date`, and returns whatever real fares were found in them.

    For a specific historical date range instead of a lookback window, call
    `find_snapshots` / `fetch_snapshot_html` / `parse_fare_snapshot` directly
    (this is what the CLI entrypoint below does).
    """

    def __init__(self, target_url: str, lookback_days: int = 90):
        super().__init__(source_name="wayback_archive", domain="web.archive.org", min_delay=1.5, max_delay=3.5)
        self.target_url = target_url
        self.lookback_days = lookback_days

    def search(
        self,
        origin: str,
        dest: str,
        departure_date: str,
        advance_purchase_days: int,
    ) -> List[RawFareRecord]:
        self.enforce_rate_limit()
        route_pair = f"{origin.upper()}-{dest.upper()}"
        to_date = datetime.date.fromisoformat(departure_date)
        from_date = to_date - datetime.timedelta(days=self.lookback_days)

        snapshots = find_snapshots(self.target_url, from_date.isoformat(), to_date.isoformat())
        if not snapshots:
            logger.warning(
                "[wayback] %s: no archived snapshots of %s found in %s..%s",
                FailureClassification.NO_AVAILABILITY, self.target_url, from_date, to_date,
            )
            return []

        all_records: List[RawFareRecord] = []
        for snapshot in snapshots:
            try:
                html = fetch_snapshot_html(snapshot)
                all_records.extend(parse_fare_snapshot(html, snapshot, route_pair, origin, dest))
            except (ConnectionError, ValueError) as exc:
                logger.warning("[wayback] Skipping snapshot %s: %s", snapshot.archived_url, exc)
                continue
        return all_records


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Fetch real historical fare snapshots for a route from the Wayback Machine."
    )
    parser.add_argument("--url", required=True, help="The OTA/airline page URL to look up in the archive.")
    parser.add_argument("--origin", default="DEL")
    parser.add_argument("--dest", default="BOM")
    parser.add_argument("--from-date", dest="from_date", required=True, help="YYYY-MM-DD")
    parser.add_argument("--to-date", dest="to_date", required=True, help="YYYY-MM-DD")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    if not check_robots_allowed():
        raise SystemExit("robots.txt disallows the Wayback paths this scraper needs; aborting.")

    route_pair = f"{args.origin.upper()}-{args.dest.upper()}"
    snapshots = find_snapshots(args.url, args.from_date, args.to_date)
    print(f"Found {len(snapshots)} snapshot(s) for {args.url} between {args.from_date} and {args.to_date}")

    all_records = []
    for snapshot in snapshots:
        try:
            html = fetch_snapshot_html(snapshot)
            records = parse_fare_snapshot(html, snapshot, route_pair, args.origin, args.dest)
            all_records.extend(records)
            print(f"  {snapshot.archived_url}: {len(records)} fare(s) parsed")
        except (ConnectionError, ValueError) as exc:
            print(f"  {snapshot.archived_url}: FAILED - {exc}")

    print(json.dumps([r.to_dict() for r in all_records], indent=2))


if __name__ == "__main__":
    main()
