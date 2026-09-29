from fastapi import APIRouter, Query
from typing import Optional, List, Dict, Any
import datetime
from scrapers.base import FailureClassification
from scrapers.health_check import get_last_report, run_all_health_checks
from scrapers.registry import DEFAULT_SIMULATED_SOURCE_KEYS, get_simulated_scraper
from scrapers.wayback_fare_scraper import check_robots_allowed
from scrapers.amadeus_fare_scraper import is_configured as is_amadeus_configured
from pipeline.decompose import decompose_matched_flights

router = APIRouter(prefix="/api/sources", tags=["Cross-Source Comparison & Scrapers"])

indigo_scraper = get_simulated_scraper("simulated_indigo")
mmt_scraper = get_simulated_scraper("simulated_makemytrip")

@router.get("/compare", summary="Cross-source fare diff & convenience fee decomposition")
async def compare_sources(
    route: str = Query("DEL-BOM", description="Corridor code: DEL-BOM, DEL-BLR, BOM-BLR"),
    advance_days: int = Query(7, description="Lead window days: 1, 7, 15, 30, 45"),
):
    """
    Compares the same fixture flight across two simulated source scenarios:
    a direct-channel fixture versus an OTA fixture.
    Returns:
    - Inferred convenience fee / hidden markup
    - Cross-source outlier validation
    - Reference to the generated raw fixture payload for auditability
    """
    route_upper = route.upper().strip()
    parts = route_upper.split("-")
    origin = parts[0] if len(parts) > 0 else "DEL"
    dest = parts[1] if len(parts) > 1 else "BOM"

    target_date = (datetime.date.today() + datetime.timedelta(days=advance_days)).isoformat()

    # Run both scrapers
    indigo_records = indigo_scraper.search(origin, dest, target_date, advance_days)
    mmt_records = mmt_scraper.search(origin, dest, target_date, advance_days)

    # Cross-source decomposition
    decomposed = decompose_matched_flights(indigo_records, mmt_records)

    return {
        "status": "success",
        "data_mode": "simulated",
        "is_live_data": False,
        "disclaimer": "Deterministic fixture comparison only; not a live fare or booking offer.",
        "available_simulated_sources": list(DEFAULT_SIMULATED_SOURCE_KEYS),
        "route_pair": route_upper,
        "advance_days": advance_days,
        "departure_date": target_date,
        "matched_flights_count": len(decomposed),
        "fan_out_all_carriers_count": len(mmt_records),
        "indigo_quotes_count": len(indigo_records),
        "mmt_quotes_count": len(mmt_records),
        "decomposed_flights": [d.to_dict() for d in decomposed],
        "mmt_other_carriers": [
            r.to_dict() for r in mmt_records if r.carrier != "IndiGo"
        ],
    }


@router.get(
    "/health",
    summary="Selector / schema-change health check for scraper sources",
    description=(
        "Probes every registered scraper source and verifies the fields the pipeline "
        "depends on (carrier, flight numbers, fares) are still present and valid. "
        "Flags a source as selector_miss when its fixture/payload shape has drifted, "
        "instead of letting empty or malformed data pass through silently. "
        "Set refresh=true to force a fresh probe instead of the cached last run."
    ),
)
async def get_source_health(
    refresh: bool = Query(False, description="Force a fresh probe instead of returning the cached last report"),
):
    report = run_all_health_checks() if refresh else get_last_report()
    sources = {key: status.to_dict() for key, status in report.items()}
    selector_miss_sources = [
        key for key, status in report.items() if status.status == FailureClassification.SELECTOR_MISS
    ]

    return {
        "status": "degraded" if selector_miss_sources else "ok",
        "checked_sources": len(sources),
        "selector_miss_sources": selector_miss_sources,
        "sources": sources,
    }


@router.get(
    "/wayback/health",
    summary="Live reachability check for the real Wayback Machine fare-snapshot source",
    description=(
        "The only non-simulated source in the registry: real historical fare data "
        "fetched from web.archive.org's public CDX API (see scrapers/wayback_fare_scraper.py). "
        "This performs a real robots.txt check against web.archive.org and reports "
        "whether it is currently reachable and permitted -- distinct from the fixture "
        "sources' health check above, which never touches the network."
    ),
)
async def get_wayback_source_health():
    robots_allowed = check_robots_allowed()
    return {
        "source_key": "wayback_archive",
        "data_mode": "archived",
        "is_live_data": False,
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "ok" if robots_allowed else FailureClassification.NETWORK_ERROR,
        "detail": (
            "robots.txt permits the Wayback CDX/web paths this scraper needs."
            if robots_allowed
            else "Could not confirm robots.txt permission -- either web.archive.org is "
            "unreachable from this deployment, or its robots.txt disallows the required paths."
        ),
    }


@router.get(
    "/amadeus/health",
    summary="Configuration status for the real Amadeus live-fare source",
    description=(
        "Reports whether AMADEUS_API_KEY/AMADEUS_API_SECRET are set (see "
        "scrapers/amadeus_fare_scraper.py). Does not make a live network call -- "
        "checking credential presence is enough to know whether this source "
        "will participate, without spending an OAuth2 token request on every health check."
    ),
)
async def get_amadeus_source_health():
    configured = is_amadeus_configured()
    return {
        "source_key": "amadeus_live",
        "data_mode": "live",
        "is_live_data": True,
        "checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "ok" if configured else "not_configured",
        "detail": (
            "AMADEUS_API_KEY and AMADEUS_API_SECRET are set; this source will participate in scrapes."
            if configured
            else "AMADEUS_API_KEY/AMADEUS_API_SECRET are not set. Sign up for a free test-tier key at "
            "https://developers.amadeus.com/register to enable this source; it is skipped cleanly "
            "until then."
        ),
    }
