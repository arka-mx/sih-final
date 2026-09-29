def test_get_dark_patterns_no_api_key_required(client):
    response = client.get("/api/public/dark-patterns?route=DEL-BOM&advance_days=7")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["route_pair"] == "DEL-BOM"
    assert data["total_listings_scanned"] > 0
    assert isinstance(data["flags"], list)
    for flag in data["flags"]:
        assert flag["pattern_type"] in (
            "SCARCITY_COPY_MISMATCH",
            "SCARCITY_MESSAGING",
            "REPEAT_VIEW_PRICE_ESCALATION",
        )
        assert flag["severity"] in ("HIGH", "MEDIUM", "LOW")


def test_get_dark_patterns_deterministic_across_calls(client):
    first = client.get("/api/public/dark-patterns?route=DEL-BOM&advance_days=7").json()
    second = client.get("/api/public/dark-patterns?route=DEL-BOM&advance_days=7").json()
    assert first["total_flagged"] == second["total_flagged"]
    assert [f["flight_no"] for f in first["flags"]] == [f["flight_no"] for f in second["flags"]]
