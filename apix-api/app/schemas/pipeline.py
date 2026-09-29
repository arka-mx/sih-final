from typing import List, Optional
from pydantic import BaseModel, Field


class CleanedFareItem(BaseModel):
    id: str
    pair: str
    origin: str
    destination: str
    carrier: str
    flight_no: str
    departure_date: str
    scrape_date: str
    advance_days: int
    fare_class: str
    base_fare: float
    taxes_udf: float
    convenience_fee: float
    total_fare: float
    seat_avail: bool
    seat_availability_flag: str
    source: str
    audit_hash: str
    data_mode: str
    is_live_data: bool
    simulation_disclaimer: str
    imputation_applied: bool
    imputed_fields: List[str]
    is_outlier: bool
    outlier_reason: Optional[str] = None
    is_duplicate: bool
    include_in_cpi_index: bool
    z_score: float


class PipelineAuditSummaryItem(BaseModel):
    total_raw_ingested: int
    valid_cleaned_records: int
    duplicates_merged: int
    outliers_flagged: int
    imputed_records_count: int
    sold_out_excluded: int
    cpi_eligible_records: int
    data_quality_score_percent: float = Field(..., examples=[92.5])


class PipelineCleanResponse(BaseModel):
    status: str = "success"
    timestamp: str
    audit_summary: PipelineAuditSummaryItem
    cleaned_records: List[CleanedFareItem]


class PipelineJobRunItem(BaseModel):
    id: str
    job_label: str
    windows: str
    started_at: str
    finished_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: str
    total_scraped: Optional[int] = None
    db_records_saved: Optional[int] = None
    error_message: Optional[str] = None


class PipelineJobStatsResponse(BaseModel):
    since_date: str
    total_jobs: int
    succeeded: int
    failed: int
    success_rate_percent: Optional[float] = None
    meets_95pct_target: Optional[bool] = None
