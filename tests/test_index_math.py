import pytest
from index_math.jevons import jevons_elementary_index
from index_math.laspeyres import laspeyres_aggregate_index, DGCA_3_ROUTE_WEIGHTS

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
