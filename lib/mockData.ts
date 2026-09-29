// Static sample data used ONLY when NEXT_PUBLIC_DEMO_MODE=true (see lib/demoMode.ts).
// Components fetch live data from the FastAPI backend (via app/api/* proxy routes) by
// default; this file must never silently power the default UI.

export interface AirfareRecord {
  id: string;
  date: string;
  route: string;
  origin: string;
  destination: string;
  airline: string;
  bookingWindow: string; // T+1, T+7, T+15, T+30, T+45
  baseFare: number;
  tax: number;
  totalFare: number;
  scrapedAt: string;
  source: string;
}

export interface IndexPoint {
  date: string;
  apixValue: number; // base 100
  dgcaBenchmark: number;
  minFare: number;
  maxFare: number;
  avgFare: number;
  changeMoM: number;
}

export interface ScraperLogItem {
  id: string;
  source: string;
  type: 'Airline' | 'OTA';
  route: string;
  status: 'SUCCESS' | 'RATE_LIMITED' | 'RETRYING' | 'BLOCKED_QUEUE';
  recordsScraped: number;
  responseTimeMs: number;
  timestamp: string;
  complianceNote: string;
}

export const INITIAL_INDEX_DATA: IndexPoint[] = [
  { date: 'Aug 15', apixValue: 98.2, dgcaBenchmark: 97.8, minFare: 3100, maxFare: 8200, avgFare: 4420, changeMoM: -0.4 },
  { date: 'Aug 18', apixValue: 98.9, dgcaBenchmark: 98.4, minFare: 3150, maxFare: 8350, avgFare: 4480, changeMoM: -0.1 },
  { date: 'Aug 21', apixValue: 99.4, dgcaBenchmark: 99.0, minFare: 3200, maxFare: 8400, avgFare: 4510, changeMoM: +0.2 },
  { date: 'Aug 24', apixValue: 100.1, dgcaBenchmark: 99.8, minFare: 3220, maxFare: 8450, avgFare: 4590, changeMoM: +0.5 },
  { date: 'Aug 27', apixValue: 100.8, dgcaBenchmark: 100.3, minFare: 3250, maxFare: 8600, avgFare: 4630, changeMoM: +0.8 },
  { date: 'Aug 30', apixValue: 101.2, dgcaBenchmark: 100.9, minFare: 3280, maxFare: 8650, avgFare: 4680, changeMoM: +1.0 },
  { date: 'Sep 02', apixValue: 101.5, dgcaBenchmark: 101.1, minFare: 3300, maxFare: 8700, avgFare: 4720, changeMoM: +1.1 },
  { date: 'Sep 05', apixValue: 101.9, dgcaBenchmark: 101.4, minFare: 3320, maxFare: 8750, avgFare: 4760, changeMoM: +1.3 },
  { date: 'Sep 08', apixValue: 102.1, dgcaBenchmark: 101.8, minFare: 3350, maxFare: 8800, avgFare: 4800, changeMoM: +1.4 },
  { date: 'Sep 11', apixValue: 102.3, dgcaBenchmark: 102.0, minFare: 3380, maxFare: 8850, avgFare: 4830, changeMoM: +1.5 },
  { date: 'Sep 14', apixValue: 102.45, dgcaBenchmark: 102.1, minFare: 3400, maxFare: 8900, avgFare: 4850, changeMoM: +1.2 },
];

export const POPULAR_ROUTES = [
  { code: 'DEL-BOM', name: 'Delhi ↔ Mumbai', price: 4450, dgcaWeight: 0.18, volume: '2.4M/mo', trend: '+1.4%' },
  { code: 'DEL-BLR', name: 'Delhi ↔ Bengaluru', price: 3900, dgcaWeight: 0.14, volume: '1.9M/mo', trend: '+0.8%' },
  { code: 'BOM-BLR', name: 'Mumbai ↔ Bengaluru', price: 3650, dgcaWeight: 0.12, volume: '1.6M/mo', trend: '-0.3%' },
  { code: 'DEL-CCU', name: 'Delhi ↔ Kolkata', price: 2850, dgcaWeight: 0.09, volume: '1.2M/mo', trend: '+1.9%' },
  { code: 'BLR-HYD', name: 'Bengaluru ↔ Hyderabad', price: 2200, dgcaWeight: 0.08, volume: '1.1M/mo', trend: '-0.5%' },
  { code: 'MAA-DEL', name: 'Chennai ↔ Delhi', price: 4100, dgcaWeight: 0.07, volume: '0.9M/mo', trend: '+1.1%' },
];

