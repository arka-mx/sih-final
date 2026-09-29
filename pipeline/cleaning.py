import re
import hashlib
import datetime
import logging
from typing import Any, Dict, List, Optional, Tuple, Union

from scrapers.models import RawFareRecord
from pipeline.schema import CleanedFareRecord

logger = logging.getLogger(__name__)

# Standard carrier canonicalization mapping
CARRIER_CANONICAL_MAP = {
    "indigo": "IndiGo",
    "6e": "IndiGo",
    "air india": "Air India",
    "ai": "Air India",
    "airindia": "Air India",
    "spicejet": "SpiceJet",
    "sg": "SpiceJet",
    "akasa": "Akasa Air",
    "akasa air": "Akasa Air",
    "qp": "Akasa Air",
    "air india express": "Air India Express",
    "ix": "Air India Express",
    "airasia india": "AIX Connect",
    "vistara": "Air India",
}

# Standard airport code mapping
AIRPORT_CANONICAL_MAP = {
    "DEL": "DEL", "DELHI": "DEL", "NEW DELHI": "DEL",
    "BOM": "BOM", "MUMBAI": "BOM", "BOMBAY": "BOM",
    "BLR": "BLR", "BENGALURU": "BLR", "BANGALORE": "BLR",
    "CCU": "CCU", "KOLKATA": "CCU", "CALCUTTA": "CCU",
    "HYD": "HYD", "HYDERABAD": "HYD",
    "MAA": "MAA", "CHENNAI": "MAA", "MADRAS": "MAA",
    "PNQ": "PNQ", "PUNE": "PNQ",
    "GOI": "GOI", "GOX": "GOI", "GOA": "GOI",
    "PAT": "PAT", "PATNA": "PAT",
    "IXR": "IXR", "RANCHI": "IXR",
    "GAU": "GAU", "GUWAHATI": "GAU",
}


def clean_currency_amount(val: Union[str, int, float, None]) -> float:
    """
    Sanitize raw fare strings containing currency symbols, commas, or whitespace.
    Examples: "₹ 3,450.00" -> 3450.0, "Rs. 4,200" -> 4200.0, 3100 -> 3100.0
    """
    if val is None:
        return 0.0
    if isinstance(val, (int, float)):
        return round(float(val), 2)
    
    val_str = str(val).strip()
    # Strip currency signs (₹, Rs, INR) and non-numeric characters except dot
    cleaned = re.sub(r"[^0-9.]", "", val_str)
    try:
        parsed = float(cleaned)
        return round(parsed, 2)
    except (ValueError, TypeError):
        return 0.0


def normalize_airport_code(code: Optional[str]) -> str:
    """Standardize airport code to 3-letter IATA uppercase."""
    if not code:
        return "DEL"
    clean = code.strip().upper()
    return AIRPORT_CANONICAL_MAP.get(clean, clean[:3])


def normalize_carrier_name(carrier: Optional[str]) -> str:
    """Normalize carrier strings into official airline brand names."""
    if not carrier:
        return "IndiGo"
    clean = carrier.strip().lower()
    return CARRIER_CANONICAL_MAP.get(clean, carrier.strip())


def normalize_availability_status(status: Optional[str]) -> Tuple[str, bool]:
    """
    Parse availability string into standard enum and boolean flag.
    Returns: (status_enum, is_available_bool)
    """
    if not status:
        return "AVAILABLE", True
    
    clean = status.strip().upper()
    if any(kw in clean for kw in ("CANCEL", "CANCELLED", "CANCELED")):
        return "CANCELLED", False
    if any(kw in clean for kw in ("SOLD OUT", "SOLDOUT", "NO SEATS", "FULL", "UNAVAILABLE")):
        return "SOLD_OUT", False
    if any(kw in clean for kw in ("FEW", "LEFT", "LAST", "SEATS LEFT")):
        return "FEW_SEATS_LEFT", True
    
    return "AVAILABLE", True


