# APIx Price Index Methodology Specification
**MoSPI - Data Informatics & Innovation Division (DIID)**

---

## 1. Mathematical Formulation

### A. Elementary Level Aggregation: Jevons Index Formula
For an individual route corridor $r$ across multiple flight quotes $i \in \{1 \dots n\}$, the elementary price index comparing current prices $P_1$ to base period prices $P_0$ is computed as the **geometric mean of price relatives**:

$$I_{J, r} = \left( \prod_{i=1}^n \frac{P_{1, i}}{P_{0, i}} \right)^{\frac{1}{n}} \times 100$$

Equivalent logarithmic formulation used in `index_math/jevons.py`:

$$\ln(I_{J, r}) = \frac{1}{n} \sum_{i=1}^n \ln\left(\frac{P_{1, i}}{P_{0, i}}\right)$$

#### Worked Numerical Example:
Assume corridor DEL-BOM has 3 observed flights with base period fares $P_0 = [3000, 4000, 5000]$ and current period fares $P_1 = [3300, 4200, 5250]$:
1. Relative ratios:
   - Flight 1: $\frac{3300}{3000} = 1.10$
   - Flight 2: $\frac{4200}{4000} = 1.05$
   - Flight 3: $\frac{5250}{5000} = 1.05$
2. Product: $1.10 \times 1.05 \times 1.05 = 1.21275$
3. Geometric mean: $(1.21275)^{1/3} \approx 1.066429$
4. **Jevons Index = 106.64**

---

### B. Higher-Level Corridor Aggregation: Laspeyres Index Formula
The overall national airfare price index aggregates elementary route indices using **DGCA passenger traffic consumption weights**:

$$I_L = \sum_{r} W_r \cdot I_{J, r}$$

The production basket (`index_math/weights.py`) covers 15 DGCA corridors
representing 63.1% of total DGCA domestic passenger traffic - the 10
highest-volume metro and metro-leisure pairs (DEL-BOM, DEL-BLR, BOM-BLR,
DEL-CCU, DEL-HYD, BLR-HYD, MAA-DEL, CCU-BLR, DEL-PNQ, BOM-GOI) plus 5
metro-to-tier2 pairs into Patna, Ranchi and Guwahati (DEL-PAT, DEL-GAU,
DEL-IXR, BOM-PAT, CCU-GAU). Weights are normalized traffic shares so that
$\sum W_r = 1.0000$ across the basket.

The 3-route basket below is a simplified worked example (retained in
`index_math/laspeyres.py` as `DGCA_3_ROUTE_WEIGHTS` for the original
hand-calculated unit tests) illustrating the same formula on a smaller set
of weights normalized from official DGCA traffic statistics:
- **DEL-BOM**: $W_1 = 0.4091$ (40.91%)
- **DEL-BLR**: $W_2 = 0.3182$ (31.82%)
- **BOM-BLR**: $W_3 = 0.2727$ (27.27%)
- $\sum W_r = 1.0000$

#### Worked Numerical Example:
Assume the elementary indices for the 3 corridors on a given day are:
- $I_{\text{DEL-BOM}} = 102.50$
- $I_{\text{DEL-BLR}} = 101.00$
- $I_{\text{BOM-BLR}} = 99.50$

Laspeyres computation:
$$I_L = (0.4091 \times 102.50) + (0.3182 \times 101.00) + (0.2727 \times 99.50)$$
$$I_L = 41.9328 + 32.1382 + 27.1336 = \mathbf{101.20}$$

---

### C. Higher-Level Corridor Aggregation: Fisher Ideal Index Formula
Laspeyres systematically overstates inflation because it freezes base-period
consumption patterns and never lets travelers substitute toward corridors
that got relatively cheaper. **Fisher's Ideal Index** - the formula
recommended by the ILO/IMF/Eurostat CPI Manual for headline published price
indices - corrects for this by taking the **geometric mean of the Laspeyres
and Paasche aggregates**:

