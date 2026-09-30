# Loading a real DGCA/MoSPI backtest dataset

`GET /api/backtest/dgca-comparison` now returns real results, loaded via
`ingestion/dgca_loader.py`. This document records exactly what was loaded,
from where, and why it isn't an item-level airfare series (MoSPI doesn't
publish one outside its client-rendered portal) - so nobody mistakes this
for more precision than it actually has.

## What's loaded today

**Benchmark side (`dgca_avg_fare` column in the DB - see caveat below):**
MoSPI's official monthly CPI (Base 2024=100) Group **07.3 "Passenger
transport services"** index, Combined (rural+urban) sector, for May–July
2026. This group includes air, rail and road passenger fares together -
it is the finest granularity MoSPI publishes in its stable, machine-fetchable
monthly press-release PDFs. An item-level "Air fare" series exists (CPI 2024
FAQ Q27/Q33 confirm airfares are separately priced online) but is only
exposed through `esankhyiki.mospi.gov.in`, which renders client-side and has
no stable direct-download URL - the same blocker this document originally
identified.

Pulled from the official press releases themselves (embargo-dated PDFs on
`mospi.gov.in`, Annexure-II "group wise indices" table, row `07.3`):

| Month | Group 07.3 (Combined) | Source PDF |
|---|---|---|
| May 2026 | 104.36 | `Press_Release_of_CPI_for_May_2026.pdf` |
| June 2026 | 105.01 | `Press_Release_of_CPI_for_June_2026.pdf` |
| July 2026 | 105.39 | `Press_Release_CPI_July_2026.pdf` (all at mospi.gov.in/uploads/...) |

**APIx side (`apix_index` column):** the *real*, already-computed
`MonthlyIndex.index_value` (chained Laspeyres) seeded in `apix-api/app/db.py`
for the same three months (111.8 / 112.5 / 113.1) - not the loader's
auto-generated placeholder. Supplying `apix_index` explicitly in the source
CSV (see below) is what avoids that fallback; without it, the loader
synthesizes a near-copy of the benchmark (±0.6% jitter) purely so the
endpoint has *something* to return, which would trivially inflate the
correlation and must never be mistaken for a real result.

Loaded via:

```bash
python -m ingestion.dgca_loader ingestion/data/mospi_cpi_passenger_transport_index.csv \
  --source-title "MoSPI CPI (Base 2024=100) Group 07.3 Passenger transport services vs real APIx MonthlyIndex (chained Laspeyres), May-Jul 2026" \
  --source-url "https://www.mospi.gov.in/uploads/latestReleases/latest_release_1786529680747_3113661d-1a2b-4b9a-af06-b340193ef9a0_Press_Release_CPI_July_2026.pdf" \
  --replace
```

Result: `pearson_r = 0.994`, `MAPE = 0.06%`, `RMSE = 0.11` index points, on
n=3 monthly observations. The frontend ([components/BacktestView.tsx](../components/BacktestView.tsx))
labels this correctly as MoSPI CPI 07.3 in index points, not rupees - the
`dgca_avg_fare` / `dgcaAvgFare` field name is a historical misnomer left
over from the API/DB schema (`apix-api/app/models`), not a claim about units.

## Honest limitations of this result

- **n=3.** Statistically this is far too small a sample to draw a real
  conclusion from the correlation coefficient alone - a 3-point series will
  almost always correlate well if both series are trending the same
  direction. Treat the "PASSED" badge in the UI as "the plumbing works and
  the two real series happen to agree," not as a validated model.
- **Group-level, not airfare-specific.** 07.3 blends air/rail/road fares.
  Real movements specific to airfares (e.g. a fuel-surcharge spike) could be
  diluted or masked at this level.
- **Only 3 of the 6 fetched months are used.** Jan–Apr 2026 CPI press
  releases were fetched too (07.3 Combined: Jan 103.50, Feb 103.57, Mar
  103.67, Apr 103.86) but were **not** loaded, because `MonthlyIndex` has no
  real computed APIx value for those months in the seed data - only
  May/Jun/Jul/Aug are seeded. Loading Jan–Apr would have forced the loader's
  synthetic-`apix_index` fallback, which is exactly the fabrication this
  document exists to avoid. August 2026's CPI release (07.3 combined) had
  not been fetched as of this writing even though `MonthlyIndex` has a real
  August value (113.7) - an operator can extend the CSV with it once
  fetched, using the same `--replace` command.

## How to extend this dataset for real

1. Fetch the next month's CPI press release PDF from `mospi.gov.in` (URL
   pattern under `/uploads/latestReleases/` or `/uploads/PressRelease/`,
   found via a web search for `mospi.gov.in "Press Release of CPI" <month
   year> filetype:pdf` - MoSPI does not keep a stable index page of these).
2. Read Annexure-II, row `07.3 Passenger transport services`, Combined
   column.
3. Only add a row if `apix-api/app/db.py`'s `MonthlyIndex` seed (or, once
   real fare scraping accumulates enough days, the real `DailyIndex`/
   `WeeklyIndex` tables) has a matching real computed value for that month -
   supply it explicitly as `apix_index` in the CSV. Never leave `apix_index`
   blank for a "real" dataset; that column is what makes the difference
   between a genuine backtest and a self-referential one.
4. Re-run the loader command above with `--replace`.

## Still-real, still-unresolved research from the original version of this doc

1. **DGCA's own statistics portal** (`dgca.gov.in` → Data and Reports →
   Aviation Statistics → Domestic Air Transport → Monthly Data) renders its
   navigation client-side; the exact current export URL should still be
   confirmed by hand in a browser.
2. **`Vonter/india-aviation-traffic` (GitHub)** was checked directly in this
   session (`aggregated/`, `dgca/`, `mca/` - traffic, footfalls, on-time
   performance, grievances) and confirmed to carry **no fare column
   whatsoever**, only traffic/operational data. It cannot be used as a fare
   benchmark; `parse_observations` would correctly reject it.
