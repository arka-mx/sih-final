import math
from typing import List, Dict

def jevons_elementary_index(current_prices: List[float], base_prices: List[float]) -> float:
    """
    Jevons Index (Geometric mean of price relatives):
    I_J = ( \prod_{i=1}^n \frac{P_{1, i}}{P_{0, i}} )^{1/n} * 100
    
    Formula is directly hand-rollable without opaque statistical black boxes.
    """
    if not current_prices or not base_prices or len(current_prices) != len(base_prices):
        raise ValueError("Prices arrays must be non-empty and of equal length.")

    n = len(current_prices)
    sum_log_relatives = 0.0
    for p1, p0 in zip(current_prices, base_prices):
        if p0 <= 0 or p1 <= 0:
            raise ValueError("Prices must be strictly positive.")
        sum_log_relatives += math.log(p1 / p0)

    geometric_mean = math.exp(sum_log_relatives / n)
    return round(geometric_mean * 100.0, 4)
