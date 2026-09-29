import math
from typing import Dict

from index_math.laspeyres import laspeyres_aggregate_index
from index_math.weights import DGCA_BASKET_WEIGHTS


def paasche_aggregate_index(
    route_indices: Dict[str, float],
    weights: Dict[str, float] = DGCA_BASKET_WEIGHTS,
) -> float:
    """
    Paasche Aggregate Index across the DGCA basket corridors, computed as the
    weighted HARMONIC mean of the elementary route indices:

    I_P = ( \\sum_{r} W_r ) / ( \\sum_{r} W_r / I_r )

    Real-time current-period expenditure weights are not observable at
    publication time (DGCA traffic statistics lag by a quarter), so - exactly
    like statistical agencies producing rapid-turnaround indices - the same
    published DGCA traffic-share weights W_r used by Laspeyres are re-used
    here. The weighted harmonic mean is what makes this a genuine Paasche-type
    aggregate rather than a copy of Laspeyres: for any non-uniform set of
    route indices, the weighted harmonic mean is strictly <= the weighted
    arithmetic mean (Laspeyres), which is the defining Laspeyres >= Paasche
    inequality Fisher's Ideal Index is designed to average out.
    """
    total_weight = sum(weights.get(r, 0.0) for r in route_indices.keys())
    if total_weight == 0:
        raise ValueError("No matching route weights found.")

    harmonic_sum = sum(
        weights[r] / route_indices[r] for r in route_indices if r in weights and route_indices[r] != 0
    )
    if harmonic_sum == 0:
        raise ValueError("Cannot compute Paasche index: all route indices are zero.")

    aggregate = total_weight / harmonic_sum
    return round(aggregate, 2)


def fisher_ideal_index(
    route_indices: Dict[str, float],
    weights: Dict[str, float] = DGCA_BASKET_WEIGHTS,
) -> float:
    """
    Fisher Ideal Index: the geometric mean of the Laspeyres and Paasche
    aggregates over the same basket of DGCA-weighted route corridors:

    I_F = sqrt( I_L * I_P )

    Fisher's Ideal Index satisfies both the time-reversal and factor-reversal
    tests that neither Laspeyres nor Paasche satisfy alone, which is why it is
    the formula recommended by the ILO/IMF/Eurostat CPI manual for headline
    published price indices whenever both base- and current-period weight
    information is available (or can be reasonably approximated, as here).
    """
    laspeyres = laspeyres_aggregate_index(route_indices, weights)
    paasche = paasche_aggregate_index(route_indices, weights)
    fisher = math.sqrt(laspeyres * paasche)
    return round(fisher, 2)
