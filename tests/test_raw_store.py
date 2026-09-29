import json

import ingestion.raw_store as raw_store


def _use_tmp_store(monkeypatch, tmp_path):
    monkeypatch.setattr(raw_store, "RAW_STORE_DIR", tmp_path / "raw_store")


def test_persist_and_read_json_payload_round_trip(monkeypatch, tmp_path):
    _use_tmp_store(monkeypatch, tmp_path)

    payload = {"carrier": "IndiGo", "flight_no": "6E-205", "total_fare": 4300.0}
    relative_path = raw_store.persist_raw_payload(
        scrape_id="S1",
        source_platform="simulated_indigo",
        route_pair="DEL-BOM",
        departure_date="2026-10-15",
        raw_content=payload,
        content_type="json",
    )

    stored = raw_store.read_raw_payload(relative_path)
    assert stored is not None
    assert json.loads(stored) == payload


def test_persist_partitions_by_source_and_date(monkeypatch, tmp_path):
    _use_tmp_store(monkeypatch, tmp_path)

    relative_path = raw_store.persist_raw_payload(
        scrape_id="S2",
        source_platform="simulated_makemytrip",
        route_pair="DEL-BLR",
        departure_date="2026-11-01",
        raw_content={"foo": "bar"},
        content_type="json",
    )

    parts = relative_path.replace("\\", "/").split("/")
    assert parts[0] == "simulated_makemytrip"
    assert parts[2] == "S2_DEL-BLR_2026-11-01.json"
    assert (raw_store.RAW_STORE_DIR / relative_path).exists()


def test_persist_non_json_content_type_writes_raw_text(monkeypatch, tmp_path):
    _use_tmp_store(monkeypatch, tmp_path)

    html_content = "<html><body>fixture</body></html>"
    relative_path = raw_store.persist_raw_payload(
        scrape_id="S3",
        source_platform="simulated_cleartrip",
        route_pair="BOM-DEL",
        departure_date="2026-10-20",
        raw_content=html_content,
        content_type="html",
    )

    stored = raw_store.read_raw_payload(relative_path)
    assert stored == html_content


def test_read_raw_payload_returns_none_for_missing_file(monkeypatch, tmp_path):
    _use_tmp_store(monkeypatch, tmp_path)
    assert raw_store.read_raw_payload("does/not/exist.json") is None
