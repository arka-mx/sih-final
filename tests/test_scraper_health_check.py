import copy

from scrapers import config_scraper
from scrapers.base import FailureClassification
from scrapers.health_check import (
    check_source_health,
    run_all_health_checks,
)
from scrapers.registry import DEFAULT_SIMULATED_SOURCE_KEYS


def test_all_registered_sources_pass_health_check():
    report = run_all_health_checks()
    assert set(report.keys()) == set(DEFAULT_SIMULATED_SOURCE_KEYS)
    for source_key, status in report.items():
        assert status.status == "ok", f"{source_key} failed selector health check: {status.detail}"
        assert status.records_found > 0


def _patch_config(monkeypatch, source_key, mutate):
    """Loads the real config, applies `mutate` to a deep copy, and serves that
    copy for `source_key` while leaving every other source's config untouched."""
    original_load_config = config_scraper.load_config
    broken_config = copy.deepcopy(original_load_config(source_key))
    mutate(broken_config)

    def patched_load_config(key):
        if key == source_key:
            return broken_config
        return original_load_config(key)

    monkeypatch.setattr(config_scraper, "load_config", patched_load_config)


def test_check_source_health_flags_missing_field_as_selector_miss(monkeypatch):
    # Simulate a schema change upstream: the config drops the "tax" key that
    # the scraper's own parsing depends on.
    _patch_config(
        monkeypatch,
        "simulated_air_india",
        lambda cfg: cfg["routes"]["DEL-BOM"][0].pop("tax"),
    )

    status = check_source_health("simulated_air_india")

    assert status.status == FailureClassification.SELECTOR_MISS
    assert status.detail is not None


def test_check_source_health_flags_blank_required_field(monkeypatch):
    _patch_config(
        monkeypatch,
        "simulated_air_india",
        lambda cfg: cfg["routes"]["DEL-BOM"][0].__setitem__("carrier", ""),
    )

    status = check_source_health("simulated_air_india")

    assert status.status == FailureClassification.SELECTOR_MISS
    assert "missing_field:carrier" in status.missing_or_invalid_fields


def test_unknown_source_is_reported_as_selector_miss_not_raised():
    # A misconfigured/renamed source key should surface as a health-check
    # finding, not an unhandled exception that crashes the scrape job.
    status = check_source_health("not_a_real_source")

    assert status.status == FailureClassification.SELECTOR_MISS
    assert "not_a_real_source" in (status.detail or "")
