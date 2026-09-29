import asyncio
import datetime
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pytest
from app.db import AsyncSessionLocal
from app.models import DailyIndex, WeeklyIndex
from sqlalchemy import select, delete

from pipeline.rollup import persist_weekly_rollup

# These tests exercise the real DB-facing upsert path and therefore need a
# reachable DATABASE_URL (the same one apix-api/tests/conftest.py's
# initialize_database fixture already requires for the rest of the suite --
# see apix-api/docker-compose.yml / .env for the Postgres instance that provides it).


def _run(coro):
    return asyncio.run(coro)


def test_persist_weekly_rollup_averages_trailing_seven_days():
    as_of = "2031-01-08"  # far-future date namespace, avoids colliding with seed data
    dates = [(datetime.date.fromisoformat(as_of) - datetime.timedelta(days=offset)).isoformat() for offset in range(7)]

    async def scenario():
        async with AsyncSessionLocal() as session:
            await session.execute(delete(WeeklyIndex).where(WeeklyIndex.week_ending == as_of))
            await session.execute(delete(DailyIndex).where(DailyIndex.date.in_(dates)))
            for i, date_str in enumerate(dates):
                session.add(
                    DailyIndex(
                        date=date_str,
                        laspeyres=100.0 + i,
                        fisher=99.0 + i,
                        ci_lower=98.0 + i,
                        ci_upper=101.0 + i,
                        t1=120.0 + i,
                        t7=115.0 + i,
                        t15=110.0 + i,
                        t30=108.0 + i,
                        t45=107.0 + i,
                    )
                )
            await session.commit()

            weekly_row = await persist_weekly_rollup(session, as_of)
            await session.commit()

            assert weekly_row is not None
            # Mean of 100..106 is 103
            assert weekly_row.rolling_laspeyres == pytest.approx(103.0)
            assert weekly_row.rolling_fisher == pytest.approx(102.0)

            # Re-running for the same as_of_date should update the existing
            # row, not insert a duplicate (upsert-by-week_ending semantics).
            await persist_weekly_rollup(session, as_of)
            await session.commit()
            result = await session.execute(select(WeeklyIndex).where(WeeklyIndex.week_ending == as_of))
            matching_rows = result.scalars().all()
            assert len(matching_rows) == 1

            await session.execute(delete(WeeklyIndex).where(WeeklyIndex.week_ending == as_of))
            await session.execute(delete(DailyIndex).where(DailyIndex.date.in_(dates)))
            await session.commit()

    _run(scenario())


def test_persist_weekly_rollup_returns_none_without_daily_data():
    as_of = "2031-02-14"

    async def scenario():
        async with AsyncSessionLocal() as session:
            await session.execute(delete(DailyIndex).where(DailyIndex.date == as_of))
            await session.commit()
            return await persist_weekly_rollup(session, as_of)

    assert _run(scenario()) is None