def generate_sha256_audit_hash(
    record_id: str,
    carrier: str,
    flight_no: str,
    departure_date: str,
    total_fare: float
) -> str:
    """
    Generate SHA-256 cryptographic audit signature for MoSPI reproducibility.
    Format identical to backend model requirement.
    """
    raw = f"{record_id}|{carrier}|{flight_no}|{departure_date}|{total_fare}"
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def clean_fare_record(
    raw: Union[RawFareRecord, Dict[str, Any]],
    default_scrape_date: Optional[str] = None
) -> CleanedFareRecord:
    """
    Core cleaning and normalization pipeline for a single fare observation.
    Accepts RawFareRecord dataclass or raw JSON dictionary.
    """
    if isinstance(raw, RawFareRecord):
        data = raw.to_dict()
    else:
        data = dict(raw)

    today_str = default_scrape_date or datetime.date.today().isoformat()
    scrape_date = data.get("scrape_date") or data.get("scrape_timestamp", today_str)[:10]

    origin = normalize_airport_code(data.get("origin"))
    dest = normalize_airport_code(data.get("destination") or data.get("dest"))
    pair = data.get("route_pair") or f"{origin}-{dest}"

    carrier = normalize_carrier_name(data.get("carrier") or data.get("carrier_name"))
    flight_no = str(data.get("flight_no") or data.get("flight_identifier") or "NA").strip().upper()
    dep_date = str(data.get("departure_date") or today_str)[:10]
    advance_days = int(data.get("advance_purchase_days") or data.get("advance_days") or data.get("lead_days") or 1)

    # Clean currency fields
    base_fare = clean_currency_amount(data.get("base_fare") or data.get("raw_base_price"))
    taxes_udf = clean_currency_amount(data.get("taxes_fees") or data.get("raw_taxes_udf") or data.get("taxes"))
    conv_fee = clean_currency_amount(data.get("convenience_fee") or data.get("convenience_charge") or data.get("ota_fee"))
    total_fare = clean_currency_amount(data.get("total_fare") or data.get("raw_total_price"))

    # Imputation Logic (PRD Section 6.2: Missing value imputation)
    imputation_applied = False
    imputed_fields: List[str] = []

    if total_fare > 0 and base_fare <= 0:
        # Standard domestic split: ~78% base fare, ~22% taxes & statutory UDF
        calculated_base = round(total_fare * 0.78, 2)
        calculated_taxes = round(max(0.0, total_fare - calculated_base - conv_fee), 2)
        base_fare = calculated_base
        taxes_udf = calculated_taxes
        imputation_applied = True
        imputed_fields.extend(["base_fare", "taxes_udf"])
        logger.debug(f"Imputed base/taxes for {flight_no} on {pair}: base={base_fare}, taxes={taxes_udf}")
    elif total_fare <= 0 and base_fare > 0:
        total_fare = round(base_fare + taxes_udf + conv_fee, 2)
        imputation_applied = True
        imputed_fields.append("total_fare")
        logger.debug(f"Imputed total_fare for {flight_no} on {pair}: total={total_fare}")

    # Clamp negative convenience fees
    if conv_fee < 0:
        conv_fee = 0.0

    # Availability normalization
    status_text = data.get("seat_availability_flag") or data.get("flight_status") or data.get("seats_left_text")
    avail_flag, is_avail = normalize_availability_status(status_text)

    # Record ID format matching SQL schema
    scrape_id = data.get("scrape_id", "REC")
    record_id = f"F_{scrape_id}_{pair}_{flight_no}_{advance_days}".replace("-", "_")

    # Cryptographic audit hash
    audit_hash = generate_sha256_audit_hash(record_id, carrier, flight_no, dep_date, total_fare)

    source = data.get("source_platform") or data.get("source") or "Direct Engine"
    raw_payload_ref = data.get("raw_payload_ref", "")

    return CleanedFareRecord(
        id=record_id,
        pair=pair,
        origin=origin,
        destination=dest,
        carrier=carrier,
        flight_no=flight_no,
        departure_date=dep_date,
        scrape_date=scrape_date,
        advance_days=advance_days,
        fare_class=data.get("fare_class", "Economy"),
        base_fare=base_fare,
        taxes_udf=taxes_udf,
        convenience_fee=conv_fee,
        total_fare=total_fare,
        seat_avail=is_avail,
        seat_availability_flag=avail_flag,
        source=source,
        audit_hash=audit_hash,
        raw_payload_ref=raw_payload_ref,
        imputation_applied=imputation_applied,
        imputed_fields=imputed_fields,
        include_in_cpi_index=is_avail,
    )


def clean_fare_batch(
    raw_records: List[Union[RawFareRecord, Dict[str, Any]]],
    default_scrape_date: Optional[str] = None
) -> List[CleanedFareRecord]:
    """Clean a collection of raw records."""
    return [clean_fare_record(r, default_scrape_date) for r in raw_records]
