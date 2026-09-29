# Scraper source configs

Each YAML file here fully describes one fare source. Adding a new
airline/OTA source is: copy an existing file, edit the values, save it under
a new `<source_key>.yaml` name. No Python subclass, registry edit, or
redeploy-time code change is needed — `scrapers/registry.py` discovers every
file in this directory automatically and `scrapers/config_scraper.py` drives
the scrape generically from its contents.

## Schema

```yaml
source_key: simulated_example      # must match the filename (without .yaml)
provider_label: "Human-readable label shown in raw payloads"
base_url: "https://example.local"  # informational; the live-scraper base URL
channel_type: direct | ota          # direct-channel airline vs OTA aggregator

rate_limit:
  min_delay: 1.5                   # seconds, per BaseScraper.enforce_rate_limit
  max_delay: 3.5

selectors:                         # DOM/JSON selector placeholders for the
  fare_container: ".flight-card"   # day this source graduates from a fixture
  price: ".fare-price"             # to a live HTTP/browser scraper. Unused by
  flight_no: ".flight-number"      # the fixture engine, kept for schema parity.

fee_model:
  convenience_fee: 0.0             # flat fee applied unless a route entry sets its own "fee"

window_multiplier:                 # advance-purchase-window fare multiplier curve
  1: 1.85
  7: 1.25
  15: 1.0
  30: 0.9
  45: 0.88

dark_patterns:                     # optional; omit or leave {} for none
  scarcity_copy_every: 3           # every Nth listing gets urgency copy despite AVAILABLE
  high_demand_every: 5             # every Nth listing flips to FEW_SEATS_LEFT + copy
  fare_cookie_every: 4             # every Nth listing simulates repeat-view fare escalation

routes:
  DEL-BOM:                         # "<ORIGIN>-<DEST>" IATA route pair
    - flight_no: "6E-205"
      carrier: IndiGo
      dep: "06:00"
      arr: "08:15"
      base: 3450                   # base fare before advance-purchase multiplier
      tax: 850
      fee: 399                     # optional; overrides fee_model.convenience_fee
```

## What consumes this

`scrapers/config_scraper.py`'s `ConfigDrivenScraper` loads a config and
implements `BaseScraper.search()` generically: rate-limits, persists the raw
payload (audit requirement), applies the advance-purchase multiplier and fee
model, simulates any configured dark patterns, and returns `RawFareRecord`s.

`scrapers/registry.py` globs this directory for `*.yaml` files to build
`DEFAULT_SIMULATED_SOURCE_KEYS` and `get_simulated_scraper()`, so every
downstream consumer (pipeline runner, health checks, API routers) picks up a
new source the moment its config file lands here.
