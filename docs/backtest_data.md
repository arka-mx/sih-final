# Loading a real DGCA/MoSPI backtest dataset

`GET /api/backtest/dgca-comparison` returns `404
/errors/backtest-data-not-loaded` until an operator loads a real official
dataset through `ingestion/dgca_loader.py`. This is deliberate: the loader
refuses traffic-only reports and refuses to fabricate a fare benchmark, so
there is never a hand-crafted "backtest" masquerading as a published-data
validation result (see `docs/methodology.md` §4 for the full validation
contract).

This document exists because building this loader surfaced two real,
specific sources — found via web research, not invented — that an operator
with real network access can point it at.

## Real sources identified

1. **DGCA's own statistics portal.** `dgca.gov.in`'s "Data and Reports" →
   "Aviation Statistics" → "Domestic Air Transport" → "Monthly Data" section
   publishes the Civil Aviation Statistics Handbook and monthly/annual
   traffic and fare reports. As of this writing, DGCA's site renders that
   navigation client-side, so the exact current export URL should be
   confirmed by hand in a browser rather than assumed to be stable —
   this doc will be updated once a direct, stable link is confirmed.
2. **`Vonter/india-aviation-traffic` (GitHub).** An open-source, pre-cleaned
   CSV mirror of DGCA-published Indian aviation traffic data, updated
   periodically from the same official source. Useful as a convenient
   starting point, but confirm it includes an *average fare* column (not
   just traffic/passenger counts) before using it as a backtest source —
   `parse_observations` will reject a traffic-only file regardless.

Neither of these could be fetched and verified end-to-end from the sandboxed
session this loader was built in (no outbound network access there at all).
Both are documented here as real, identified starting points for an operator
to load for real, not as data already validated by this codebase.

## What was deliberately NOT done

A single, vague, non-tabular figure ("average airfare rose 20.5% on 72
domestic routes, June 2026 vs March 2025" — routes undisclosed) was the only
concretely citable DGCA average-fare figure found during this research. It is
not a usable backtest series: no per-route rupee amounts, no monthly time
series, no way to correlate it against a daily/monthly APIx index. Inventing
a plausible-looking fare series to fill this gap would defeat the entire
purpose of `dgca_loader.py`'s validation and would be exactly the kind of
"unconvincing claim that doesn't hold up under questioning" the PRD itself
warns against (§10). This gap's real deliverable is the tooling
(`ingestion/dgca_loader.py`, including the `--fetch-url` download path); an
operator with real network access loading an actual official file remains a
manual step.

## How to load a dataset once you have one

```bash
# From a local file you already downloaded:
python -m ingestion.dgca_loader path/to/dgca_domestic_fares.xlsx \
  --source-title "DGCA Domestic Air Transport Monthly Statistics" \
  --source-url "https://www.dgca.gov.in/" \
  --replace

# Or download it directly:
python -m ingestion.dgca_loader --fetch-url "https://<real-export-link>" \
  --source-title "DGCA Domestic Air Transport Monthly Statistics" \
  --replace
```

Required columns (header aliases accepted): a period/date column and an
official average-fare column. See `docs/methodology.md` §4 for the full
column table and provenance record format.
