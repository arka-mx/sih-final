def test_get_anomalies_no_api_key_required(client):
    response = client.get("/api/public/anomalies")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "window_start" in data
    assert "window_end" in data
    assert "total_days" in data
    assert "spikes" in data
    assert "festival_calendar_source" in data
    assert "fuel_price_source" in data
    for spike in data["spikes"]:
        assert "date" in spike
        assert "index_value" in spike
        assert "day_change_pct" in spike
        assert "z_score" in spike
        assert "tags" in spike
        for tag in spike["tags"]:
            assert tag["cause"] in (
                "FESTIVAL_CALENDAR_MATCH",
                "ATF_FUEL_PRICE_REVISION",
                "UNEXPLAINED_STATISTICAL_VOLATILITY",
            )


def test_get_anomalies_respects_days_window(client):
    response = client.get("/api/public/anomalies?days=5")
    assert response.status_code == 200
    data = response.json()
    assert data["total_days"] <= 5
