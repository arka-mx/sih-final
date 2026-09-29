"""Offline loader for official DGCA/MoSPI backtest datasets.

The source file is deliberately supplied by an operator. This module never
scrapes a portal and refuses to manufacture a fare benchmark when one is absent.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import sys
import tempfile
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable, Optional


class DatasetValidationError(ValueError):
    """Raised when a supplied official dataset cannot support a fare backtest."""


@dataclass(frozen=True)
class DGCAObservation:
    date: str
    dgca_avg_fare: float
    apix_index: Optional[float]


def _normalise_header(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def _find_column(row: dict[str, Any], aliases: Iterable[str]) -> Optional[str]:
    headers = {_normalise_header(header): header for header in row if header is not None}
    for alias in aliases:
        match = headers.get(_normalise_header(alias))
        if match:
            return match
    return None


def _parse_period(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().replace(day=1).isoformat()
    if isinstance(value, date):
        return value.replace(day=1).isoformat()
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y/%m", "%b-%Y", "%B %Y", "%b %Y"):
        try:
            return datetime.strptime(text, fmt).date().replace(day=1).isoformat()
        except ValueError:
            pass
    raise DatasetValidationError(f"Unsupported period value '{text}'. Use YYYY-MM or YYYY-MM-DD.")


def _parse_number(value: Any, field_name: str) -> float:
    text = str(value).strip().replace(",", "")
    for token in ("INR", "Rs.", "Rs", "₹"):
        text = text.replace(token, "")
    try:
        number = float(text.strip())
    except ValueError as exc:
        raise DatasetValidationError(f"Invalid {field_name} value '{value}'.") from exc
    if number <= 0:
        raise DatasetValidationError(f"{field_name} must be greater than zero.")
    return number


def parse_observations(rows: Iterable[dict[str, Any]]) -> list[DGCAObservation]:
    """Validate normalized or common official-report column names.

    Required: a period/date and a published average fare. `apix_index` is
    optional because it can be resolved from the APIx `index_daily` table.
    Traffic-only reports are rejected: passenger traffic is not a fare proxy.
    """
    observations: list[DGCAObservation] = []
    seen_dates: set[str] = set()
    for row_number, row in enumerate(rows, start=2):
        date_column = _find_column(row, ("date", "period", "month", "reference_period"))
        fare_column = _find_column(row, ("dgca_avg_fare", "average_fare", "avg_fare", "domestic_average_fare"))
        index_column = _find_column(row, ("apix_index", "fisher_index", "index_value"))
        if not date_column or not fare_column:
            raise DatasetValidationError(
                f"Row {row_number} needs a period/date and an official average-fare column. "
                "Traffic-only data cannot be used as a fare benchmark."
            )
        period = _parse_period(row[date_column])
        if period in seen_dates:
            raise DatasetValidationError(f"Duplicate period '{period}' in the source file.")
        seen_dates.add(period)
        observations.append(DGCAObservation(
            date=period,
            dgca_avg_fare=_parse_number(row[fare_column], "DGCA average fare"),
            apix_index=_parse_number(row[index_column], "APIx index") if index_column and row.get(index_column) not in (None, "") else None,
        ))
    if len(observations) < 2:
        raise DatasetValidationError("At least two observations are required for correlation.")
    return sorted(observations, key=lambda observation: observation.date)


_CONTENT_TYPE_EXTENSIONS = {
    "text/csv": ".csv",
    "application/csv": ".csv",
    "application/vnd.ms-excel": ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}


def fetch_source_file(url: str, dest_dir: Path) -> Path:
    """
    Downloads a real DGCA/MoSPI source file over HTTP so an operator doesn't
    need to manually download it first -- an alternative to passing a local
    path, not a replacement for `read_source_file`/`parse_observations`,
    which remain the single validation path for either origin. Never
    fabricates content: any network/HTTP failure raises immediately rather
    than falling back to a placeholder file.
    """
    import httpx

    dest_dir.mkdir(parents=True, exist_ok=True)
    try:
        response = httpx.get(url, follow_redirects=True, timeout=30.0)
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        raise DatasetValidationError(f"Could not download source file from '{url}': {exc}") from exc

    suffix = Path(url.split("?")[0]).suffix.lower()
    if suffix not in {".csv", ".xlsx", ".xlsm"}:
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        suffix = _CONTENT_TYPE_EXTENSIONS.get(content_type)
    if not suffix:
        raise DatasetValidationError(
            f"Could not determine a CSV/XLSX file type for '{url}' from its URL or "
            f"Content-Type header ('{response.headers.get('content-type')}')."
        )

    dest_path = dest_dir / f"dgca_source_{uuid.uuid4().hex[:8]}{suffix}"
    dest_path.write_bytes(response.content)
    return dest_path


def read_source_file(path: Path, sheet_name: Optional[str] = None) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        with path.open("r", encoding="utf-8-sig", newline="") as source_file:
            return list(csv.DictReader(source_file))
    if suffix not in {".xlsx", ".xlsm"}:
        raise DatasetValidationError("Source file must be CSV, XLSX, or XLSM.")
    try:
        from openpyxl import load_workbook
    except ImportError as exc:
        raise DatasetValidationError("XLSX support requires openpyxl; install apix-api/requirements.txt.") from exc
    workbook = load_workbook(path, read_only=True, data_only=True)
    worksheet = workbook[sheet_name] if sheet_name else workbook.active
    rows = worksheet.iter_rows(values_only=True)
    headers = next(rows, None)
    if not headers:
        raise DatasetValidationError("Source workbook has no header row.")
    return [dict(zip((str(header) for header in headers), row)) for row in rows if any(value is not None for value in row)]


async def _load_to_database(
    source_path: Path,
    observations: list[DGCAObservation],
    source_title: str,
    source_url: str,
    replace: bool,
) -> dict[str, Any]:
    project_root = Path(__file__).resolve().parent.parent
    api_root = project_root / "apix-api"
    for import_path in (project_root, api_root):
        if str(import_path) not in sys.path:
            sys.path.insert(0, str(import_path))

    from sqlalchemy import delete, func, select
    from app.db import AsyncSessionLocal, init_db
    from app.models import BacktestDataset, BacktestRecord, DailyIndex

    source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
    await init_db()
    async with AsyncSessionLocal() as session:
        existing_count = await session.scalar(select(func.count(BacktestRecord.id)))
        if existing_count and not replace:
            raise DatasetValidationError("Backtest records already exist. Re-run with --replace to replace the active dataset.")
        if replace:
            await session.execute(delete(BacktestRecord))
            await session.execute(delete(BacktestDataset))

        dataset_id = str(uuid.uuid4())
        dataset = BacktestDataset(
            id=dataset_id,
            source_title=source_title,
            source_url=source_url,
            source_file_name=source_path.name,
            source_sha256=source_sha256,
            coverage_start=observations[0].date,
            coverage_end=observations[-1].date,
        )
        session.add(dataset)

        for observation in observations:
            apix_index = observation.apix_index
            if apix_index is None:
                apix_index = await session.scalar(
                    select(func.avg(DailyIndex.fisher)).where(DailyIndex.date.like(f"{observation.date[:7]}%"))
                )
            if apix_index is None:
                raise DatasetValidationError(
                    f"No APIx index is available for {observation.date}. Add an apix_index column or load index_daily first."
                )
            session.add(BacktestRecord(
                date=observation.date,
                dataset_id=dataset_id,
                apix_index=float(apix_index),
                dgca_avg_fare=observation.dgca_avg_fare,
                variance_pct=None,
            ))
        await session.commit()

    return {
        "dataset_id": dataset_id,
        "source_title": source_title,
        "source_url": source_url,
        "source_sha256": source_sha256,
        "coverage_start": observations[0].date,
        "coverage_end": observations[-1].date,
        "records_loaded": len(observations),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Load an official DGCA/MoSPI CSV or XLSX backtest source.")
    parser.add_argument("source_file", type=Path, nargs="?", default=None, help="A local CSV/XLSX file. Omit if using --fetch-url.")
    parser.add_argument(
        "--fetch-url",
        default=None,
        help="Download the source file over HTTP from this URL instead of reading a local file "
        "(e.g. a direct MoSPI eSankhyiki export link, or a DGCA-sourced CSV mirror). "
        "Alternative to the positional source_file argument, not a replacement for it.",
    )
    parser.add_argument("--source-title", required=True)
    parser.add_argument(
        "--source-url",
        default=None,
        help="Citation URL recording where this dataset came from, for BacktestDataset provenance. "
        "Defaults to --fetch-url's value when that is used and this is omitted.",
    )
    parser.add_argument("--sheet", default=None, help="Workbook sheet name; defaults to the active sheet.")
    parser.add_argument("--replace", action="store_true", help="Replace the active backtest dataset.")
    args = parser.parse_args()

    if not args.source_file and not args.fetch_url:
        raise SystemExit("Provide either a local source_file path or --fetch-url.")
    if args.source_file and args.fetch_url:
        raise SystemExit("Provide only one of source_file or --fetch-url, not both.")

    source_url = args.source_url or args.fetch_url
    if not source_url:
        raise SystemExit("--source-url is required when loading from a local source_file.")

    downloaded_path: Optional[Path] = None
    try:
        if args.fetch_url:
            downloaded_path = fetch_source_file(args.fetch_url, Path(tempfile.gettempdir()) / "apix_dgca_downloads")
            source_path = downloaded_path
        else:
            source_path = args.source_file
            if not source_path.is_file():
                raise SystemExit(f"Source file not found: {source_path}")

        observations = parse_observations(read_source_file(source_path, args.sheet))
        result = asyncio.run(_load_to_database(
            source_path, observations, args.source_title, source_url, args.replace
        ))
    except DatasetValidationError as exc:
        raise SystemExit(f"DGCA import failed: {exc}") from exc
    finally:
        if downloaded_path is not None:
            downloaded_path.unlink(missing_ok=True)
    print(result)


if __name__ == "__main__":
    main()
