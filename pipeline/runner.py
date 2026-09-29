import os
import sys
import sqlite3
import datetime
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scrapers.indigo_direct import IndiGoDirectScraper
from scrapers.makemytrip import MakeMyTripScraper
from scrapers.models import RawFareRecord
from pipeline.cleaning import clean_fare_batch
from pipeline.decompose import decompose_matched_flights
from pipeline.outlier_detection import run_quality_pipeline
from pipeline.schema import CleanedFareRecord, PipelineAuditSummary

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("APIx.PipelineRunner")

DEFAULT_DB_PATH = PROJECT_ROOT / "apix-api" / "apix.db"
DEFAULT_ROUTES = [
    ("DEL", "BOM"),
    ("DEL", "BLR"),
    ("BOM", "BLR"),
    ("DEL", "CCU"),
    ("BLR", "HYD"),
    ("MAA", "DEL"),
    ("DEL", "PNQ"),
    ("BOM", "GOI"),
]
DEFAULT_WINDOWS = [1, 7, 15, 30, 45]


def get_sqlite_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Connect to the APIx SQLite database and ensure the fares table exists."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fares (
            id VARCHAR(50) PRIMARY KEY,
            pair VARCHAR(10) NOT NULL,
            origin VARCHAR(5) NOT NULL,
            destination VARCHAR(5) NOT NULL,
            carrier VARCHAR(50) NOT NULL,
            flight_no VARCHAR(20) NOT NULL,
            departure_date VARCHAR(15) NOT NULL,
            scrape_date VARCHAR(15) NOT NULL,
            advance_days INTEGER NOT NULL,
            fare_class VARCHAR(20) DEFAULT 'Economy',
            base_fare FLOAT NOT NULL,
            taxes_udf FLOAT NOT NULL,
            convenience_fee FLOAT DEFAULT 0.0,
            total_fare FLOAT NOT NULL,
            seat_avail BOOLEAN DEFAULT 1,
            source VARCHAR(50) DEFAULT 'Direct Engine',
            audit_hash VARCHAR(100) NOT NULL
        )
    """)
    conn.commit()
    return conn


def save_cleaned_fares_to_db(records: List[CleanedFareRecord], conn: sqlite3.Connection) -> int:
    """
    Inserts or updates cleaned CPI-eligible records into the SQLite database.
    """
    cursor = conn.cursor()
    saved_count = 0
    sql = """
        INSERT OR REPLACE INTO fares (
            id, pair, origin, destination, carrier, flight_no,
            departure_date, scrape_date, advance_days, fare_class,
            base_fare, taxes_udf, convenience_fee, total_fare,
            seat_avail, source, audit_hash
        ) VALUES (
            :id, :pair, :origin, :destination, :carrier, :flight_no,
            :departure_date, :scrape_date, :advance_days, :fare_class,
            :base_fare, :taxes_udf, :convenience_fee, :total_fare,
            :seat_avail, :source, :audit_hash
        )
    """

    for r in records:
        data = r.to_db_dict()
        cursor.execute(sql, data)
        saved_count += 1

    conn.commit()
    return saved_count


def execute_pipeline_cycle(
    routes: Optional[List[tuple]] = None,
    windows: Optional[List[int]] = None,
    db_path: Path = DEFAULT_DB_PATH,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    """
    Executes an end-to-end extraction, cleaning, fee decomposition, and quality filtering cycle.
    
    1. Scrapes IndiGo Direct and MakeMyTrip across routes and lead windows.
    2. Persists raw payloads to raw_store (for cryptographic auditability).
    3. Normalizes currencies, parses fields, and applies missing-value imputation.
    4. Computes cross-source fee decomposition (IndiGo vs MMT inferred markups).
    5. Detects IQR / Z-score outliers, merges duplicates, and tags sold-out flights.
    6. Persists clean, auditable records into SQLite/Postgres DB.
    """
    routes = routes or DEFAULT_ROUTES
    windows = windows or DEFAULT_WINDOWS
    today = datetime.date.today()
    scrape_date_str = today.isoformat()

    logger.info("=" * 70)
    logger.info("Starting APIx Data Ingestion & Quality Cleaning Pipeline Cycle")
    logger.info(f"Target Routes: {len(routes)} pairs | Windows: {windows} | Scrape Date: {scrape_date_str}")
    logger.info("=" * 70)

    indigo_scraper = IndiGoDirectScraper()
    mmt_scraper = MakeMyTripScraper()

    raw_indigo: List[RawFareRecord] = []
    raw_mmt: List[RawFareRecord] = []

    # Step 1: Automated extraction
    for origin, dest in routes:
        for adv_days in windows:
            dep_date = (today + datetime.timedelta(days=adv_days)).isoformat()
            try:
                ind_recs = indigo_scraper.search(origin, dest, dep_date, adv_days)
                raw_indigo.extend(ind_recs)
            except Exception as e:
                logger.error(f"Error scraping IndiGo for {origin}-{dest} (T+{adv_days}): {e}")

            try:
                mmt_recs = mmt_scraper.search(origin, dest, dep_date, adv_days)
                raw_mmt.extend(mmt_recs)
            except Exception as e:
                logger.error(f"Error scraping MakeMyTrip for {origin}-{dest} (T+{adv_days}): {e}")

    total_scraped = len(raw_indigo) + len(raw_mmt)
    logger.info(f"Extraction Completed: {len(raw_indigo)} IndiGo Direct + {len(raw_mmt)} MMT = {total_scraped} raw quotes")

    # Step 2: Cross-Source Fee Decomposition
    decomposition_results = decompose_matched_flights(raw_indigo, raw_mmt)
    logger.info(f"Decomposition Completed: {len(decomposition_results)} matched flights compared for inferred OTA markups")

    # Step 3: Cleaning & Normalization
    all_raw: List[RawFareRecord] = raw_indigo + raw_mmt
    cleaned_records = clean_fare_batch(all_raw, default_scrape_date=scrape_date_str)

    # Step 4: Outlier Detection, Deduplication & Quality Filtering
    filtered_records, summary = run_quality_pipeline(cleaned_records)

    # Step 5: Database Persistence
    db_saved = 0
    if save_to_db:
        conn = get_sqlite_connection(db_path)
        try:
            # We persist all valid cleaned records with their quality flags
            db_saved = save_cleaned_fares_to_db(filtered_records, conn)
            logger.info(f"Database Persistence: {db_saved} records saved to {db_path.name}")
        finally:
            conn.close()

    result = {
        "status": "success",
        "scrape_date": scrape_date_str,
        "total_scraped": total_raw_scraped := len(all_raw),
        "audit_summary": summary.to_dict(),
        "matched_decompositions": len(decomposition_results),
        "db_records_saved": db_saved,
    }

    logger.info("=" * 70)
    logger.info(f"Pipeline Completed: {summary.cpi_eligible_records} CPI-eligible quotes retained ({summary.data_quality_score_percent}% Quality Score)")
    logger.info("=" * 70)
    return result


if __name__ == "__main__":
    result = execute_pipeline_cycle()
    print("\n--- Pipeline Execution Summary ---")
    for k, v in result.items():
        print(f"{k}: {v}")