$$I_F = \sqrt{I_L \times I_P}$$

**Paasche Index.** True Paasche weighting requires *current-period*
expenditure shares, which are not observable in real time (DGCA traffic
statistics are published on a quarterly lag). Consistent with standard
practice at statistical agencies facing the same constraint, `index_math/fisher.py`
approximates Paasche using the same published DGCA traffic-share weights
$W_r$ as Laspeyres, but combines the route indices with a **weighted
harmonic mean** instead of a weighted arithmetic mean:

$$I_P = \frac{\sum_{r} W_r}{\sum_{r} \dfrac{W_r}{I_{J,r}}}$$

This is what makes Paasche a genuinely distinct aggregate from Laspeyres
rather than a relabeled copy of it: for any non-uniform set of route
indices, the weighted harmonic mean is always $\le$ the weighted arithmetic
mean computed from the same weights ($I_P \le I_L$), which is precisely the
inequality Fisher's geometric mean is designed to average out.

#### Worked Numerical Example
Using the same elementary indices as the Laspeyres example above:
- $I_{\text{DEL-BOM}} = 102.50$, $I_{\text{DEL-BLR}} = 101.00$, $I_{\text{BOM-BLR}} = 99.50$

Paasche computation:
$$\sum_r \frac{W_r}{I_{J,r}} = \frac{0.4091}{102.50} + \frac{0.3182}{101.00} + \frac{0.2727}{99.50} = 0.0098824$$
$$I_P = \frac{1.0000}{0.0098824} = \mathbf{101.19}$$

Fisher computation (using $I_L = 101.20$ from the Laspeyres example):
$$I_F = \sqrt{101.20 \times 101.19} = \mathbf{101.20}$$

#### Laspeyres vs. Paasche vs. Fisher - Comparison
| Formula | Weighting | Direction of Bias | Used For |
|---|---|---|---|
| Laspeyres ($I_L$) | Base-period weights, arithmetic mean | Overstates inflation (ignores substitution) | Fast, always-computable headline number |
| Paasche ($I_P$) | Base-period weights, harmonic mean (Paasche-equivalent) | Understates inflation | Lower bound / substitution-adjusted check |
| Fisher ($I_F$) | Geometric mean of $I_L$ and $I_P$ | Satisfies time-reversal & factor-reversal tests | Statistically preferred published index |

Both `apix-api/app/db.py` (the live-Fare seed path) and `pipeline/runner.py`
(the daily scrape → clean → index job) call the same
`index_math.engine.compute_daily_aggregate_indices()` function, so the
`DailyIndex.laspeyres` and `DailyIndex.fisher` columns served by
`/api/index/daily` are always derived from the identical route-level Jevons
indices - never independently hardcoded.

---

## 3. Inferred Convenience-Fee Decomposition
For matched flight records $(c, f, d, w)$ where $c$ is carrier, $f$ is flight number, $d$ is departure date, and $w$ is advance purchase days:

$$\text{Inferred Markup} = P_{\text{MMT, Total}} - P_{\text{Direct, Total}}$$

This isolates non-airline consumer surcharges from pure air transport price changes.

---

## 4. DGCA/MoSPI Backtest Source and Provenance

