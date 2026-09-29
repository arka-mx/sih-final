import pytest

from index_math.elasticity import find_optimal_window


def test_find_optimal_window_identifies_cheapest_and_priciest():
    result = find_optimal_window({1: 8250.0, 7: 4570.0, 15: 3950.0, 30: 3540.0, 45: 3370.0})
    assert result["optimal_window_days"] == 45
    assert result["optimal_window_label"] == "T+45"
    assert result["optimal_avg_fare"] == 3370.0
    assert result["worst_window_days"] == 1
    assert result["worst_window_label"] == "T+1"
    assert result["worst_avg_fare"] == 8250.0


def test_find_optimal_window_computes_savings():
    result = find_optimal_window({1: 8250.0, 45: 3370.0})
    assert result["savings_amount"] == pytest.approx(4880.0)
    assert result["savings_pct"] == pytest.approx(59.15, rel=1e-3)


def test_find_optimal_window_curve_is_sorted_and_labeled():
    result = find_optimal_window({30: 3540.0, 1: 8250.0, 7: 4570.0})
    assert list(result["curve"].keys()) == ["T+1", "T+7", "T+30"]


def test_find_optimal_window_single_observation():
    result = find_optimal_window({7: 4200.0})
    assert result["optimal_window_days"] == 7
    assert result["worst_window_days"] == 7
    assert result["savings_amount"] == 0.0
    assert result["savings_pct"] == 0.0


def test_find_optimal_window_rejects_empty_input():
    with pytest.raises(ValueError):
        find_optimal_window({})


def test_find_optimal_window_unlisted_days_falls_back_to_generic_label():
    result = find_optimal_window({3: 5000.0, 60: 3000.0})
    assert result["optimal_window_label"] == "T+60"
    assert result["worst_window_label"] == "T+3"
