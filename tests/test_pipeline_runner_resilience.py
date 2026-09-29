import pytest

from pipeline.runner import (
    _scrape_with_retry,
    _scrape_with_tracking,
    _raise_source_failure_alerts,
    SCRAPE_MAX_RETRIES,
)


class _FlakyScraper:
    """Fails a fixed number of times before succeeding, or always fails."""

    def __init__(self, source_name, fail_times=0, always_fail=False):
        self.source_name = source_name
        self.fail_times = fail_times
        self.always_fail = always_fail
        self.calls = 0

    def search(self, origin, destination, departure_date, advance_days):
        self.calls += 1
        if self.always_fail or self.calls <= self.fail_times:
            raise ConnectionError(f"simulated network failure #{self.calls}")
        return [{"origin": origin, "destination": destination}]


def test_scrape_with_retry_succeeds_after_transient_failures(monkeypatch):
    monkeypatch.setattr("pipeline.runner.time.sleep", lambda _seconds: None)
    scraper = _FlakyScraper("simulated_flaky", fail_times=2)
    result = _scrape_with_retry(scraper, "DEL", "BOM", "2026-10-01", 7)
    assert result == [{"origin": "DEL", "destination": "BOM"}]
    assert scraper.calls == 3


def test_scrape_with_retry_raises_after_exhausting_retries(monkeypatch):
    monkeypatch.setattr("pipeline.runner.time.sleep", lambda _seconds: None)
    scraper = _FlakyScraper("simulated_always_down", always_fail=True)
    with pytest.raises(ConnectionError):
        _scrape_with_retry(scraper, "DEL", "BOM", "2026-10-01", 7)
    assert scraper.calls == SCRAPE_MAX_RETRIES + 1


def test_scrape_with_tracking_records_failure_and_returns_empty(monkeypatch):
    monkeypatch.setattr("pipeline.runner.time.sleep", lambda _seconds: None)
    scraper = _FlakyScraper("simulated_always_down", always_fail=True)
    stats = {}
    from collections import defaultdict

    stats = defaultdict(lambda: {"calls": 0, "failures": 0})
    result = _scrape_with_tracking(scraper, "DEL", "BOM", "2026-10-01", 7, stats)
    assert result == []
    assert stats["simulated_always_down"]["calls"] == 1
    assert stats["simulated_always_down"]["failures"] == 1


def test_scrape_with_tracking_does_not_count_failure_on_success(monkeypatch):
    monkeypatch.setattr("pipeline.runner.time.sleep", lambda _seconds: None)
    scraper = _FlakyScraper("simulated_healthy", fail_times=0)
    from collections import defaultdict

    stats = defaultdict(lambda: {"calls": 0, "failures": 0})
    result = _scrape_with_tracking(scraper, "DEL", "BOM", "2026-10-01", 7, stats)
    assert result == [{"origin": "DEL", "destination": "BOM"}]
    assert stats["simulated_healthy"]["calls"] == 1
    assert stats["simulated_healthy"]["failures"] == 0


def test_raise_source_failure_alerts_flags_source_above_threshold(monkeypatch):
    sent = []
    monkeypatch.setattr("pipeline.runner._send_alert_webhook", lambda alert: sent.append(alert))

    stats = {
        "simulated_bad_source": {"calls": 10, "failures": 2},  # 20% > 5% threshold
        "simulated_good_source": {"calls": 10, "failures": 0},
    }
    alerts = _raise_source_failure_alerts(stats)

    assert len(alerts) == 1
    assert alerts[0]["source"] == "simulated_bad_source"
    assert alerts[0]["failure_rate_pct"] == 20.0
    assert len(sent) == 1
    assert sent[0]["source"] == "simulated_bad_source"


def test_raise_source_failure_alerts_silent_when_all_sources_healthy(monkeypatch):
    sent = []
    monkeypatch.setattr("pipeline.runner._send_alert_webhook", lambda alert: sent.append(alert))

    stats = {"simulated_good_source": {"calls": 40, "failures": 1}}  # 2.5% < 5% threshold
    alerts = _raise_source_failure_alerts(stats)

    assert alerts == []
    assert sent == []
