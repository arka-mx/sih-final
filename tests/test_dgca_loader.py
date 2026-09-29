import httpx
import pytest

from ingestion.dgca_loader import DatasetValidationError, fetch_source_file, parse_observations


def test_parse_official_fare_rows_with_optional_apix_index():
    observations = parse_observations([
        {"Period": "2026-01", "Average Fare": "4,250", "APIx Index": "101.2"},
        {"Period": "2026-02", "Average Fare": "₹4,310", "APIx Index": "102.4"},
    ])

    assert [(item.date, item.dgca_avg_fare, item.apix_index) for item in observations] == [
        ("2026-01-01", 4250.0, 101.2),
        ("2026-02-01", 4310.0, 102.4),
    ]


def test_parse_rejects_traffic_only_rows():
    with pytest.raises(DatasetValidationError, match="Traffic-only"):
        parse_observations([
            {"Period": "2026-01", "Domestic Passengers": "15000000"},
            {"Period": "2026-02", "Domestic Passengers": "15200000"},
        ])


class _FakeDownloadResponse:
    def __init__(self, content: bytes, content_type: str):
        self.content = content
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        pass


def test_fetch_source_file_downloads_via_url_extension(monkeypatch, tmp_path):
    csv_bytes = b"Period,Average Fare\n2026-01,4250\n2026-02,4310\n"

    def _fake_get(url, follow_redirects=True, timeout=None):
        assert url == "https://example.gov.in/dgca_fares.csv"
        return _FakeDownloadResponse(csv_bytes, "text/csv")

    monkeypatch.setattr(httpx, "get", _fake_get)

    downloaded = fetch_source_file("https://example.gov.in/dgca_fares.csv", tmp_path)
    assert downloaded.suffix == ".csv"
    assert downloaded.read_bytes() == csv_bytes

    # The downloaded file flows through the exact same validation path as a
    # local file -- no duplicated parsing logic for the network case.
    from ingestion.dgca_loader import read_source_file
    observations = parse_observations(read_source_file(downloaded))
    assert len(observations) == 2


def test_fetch_source_file_falls_back_to_content_type_without_url_extension(monkeypatch, tmp_path):
    csv_bytes = b"Period,Average Fare\n2026-01,4250\n"

    def _fake_get(url, follow_redirects=True, timeout=None):
        return _FakeDownloadResponse(csv_bytes, "text/csv; charset=utf-8")

    monkeypatch.setattr(httpx, "get", _fake_get)

    downloaded = fetch_source_file("https://example.gov.in/download?id=42", tmp_path)
    assert downloaded.suffix == ".csv"


def test_fetch_source_file_raises_on_network_failure(monkeypatch, tmp_path):
    def _raise(*args, **kwargs):
        raise httpx.ConnectError("simulated network failure")

    monkeypatch.setattr(httpx, "get", _raise)

    with pytest.raises(DatasetValidationError):
        fetch_source_file("https://example.gov.in/dgca_fares.csv", tmp_path)
