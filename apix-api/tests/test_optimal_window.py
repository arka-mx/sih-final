def test_get_optimal_booking_window_for_seeded_route(client, nso_headers):
    response = client.get("/api/routes/DEL-BOM/optimal-window", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["pair"] == "DEL-BOM"
    # Seeded DEL-BOM fares: T+1=8250, T+7 avg of (4570,5120,3930)=4540,
    # T+15=3950, T+30=3540, T+45=3370 -- cheapest is T+45, priciest is T+1.
    assert data["optimal_window_days"] == 45
    assert data["optimal_window_label"] == "T+45"
    assert data["worst_window_days"] == 1
    assert data["worst_window_label"] == "T+1"
    assert data["savings_amount"] > 0
    assert data["savings_pct"] > 0
    assert "T+45" in data["curve"]


def test_get_optimal_booking_window_unknown_route_returns_404(client, nso_headers):
    response = client.get("/api/routes/XXX-YYY/optimal-window", headers=nso_headers)
    assert response.status_code == 404
    data = response.json()
    assert data["type"] == "https://errors.apix.mospi.gov.in/route-not-found"
