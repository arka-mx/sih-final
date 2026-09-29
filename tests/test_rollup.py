import pytest

from pipeline.rollup import compute_rolling_window_stats


def _row(laspeyres, fisher, t1, t7, t15, t30, t45):
    return {"laspeyres": laspeyres, "fisher": fisher, "t1": t1, "t7": t7, "t15": t15, "t30": t30, "t45": t45}


def test_compute_rolling_window_stats_averages_each_field():
    rows = [
        _row(100.0, 99.0, 120.0, 115.0, 110.0, 108.0, 107.0),
        _row(102.0, 101.0, 122.0, 117.0, 112.0, 110.0, 109.0),
    ]
    stats = compute_rolling_window_stats(rows)
    assert stats["rolling_laspeyres"] == pytest.approx(101.0)
    assert stats["rolling_fisher"] == pytest.approx(100.0)
    assert stats["t1"] == pytest.approx(121.0)
    assert stats["t7"] == pytest.approx(116.0)
    assert stats["t15"] == pytest.approx(111.0)
    assert stats["t30"] == pytest.approx(109.0)
    assert stats["t45"] == pytest.approx(108.0)


def test_compute_rolling_window_stats_single_row_returns_itself():
    rows = [_row(105.5, 104.2, 125.0, 118.0, 113.0, 109.5, 108.2)]
    stats = compute_rolling_window_stats(rows)
    assert stats["rolling_laspeyres"] == 105.5
    assert stats["rolling_fisher"] == 104.2


def test_compute_rolling_window_stats_rejects_empty_input():
    with pytest.raises(ValueError):
        compute_rolling_window_stats([])
