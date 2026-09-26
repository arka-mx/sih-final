from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from datetime import datetime

@dataclass
class RawFareRecord:
    scrape_id: str
    source_platform: str  # "indigo_direct" | "makemytrip"
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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