Backtest observations are not seeded by APIx. They are loaded only from an operator-supplied official CSV/XLSX through `ingestion/dgca_loader.py`. The intended source families are the DGCA aviation statistics and domestic air-traffic publications ([DGCA statistics sitemap](https://www.dgca.gov.in/digigov-portal/jsp/dgca/footerLink/sitemap.jsp)) and MoSPI's [eSankhyiki macro-indicators portal](https://esankhyiki.mospi.gov.in/macroindicators-main).

No official source file is bundled with this repository, so **no DGCA backtest date range is currently claimed**. The backtest API returns `404 /errors/backtest-data-not-loaded` until an operator loads a real dataset. This avoids presenting a hand-crafted correlation as a published-data validation result.

The supplied file must contain at least two observations with these columns (header aliases are accepted):

| Required field | Accepted headers | Meaning |
|---|---|---|
| Period | `date`, `period`, `month`, `reference_period` | Monthly or daily reference period, normalized to the first day of its month |
| Official fare | `dgca_avg_fare`, `average_fare`, `avg_fare`, `domestic_average_fare` | Published domestic average fare in INR |
| APIx index | `apix_index`, `fisher_index`, `index_value` | Optional; when omitted, loader uses the matching monthly average from `index_daily` |

Traffic-only reports are rejected because passenger volume is not a fare proxy. Load a verified local file with its citation:

```bash
python -m ingestion.dgca_loader path/to/dgca_domestic_fares.xlsx \
  --source-title "DGCA Domestic Air Transport Monthly Statistics" \
  --source-url "https://www.dgca.gov.in/" \
  --replace
```

Or download the file directly over HTTP instead of fetching it manually first, using `--fetch-url` in place of the local path (the citation `--source-url` defaults to the same link when omitted):

```bash
python -m ingestion.dgca_loader --fetch-url "https://esankhyiki.mospi.gov.in/<export-link>" \
  --source-title "DGCA Domestic Air Transport Monthly Statistics" \
  --replace
```

Both paths run through the exact same `parse_observations` validation, so a downloaded file is held to the identical standard as a manually supplied one. See `docs/backtest_data.md` for the specific real sources identified for this.

Each import persists the source title, URL, filename, SHA-256 digest, import timestamp, and actual coverage start/end in `backtest_datasets`; every `backtest_records` row references that dataset. The loader's printed result is the authoritative citation and date range to include in a release note for that import.

---

## 5. Chain-Linking (Monthly Index)

`MonthlyIndex.formula = "chained_laspeyres"` is not merely a label: `GET
/api/index/monthly` with this formula (the default) computes a genuine
chained series via `index_math/chain_link.py::build_chained_series`. Given
`MonthlyIndex.mom_change_pct` for every month up to and including the
requested one, the published index is the earliest known month's own
`index_value`, compounded forward by each subsequent month's own
month-over-month change:

$$C_0 = I_{\text{anchor month}}, \qquad C_t = C_{t-1} \times \left(1 + \frac{\Delta_t}{100}\right)$$

This is the standard technique statistical agencies use to splice a run of
short-run (month-over-month) comparisons into one continuous long-run series
- including across a future base-year/basket revision, using the overlap-
linking method in `index_math/chain_link.py::splice_basket_revision`: the
overlap period is computed once on the old weights (published as the last
pre-revision figure) and once on the new weights (used only to derive a link
factor), so `link_factor = overlap_old_basket_value / overlap_new_basket_value`
rescales every subsequent new-basket value onto the same continuous scale.
`tests/test_basket_revision_scenario.py` exercises this end-to-end against
the real 3-route legacy basket and the real 15-route production basket. The
`formula=fisher_ideal` query option is unaffected: it remains a point-in-time
index and returns the stored/computed period value directly, since chaining
a level-based Fisher Ideal series the same way would double-count the
substitution effect Fisher's geometric mean already accounts for at each
period.

---

## 6. Weekly Rolling-Average Index

The PRD calls for a "weekly (rolling avg)" frequency distinct from the daily
raw index and the monthly CPI-aligned index. A rolling average is, by
definition, recomputed every time a new daily observation lands - not once a
week. `pipeline/rollup.py::persist_weekly_rollup` runs as part of every daily
pipeline cycle (`pipeline/runner.py::persist_pipeline_outputs`) and
upserts the `index_weekly` row for `week_ending = today`, averaging
`laspeyres`/`fisher`/`t1..t45` over the trailing 7 calendar days of
`index_daily`. `GET /api/index/weekly` therefore always reflects a genuine
trailing 7-day rolling average as of its `week_ending` date, not a
once-a-week snapshot.
