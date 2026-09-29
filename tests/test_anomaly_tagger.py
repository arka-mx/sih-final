import pytest

from pipeline.anomaly_tagger import (
    FestivalEvent,
    FuelPricePoint,
    detect_index_spikes,
    load_festival_calendar,
    load_fuel_price_series,
    run_anomaly_tagger,
    tag_spike,
)


def test_detect_index_spikes_flags_outlier_day_over_day_change():
    series = [
        ("2026-09-01", 100.0),
        ("2026-09-02", 100.2),
        ("2026-09-03", 100.1),
        ("2026-09-04", 100.4),
        ("2026-09-05", 100.3),
        ("2026-09-06", 100.5),
        ("2026-09-07", 118.0),  # sharp one-day spike
        ("2026-09-08", 100.6),
    ]
    spikes = detect_index_spikes(series)
    flagged = [s for s in spikes if s.is_spike]
    assert any(s.date == "2026-09-07" for s in flagged)


def test_detect_index_spikes_too_few_samples_flags_nothing():
    series = [("2026-09-01", 100.0), ("2026-09-02", 150.0), ("2026-09-03", 90.0)]
    spikes = detect_index_spikes(series)
    assert all(not s.is_spike for s in spikes)


def test_detect_index_spikes_requires_at_least_two_points():
    assert detect_index_spikes([]) == []
    assert detect_index_spikes([("2026-09-01", 100.0)]) == []


def test_tag_spike_matches_nearby_festival():
    spikes = detect_index_spikes([
        ("2026-09-01", 100.0),
        ("2026-09-02", 100.1),
        ("2026-09-03", 100.2),
        ("2026-09-04", 100.1),
        ("2026-09-05", 100.3),
        ("2026-09-06", 118.0),
    ])
    spike = next(s for s in spikes if s.is_spike)
    festivals = [FestivalEvent(date="2026-09-05", name="Janmashtami", category="festival", impact_window_days=3)]
    tags = tag_spike(spike, festivals, [])
    assert any(t.cause == "FESTIVAL_CALENDAR_MATCH" for t in tags)


def test_tag_spike_matches_recent_fuel_price_revision():
    spikes = detect_index_spikes([
        ("2026-09-01", 100.0),
        ("2026-09-02", 100.1),
        ("2026-09-03", 100.2),
        ("2026-09-04", 100.1),
        ("2026-09-05", 100.3),
        ("2026-09-06", 118.0),
    ])
    spike = next(s for s in spikes if s.is_spike)
    fuel_points = [FuelPricePoint(effective_date="2026-09-01", atf_price_per_kl_inr=97000.0, pct_change_mom=2.5)]
    tags = tag_spike(spike, [], fuel_points)
    assert any(t.cause == "ATF_FUEL_PRICE_REVISION" for t in tags)


def test_tag_spike_falls_back_to_unexplained_when_no_rule_matches():
    spikes = detect_index_spikes([
        ("2026-09-01", 100.0),
        ("2026-09-02", 100.1),
        ("2026-09-03", 100.2),
        ("2026-09-04", 100.1),
        ("2026-09-05", 100.3),
        ("2026-09-06", 118.0),
    ])
    spike = next(s for s in spikes if s.is_spike)
    tags = tag_spike(spike, [], [])
    assert len(tags) == 1
    assert tags[0].cause == "UNEXPLAINED_STATISTICAL_VOLATILITY"


def test_run_anomaly_tagger_end_to_end_uses_bundled_reference_data():
    series = [
        ("2026-09-01", 100.0),
        ("2026-09-02", 100.1),
        ("2026-09-03", 100.2),
        ("2026-09-04", 100.1),
        ("2026-09-05", 118.0),  # near Janmashtami (bundled calendar)
        ("2026-09-06", 100.4),
    ]
    report = run_anomaly_tagger(series)
    assert report.window_start == "2026-09-01"
    assert report.window_end == "2026-09-06"
    assert report.total_days == 6
    spike = next(s for s in report.spikes if s.date == "2026-09-05")
    assert any(t.cause == "FESTIVAL_CALENDAR_MATCH" for t in spike.tags)


def test_load_festival_calendar_returns_bundled_events():
    events = load_festival_calendar()
    assert any(e.name == "Independence Day" for e in events)


def test_load_fuel_price_series_parses_bundled_csv():
    points = load_fuel_price_series()
    assert len(points) > 0
    assert all(p.atf_price_per_kl_inr > 0 for p in points)


def test_load_missing_files_return_empty_without_raising(tmp_path):
    assert load_festival_calendar(tmp_path / "missing.json") == []
    assert load_fuel_price_series(tmp_path / "missing.csv") == []