export const AIRLINE_COMPARISON = [
  { name: 'IndiGo', avgPrice: 4200, marketShare: '62%', reliability: '99.4%', color: '#003f87' },
  { name: 'Air India', avgPrice: 5100, marketShare: '15%', reliability: '98.8%', color: '#dc2626' },
  { name: 'SpiceJet', avgPrice: 3800, marketShare: '9%', reliability: '96.2%', color: '#ea580c' },
  { name: 'Akasa Air', avgPrice: 3950, marketShare: '8%', reliability: '99.1%', color: '#7c3aed' },
  { name: 'Air India Express', avgPrice: 4050, marketShare: '6%', reliability: '97.9%', color: '#0284c7' },
];

export interface DarkPatternFlagItem {
  scrapeId: string;
  sourcePlatform: string;
  routePair: string;
  carrier: string;
  flightNo: string;
  departureDate: string;
  advanceDays: number;
  patternType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  evidence: Record<string, unknown>;
}

export const MOCK_DARK_PATTERN_FLAGS: DarkPatternFlagItem[] = [
  {
    scrapeId: 'MMT_a1b2c3d4',
    sourcePlatform: 'simulated_makemytrip',
    routePair: 'DEL-BOM',
    carrier: 'Air India',
    flightNo: 'AI-805',
    departureDate: '2026-10-06',
    advanceDays: 7,
    patternType: 'SCARCITY_COPY_MISMATCH',
    severity: 'HIGH',
    message:
      'Listing copy "Hurry! Only 3 seats left at this price." implies scarcity but seat_availability_flag="AVAILABLE" reports normal availability.',
    evidence: { listing_copy: 'Hurry! Only 3 seats left at this price.', matched_phrase: 'Only 3 seats left', seat_availability_flag: 'AVAILABLE' },
  },
  {
    scrapeId: 'MMT_a1b2c3d4',
    sourcePlatform: 'simulated_makemytrip',
    routePair: 'DEL-BOM',
    carrier: 'SpiceJet',
    flightNo: 'SG-153',
    departureDate: '2026-10-06',
    advanceDays: 7,
    patternType: 'SCARCITY_MESSAGING',
    severity: 'MEDIUM',
    message: 'Listing copy "Selling fast — high demand on this route." uses scarcity/urgency framing.',
    evidence: { listing_copy: 'Selling fast — high demand on this route.', matched_phrase: 'Selling fast', seat_availability_flag: 'FEW_SEATS_LEFT' },
  },
  {
    scrapeId: 'MMT_a1b2c3d4',
    sourcePlatform: 'simulated_makemytrip',
    routePair: 'DEL-BOM',
    carrier: 'Akasa Air',
    flightNo: 'QP-1102',
    departureDate: '2026-10-06',
    advanceDays: 7,
    patternType: 'REPEAT_VIEW_PRICE_ESCALATION',
    severity: 'MEDIUM',
    message:
      'Fare shown for this listing rose 4.17% (₹4325.0 → ₹4507.0) across 3 simulated repeat views of the same session, consistent with fare-cookie/price-tracking markup.',
    evidence: { repeat_view_fare_history: [4325.0, 4463.0, 4507.0], pct_change: 4.17 },
  },
];

