from fastapi import APIRouter, Query
from typing import Optional, List, Dict, Any
import datetime
from scrapers.indigo_direct import IndiGoDirectScraper
from scrapers.makemytrip import MakeMyTripScraper
from pipeline.decompose import decompose_matched_flights

router = APIRouter(prefix="/api/sources", tags=["Cross-Source Comparison & Scrapers"])

indigo_scraper = IndiGoDirectScraper()
mmt_scraper = MakeMyTripScraper()

@router.get("/compare", summary="Cross-source fare diff & convenience fee decomposition")
async def compare_sources(
    route: str = Query("DEL-BOM", description="Corridor code: DEL-BOM, DEL-BLR, BOM-BLR"),
    advance_days: int = Query(7, description="Lead window days: 1, 7, 15, 30, 45"),
):
    """
    Diffs the SAME flight across two sources:
    IndiGo-direct price vs. IndiGo-via-MMT price.
    Returns:
    - Inferred convenience fee / hidden markup
    - Cross-source outlier validation
    - Direct link/ref to underlying raw JSON payload for auditability
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
        "route_pair": route_upper,
        "advance_days": advance_days,
        "departure_date": target_date,
        "matched_flights_count": len(decomposed),
        "fan_out_all_carriers_count": len(mmt_records),
        "decomposed_flights": [d.to_dict() for d in decomposed],
        "mmt_other_carriers": [
            r.to_dict() for r in mmt_records if r.carrier != "IndiGo"
        ],
    }
