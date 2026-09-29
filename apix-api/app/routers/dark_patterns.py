import datetime
from fastapi import APIRouter, Query

from app.schemas.dark_patterns import DarkPatternResponse
from pipeline.dark_pattern_detector import run_dark_pattern_detector
from scrapers.registry import get_simulated_scraper

router = APIRouter(prefix="/api/public", tags=["Open Data / Public Transparency"])

mmt_scraper = get_simulated_scraper("simulated_makemytrip")


@router.get(
    "/dark-patterns",
    response_model=DarkPatternResponse,
    summary="Fare-manipulation / dark-pattern detector for OTA listing pages",
    description=(
        "Scans a simulated OTA listing batch (pipeline/dark_pattern_detector.py) for two "
        "consumer-protection signals: artificial-scarcity copy ('3 seats left', 'hurry') that "
        "doesn't match the underlying seat_availability_flag, and fare-cookie price escalation, "
        "where the same listing's shown fare climbs across simulated repeat page views in one "
        "browsing session. Flags are rule-based heuristics over deterministic fixture data, not "
        "a legal finding about any real OTA. No API key required."
    ),
)
async def get_dark_patterns(
    route: str = Query("DEL-BOM", description="Corridor code, e.g. DEL-BOM"),
    advance_days: int = Query(7, description="Lead window days: 1, 7, 15, 30, 45"),
):
    route_upper = route.upper().strip()
    parts = route_upper.split("-")
    origin = parts[0] if len(parts) > 0 else "DEL"
    dest = parts[1] if len(parts) > 1 else "BOM"
    target_date = (datetime.date.today() + datetime.timedelta(days=advance_days)).isoformat()

    mmt_records = mmt_scraper.search(origin, dest, target_date, advance_days)
    report = run_dark_pattern_detector(mmt_records)

    return DarkPatternResponse(
        route_pair=route_upper,
        advance_days=advance_days,
        departure_date=target_date,
        methodology_note=(
            "Scarcity copy is matched against a fixed phrase list and cross-checked against "
            "seat_availability_flag; repeat-view escalation flags a >=2% fare rise across a "
            "simulated 3-view browsing session for the same listing."
        ),
        **report.to_dict(),
    )
