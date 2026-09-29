"""Converts a raw MoSPI CPI sub-index export (year/month/index columns, one
row per reference period) into the period/average_fare CSV shape that
ingestion/dgca_loader.py requires.

MoSPI's own exports for a CPI item (e.g. Airfare, item code 07.3.3.1.2.01)
split the reference period across separate `year` and `month` columns and
call the published figure `index`, rather than a single `period`/`average_fare`
pair -- this script does that column mapping mechanically (no manual
retyping of any values) so the loader reads MoSPI's real, unedited numbers.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


def convert(source_path: Path, dest_path: Path, item_code: str | None = None) -> int:
    with source_path.open("r", encoding="utf-8-sig", newline="") as source_file:
        rows = list(csv.DictReader(source_file))

    if item_code:
        rows = [row for row in rows if row.get("code") == item_code]

    written = 0
    with dest_path.open("w", encoding="utf-8", newline="") as dest_file:
        writer = csv.writer(dest_file)
        writer.writerow(["period", "average_fare", "inflation_yoy_pct", "source_item_code"])
        for row in rows:
            month = row["month"].strip()
            year = row["year"].strip()
            index_value = row["index"].strip()
            inflation = row.get("inflation", "").strip()
            code = row.get("code", "").strip()
            if not month or not year or not index_value:
                continue
            writer.writerow([f"{month} {year}", index_value, inflation, code])
            written += 1
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_csv", type=Path)
    parser.add_argument("dest_csv", type=Path)
    parser.add_argument(
        "--item-code",
        default="07.3.3.1.2.01",
        help="Only convert rows matching this CPI item code (default: domestic Airfare). "
        "Pass an empty string to convert every row regardless of item.",
    )
    args = parser.parse_args()

    if not args.source_csv.is_file():
        raise SystemExit(f"Source file not found: {args.source_csv}")

    count = convert(args.source_csv, args.dest_csv, args.item_code or None)
    print(f"Wrote {count} rows to {args.dest_csv}")


if __name__ == "__main__":
    main()
