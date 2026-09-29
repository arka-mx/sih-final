# APIx Ethics and Compliance Specification
**Ministry of Statistics and Programme Implementation (MoSPI) - DIID**

## 1. Current Data Mode: Simulated Fixtures + One Real Archived Source
APIx's default daily pipeline cycle still runs entirely in **simulated data
mode**: it does not fetch live airline or OTA pages, call private APIs, use
Playwright/Selenium/Scrapy against a live booking engine, submit booking
forms, or make booking offers. Every fare in the default cycle is generated
from deterministic, versioned-in-code fixture tables for demonstration and
pipeline testing.

Each `RawFareRecord` carries `data_mode="simulated"`, `is_live_data=false`,
and a simulation disclaimer. The source-comparison API returns the same
markers. Source platform IDs are prefixed with `simulated_` so they cannot be
mistaken for live collection.

**One source is a real, non-simulated exception:**
`scrapers/wayback_fare_scraper.py` fetches real archived HTML of real OTA/
airline pages from the Internet Archive's public Wayback Machine
(`web.archive.org`) — a credential-free, ToS-permitting, public-interest
archive, not a live anti-bot-protected booking engine. Records from this
source carry `data_mode="archived"` (still `is_live_data=false`, since the
page was captured in the past, not fetched live today) and a disclaimer
naming the exact archive URL and real capture date a MoSPI auditor could open
by hand. This is the PRD's own named technique for getting real historical
fare data without either 30 days of live scraping or a paid fare-API key
(PRD §10). It is a standalone/CLI tool for historical backfill and is **not**
wired into the default automatic pipeline cycle, which only produces `today`-
dated observations.

There is therefore exactly one third-party system accessed by the current
implementation (`web.archive.org`, via its own public CDX API, with a real
`robots.txt` check performed before any fetch — see
`scrapers/wayback_fare_scraper.py::check_robots_allowed`), no CAPTCHA
workflow anywhere, and no PII collected by any source.

## 2. Future Live-Collection Boundary
`BaseScraper.enforce_rate_limit()` remains the common control point for any
future network-backed provider targeting a live commercial site (an
airline/OTA booking engine, or a paid fare API like Amadeus's Self-Service
API). Before such a provider is introduced, it must implement domain-specific
robots.txt and terms review, a conservative per-domain delay, single-session
concurrency, raw-response auditing, and a clear opt-out path. No such
live-commercial-site provider is present today; the Wayback Machine source
above is real but targets a public archive, not a commercial booking engine.

## 3. Simulated Source Coverage

Every source is defined by one config file under `scrapers/configs/` and driven
by the generic `ConfigDrivenScraper` engine (`scrapers/config_scraper.py`) --
adding a source is a config-file addition, not a new Python class. See
`scrapers/configs/README.md` for the schema.

| Config | Source ID | Scenario represented |
|---|---|---|
| `scrapers/configs/simulated_indigo.yaml` | `simulated_indigo` | Direct-channel IndiGo fixture |
| `scrapers/configs/simulated_makemytrip.yaml` | `simulated_makemytrip` | Multi-carrier OTA fixture |
| `scrapers/configs/simulated_air_india.yaml` | `simulated_air_india` | Direct-channel Air India fixture |
| `scrapers/configs/simulated_cleartrip.yaml` | `simulated_cleartrip` | OTA fixture |
| `scrapers/configs/simulated_ixigo.yaml` | `simulated_ixigo` | OTA fixture |

Brand names identify the scenario the fixture models; they do not assert an affiliation, a live integration, or real-time pricing.

## 4. Deliberate Tradeoffs
1. **Five simulated sources, one real archived source, zero live-commercial-site sources**: Multiple fixture shapes exercise direct-channel, OTA, multi-carrier, and fee-decomposition paths without implying operational live-scraping coverage; the Wayback Machine source adds genuinely real historical data without touching a commercial site directly.
2. **No fabricated collection history**: Scheduled runs generate new simulated observations. They are not presented as a 30-day history of live market collection. The Wayback source's `scrape_date` is always the snapshot's own real capture date, never "today."
3. **Live-commercial-site data requires separate approval**: A production transition to scraping a real airline/OTA booking engine directly needs legal, robots.txt, terms, reliability, and data-governance review for each provider — this is a materially different risk profile from either the simulated fixtures or the public-archive source, and is not attempted here.
4. **The Wayback source's live network calls are unverified in this codebase's development environment** (no outbound network access there): the code is written directly against the CDX API's documented, stable JSON contract and unit-tested against realistic fixtures, but needs one post-deployment smoke test — see `scrapers/wayback_fare_scraper.py`'s module docstring.
