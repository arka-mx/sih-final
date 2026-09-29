from typing import List
from pydantic import BaseModel, Field


class AnomalyTagItem(BaseModel):
    cause: str = Field(..., examples=["FESTIVAL_CALENDAR_MATCH"])
    label: str = Field(..., examples=["Festival Travel Surge"])
    confidence: str = Field(..., examples=["high"])
    detail: str = Field(..., examples=["Janmashtami (2026-09-05) is 0 day(s) from this spike..."])


class TaggedSpikeItem(BaseModel):
    date: str = Field(..., examples=["2026-09-05"])
    index_value: float = Field(..., examples=[103.42])
    day_change_pct: float = Field(..., examples=[2.15])
    z_score: float = Field(..., examples=[1.92])
    tags: List[AnomalyTagItem]


class AnomalyResponse(BaseModel):
    status: str = "success"
    window_start: str = Field(..., examples=["2026-08-01"])
    window_end: str = Field(..., examples=["2026-09-14"])
    total_days: int = Field(..., examples=[45])
    z_threshold: float = Field(..., examples=[1.75])
    spikes: List[TaggedSpikeItem]
    festival_calendar_source: str
    fuel_price_source: str
    methodology_note: str = Field(
        default=(
            "Spikes are detected on the daily Fisher index's day-over-day % change using the same "
            "hybrid IQR + Z-score method as pipeline/outlier_detection.py, then cross-referenced against "
            "a static Indian festival calendar and a manually-updated ATF fuel price series "
            "(pipeline/anomaly_tagger.py). Cause tags are rule-based hypotheses, not confirmed causation."
        )
    )
