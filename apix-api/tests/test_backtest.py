def test_get_dgca_backtest_requires_loaded_official_dataset(client, rbi_headers):
    response = client.get("/api/backtest/dgca-comparison?days=30", headers=rbi_headers)
    assert response.status_code == 404
    data = response.json()
    assert data["type"] == "/errors/backtest-data-not-loaded"
    assert "dgca_loader.py" in data["detail"]
