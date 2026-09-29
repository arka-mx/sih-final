"""
Weekly rolling-average rollup: index_daily -> index_weekly.

The PRD calls for a "weekly (rolling avg)" index frequency, distinct from the
daily raw index and the monthly CPI-aligned index. A rolling average is, by
definition, recomputed every time a new daily observation lands -- not once a
week -- so this module's DB-facing entrypoint (`persist_weekly_rollup`) is
called once per pipeline cycle (see pipeline/runner.py), same as the daily
index itself, and simply overwrites (upserts) the WeeklyIndex row whose
`week_ending` is today's date.

Split into a pure function (`compute_rolling_window_stats`, no DB dependency,
trivially unit-testable) and a DB-facing wrapper (`persist_weekly_rollup`),
mirroring the existing index_math/engine.py (pure) vs pipeline/runner.py
(DB-wrapping) split in this codebase.
"""

import datetime
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API_ROOT = PROJECT_ROOT / "apix-api"
for path in (PROJECT_ROOT, API_ROOT):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

ROLLUP_FIELDS: Sequence[str] = ("laspeyres", "fisher", "t1", "t7", "t15", "t30", "t45")


def compute_rolling_window_stats(daily_rows: List[Dict[str, float]]) -> Dict[str, float]:
    """
    Pure function: arithmetic mean of each rollup field across whatever daily
    rows are passed in. Each row is a plain dict with the keys in
    ROLLUP_FIELDS (a DailyIndex ORM row, once converted, or a hand-built dict
    in a test). Raises ValueError on an empty input -- there is no meaningful
    rolling average over zero observations.
    """
    if not daily_rows:
        raise ValueError("Cannot compute a rolling window average over zero daily rows.")

    stats: Dict[str, float] = {}
    for field in ROLLUP_FIELDS:
        values = [row[field] for row in daily_rows]
        stats[f"rolling_{field}" if field in ("laspeyres", "fisher") else field] = round(
            sum(values) / len(values), 2
        )
    return stats


async def persist_weekly_rollup(session: Any, as_of_date: str, window_days: int = 7):
    """
    Queries DailyIndex for the trailing `window_days` calendar days ending
    (inclusive) at `as_of_date`, computes the rolling averages, and merges the
    corresponding WeeklyIndex row (upsert, keyed by week_ending). Returns the
    persisted WeeklyIndex instance, or None if no daily rows exist in the
    window (e.g. the very first pipeline run).
    """
    from sqlalchemy import select
    from app.models import DailyIndex, WeeklyIndex

    end_date = datetime.date.fromisoformat(as_of_date)
    start_date = end_date - datetime.timedelta(days=window_days - 1)

    result = await session.execute(
        select(DailyIndex).where(
            DailyIndex.date >= start_date.isoformat(),
            DailyIndex.date <= end_date.isoformat(),
        )
    )
    rows = result.scalars().all()
    if not rows:
        return None

    daily_dicts = [
        {field: getattr(row, field) for field in ROLLUP_FIELDS} for row in rows
    ]
    stats = compute_rolling_window_stats(daily_dicts)

    # WeeklyIndex's primary key is an autoincrement `id`, not `week_ending`
    # (which is only unique+indexed), so a plain session.merge() would insert
    # a duplicate row and trip the unique constraint instead of upserting.
    # Look up any existing row for this week_ending and update it in place;
    # otherwise add a new one.
    existing_result = await session.execute(
        select(WeeklyIndex).where(WeeklyIndex.week_ending == as_of_date)
    )
    weekly_row = existing_result.scalars().first()
    if weekly_row is None:
        weekly_row = WeeklyIndex(week_ending=as_of_date)
        session.add(weekly_row)

    weekly_row.week_number = end_date.isocalendar()[1]
    weekly_row.rolling_laspeyres = stats["rolling_laspeyres"]
    weekly_row.rolling_fisher = stats["rolling_fisher"]
    weekly_row.t1 = stats["t1"]
    weekly_row.t7 = stats["t7"]
    weekly_row.t15 = stats["t15"]
    weekly_row.t30 = stats["t30"]
    weekly_row.t45 = stats["t45"]
    await session.flush()
    return weekly_row
