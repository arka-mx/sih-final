import hashlib
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Date,
    DateTime,
    Text,
    func,
    ForeignKey,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pair = Column(String(10), unique=True, nullable=False, index=True)
    origin = Column(String(5), nullable=False)
    origin_name = Column(String(100), nullable=False)
    destination = Column(String(5), nullable=False)
    destination_name = Column(String(100), nullable=False)
    dgca_weight = Column(Float, nullable=False)
    monthly_volume = Column(String(20), nullable=False)
    tier = Column(String(50), default="Metro-to-Metro")


class Fare(Base):
    __tablename__ = "fares"

    id = Column(String(50), primary_key=True)
    observed_at = Column(DateTime(timezone=True), primary_key=True, nullable=False, server_default=func.now(), index=True)
    pair = Column(String(10), nullable=False, index=True)
    origin = Column(String(5), nullable=False)
    destination = Column(String(5), nullable=False)
    carrier = Column(String(50), nullable=False, index=True)
    flight_no = Column(String(20), nullable=False)
    departure_date = Column(String(15), nullable=False)
    scrape_date = Column(String(15), nullable=False, index=True)
    advance_days = Column(Integer, nullable=False, index=True)
    fare_class = Column(String(20), default="Economy")
    base_fare = Column(Float, nullable=False)
    taxes_udf = Column(Float, nullable=False)
    convenience_fee = Column(Float, default=0.0)
    total_fare = Column(Float, nullable=False)
    seat_avail = Column(Boolean, default=True)
    source = Column(String(50), default="Direct Engine")
    audit_hash = Column(String(100), nullable=False)


class DailyIndex(Base):
    __tablename__ = "index_daily"

    id = Column(Integer)
    date = Column(String(15), primary_key=True, nullable=False, index=True)
    observed_at = Column(DateTime(timezone=True), primary_key=True, nullable=False, server_default=func.now(), index=True)
    laspeyres = Column(Float, nullable=False)
    fisher = Column(Float, nullable=False)
    ci_lower = Column(Float, nullable=False)
    ci_upper = Column(Float, nullable=False)
    t1 = Column(Float, nullable=False)
    t7 = Column(Float, nullable=False)
    t15 = Column(Float, nullable=False)
    t30 = Column(Float, nullable=False)
    t45 = Column(Float, nullable=False)


class WeeklyIndex(Base):
    __tablename__ = "index_weekly"

    id = Column(Integer, primary_key=True, autoincrement=True)
    week_ending = Column(String(15), unique=True, nullable=False, index=True)
    week_number = Column(Integer, nullable=False)
    rolling_laspeyres = Column(Float, nullable=False)
    rolling_fisher = Column(Float, nullable=False)
    t1 = Column(Float, nullable=False)
    t7 = Column(Float, nullable=False)
    t15 = Column(Float, nullable=False)
    t30 = Column(Float, nullable=False)
    t45 = Column(Float, nullable=False)


class MonthlyIndex(Base):
    __tablename__ = "index_monthly"

    id = Column(Integer, primary_key=True, autoincrement=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    formula = Column(String(50), default="chained_laspeyres")
    index_value = Column(Float, nullable=False)
    mom_change_pct = Column(Float, nullable=False)
    yoy_change_pct = Column(Float, nullable=False)
    cpi_transport_contrib = Column(Float, nullable=False)


class BacktestRecord(Base):
    __tablename__ = "backtest_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(15), unique=True, nullable=False, index=True)
    dataset_id = Column(String(36), ForeignKey("backtest_datasets.id"), nullable=False, index=True)
    apix_index = Column(Float, nullable=False)
    dgca_avg_fare = Column(Float, nullable=False)
    variance_pct = Column(Float, nullable=True)


class BacktestDataset(Base):
    __tablename__ = "backtest_datasets"

    id = Column(String(36), primary_key=True)
    source_title = Column(String(255), nullable=False)
    source_url = Column(Text, nullable=False)
    source_file_name = Column(String(255), nullable=False)
    source_sha256 = Column(String(64), nullable=False, unique=True)
    coverage_start = Column(String(15), nullable=False)
    coverage_end = Column(String(15), nullable=False)
    imported_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class PipelineJobRun(Base):
    __tablename__ = "pipeline_job_runs"

    id = Column(String(40), primary_key=True)
    job_label = Column(String(50), nullable=False, index=True)
    windows = Column(String(50), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    status = Column(String(10), nullable=False, index=True)
    total_scraped = Column(Integer, nullable=True)
    db_records_saved = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)


def generate_audit_hash(record_dict: dict) -> str:
    raw = f"{record_dict.get('id')}|{record_dict.get('carrier')}|{record_dict.get('flight_no')}|{record_dict.get('departure_date')}|{record_dict.get('total_fare')}"
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()
