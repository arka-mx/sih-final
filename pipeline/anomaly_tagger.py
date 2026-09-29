"""
Rules-engine module that detects statistically significant spikes in the
daily APIx fare index and cross-references them against a static Indian
festival calendar and an ATF fuel price series to tag likely causes.

Spike detection reuses the same hybrid IQR + Z-score method as
pipeline/outlier_detection.py's detect_statistical_outliers, applied to the
day-over-day % change of the index series instead of individual fare quotes.
Tags produced here are rule-based hypotheses, not confirmed causation: a
spike that matches no rule is explicitly tagged UNEXPLAINED_STATISTICAL_VOLATILITY
rather than being silently attributed to a guessed cause.
"""

import csv
import json
import logging
import math
from dataclasses import asdict, dataclass, field
from datetime import date as date_cls
from pathlib import Path
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_FESTIVAL_CALENDAR_PATH = DATA_DIR / "festival_calendar_india.json"
DEFAULT_ATF_FUEL_PRICE_PATH = DATA_DIR / "atf_fuel_prices_in.csv"

Z_SCORE_THRESHOLD = 1.75
IQR_MULTIPLIER = 1.5
MIN_SAMPLES_FOR_STATS = 5
FUEL_LOOKBACK_DAYS = 10
FUEL_PCT_CHANGE_THRESHOLD = 1.0


@dataclass
class FestivalEvent:
    date: str
    name: str
    category: str = "festival"
    impact_window_days: int = 3
    confidence: str = "confirmed"


@dataclass
class FuelPricePoint:
    effective_date: str
    atf_price_per_kl_inr: float
    pct_change_mom: float


@dataclass
class IndexSpike:
    date: str
    index_value: float
    day_change_pct: float
    z_score: float
    is_spike: bool


@dataclass
class AnomalyTag:
    cause: str
    label: str
    confidence: str
    detail: str

    def to_dict(self):
        return asdict(self)


@dataclass
class TaggedSpike:
    date: str
    index_value: float
    day_change_pct: float
    z_score: float
    tags: List[AnomalyTag] = field(default_factory=list)

    def to_dict(self):
        return {
            "date": self.date,
            "index_value": self.index_value,
            "day_change_pct": self.day_change_pct,
            "z_score": self.z_score,
            "tags": [t.to_dict() for t in self.tags],
        }


@dataclass
class AnomalyReport:
    window_start: str
    window_end: str
    total_days: int
    z_threshold: float
    spikes: List[TaggedSpike]
    festival_calendar_source: str
    fuel_price_source: str

    def to_dict(self):
        return {
            "window_start": self.window_start,
            "window_end": self.window_end,
            "total_days": self.total_days,
            "z_threshold": self.z_threshold,
            "spikes": [s.to_dict() for s in self.spikes],
            "festival_calendar_source": self.festival_calendar_source,
            "fuel_price_source": self.fuel_price_source,
        }