export const ELASTICITY_DATA = [
  { window: 'T+1', avgFare: 8100, label: '1 Day (Last Minute)' },
  { window: 'T+7', avgFare: 5400, label: '7 Days Advance' },
  { window: 'T+15', avgFare: 3800, label: '15 Days Advance' },
  { window: 'T+30', avgFare: 3400, label: '30 Days Advance' },
  { window: 'T+45', avgFare: 3200, label: '45 Days Advance' },
];

export const HEATMAP_DATA = [
  { route: 'DEL-BOM', t1: 8900, t7: 5800, t15: 4450, t30: 3900, t45: 3600 },
  { route: 'DEL-BLR', t1: 8200, t7: 5200, t15: 3900, t30: 3500, t45: 3300 },
  { route: 'BOM-BLR', t1: 7100, t7: 4600, t15: 3650, t30: 3200, t45: 3000 },
  { route: 'DEL-CCU', t1: 6500, t7: 4100, t15: 2850, t30: 2600, t45: 2400 },
  { route: 'BLR-HYD', t1: 5200, t7: 3300, t15: 2200, t30: 2000, t45: 1900 },
  { route: 'MAA-DEL', t1: 8400, t7: 5500, t15: 4100, t30: 3700, t45: 3500 },
];

export const MOCK_RAW_FARES: AirfareRecord[] = [
  { id: 'F101', date: '2026-09-14', route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', airline: 'IndiGo', bookingWindow: 'T+7', baseFare: 3800, tax: 650, totalFare: 4450, scrapedAt: '10:14:02 AM', source: 'IndiGo Direct' },
  { id: 'F102', date: '2026-09-14', route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', airline: 'SpiceJet', bookingWindow: 'T+7', baseFare: 3200, tax: 480, totalFare: 3680, scrapedAt: '10:14:05 AM', source: 'MakeMyTrip' },
  { id: 'F103', date: '2026-09-14', route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', airline: 'Air India', bookingWindow: 'T+7', baseFare: 4500, tax: 675, totalFare: 5175, scrapedAt: '10:14:10 AM', source: 'AirIndia.com' },
  { id: 'F104', date: '2026-09-14', route: 'DEL-BLR', origin: 'DEL', destination: 'BLR', airline: 'IndiGo', bookingWindow: 'T+15', baseFare: 3300, tax: 600, totalFare: 3900, scrapedAt: '10:14:12 AM', source: 'IndiGo Direct' },
  { id: 'F105', date: '2026-09-14', route: 'DEL-BLR', origin: 'DEL', destination: 'BLR', airline: 'Akasa Air', bookingWindow: 'T+15', baseFare: 3100, tax: 550, totalFare: 3650, scrapedAt: '10:14:15 AM', source: 'EaseMyTrip' },
  { id: 'F106', date: '2026-09-14', route: 'BOM-BLR', origin: 'BOM', destination: 'BLR', airline: 'Air India Express', bookingWindow: 'T+30', baseFare: 2800, tax: 450, totalFare: 3250, scrapedAt: '10:14:20 AM', source: 'Cleartrip' },
  { id: 'F107', date: '2026-09-13', route: 'DEL-CCU', origin: 'DEL', destination: 'CCU', airline: 'SpiceJet', bookingWindow: 'T+7', baseFare: 2400, tax: 450, totalFare: 2850, scrapedAt: '09:30:11 AM', source: 'Yatra' },
  { id: 'F108', date: '2026-09-13', route: 'BLR-HYD', origin: 'BLR', destination: 'HYD', airline: 'IndiGo', bookingWindow: 'T+45', baseFare: 1800, tax: 400, totalFare: 2200, scrapedAt: '09:30:15 AM', source: 'IndiGo Direct' },
  { id: 'F109', date: '2026-09-13', route: 'MAA-DEL', origin: 'MAA', destination: 'DEL', airline: 'Air India', bookingWindow: 'T+1', baseFare: 7400, tax: 1000, totalFare: 8400, scrapedAt: '09:30:20 AM', source: 'Ixigo' },
  { id: 'F110', date: '2026-09-13', route: 'DEL-BOM', origin: 'DEL', destination: 'BOM', airline: 'Akasa Air', bookingWindow: 'T+1', baseFare: 7100, tax: 950, totalFare: 8050, scrapedAt: '09:30:25 AM', source: 'EaseMyTrip' },
];

export interface CleanedFareItem {
  id: string;
  pair: string;
  origin: string;
  destination: string;
  carrier: string;
  flight_no: string;
  departure_date: string;
  scrape_date: string;
  advance_days: number;
  fare_class: string;
  base_fare: number;
  taxes_udf: number;
  convenience_fee: number;
  total_fare: number;
  seat_avail: boolean;
  seat_availability_flag: 'AVAILABLE' | 'FEW_SEATS_LEFT' | 'SOLD_OUT' | 'CANCELLED';
  source: string;
  audit_hash: string;
  imputation_applied: boolean;
  imputed_fields: string[];
  is_outlier: boolean;
  outlier_reason: string | null;
  is_duplicate: boolean;
  include_in_cpi_index: boolean;
  z_score: number;
}

export interface PipelineAuditSummary {
  total_raw_ingested: number;
  valid_cleaned_records: number;
  duplicates_merged: number;
  outliers_flagged: number;
  imputed_records_count: number;
  sold_out_excluded: number;
  cpi_eligible_records: number;
  data_quality_score_percent: number;
}

export const MOCK_PIPELINE_AUDIT: PipelineAuditSummary = {
  total_raw_ingested: 8,
  valid_cleaned_records: 7,
  duplicates_merged: 1,
  outliers_flagged: 1,
  imputed_records_count: 1,
  sold_out_excluded: 1,
  cpi_eligible_records: 5,
  data_quality_score_percent: 62.5,
};

export const MOCK_CLEANED_FARES: CleanedFareItem[] = [
  { id: 'F_INDIGO_DEL_BOM_6E_205_7', pair: 'DEL-BOM', origin: 'DEL', destination: 'BOM', carrier: 'IndiGo', flight_no: '6E-205', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 3450, taxes_udf: 850, convenience_fee: 0, total_fare: 4300, seat_avail: true, seat_availability_flag: 'AVAILABLE', source: 'indigo_direct', audit_hash: 'sha256:0a1b2c3d4e5f60718293a4b5c6d7e8f9', imputation_applied: false, imputed_fields: [], is_outlier: false, outlier_reason: null, is_duplicate: false, include_in_cpi_index: true, z_score: -0.12 },
  { id: 'F_MMT_DEL_BOM_6E_205_7', pair: 'DEL-BOM', origin: 'DEL', destination: 'BOM', carrier: 'IndiGo', flight_no: '6E-205', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 3450, taxes_udf: 850, convenience_fee: 399, total_fare: 4699, seat_avail: true, seat_availability_flag: 'AVAILABLE', source: 'makemytrip', audit_hash: 'sha256:1b2c3d4e5f60718293a4b5c6d7e8f9a0', imputation_applied: false, imputed_fields: [], is_outlier: false, outlier_reason: null, is_duplicate: false, include_in_cpi_index: true, z_score: 0.31 },
  { id: 'F_MMT_DEL_BOM_AI_805_7', pair: 'DEL-BOM', origin: 'DEL', destination: 'BOM', carrier: 'Air India', flight_no: 'AI-805', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 22230, taxes_udf: 6270, convenience_fee: 399, total_fare: 28899, seat_avail: true, seat_availability_flag: 'FEW_SEATS_LEFT', source: 'makemytrip', audit_hash: 'sha256:2c3d4e5f60718293a4b5c6d7e8f9a0b1', imputation_applied: false, imputed_fields: [], is_outlier: true, outlier_reason: 'IQR_HIGH_OUTLIER (₹28899 > upper bound ₹9800)', is_duplicate: false, include_in_cpi_index: false, z_score: 2.91 },
  { id: 'F_MMT_DEL_BOM_SG_8182_7', pair: 'DEL-BOM', origin: 'DEL', destination: 'BOM', carrier: 'SpiceJet', flight_no: 'SG-8182', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 3042, taxes_udf: 858, convenience_fee: 0, total_fare: 3900, seat_avail: true, seat_availability_flag: 'AVAILABLE', source: 'makemytrip', audit_hash: 'sha256:3d4e5f60718293a4b5c6d7e8f9a0b1c2', imputation_applied: true, imputed_fields: ['base_fare', 'taxes_udf'], is_outlier: false, outlier_reason: null, is_duplicate: false, include_in_cpi_index: true, z_score: -0.44 },
  { id: 'F_INDIGO_DEL_BOM_6E_205_7_DUP', pair: 'DEL-BOM', origin: 'DEL', destination: 'BOM', carrier: 'IndiGo', flight_no: '6E-205', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 3450, taxes_udf: 850, convenience_fee: 0, total_fare: 4300, seat_avail: true, seat_availability_flag: 'AVAILABLE', source: 'indigo_direct', audit_hash: 'sha256:4e5f60718293a4b5c6d7e8f9a0b1c2d3', imputation_applied: false, imputed_fields: [], is_outlier: false, outlier_reason: null, is_duplicate: true, include_in_cpi_index: false, z_score: -0.12 },
  { id: 'F_INDIGO_BLR_HYD_QP_1304_7', pair: 'BLR-HYD', origin: 'BLR', destination: 'HYD', carrier: 'Akasa Air', flight_no: 'QP-1304', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 2200, taxes_udf: 400, convenience_fee: 300, total_fare: 2900, seat_avail: false, seat_availability_flag: 'SOLD_OUT', source: 'makemytrip', audit_hash: 'sha256:5f60718293a4b5c6d7e8f9a0b1c2d3e4', imputation_applied: false, imputed_fields: [], is_outlier: false, outlier_reason: null, is_duplicate: false, include_in_cpi_index: false, z_score: 0.02 },
  { id: 'F_INDIGO_BOM_BLR_IX_245_7', pair: 'BOM-BLR', origin: 'BOM', destination: 'BLR', carrier: 'Air India Express', flight_no: 'IX-245', departure_date: '2026-09-21', scrape_date: '2026-09-14', advance_days: 7, fare_class: 'Economy', base_fare: 2900, taxes_udf: 450, convenience_fee: 300, total_fare: 3650, seat_avail: true, seat_availability_flag: 'AVAILABLE', source: 'indigo_direct', audit_hash: 'sha256:60718293a4b5c6d7e8f9a0b1c2d3e4f5', imputation_applied: false, imputed_fields: [], is_outlier: false, outlier_reason: null, is_duplicate: false, include_in_cpi_index: true, z_score: -0.08 },
];

export const SCRAPER_LOGS: ScraperLogItem[] = [
  { id: 'SCR-901', source: 'IndiGo Booking API / Web', type: 'Airline', route: 'DEL-BOM', status: 'SUCCESS', recordsScraped: 142, responseTimeMs: 420, timestamp: '10:14:02 AM', complianceNote: 'Robots.txt compliant, Crawl-delay: 2s' },
  { id: 'SCR-902', source: 'MakeMyTrip Search Engine', type: 'OTA', route: 'DEL-BLR', status: 'SUCCESS', recordsScraped: 210, responseTimeMs: 650, timestamp: '10:14:05 AM', complianceNote: 'Affiliate API token used, rate-limited' },
  { id: 'SCR-903', source: 'Air India Direct Engine', type: 'Airline', route: 'BOM-BLR', status: 'SUCCESS', recordsScraped: 98, responseTimeMs: 510, timestamp: '10:14:10 AM', complianceNote: 'Headless Playwright session rotated' },
  { id: 'SCR-904', source: 'SpiceJet Public Booking', type: 'Airline', route: 'DEL-CCU', status: 'RATE_LIMITED', recordsScraped: 0, responseTimeMs: 1200, timestamp: '10:13:40 AM', complianceNote: 'Throttled (429), retry queued in 15m' },
  { id: 'SCR-905', source: 'EaseMyTrip Listing', type: 'OTA', route: 'BLR-HYD', status: 'SUCCESS', recordsScraped: 175, responseTimeMs: 390, timestamp: '10:12:00 AM', complianceNote: 'Partner API read-only endpoint' },
  { id: 'SCR-906', source: 'Akasa Air Engine', type: 'Airline', route: 'MAA-DEL', status: 'BLOCKED_QUEUE', recordsScraped: 0, responseTimeMs: 2100, timestamp: '10:10:15 AM', complianceNote: 'CAPTCHA barrier detected, fallback queue' },
];

export interface BacktestDataPoint {
  date: string;
  displayDate: string;
  apixIndex: number;
  dgcaAvgFare: number;
  impliedFare: number;
  variancePct: number;
  trackingResidual: number;
}

export const BACKTEST_SUMMARY_METRICS = {
  pearsonR: 0.892,
  targetR: 0.80,
  mape: 3.12,
  targetMape: 3.50,
  rmse: 142.50,
  daysEvaluated: 30,
  pValue: '< 0.0001',
  periodStart: '2026-08-16',
  periodEnd: '2026-09-14',
  status: 'TARGET MET (Pearson r ≥ 0.80)',
};

export const DGCA_BACKTEST_DATA: BacktestDataPoint[] = [
  { date: '2026-08-16', displayDate: 'Aug 16', apixIndex: 98.2, dgcaAvgFare: 4380.0, impliedFare: 4380.0, variancePct: 0.00, trackingResidual: 0.0 },
  { date: '2026-08-17', displayDate: 'Aug 17', apixIndex: 98.5, dgcaAvgFare: 4390.0, impliedFare: 4393.4, variancePct: 0.08, trackingResidual: 3.4 },
  { date: '2026-08-18', displayDate: 'Aug 18', apixIndex: 98.9, dgcaAvgFare: 4420.0, impliedFare: 4411.2, variancePct: 0.20, trackingResidual: -8.8 },
  { date: '2026-08-19', displayDate: 'Aug 19', apixIndex: 99.1, dgcaAvgFare: 4440.0, impliedFare: 4420.1, variancePct: 0.45, trackingResidual: -19.9 },
  { date: '2026-08-20', displayDate: 'Aug 20', apixIndex: 99.3, dgcaAvgFare: 4460.0, impliedFare: 4429.1, variancePct: 0.69, trackingResidual: -30.9 },
  { date: '2026-08-21', displayDate: 'Aug 21', apixIndex: 99.4, dgcaAvgFare: 4480.0, impliedFare: 4433.5, variancePct: 1.04, trackingResidual: -46.5 },
  { date: '2026-08-22', displayDate: 'Aug 22', apixIndex: 99.7, dgcaAvgFare: 4500.0, impliedFare: 4446.9, variancePct: 1.18, trackingResidual: -53.1 },
  { date: '2026-08-23', displayDate: 'Aug 23', apixIndex: 99.9, dgcaAvgFare: 4520.0, impliedFare: 4455.8, variancePct: 1.42, trackingResidual: -64.2 },
  { date: '2026-08-24', displayDate: 'Aug 24', apixIndex: 100.1, dgcaAvgFare: 4550.0, impliedFare: 4464.8, variancePct: 1.87, trackingResidual: -85.2 },
  { date: '2026-08-25', displayDate: 'Aug 25', apixIndex: 100.3, dgcaAvgFare: 4570.0, impliedFare: 4473.7, variancePct: 2.11, trackingResidual: -96.3 },
  { date: '2026-08-26', displayDate: 'Aug 26', apixIndex: 100.6, dgcaAvgFare: 4590.0, impliedFare: 4487.1, variancePct: 2.24, trackingResidual: -102.9 },
  { date: '2026-08-27', displayDate: 'Aug 27', apixIndex: 100.8, dgcaAvgFare: 4610.0, impliedFare: 4496.0, variancePct: 2.47, trackingResidual: -114.0 },
  { date: '2026-08-28', displayDate: 'Aug 28', apixIndex: 101.0, dgcaAvgFare: 4630.0, impliedFare: 4504.9, variancePct: 2.70, trackingResidual: -125.1 },
  { date: '2026-08-29', displayDate: 'Aug 29', apixIndex: 101.1, dgcaAvgFare: 4640.0, impliedFare: 4509.4, variancePct: 2.81, trackingResidual: -130.6 },
  { date: '2026-08-30', displayDate: 'Aug 30', apixIndex: 101.2, dgcaAvgFare: 4660.0, impliedFare: 4513.8, variancePct: 3.14, trackingResidual: -146.2 },
  { date: '2026-08-31', displayDate: 'Aug 31', apixIndex: 101.3, dgcaAvgFare: 4680.0, impliedFare: 4518.3, variancePct: 3.46, trackingResidual: -161.7 },
  { date: '2026-09-01', displayDate: 'Sep 01', apixIndex: 101.4, dgcaAvgFare: 4700.0, impliedFare: 4522.8, variancePct: 3.77, trackingResidual: -177.2 },
  { date: '2026-09-02', displayDate: 'Sep 02', apixIndex: 101.5, dgcaAvgFare: 4710.0, impliedFare: 4527.2, variancePct: 3.88, trackingResidual: -182.8 },
  { date: '2026-09-03', displayDate: 'Sep 03', apixIndex: 101.6, dgcaAvgFare: 4730.0, impliedFare: 4531.7, variancePct: 4.19, trackingResidual: -198.3 },
  { date: '2026-09-04', displayDate: 'Sep 04', apixIndex: 101.8, dgcaAvgFare: 4750.0, impliedFare: 4540.6, variancePct: 4.41, trackingResidual: -209.4 },
  { date: '2026-09-05', displayDate: 'Sep 05', apixIndex: 101.9, dgcaAvgFare: 4760.0, impliedFare: 4545.1, variancePct: 4.51, trackingResidual: -214.9 },
  { date: '2026-09-06', displayDate: 'Sep 06', apixIndex: 102.0, dgcaAvgFare: 4780.0, impliedFare: 4549.5, variancePct: 4.82, trackingResidual: -230.5 },
  { date: '2026-09-07', displayDate: 'Sep 07', apixIndex: 102.1, dgcaAvgFare: 4790.0, impliedFare: 4554.0, variancePct: 4.93, trackingResidual: -236.0 },
  { date: '2026-09-08', displayDate: 'Sep 08', apixIndex: 102.15, dgcaAvgFare: 4800.0, impliedFare: 4556.2, variancePct: 5.08, trackingResidual: -243.8 },
  { date: '2026-09-09', displayDate: 'Sep 09', apixIndex: 102.20, dgcaAvgFare: 4810.0, impliedFare: 4558.5, variancePct: 5.23, trackingResidual: -251.5 },
  { date: '2026-09-10', displayDate: 'Sep 10', apixIndex: 102.25, dgcaAvgFare: 4820.0, impliedFare: 4560.7, variancePct: 5.38, trackingResidual: -259.3 },
  { date: '2026-09-11', displayDate: 'Sep 11', apixIndex: 102.30, dgcaAvgFare: 4830.0, impliedFare: 4562.9, variancePct: 5.53, trackingResidual: -267.1 },
  { date: '2026-09-12', displayDate: 'Sep 12', apixIndex: 102.35, dgcaAvgFare: 4840.0, impliedFare: 4565.1, variancePct: 5.68, trackingResidual: -274.9 },
  { date: '2026-09-13', displayDate: 'Sep 13', apixIndex: 102.40, dgcaAvgFare: 4850.0, impliedFare: 4567.4, variancePct: 5.83, trackingResidual: -282.6 },
  { date: '2026-09-14', displayDate: 'Sep 14', apixIndex: 102.45, dgcaAvgFare: 4860.0, impliedFare: 4569.6, variancePct: 5.98, trackingResidual: -290.4 },
];

