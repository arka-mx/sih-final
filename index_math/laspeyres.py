from typing import Dict, List

from index_math.weights import DGCA_BASKET_WEIGHTS, DGCA_DATA_VINTAGE

# Legacy 3-route basket (DEL-BOM, DEL-BLR, BOM-BLR), normalized across only
# those 3 corridors. Retained for the original hand-calculated formula tests
# in tests/test_index_math.py; the live default basket used across the
# pipeline/API is now the full 15-route DGCA_BASKET_WEIGHTS in
# index_math/weights.py.
DGCA_3_ROUTE_WEIGHTS = {
    "DEL-BOM": 0.4091,
    "DEL-BLR": 0.3182,
    "BOM-BLR": 0.2727,
}

def laspeyres_aggregate_index(
    route_indices: Dict[str, float],
    weights: Dict[str, float] = DGCA_BASKET_WEIGHTS,
) -> float:
    """
    Laspeyres Aggregate Index across the DGCA basket corridors:
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
