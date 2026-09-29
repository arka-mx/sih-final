from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, Any, List
from datetime import datetime

@dataclass
class RawFareRecord:
    scrape_id: str
    source_platform: str  # e.g. "simulated_indigo"; never a live-source claim
    origin: str           # "DEL"
    destination: str      # "BOM"
    route_pair: str       # "DEL-BOM"
    carrier: str          # "IndiGo", "Air India", "Akasa Air", "SpiceJet"
    flight_no: str        # e.g. "6E-205"
    departure_date: str   # "YYYY-MM-DD"
    departure_time: Optional[str]
    arrival_time: Optional[str]
    advance_purchase_days: int  # 1, 7, 15, 30, 45
    fare_class: str       # "Economy"
    base_fare: float
    taxes_fees: float     # UDF, CUTE, GST
    convenience_fee: float
    total_fare: float
    currency: str         # "INR"
    seat_availability_flag: str  # "AVAILABLE", "FEW_SEATS_LEFT", "SOLD_OUT"
    scrape_timestamp: str # ISO 8601
    raw_payload_ref: str  # path or key to raw payload in raw_store
    data_mode: str = "simulated"
    is_live_data: bool = False
    simulation_disclaimer: str = (
        "Deterministic fixture data for demonstration only; not a live fare or booking offer."
    )
    # OTA listing-page copy shown alongside this fare (e.g. "Only 2 seats left!").
    # None for direct-channel/non-OTA sources that don't render such copy.
    listing_copy: Optional[str] = None
    # Simulated fare-cookie tracking: the total fare this same listing showed
    # across successive repeat page views in one browsing session, oldest first.
    # Models the "price goes up the more you look" dark pattern. None where
    # the source doesn't simulate repeat-view tracking.
    repeat_view_fare_history: Optional[List[float]] = field(default=None)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
