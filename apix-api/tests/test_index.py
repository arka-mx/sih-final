def test_get_daily_index_all(client, nso_headers):
    response = client.get("/api/index/daily", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["base_period"] == "2025-01-01=100"
    assert data["total_records"] > 0
    first = data["data"][0]
    assert "date" in first
    assert "laspeyres" in first
    assert "fisher" in first
    assert "ci_lower" in first
    assert "ci_upper" in first
    assert "windows" in first
    assert "T+1" in first["windows"]
    assert "T+7" in first["windows"]
    assert "sectors" in first


def test_get_daily_index_filter_date(client, nso_headers):
    response = client.get("/api/index/daily?date=2026-09-14", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_records"] == 1
    assert data["data"][0]["date"] == "2026-09-14"
    # Computed live from the seeded 2026-09-14 Fare rows via
    # index_math/engine.py (Jevons -> Laspeyres/Paasche/Fisher), not a
    # hand-typed placeholder like the earlier historical backfill rows.
    assert data["data"][0]["fisher"] == 104.82


def test_get_daily_index_filter_window(client, nso_headers):
    response = client.get("/api/index/daily?window=T+7", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    first = data["data"][0]
    assert "T+7" in first["windows"]
    assert "T+1" not in first["windows"]


def test_get_weekly_index(client, rbi_headers):
    response = client.get("/api/index/weekly", headers=rbi_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_weeks"] > 0
    first = data["data"][0]
    assert "week_ending" in first
    assert "rolling_laspeyres_7d" in first
    assert "rolling_fisher_7d" in first
    assert "windows" in first


def test_get_monthly_index(client, nso_headers):
    # Default formula is chained_laspeyres, which now compounds the real
    # month-over-month link relatives (index_math/chain_link.py) from the
    # seeded 2026-05 anchor (111.8) forward, rather than returning the flat
    # seeded index_value verbatim: 111.8 * 1.006 * 1.005 * 1.008 = 113.9375.
    response = client.get("/api/index/monthly?year=2026&month=8", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["year"] == 2026
    assert data["month"] == 8
    assert data["index"] == 113.94
    assert data["mom_change_pct"] == 0.8
    assert data["yoy_change_pct"] == 4.2
    assert "DEL-BOM" in data["sector_weights"]
    assert data["contribution_to_cpi_transport"] == 0.15


def test_get_monthly_index_fisher_ideal_returns_seeded_point_value(client, nso_headers):
    # fisher_ideal is a point-in-time formula, not chained -- it should still
    # return the seeded record's own index_value unchanged.
    response = client.get("/api/index/monthly?year=2026&month=8&formula=fisher_ideal", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["index"] == 113.7


def test_monthly_seeded_returns_record(client, nso_headers):
    response = client.get("/api/index/monthly?year=2026&month=8", headers=nso_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["year"] == 2026
    assert data["month"] == 8
    assert data["index"] == 113.94
    assert data["computed_dynamically"] is False


def test_monthly_unseeded_returns_404(client, nso_headers):
    response = client.get("/api/index/monthly?year=2024&month=1", headers=nso_headers)
    assert response.status_code == 404
    data = response.json()
    assert data["type"] == "/errors/month-not-found"
    assert data["status"] == 404
    assert "No daily index records exist" in data["detail"]
