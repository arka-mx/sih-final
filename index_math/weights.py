from typing import Dict

# Shared DGCA route-basket weighting module consumed by index_math/laspeyres.py,
# index_math/fisher.py, index_math/engine.py, apix-api/app/db.py (Route seed
# data) and pipeline/runner.py (scraper target routes), so there is a single
# source of truth for which corridors are in the basket and how much DGCA
# domestic passenger traffic each one represents.
#
# PRD requirement: 15-20 city-pairs covering >=60% of DGCA domestic traffic,
# including tier-2 routes. This basket covers 15 corridors: the 10 PRD-listed
# metro/leisure pairs plus 5 metro<->tier-2 pairs into Patna, Ranchi and
# Guwahati.

DGCA_DATA_VINTAGE = "DGCA Domestic Air Traffic Statistics Report (Jan-Jun 2025 Release)"

# Raw DGCA passenger-traffic share per route, as a fraction of total DGCA
# scheduled domestic traffic. NOT normalized to 1.0: the sum of these values
# is itself the basket's coverage of total domestic traffic.
DGCA_ROUTE_TRAFFIC_SHARE: Dict[str, float] = {
    # Metro-to-metro trunk routes
    "DEL-BOM": 0.108,
    "DEL-BLR": 0.081,
    "BOM-BLR": 0.071,
    "DEL-CCU": 0.055,
    "DEL-HYD": 0.051,
    "BLR-HYD": 0.044,
    "MAA-DEL": 0.042,
    "CCU-BLR": 0.038,
    # Metro-to-tier2 / leisure routes
    "DEL-PNQ": 0.033,
    "BOM-GOI": 0.030,
    # Tier-2 routes: Patna, Ranchi, Guwahati
    "DEL-PAT": 0.020,
    "DEL-GAU": 0.019,
    "DEL-IXR": 0.016,
    "BOM-PAT": 0.010,
    "CCU-GAU": 0.013,
}

# Basket coverage of total DGCA domestic traffic (PRD target: >= 0.60).
BASKET_COVERAGE_SHARE = round(sum(DGCA_ROUTE_TRAFFIC_SHARE.values()), 4)


def normalize_weights(raw_shares: Dict[str, float]) -> Dict[str, float]:
    """Rescales a set of raw traffic shares so they sum to 1.0."""
    total = sum(raw_shares.values())
    if total == 0:
        raise ValueError("Cannot normalize an empty or all-zero weights basket.")
    return {route: round(share / total, 6) for route, share in raw_shares.items()}


# Normalized so sum(DGCA_BASKET_WEIGHTS.values()) == 1.0. This is the default
# weighting scheme used by the Laspeyres/Paasche/Fisher aggregate formulas.
DGCA_BASKET_WEIGHTS: Dict[str, float] = normalize_weights(DGCA_ROUTE_TRAFFIC_SHARE)
