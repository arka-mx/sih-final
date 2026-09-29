import math
import pytest
from index_math.jevons import jevons_elementary_index
from index_math.laspeyres import laspeyres_aggregate_index, DGCA_3_ROUTE_WEIGHTS
from index_math.fisher import paasche_aggregate_index, fisher_ideal_index
from index_math.engine import compute_daily_aggregate_indices, BASE_PERIOD_ROUTE_FARES

def test_jevons_elementary_index_known_calculation():
    """
    Test Jevons formula against hand-computed values:
    Route with 3 quotes:
    Base prices: P0 = [3000, 4000, 5000]
    Current prices: P1 = [3300, 4200, 5250]
    Relatives:
      3300 / 3000 = 1.10
      4200 / 4000 = 1.05
      5250 / 5000 = 1.05
    Product = 1.10 * 1.05 * 1.05 = 1.21275
    Geometric Mean = (1.21275) ^ (1/3) = 1.066428...
    Expected Index = 106.6429
    """
    base_prices = [3000.0, 4000.0, 5000.0]
    current_prices = [3300.0, 4200.0, 5250.0]
    idx = jevons_elementary_index(current_prices, base_prices)
    assert abs(idx - 106.6429) < 0.001

def test_laspeyres_aggregate_index_known_calculation():
    """
    Test Laspeyres aggregation across 3 DGCA corridors:
    Weights:
      DEL-BOM: 0.4091
      DEL-BLR: 0.3182
      BOM-BLR: 0.2727
    Elementary indices:
      DEL-BOM = 102.5
      DEL-BLR = 101.0
      BOM-BLR = 99.5
    Hand-calculated:
      0.4091 * 102.5 = 41.93275
      0.3182 * 101.0 = 32.1382
      0.2727 * 99.5  = 27.13365
      Sum = 101.2046 => 101.20
    """
    route_indices = {
        "DEL-BOM": 102.5,
        "DEL-BLR": 101.0,
        "BOM-BLR": 99.5,
    }
    agg = laspeyres_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    assert abs(agg - 101.20) <= 0.05


def test_paasche_aggregate_index_known_calculation():
    """
    Paasche aggregation across the same 3 DGCA corridors, using the same base
    weights but the weighted HARMONIC mean instead of the arithmetic mean:
    Weights:
      DEL-BOM: 0.4091
      DEL-BLR: 0.3182
      BOM-BLR: 0.2727
    Elementary indices:
      DEL-BOM = 102.5
      DEL-BLR = 101.0
      BOM-BLR = 99.5
    Hand-calculated:
      sum(W_r / I_r) = 0.4091/102.5 + 0.3182/101.0 + 0.2727/99.5
                     = 0.0039912 + 0.0031505 + 0.0027407 = 0.0098824
      I_P = 1.0 / 0.0098824 = 101.19
    """
    route_indices = {
        "DEL-BOM": 102.5,
        "DEL-BLR": 101.0,
        "BOM-BLR": 99.5,
    }
    agg = paasche_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    assert abs(agg - 101.19) <= 0.05


def test_paasche_is_less_than_or_equal_to_laspeyres():
    """
    Fundamental index-number-theory inequality: for any non-uniform set of
    route indices, the weighted harmonic mean (Paasche) is <= the weighted
    arithmetic mean (Laspeyres) using the same weights.
    """
    route_indices = {"DEL-BOM": 105.0, "DEL-BLR": 98.0, "BOM-BLR": 110.0}
    laspeyres = laspeyres_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    paasche = paasche_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    assert paasche <= laspeyres


def test_fisher_ideal_index_is_geometric_mean_of_laspeyres_and_paasche():
    route_indices = {
        "DEL-BOM": 102.5,
        "DEL-BLR": 101.0,
        "BOM-BLR": 99.5,
    }
    laspeyres = laspeyres_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    paasche = paasche_aggregate_index(route_indices, DGCA_3_ROUTE_WEIGHTS)
    fisher = fisher_ideal_index(route_indices, DGCA_3_ROUTE_WEIGHTS)

    assert abs(fisher - math.sqrt(laspeyres * paasche)) < 0.01
    # Fisher must lie between Paasche and Laspeyres.
    assert paasche <= fisher <= laspeyres


def test_fisher_ideal_index_uniform_prices_equals_100():
    """When every route index equals 100, Laspeyres/Paasche/Fisher all collapse to 100."""
    route_indices = {"DEL-BOM": 100.0, "DEL-BLR": 100.0, "BOM-BLR": 100.0}
    assert fisher_ideal_index(route_indices, DGCA_3_ROUTE_WEIGHTS) == 100.0


def test_compute_daily_aggregate_indices_end_to_end():
    """
    Full index_math/engine.py path: raw route-level fare quotes -> Jevons
    elementary index per route -> Laspeyres/Paasche/Fisher aggregates.
    """
    base = BASE_PERIOD_ROUTE_FARES
    fares_by_route = {
        "DEL-BOM": [base["DEL-BOM"] * 1.05, base["DEL-BOM"] * 1.03],
        "DEL-BLR": [base["DEL-BLR"] * 1.02],
        "BOM-BLR": [base["BOM-BLR"] * 0.98],
    }
    result = compute_daily_aggregate_indices(fares_by_route)

    assert set(result["route_indices"].keys()) == {"DEL-BOM", "DEL-BLR", "BOM-BLR"}
    assert result["paasche"] <= result["fisher"] <= result["laspeyres"]
    assert result["ci_lower"] < result["fisher"] < result["ci_upper"]


def test_compute_daily_aggregate_indices_raises_without_matching_routes():
    with pytest.raises(ValueError):
        compute_daily_aggregate_indices({"XXX-YYY": [3000.0]})
