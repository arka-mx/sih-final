from typing import Any, Dict, List
from pydantic import BaseModel


class DarkPatternFlagItem(BaseModel):
    scrape_id: str
    source_platform: str
    route_pair: str
    carrier: str
    flight_no: str
    departure_date: str
    advance_days: int
    pattern_type: str
    severity: str
    message: str
    evidence: Dict[str, Any]
    raw_payload_ref: str


class DarkPatternResponse(BaseModel):
    status: str = "success"
    data_mode: str = "simulated"
    is_live_data: bool = False
    disclaimer: str = (
        "Deterministic fixture-derived flags for demonstration only; not a claim about any "
        "real OTA's current listing behavior."
    )
    route_pair: str
    advance_days: int
    departure_date: str
    total_listings_scanned: int
    total_flagged: int
    flagged_by_pattern_type: Dict[str, int]
    flagged_by_severity: Dict[str, int]
    flags: List[DarkPatternFlagItem]
    methodology_note: str