def _percentile(data: List[float], p: float) -> float:
    if not data:
        return 0.0
    k = (len(data) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return data[int(k)]
    d0 = data[int(f)] * (c - k)
    d1 = data[int(c)] * (k - f)
    return d0 + d1


def load_festival_calendar(path: Optional[Path] = None) -> List[FestivalEvent]:
    target = Path(path) if path else DEFAULT_FESTIVAL_CALENDAR_PATH
    if not target.is_file():
        logger.warning(f"Festival calendar not found at {target}; skipping festival cross-referencing.")
        return []
    with target.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    return [
        FestivalEvent(
            date=entry["date"],
            name=entry["name"],
            category=entry.get("category", "festival"),
            impact_window_days=int(entry.get("impact_window_days", 3)),
            confidence=entry.get("confidence", "confirmed"),
        )
        for entry in payload.get("events", [])
    ]


def load_fuel_price_series(path: Optional[Path] = None) -> List[FuelPricePoint]:
    target = Path(path) if path else DEFAULT_ATF_FUEL_PRICE_PATH
    if not target.is_file():
        logger.warning(f"ATF fuel price series not found at {target}; skipping fuel cross-referencing.")
        return []
    points: List[FuelPricePoint] = []
    with target.open("r", encoding="utf-8-sig", newline="") as f:
        data_lines = (line for line in f if not line.lstrip().startswith("#"))
        reader = csv.DictReader(data_lines)
        for row in reader:
            points.append(
                FuelPricePoint(
                    effective_date=row["effective_date"].strip(),
                    atf_price_per_kl_inr=float(row["atf_price_per_kl_inr"]),
                    pct_change_mom=float(row["pct_change_mom"]),
                )
            )
    return sorted(points, key=lambda p: p.effective_date)


def detect_index_spikes(
    series: List[Tuple[str, float]],
    z_threshold: float = Z_SCORE_THRESHOLD,
    iqr_multiplier: float = IQR_MULTIPLIER,
) -> List[IndexSpike]:
    """
    Flags statistically anomalous day-over-day % changes in a daily index
    series using the same hybrid IQR + Z-score method as
    pipeline/outlier_detection.py's detect_statistical_outliers.
    """
    ordered = sorted(series, key=lambda p: p[0])
    if len(ordered) < 2:
        return []

    changes: List[Tuple[str, float, float]] = []
    for (_, prev_val), (curr_date, curr_val) in zip(ordered, ordered[1:]):
        pct_change = ((curr_val - prev_val) / prev_val) * 100.0 if prev_val else 0.0
        changes.append((curr_date, curr_val, pct_change))

    if len(changes) < MIN_SAMPLES_FOR_STATS:
        return [
            IndexSpike(date=d, index_value=v, day_change_pct=round(c, 3), z_score=0.0, is_spike=False)
            for d, v, c in changes
        ]

    pct_values = sorted(c for _, _, c in changes)
    n = len(pct_values)
    mean_val = sum(pct_values) / n
    variance = sum((x - mean_val) ** 2 for x in pct_values) / max(1, n - 1)
    std_val = math.sqrt(variance)

    q1 = _percentile(pct_values, 0.25)
    q3 = _percentile(pct_values, 0.75)
    iqr = q3 - q1
    lower_bound = q1 - iqr_multiplier * iqr
    upper_bound = q3 + iqr_multiplier * iqr

    spikes: List[IndexSpike] = []
    for d, v, c in changes:
        z = round((c - mean_val) / std_val, 2) if std_val > 0 else 0.0
        is_iqr_outlier = c < lower_bound or c > upper_bound
        is_z_outlier = abs(z) > z_threshold
        spikes.append(
            IndexSpike(
                date=d,
                index_value=v,
                day_change_pct=round(c, 3),
                z_score=z,
                is_spike=is_iqr_outlier or is_z_outlier,
            )
        )
    return spikes


def _days_between(date_a: str, date_b: str) -> int:
    da = date_cls.fromisoformat(date_a[:10])
    db = date_cls.fromisoformat(date_b[:10])
    return abs((da - db).days)


def _match_festivals(spike_date: str, festivals: List[FestivalEvent]) -> List[AnomalyTag]:
    tags: List[AnomalyTag] = []
    for festival in festivals:
        try:
            delta = _days_between(spike_date, festival.date)
        except ValueError:
            continue
        if delta > festival.impact_window_days:
            continue
        confidence = "high" if delta <= 1 else ("medium" if delta <= 2 else "low")
        label = "Festive / Long-Weekend Surge" if festival.category == "long_weekend" else "Festival Travel Surge"
        estimate_note = "" if festival.confidence == "confirmed" else " Festival date is an estimate pending official confirmation."
        tags.append(
            AnomalyTag(
                cause="FESTIVAL_CALENDAR_MATCH",
                label=label,
                confidence=confidence,
                detail=(
                    f"{festival.name} ({festival.date}) is {delta} day(s) from this spike, within its "
                    f"{festival.impact_window_days}-day demand-impact window.{estimate_note}"
                ),
            )
        )
    return tags


def _match_fuel_price(
    spike_date: str,
    fuel_points: List[FuelPricePoint],
    lookback_days: int = FUEL_LOOKBACK_DAYS,
    pct_threshold: float = FUEL_PCT_CHANGE_THRESHOLD,
) -> List[AnomalyTag]:
    candidates: List[Tuple[int, FuelPricePoint]] = []
    for point in fuel_points:
        if point.effective_date > spike_date:
            continue
        delta = _days_between(spike_date, point.effective_date)
        if delta <= lookback_days and abs(point.pct_change_mom) >= pct_threshold:
            candidates.append((delta, point))
    if not candidates:
        return []
    delta, point = min(candidates, key=lambda pair: pair[0])
    direction = "hike" if point.pct_change_mom > 0 else "cut"
    confidence = "high" if delta <= 3 else ("medium" if delta <= 6 else "low")
    return [
        AnomalyTag(
            cause="ATF_FUEL_PRICE_REVISION",
            label="Fuel Surcharge Pass-Through",
            confidence=confidence,
            detail=(
                f"ATF price revised {point.pct_change_mom:+.2f}% effective {point.effective_date} "
                f"({direction}), {delta} day(s) before this spike."
            ),
        )
    ]


def tag_spike(spike: IndexSpike, festivals: List[FestivalEvent], fuel_points: List[FuelPricePoint]) -> List[AnomalyTag]:
    tags = _match_festivals(spike.date, festivals) + _match_fuel_price(spike.date, fuel_points)
    if not tags:
        tags.append(
            AnomalyTag(
                cause="UNEXPLAINED_STATISTICAL_VOLATILITY",
                label="Unexplained Volatility",
                confidence="low",
                detail=(
                    f"Day-over-day change of {spike.day_change_pct:+.2f}% (z={spike.z_score}) is a statistical "
                    "outlier but matches no festival or ATF fuel-price rule in the current reference data."
                ),
            )
        )
    return tags


def run_anomaly_tagger(
    series: List[Tuple[str, float]],
    festival_path: Optional[Path] = None,
    fuel_path: Optional[Path] = None,
    z_threshold: float = Z_SCORE_THRESHOLD,
    iqr_multiplier: float = IQR_MULTIPLIER,
) -> AnomalyReport:
    ordered = sorted(series, key=lambda p: p[0])
    festivals = load_festival_calendar(festival_path)
    fuel_points = load_fuel_price_series(fuel_path)

    all_spikes = detect_index_spikes(ordered, z_threshold=z_threshold, iqr_multiplier=iqr_multiplier)
    tagged = [
        TaggedSpike(
            date=s.date,
            index_value=round(s.index_value, 2),
            day_change_pct=s.day_change_pct,
            z_score=s.z_score,
            tags=tag_spike(s, festivals, fuel_points),
        )
        for s in all_spikes
        if s.is_spike
    ]

    return AnomalyReport(
        window_start=ordered[0][0] if ordered else "",
        window_end=ordered[-1][0] if ordered else "",
        total_days=len(ordered),
        z_threshold=z_threshold,
        spikes=tagged,
        festival_calendar_source=str(festival_path or DEFAULT_FESTIVAL_CALENDAR_PATH),
        fuel_price_source=str(fuel_path or DEFAULT_ATF_FUEL_PRICE_PATH),
    )
