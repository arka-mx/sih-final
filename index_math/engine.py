import math
import statistics
from typing import Dict, List, Tuple

from index_math.jevons import jevons_elementary_index
from index_math.laspeyres import laspeyres_aggregate_index
from index_math.fisher import paasche_aggregate_index, fisher_ideal_index
from index_math.weights import DGCA_BASKET_WEIGHTS

# Base-period (2025-01-01=100) reference average fares per DGCA basket corridor.
# Anchors the Jevons elementary relative P1/P0 for each corridor until a real
# historical fare warehouse replaces this static reference, exactly as
# DGCA_BASKET_WEIGHTS in index_math/weights.py stands in for a live traffic feed.
BASE_PERIOD_ROUTE_FARES: Dict[str, float] = {
    "DEL-BOM": 4000.0,
    "DEL-BLR": 4100.0,
    "BOM-BLR": 3050.0,
    "DEL-CCU": 4200.0,
    "DEL-HYD": 4600.0,
    "BLR-HYD": 2100.0,
    "MAA-DEL": 4500.0,
    "CCU-BLR": 4800.0,
    "DEL-PNQ": 4300.0,
    "BOM-GOI": 3400.0,
    "DEL-PAT": 3900.0,
    "DEL-GAU": 5200.0,
    "DEL-IXR": 4000.0,
    "BOM-PAT": 5300.0,
    "CCU-GAU": 3600.0,
}

BASE_PERIOD_LABEL = "2025-01-01=100"

# Two-sided critical value for a 95% confidence interval under a normal
# approximation of the sampling distribution.
CI_Z_SCORE = 1.96
MIN_CI_MARGIN = 0.05


def _standard_error_ci(
    fares_by_route: Dict[str, List[float]],
    base_prices: Dict[str, float],
    route_indices: Dict[str, float],
    fisher: float,
) -> Tuple[float, float]:
    """
    95% CI for the published Fisher aggregate from the standard error of the
    mean of every individual route-relative price observation (current fare /
    base-period fare, expressed on the same 100=base scale as the index)
    across every route that reported a Jevons index today.

    Pooling at the level of raw fare quotes -- rather than at the level of
    the per-route aggregated indices -- means the CI reflects both of the
    quantities called out by the DGCA methodology as index-quality signals:
    how many basket routes reported today (more routes contribute more
    independent terms to the pooled sample) and how many source quotes each
    route was corroborated by (a route seen from three scrapers contributes
    three terms, a route seen from one contributes one). A thin data day --
    few routes, or routes backed by a single source -- produces a wider band;
    a well-corroborated day narrows it.
    """
    relatives: List[float] = []
    for route in route_indices:
        base_price = base_prices.get(route)
        if not base_price:
            continue
        relatives.extend(
            (price / base_price) * 100.0 for price in fares_by_route.get(route, [])
        )

    n = len(relatives)
    if n < 2:
        # A single pooled observation carries no estimable sampling
        # variance; fall back to a fixed minimum band rather than reporting
        # a false-precision zero-width interval.
        margin = 0.5
    else:
        stdev = statistics.stdev(relatives)
        standard_error = stdev / math.sqrt(n)
        margin = max(round(CI_Z_SCORE * standard_error, 2), MIN_CI_MARGIN)

    return round(fisher - margin, 2), round(fisher + margin, 2)


def compute_route_elementary_indices(
    fares_by_route: Dict[str, List[float]],
    base_prices: Dict[str, float] = BASE_PERIOD_ROUTE_FARES,
) -> Dict[str, float]:
    """
    Reduces raw current-period fare quotes per route into a Jevons elementary
    index (index_math/jevons.py) for each route that has both a base-period
    reference price and at least one current-period quote.
    """
    route_indices: Dict[str, float] = {}
    for route, current_prices in fares_by_route.items():
        base_price = base_prices.get(route)
        if base_price is None or not current_prices:
            continue
        route_indices[route] = jevons_elementary_index(
            current_prices, [base_price] * len(current_prices)
        )
    return route_indices


def compute_daily_aggregate_indices(
    fares_by_route: Dict[str, List[float]],
    weights: Dict[str, float] = DGCA_BASKET_WEIGHTS,
    base_prices: Dict[str, float] = BASE_PERIOD_ROUTE_FARES,
) -> Dict[str, float]:
    """
    Full index-computation path: raw route-level fare quotes -> Jevons
    elementary indices -> Laspeyres / Paasche / Fisher aggregates.

    This is the single function that both the daily pipeline job
    (pipeline/runner.py) and the API's fallback seed data
    (apix-api/app/db.py) call, so both paths compute the same real formulas
    from the same real fare data.
    """
    route_indices = compute_route_elementary_indices(fares_by_route, base_prices)
    if not route_indices:
        raise ValueError(
            "No route indices could be computed: missing a base-period price "
            "or a current-period fare quote for every DGCA basket route."
        )

    laspeyres = laspeyres_aggregate_index(route_indices, weights)
    paasche = paasche_aggregate_index(route_indices, weights)
    fisher = fisher_ideal_index(route_indices, weights)

    ci_lower, ci_upper = _standard_error_ci(fares_by_route, base_prices, route_indices, fisher)

    return {
        "route_indices": route_indices,
        "laspeyres": laspeyres,
        "paasche": paasche,
        "fisher": fisher,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper,
    }
