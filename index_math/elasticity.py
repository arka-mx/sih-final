from typing import Any, Dict

WINDOW_LABELS: Dict[int, str] = {1: "T+1", 7: "T+7", 15: "T+15", 30: "T+30", 45: "T+45"}


def find_optimal_window(window_avg_fares: Dict[int, float]) -> Dict[str, Any]:
    """
    Turns a route's lead-time elasticity curve (average fare per
    advance-purchase window) into an explicit "book on this window" answer,
    instead of leaving the reader to eyeball a chart.

    `window_avg_fares` maps advance-purchase days (1, 7, 15, 30, 45, ...) to
    the average fare observed at that window for one route. Returns the
    cheapest and most expensive windows, the rupee and percentage savings of
    booking at the cheapest window instead of the most expensive one, and the
    same curve re-expressed as {window_label: fare} for direct reuse by a
    dashboard.

    Raises ValueError on an empty input -- there is no "optimal window"
    without at least one observed window.
    """
    if not window_avg_fares:
        raise ValueError("Cannot determine an optimal booking window from zero observed windows.")

    optimal_days = min(window_avg_fares, key=lambda days: window_avg_fares[days])
    worst_days = max(window_avg_fares, key=lambda days: window_avg_fares[days])
    optimal_fare = window_avg_fares[optimal_days]
    worst_fare = window_avg_fares[worst_days]

    savings_amount = round(worst_fare - optimal_fare, 2)
    savings_pct = round((savings_amount / worst_fare) * 100.0, 2) if worst_fare else 0.0

    return {
        "optimal_window_days": optimal_days,
        "optimal_window_label": WINDOW_LABELS.get(optimal_days, f"T+{optimal_days}"),
        "optimal_avg_fare": round(optimal_fare, 2),
        "worst_window_days": worst_days,
        "worst_window_label": WINDOW_LABELS.get(worst_days, f"T+{worst_days}"),
        "worst_avg_fare": round(worst_fare, 2),
        "savings_amount": savings_amount,
        "savings_pct": savings_pct,
        "curve": {
            WINDOW_LABELS.get(days, f"T+{days}"): round(fare, 2)
            for days, fare in sorted(window_avg_fares.items())
        },
    }
