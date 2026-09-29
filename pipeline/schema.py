from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any

@dataclass
class CleanedFareRecord:
    """
    Standardized, cleaned, and validated fare record conforming to
    MoSPI DIID statistical specifications.
    """
    id: str
    pair: str                         # e.g. "DEL-BOM"
    origin: str                       # e.g. "DEL"
    destination: str                  # e.g. "BOM"
    carrier: str                      # e.g. "IndiGo"
    flight_no: str                    # e.g. "6E-205"
    departure_date: str               # "YYYY-MM-DD"
    scrape_date: str                  # "YYYY-MM-DD"
    advance_days: int                 # 1, 7, 15, 30, 45
    fare_class: str = "Economy"       # "Economy"
    base_fare: float = 0.0
    taxes_udf: float = 0.0
    convenience_fee: float = 0.0
    total_fare: float = 0.0
    seat_avail: bool = True
    seat_availability_flag: str = "AVAILABLE"  # "AVAILABLE", "FEW_SEATS_LEFT", "SOLD_OUT", "CANCELLED"
    source: str = "Direct Engine"
    audit_hash: str = ""
    raw_payload_ref: str = ""
    data_mode: str = "simulated"
    is_live_data: bool = False
    simulation_disclaimer: str = "Deterministic fixture data for demonstration only; not a live fare or booking offer."

    # Pipeline metadata flags
    imputation_applied: bool = False
    imputed_fields: List[str] = field(default_factory=list)
    is_outlier: bool = False
    outlier_reason: Optional[str] = None
    is_duplicate: bool = False
    include_in_cpi_index: bool = True
    z_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dict schema matching the SQL Fare model."""
        return {
            "id": self.id,
            "pair": self.pair,
            "origin": self.origin,
            "destination": self.destination,
            "carrier": self.carrier,
            "flight_no": self.flight_no,
            "departure_date": self.departure_date,
            "scrape_date": self.scrape_date,
            "advance_days": self.advance_days,
            "fare_class": self.fare_class,
            "base_fare": self.base_fare,
            "taxes_udf": self.taxes_udf,
            "convenience_fee": self.convenience_fee,
            "total_fare": self.total_fare,
            "seat_avail": self.seat_avail,
            "source": self.source,
            "audit_hash": self.audit_hash,
        }

@dataclass
class PipelineAuditSummary:
    total_raw_ingested: int = 0
    valid_cleaned_records: int = 0
    duplicates_merged: int = 0
    outliers_flagged: int = 0
    imputed_records_count: int = 0
    sold_out_excluded: int = 0
    cpi_eligible_records: int = 0
    data_quality_score_percent: float = 100.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
