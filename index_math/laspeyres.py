from typing import Dict, List

# Exactly the 3 routes in the basket with official DGCA traffic share weights:
# Normalized so sum(weights) == 1.0 across the 3 corridors:
# Raw published DGCA shares: DEL-BOM (0.18), DEL-BLR (0.14), BOM-BLR (0.12)
# Sum = 0.44
# Normalized weights:
# DEL-BOM: 0.18 / 0.44 ≈ 0.4091 (40.91%)
# DEL-BLR: 0.14 / 0.44 ≈ 0.3182 (31.82%)
# BOM-BLR: 0.12 / 0.44 ≈ 0.2727 (27.27%)

DGCA_3_ROUTE_WEIGHTS = {
    "DEL-BOM": 0.4091,
    "DEL-BLR": 0.3182,
    "BOM-BLR": 0.2727,
}

DGCA_DATA_VINTAGE = "DGCA Domestic Air Traffic Statistics Report (Jan-Jun 2025 Release)"

def laspeyres_aggregate_index(
    route_indices: Dict[str, float],
    weights: Dict[str, float] = DGCA_3_ROUTE_WEIGHTS,
) -> float:
    """
    Laspeyres Aggregate Index across the 3 DGCA basket corridors:
    I_L = \sum_{r} ( W_r * I_r )
    
    Where:
    - W_r is DGCA passenger-traffic consumption weight for route r
    - I_r is the elementary price index for route r
    """
    total_weight = sum(weights.get(r, 0.0) for r in route_indices.keys())
    if total_weight == 0:
        raise ValueError("No matching route weights found.")

    weighted_sum = sum(route_indices[r] * weights[r] for r in route_indices if r in weights)
    # Rescale by actual sum of weights in case a route is missing
    aggregate = weighted_sum / total_weight
    return round(aggregate, 2)
