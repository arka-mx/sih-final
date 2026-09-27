# APIx Price Index Methodology Specification
**MoSPI — Data Informatics & Innovation Division (DIID)**

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

Where the 3-route basket weights are normalized from official DGCA traffic statistics:
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

## 2. Inferred Convenience-Fee Decomposition
For matched flight records $(c, f, d, w)$ where $c$ is carrier, $f$ is flight number, $d$ is departure date, and $w$ is advance purchase days:

$$\text{Inferred Markup} = P_{\text{MMT, Total}} - P_{\text{Direct, Total}}$$

This isolates non-airline consumer surcharges from pure air transport price changes.
