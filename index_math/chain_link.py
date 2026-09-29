from typing import List


def link_relative(current_value: float, previous_value: float) -> float:
    """
    Period-over-period link relative, expressed on the same 100=parity scale as
    a month-over-month percent change: 100 * current / previous.
    """
    if previous_value == 0:
        raise ValueError("Cannot compute a link relative against a zero previous value.")
    return round(100.0 * current_value / previous_value, 4)


def build_chained_series(anchor_value: float, mom_pct_changes: List[float]) -> List[float]:
    """
    Chain-links a series of period-over-period percent changes into one
    continuous index-level series, anchored to `anchor_value` for the first
    period:

        C_0 = anchor_value
        C_t = C_{t-1} * (1 + mom_pct_changes[t] / 100)

    This is the standard technique statistical agencies use to splice a run of
    short-run (month-over-month) comparisons -- which is all `MonthlyIndex.mom_change_pct`
    ever stores -- into one continuous long-run series, including across a
    base-year revision where the basket weights themselves change. It is what
    "chained_laspeyres" actually means, as opposed to a single period's average
    fare level in isolation.

    `mom_pct_changes[0]` is conventionally 0.0 (the anchor period has no prior
    period to compare against); the function does not assume this and simply
    compounds whatever series it is given.
    """
    series = [round(anchor_value, 4)]
    for pct_change in mom_pct_changes[1:]:
        series.append(round(series[-1] * (1.0 + pct_change / 100.0), 4))
    return series


def splice_basket_revision(
    overlap_old_basket_value: float,
    overlap_new_basket_value: float,
) -> float:
    """
    Classic "overlap linking" for a basket-weight revision: in the period the
    basket changes, the index is computed once on the OLD weights
    (`overlap_old_basket_value` -- this is also the last published value of
    the pre-revision chained series, since the overlap period is itself
    published under the old basket) and once on the NEW weights
    (`overlap_new_basket_value`), both against the same underlying fares.

    The returned link factor rescales every NEW-basket value from the
    overlap period onward so the published series stays continuous even
    though the weighting scheme changed:

        published(t) = link_factor * new_basket_raw_value(t)   for t >= overlap period

    At the overlap period itself this reproduces `overlap_old_basket_value`
    exactly, by construction: `link_factor * overlap_new_basket_value == overlap_old_basket_value`.
    """
    if overlap_new_basket_value == 0:
        raise ValueError("Cannot splice a basket revision against a zero new-basket overlap value.")
    return round(overlap_old_basket_value / overlap_new_basket_value, 6)
