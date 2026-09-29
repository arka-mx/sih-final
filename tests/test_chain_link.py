import pytest

from index_math.chain_link import build_chained_series, link_relative, splice_basket_revision


def test_link_relative_basic():
    assert link_relative(110.0, 100.0) == 110.0
    assert link_relative(95.0, 100.0) == 95.0


def test_link_relative_rejects_zero_previous():
    with pytest.raises(ValueError):
        link_relative(100.0, 0.0)


def test_build_chained_series_single_period_returns_anchor():
    series = build_chained_series(111.8, [0.0])
    assert series == [111.8]


def test_build_chained_series_compounds_forward():
    # Anchor 100, then +2%, then +1.5%, then -0.5%
    series = build_chained_series(100.0, [0.0, 2.0, 1.5, -0.5])
    assert series[0] == 100.0
    assert series[1] == pytest.approx(102.0)
    assert series[2] == pytest.approx(102.0 * 1.015, rel=1e-4)
    assert series[3] == pytest.approx(102.0 * 1.015 * 0.995, rel=1e-4)


def test_build_chained_series_matches_seeded_monthly_trail():
    # Mirrors the seeded apix-api/app/db.py MonthlyIndex rows: 111.8 (anchor),
    # then successive mom_change_pct of 0.6, 0.5, 0.8.
    series = build_chained_series(111.8, [0.0, 0.6, 0.5, 0.8])
    assert series[-1] == pytest.approx(111.8 * 1.006 * 1.005 * 1.008, rel=1e-4)


def test_build_chained_series_order_sensitivity():
    forward = build_chained_series(100.0, [0.0, 5.0, -5.0])
    reversed_order = build_chained_series(100.0, [0.0, -5.0, 5.0])
    # Compounding is not commutative in general, but a +5%/-5% pair nets
    # slightly below the anchor either way -- confirm both orders land there
    # and are distinguishable from a naive additive (0% net) expectation.
    assert forward[-1] < 100.0
    assert reversed_order[-1] < 100.0
    assert forward[-1] == pytest.approx(reversed_order[-1], rel=1e-9)


def test_splice_basket_revision_returns_link_factor():
    factor = splice_basket_revision(overlap_old_basket_value=120.0, overlap_new_basket_value=100.0)
    assert factor == pytest.approx(1.2)

    # Applying the factor to the new-basket overlap value must exactly
    # reproduce the old-basket (pre-revision) value at the splice point --
    # that continuity is the entire point of overlap linking.
    assert round(factor * 100.0, 6) == 120.0


def test_splice_basket_revision_rejects_zero_new_value():
    with pytest.raises(ValueError):
        splice_basket_revision(100.0, 0.0)
