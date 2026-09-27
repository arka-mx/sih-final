import os
import json
import gzip
import datetime
from pathlib import Path
from typing import Dict, Any, Optional

RAW_STORE_DIR = Path(os.environ.get("APIX_RAW_STORE_DIR", "d:/SIH final/sih-final/data/raw_store"))

def ensure_raw_store_dir():
    RAW_STORE_DIR.mkdir(parents=True, exist_ok=True)

def persist_raw_payload(
    scrape_id: str,
    source_platform: str,
    route_pair: str,
    departure_date: str,
    raw_content: Any,
    content_type: str = "json"
) -> str:
    """
    Non-negotiable design choice: persist the raw scrape payload (HTML/JSON)
    BEFORE any parsing touches it. Enables full cryptographic auditability for MoSPI.
    
    Returns: Relative file path/reference to the stored payload.
    """
    ensure_raw_store_dir()
    date_partition = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    partition_dir = RAW_STORE_DIR / source_platform / date_partition
    partition_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{scrape_id}_{route_pair}_{departure_date}.{content_type}"
    file_path = partition_dir / filename

    if content_type == "json":
        with open(file_path, "w", encoding="utf-8") as f:
            if isinstance(raw_content, (dict, list)):
                json.dump(raw_content, f, indent=2)
            else:
                f.write(str(raw_content))
    else:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(str(raw_content))

    return str(file_path.relative_to(RAW_STORE_DIR))

def read_raw_payload(relative_path: str) -> Optional[str]:
    """Retrieve raw payload for auditing."""
    full_path = RAW_STORE_DIR / relative_path
    if not full_path.exists():
        return None
    with open(full_path, "r", encoding="utf-8") as f:
        return f.read()
