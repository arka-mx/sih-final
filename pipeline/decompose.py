import os
import json
import logging
from typing import List, Dict, Any, Tuple
from scrapers.models import RawFareRecord

logger = logging.getLogger(__name__)

class FeeDecompositionResult:
    def __init__(
        self,
        route_pair: str,
        carrier: str,
        flight_no: str,
        departure_date: str,
        advance_days: int,
        direct_total: float,
        mmt_total: float,
        inferred_convenience_fee: float,
        direct_base: float,
        mmt_base: float,
        base_fare_diff: float,
        raw_direct_ref: str,
        raw_mmt_ref: str,
    ):
        self.route_pair = route_pair
        self.carrier = carrier
        self.flight_no = flight_no
        self.departure_date = departure_date
        self.advance_days = advance_days
        self.direct_total = direct_total
        self.mmt_total = mmt_total
        self.inferred_convenience_fee = inferred_convenience_fee
        self.direct_base = direct_base
        self.mmt_base = mmt_base
        self.base_fare_diff = base_fare_diff
        self.raw_direct_ref = raw_direct_ref
        self.raw_mmt_ref = raw_mmt_ref

    def to_dict(self) -> Dict[str, Any]:
        return {
            "route_pair": self.route_pair,
            "carrier": self.carrier,
            "flight_no": self.flight_no,
            "departure_date": self.departure_date,
            "advance_days": self.advance_days,
            "direct_total": self.direct_total,
            "mmt_total": self.mmt_total,
            "inferred_convenience_fee": self.inferred_convenience_fee,
            "direct_base": self.direct_base,
            "mmt_base": self.mmt_base,
            "base_fare_diff": self.base_fare_diff,
            "raw_direct_ref": self.raw_direct_ref,
            "raw_mmt_ref": self.raw_mmt_ref,
        }

def decompose_matched_flights(
    indigo_records: List[RawFareRecord],
    mmt_records: List[RawFareRecord],
) -> List[FeeDecompositionResult]:
    """
    Centerpiece feature:
    For matched (carrier, flight_no, departure_date, advance_days) across
    simulated IndiGo direct-channel and simulated MakeMyTrip fixture records, computes:
        inferred_convenience_fee = mmt_total - direct_total
    
    Acts as:
    1. Cross-source outlier and consistency check
    2. Simulated OTA convenience-fee comparison
    3. Fully auditable back to underlying raw payloads
    """
    direct_index: Dict[Tuple[str, str, str, int], RawFareRecord] = {}
    for r in indigo_records:
        key = (r.carrier.upper(), r.flight_no.upper(), r.departure_date, r.advance_purchase_days)
        direct_index[key] = r

    results: List[FeeDecompositionResult] = []

    for mmt_r in mmt_records:
        key = (mmt_r.carrier.upper(), mmt_r.flight_no.upper(), mmt_r.departure_date, mmt_r.advance_purchase_days)
        if key in direct_index:
            dir_r = direct_index[key]
            inferred_fee = round(mmt_r.total_fare - dir_r.total_fare, 2)
            base_diff = round(mmt_r.base_fare - dir_r.base_fare, 2)

            res = FeeDecompositionResult(
                route_pair=mmt_r.route_pair,
                carrier=mmt_r.carrier,
                flight_no=mmt_r.flight_no,
                departure_date=mmt_r.departure_date,
                advance_days=mmt_r.advance_purchase_days,
                direct_total=dir_r.total_fare,
                mmt_total=mmt_r.total_fare,
                inferred_convenience_fee=inferred_fee,
                direct_base=dir_r.base_fare,
                mmt_base=mmt_r.base_fare,
                base_fare_diff=base_diff,
                raw_direct_ref=dir_r.raw_payload_ref,
                raw_mmt_ref=mmt_r.raw_payload_ref,
            )
            results.append(res)
            logger.info(
                f"[DECOMPOSE] Matched {mmt_r.flight_no} ({mmt_r.route_pair}): "
                f"Direct=₹{dir_r.total_fare} vs MMT=₹{mmt_r.total_fare} => Markup=₹{inferred_fee}"
            )

    return results
