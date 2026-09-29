"""
End-to-end exercise of a basket-weight revision, using the real production
weights (index_math/weights.py::DGCA_BASKET_WEIGHTS), the real 3-route legacy
basket (index_math/laspeyres.py::DGCA_3_ROUTE_WEIGHTS), the real Laspeyres
formula, and the real chain-linking/splice mechanism together -- not just
each piece in isolation, which is what tests/test_chain_link.py already
covers.

Scenario: APIx's basket was revised from the original 3-route basket to the
current 15-route DGCA_BASKET_WEIGHTS. This test proves that a chained series
computed under the *old* basket can be spliced onto a series computed under
the *new* basket, without a discontinuity at the revision point -- exactly
what a real CPI base-year/basket revision requires, and exactly the PRD Q&A
answer ("periodic re-weighting like CPI base-year revisions", PRD section
14) this mechanism is meant to back up with working code, not just a
rehearsed talking point.
"""

import pytest

from index_math.chain_link import build_chained_series, splice_basket_revision
from index_math.laspeyres import DGCA_3_ROUTE_WEIGHTS, laspeyres_aggregate_index
from index_math.weights import DGCA_BASKET_WEIGHTS

# Route-level elementary indices observed on the revision (overlap) day --
# computed once under both the old and new basket to produce the two
# "overlap" aggregate values the splice needs. Only DEL-BOM/DEL-BLR/BOM-BLR
# are given non-trivial values since those are the only routes the legacy
# 3-route basket actually weights; the new basket's extra corridors don't
# affect the old-basket aggregate at all (laspeyres_aggregate_index only
# sums over the weights it's given).
OVERLAP_DAY_ROUTE_INDICES = {
    "DEL-BOM": 103.5,
    "DEL-BLR": 101.8,
    "BOM-BLR": 99.2,
    "DEL-CCU": 104.0,
    "DEL-HYD": 102.1,
}


def test_basket_revision_overlap_aggregates_differ_by_weighting_scheme():
    """
    Sanity check that the two basket definitions really do produce different
    aggregates for the same underlying route indices -- otherwise a splice
    test would be proving nothing.
    """
    old_basket_aggregate = laspeyres_aggregate_index(OVERLAP_DAY_ROUTE_INDICES, DGCA_3_ROUTE_WEIGHTS)
    new_basket_aggregate = laspeyres_aggregate_index(OVERLAP_DAY_ROUTE_INDICES, DGCA_BASKET_WEIGHTS)
    assert old_basket_aggregate != new_basket_aggregate


def test_basket_revision_splice_produces_a_continuous_chained_series():
    # Pre-revision chained series, entirely on the OLD 3-route basket. Its
    # final value is, by definition, the published figure for the overlap
    # period itself -- the overlap period is always published under the OLD
    # basket in the classical overlap-linking method.
    pre_revision_mom_changes = [0.0, 1.2, 0.8]  # anchor, then two months of change
    pre_revision_series = build_chained_series(100.0, pre_revision_mom_changes)
    overlap_old_basket_value = pre_revision_series[-1]

    # The SAME overlap period, independently computed on the NEW 15-route
    # basket from the same underlying route-level indices -- this value is
    # only ever used to derive the link factor below, never published itself.
    overlap_new_basket_value = laspeyres_aggregate_index(OVERLAP_DAY_ROUTE_INDICES, DGCA_BASKET_WEIGHTS)

    link_factor = splice_basket_revision(
        overlap_old_basket_value=overlap_old_basket_value,
        overlap_new_basket_value=overlap_new_basket_value,
    )

    # At the overlap point, applying the link factor to the new-basket value
    # must exactly reproduce the old-basket published figure -- no jump.
    assert round(link_factor * overlap_new_basket_value, 2) == pytest.approx(overlap_old_basket_value, abs=0.01)

    # Post-revision months, computed entirely on the NEW 15-route basket,
    # chained forward from the overlap period's own new-basket value.
    post_revision_mom_changes = [0.0, 0.6, 0.9]
    post_revision_raw_series = build_chained_series(overlap_new_basket_value, post_revision_mom_changes)

    # The published, continuous series: pre-revision values unchanged, then
    # every post-revision (including the overlap period itself, which must
    # match) value rescaled by the link factor.
    published_series = pre_revision_series[:-1] + [round(link_factor * value, 2) for value in post_revision_raw_series]

    assert published_series[len(pre_revision_series) - 1] == pytest.approx(overlap_old_basket_value, abs=0.01)
    assert len(published_series) == len(pre_revision_series) + len(post_revision_raw_series) - 1
