# APIx Ethics & Compliance Specification
**Ministry of Statistics & Programme Implementation (MoSPI) — DIID**  
*Problem Statement 26056: Real-time Airfare Price Index (APIx) for India*

---

## 1. Legal Stance & IT Act Compliance (Sec. 43 / 66)
Under sections 43 and 66 of the Information Technology Act (2000), accessing computer systems without authorization or causing disruption/denial of service constitutes an offense. APIx complies through the following strict engineering boundaries:
- **No CAPTCHA-Bypass Automation**: APIx does **not** integrate third-party CAPTCHA solving farms or automated bypass tools. If an automated challenge appears, the scrape job logs `blocked`, backs off exponentially, and halts.
- **Publicly Displayed Microdata Only**: The platform captures only open, publicly accessible flight schedule and fare cards available to any anonymous consumer. No user login, account credentials, or authenticated sessions are simulated or scraped.
- **No Personal Identifiable Information (PII)**: Passenger booking forms, user accounts, and cookie-stored personal histories are strictly outside the scraper boundary.

---

## 2. Scraping Rate Limits & Crawl Delay Architecture
To prevent server strain or disruptive load on domestic airline infrastructure:
- **Concurrency Cap**: Fixed at **1 concurrent session** per domain (`goindigo.in`, `makemytrip.com`).
- **Randomized Jitter Delay**: Mandatory crawl delay between **1.5s and 3.5s** per request (`enforce_rate_limit()` in `scrapers/base.py`).
- **Off-Peak Execution**: Scheduled daily runs trigger during low-traffic windows (02:00 – 04:00 IST).

---

## 3. Platform-Specific ToS Review

### IndiGo Direct (`goindigo.in`)
- **Coverage Justification**: Largest domestic carrier (~62% seat share), structurally excluded from public GDS engines. Capturing IndiGo directly is essential to prevent systematic under-representation of domestic airfare inflation.
- **Data Scope**: Origin, destination, flight number, departure time, base fare, taxes/UDF.

### MakeMyTrip (`makemytrip.com`)
- **Coverage Justification**: Serves as the multi-carrier fan-out engine (Air India, Akasa Air, SpiceJet) and the benchmark for consumer retail pricing.
- **Convenience-Fee Transparency**: Used to decompose and isolate OTA markups from carrier base fares.

---

## 4. What We Didn't Build and Why (Deliberate Tradeoffs)
1. **Two Sources Only (IndiGo + MMT)**: Rather than building 5 brittle airline scrapers that fail on DOM updates, focusing on IndiGo + MMT enables exact 1-to-1 cross-source diffing and fee decomposition.
2. **Three Corridors Only (DEL-BOM, DEL-BLR, BOM-BLR)**: Covers the highest-volume domestic passenger corridors, proving Laspeyres weighting and Jevons math without operational fragility.
3. **No Fabricated 30-Day History**: Pre-seeded baselines are transparently labeled as DGCA validation benchmarks, rather than pretending to have accumulated 30 days of live data during a hackathon.
