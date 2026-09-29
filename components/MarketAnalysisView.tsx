'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HEATMAP_DATA, ELASTICITY_DATA } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { Grid, Sparkles, Info, Activity, AlertTriangle, Calculator, Scale, BookOpen, Layers } from 'lucide-react';

const WINDOWS = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'] as const;

interface OptimalWindow {
  optimalWindow: string;
  optimalAvgFare: number;
  worstWindow: string;
  worstAvgFare: number;
  savingsAmount: number;
  savingsPct: number;
}

interface TrendsResponse {
  heatmap: Record<string, string | number | null>[];
  elasticity: { window: string; label: string; avgFare: number | null }[];
  optimalWindow: OptimalWindow | null;
  airlines: { name: string; avgPrice: number; marketShare: string; observations: number }[];
  volatility: { corridor: string; volatilityPct: number }[];
}

interface SourcesResponse {
  routePair: string;
  advanceDays: number;
  matchedFlightsCount: number;
  flights: {
    route: string;
    carrier: string;
    flightNo: string;
    departureDate: string;
    directTotal: number;
    mmtTotal: number;
    markup: number;
    auditRefDirect: string;
  }[];
}

interface DailyIndexLatest {
  latest: {
    date: string;
    laspeyres: number;
    fisher: number;
    sectors: { pair: string; index: number; weight: number }[];
  } | null;
}

export default function MarketAnalysisView() {
  const [activeTab, setActiveTab] = useState<'heatmap' | 'elasticity' | 'volatility' | 'cross-source' | 'statistical-rigor'>('statistical-rigor');
  const [sourceRoute, setSourceRoute] = useState('DEL-BOM');

  const trends = useApiData<TrendsResponse>(
    DEMO_MODE ? null : activeTab === 'heatmap' || activeTab === 'elasticity' || activeTab === 'volatility' ? '/api/trends' : null,
    [activeTab]
  );
  const sources = useApiData<SourcesResponse>(
    DEMO_MODE ? null : activeTab === 'cross-source' ? `/api/sources?route=${sourceRoute}&advance_days=7` : null,
    [activeTab, sourceRoute]
  );
  const dailyIndex = useApiData<DailyIndexLatest>(
    DEMO_MODE ? null : activeTab === 'statistical-rigor' ? '/api/index/daily' : null,
    [activeTab]
  );

  const getHeatmapColor = (price: number | null | undefined) => {
    if (price == null) return 'bg-ink-100 text-ink-400';
    if (price > 7000) return 'bg-navy-800 text-white';
    if (price > 4500) return 'bg-navy-600 text-white';
    if (price > 3000) return 'bg-navy-300 text-navy-900 font-semibold';
    return 'bg-navy-100 text-navy-800 font-medium';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {DEMO_MODE && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Demo mode — showing static sample data, not live APIx backend results.
        </div>
      )}

      {/* Tab Header */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Market Analysis & Statistical Intelligence</h2>
            <p className="text-xs text-ink-500">
              Index number theory (Laspeyres vs Fisher), cross-source fee decomposition, elasticity, and corridor heatmaps
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-ink-50 border border-ink-100 rounded-lg p-1">
            {[
              { id: 'statistical-rigor', label: 'Laspeyres vs Fisher (Rigor)' },
              { id: 'cross-source', label: 'IndiGo vs MMT Diff' },
              { id: 'heatmap', label: 'Route Heatmap' },
              { id: 'elasticity', label: 'Price Elasticity' },
              { id: 'volatility', label: 'Volatility Index' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-white text-navy-800 shadow-panel'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* STATISTICAL RIGOR PANEL: Laspeyres vs. Fisher Ideal Index */}
        {activeTab === 'statistical-rigor' && (
          <div className="space-y-6 pt-2">
            {!DEMO_MODE && dailyIndex.loading && <LoadingPanel label="Loading latest daily Laspeyres/Fisher index..." />}
            {!DEMO_MODE && dailyIndex.error && <ErrorPanel message={dailyIndex.error} onRetry={dailyIndex.refetch} />}

            {(DEMO_MODE || (!dailyIndex.loading && !dailyIndex.error)) && (
              <>
                {/* Header Banner */}
                <div className="bg-navy-50 border border-navy-200 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="flex items-center space-x-2 text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
                      <Scale className="w-4 h-4 text-navy-700" />
                      <span>MoSPI / NSO Index Number Methodology</span>
                    </div>
                    <h3 className="text-base font-semibold text-ink-900">Laspeyres vs. Fisher Ideal Index Comparison</h3>
                    <p className="text-ink-700 mt-1 leading-relaxed">
                      Demonstrates compliance with <strong>Consumer Price Index (CPI)</strong> item-basket standards.
                      MoSPI mandates <strong>Modified Laspeyres</strong> (fixed base-period quantity weights) for operational CPI publishing,
                      while <strong>Fisher Ideal Index</strong> is calculated alongside as an academic robustness check to quantify substitution bias.
                    </p>
                  </div>

                  <div className="shrink-0 bg-white p-3 rounded-lg border border-ink-100 space-y-1">
                    <span className="text-[11px] text-ink-500 block font-medium">Latest Reading Date</span>
                    <span className="text-xs font-semibold text-navy-700 flex items-center font-tabular">
                      <BookOpen className="w-3.5 h-3.5 mr-1 text-navy-700" />
                      {DEMO_MODE ? 'Sample Data' : dailyIndex.data?.latest?.date ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Index Formula Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="panel border-2 border-navy-200 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-navy-700 text-white text-[10px] font-semibold px-3 py-1 rounded-bl-lg">
                      MoSPI&apos;s CPI Method
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Calculator className="w-4 h-4 text-navy-700" />
                      <h4 className="font-semibold text-sm text-ink-900">Modified Laspeyres Index ($I_L$)</h4>
                    </div>
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-3 font-mono text-xs text-ink-900 my-3">
                      I_L = ∑ [ W_r × ( P_1,r / P_0,r ) ]
                    </div>
                    <div className="space-y-2 text-xs text-ink-700">
                      <p>• <strong>Weighting:</strong> Fixed base-period passenger share ($W_r$) from DGCA domestic statistics.</p>
                      <p>
                        • <strong>Current Reading:</strong>{' '}
                        <strong className="text-lg text-navy-700 font-semibold ml-1 font-tabular">
                          {dailyIndex.data?.latest?.laspeyres.toFixed(2) ?? '—'}
                        </strong>{' '}
                        (Base 100)
                      </p>
                      <p>• <strong>Why MoSPI uses this:</strong> Prevents index volatility caused by rapid short-term changes in passenger traffic, ensuring consistent monthly CPI releases.</p>
                    </div>
                  </div>

                  <div className="panel border-2 border-emerald-200 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-semibold px-3 py-1 rounded-bl-lg">
                      Robustness Check
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Scale className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-semibold text-sm text-ink-900">Fisher Ideal Index ($I_F$)</h4>
                    </div>
                    <div className="bg-ink-50 border border-ink-200 rounded-lg p-3 font-mono text-xs text-ink-900 my-3">
                      I_F = √( I_Laspeyres × I_Paasche )
                    </div>
                    <div className="space-y-2 text-xs text-ink-700">
                      <p>• <strong>Weighting:</strong> Geometric mean combining both base-period and current-period flight volumes.</p>
                      <p>
                        • <strong>Current Reading:</strong>{' '}
                        <strong className="text-lg text-emerald-700 font-semibold ml-1 font-tabular">
                          {dailyIndex.data?.latest?.fisher.toFixed(2) ?? '—'}
                        </strong>{' '}
                        (Base 100)
                      </p>
                      <p>• <strong>Why we include this:</strong> Acts as an econometric check. A small divergence from Laspeyres indicates minimal substitution bias in domestic aviation.</p>
                    </div>
                  </div>
                </div>

                {/* Route Weighting Basket Derivation Table */}
                <div className="panel p-5 space-y-3">
                  <h4 className="font-semibold text-sm text-ink-900 flex items-center">
                    <Layers className="w-4 h-4 mr-2 text-navy-700" />
                    Corridor Sector Contributions (Live)
                  </h4>
                  <p className="text-xs text-ink-500">
                    Top DGCA-weighted corridors and their contribution to today&apos;s Fisher index reading.
                  </p>

                  <div className="overflow-x-auto border border-ink-100 rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
                        <tr>
                          <th className="p-3">Corridor</th>
                          <th className="p-3 text-right">Basket Weight (Wr)</th>
                          <th className="p-3 text-right">Sector Index</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {(dailyIndex.data?.latest?.sectors ?? []).map((row) => (
                          <tr key={row.pair} className="hover:bg-ink-50/60 transition-colors">
                            <td className="p-3 font-semibold text-ink-900">
                              <span className="font-mono text-navy-700 mr-1.5">{row.pair}</span>
                            </td>
                            <td className="p-3 text-right font-semibold text-navy-700 font-tabular">{(row.weight * 100).toFixed(2)}%</td>
                            <td className="p-3 text-right font-mono font-medium font-tabular">{row.index.toFixed(2)}</td>
                          </tr>
                        ))}
                        {!dailyIndex.data?.latest?.sectors.length && (
                          <tr>
                            <td colSpan={3} className="p-3 text-center text-ink-500">
                              No sector data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-start space-x-3 text-xs text-emerald-950">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block mb-0.5">Methodology Note:</strong>
                    A naive arithmetic average of scraped fares is upward-biased by low-volume luxury flights. APIx instead uses <strong>elementary Jevons geometric means</strong> aggregated via <strong>DGCA traffic weights</strong>, per MoSPI&apos;s official CPI methodology.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CROSS-SOURCE DIFF SECTION (IndiGo-direct vs MakeMyTrip) */}
        {activeTab === 'cross-source' && (
          <div className="space-y-5 pt-2">
            <div className="bg-navy-50 border border-navy-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-navy-700 text-sm flex items-center">
                  <Sparkles className="w-4 h-4 mr-1.5 text-navy-700" />
                  OTA Convenience-Fee Decomposition & Cross-Source Outlier Audit
                </span>
                <p className="text-ink-700 mt-1">
                  Comparing matching deterministic fixtures for a direct-channel scenario and an OTA scenario.
                  Proves consumer markup and audits price consistency before CPI basket inclusion.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <select
                  value={sourceRoute}
                  onChange={(e) => setSourceRoute(e.target.value)}
                  className="text-xs font-mono px-2 py-1.5 rounded-lg border border-navy-200 bg-white cursor-pointer"
                >
                  {['DEL-BOM', 'DEL-BLR', 'BOM-BLR'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!DEMO_MODE && sources.loading && <LoadingPanel label="Running live IndiGo vs MakeMyTrip scrapers..." />}
            {!DEMO_MODE && sources.error && <ErrorPanel message={sources.error} onRetry={sources.refetch} />}

            {!DEMO_MODE && !sources.loading && !sources.error && (
              <div className="overflow-x-auto border border-ink-100 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
                    <tr>
                      <th className="p-3">Route & Flight</th>
                      <th className="p-3">Departure Date</th>
                      <th className="p-3 text-right">IndiGo Direct</th>
                      <th className="p-3 text-right">MakeMyTrip Total</th>
                      <th className="p-3 text-right text-amber-700">Inferred Markup</th>
                      <th className="p-3 text-center">Audit Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {(sources.data?.flights ?? []).map((row) => (
                      <tr key={row.flightNo} className="hover:bg-ink-50/60 transition-colors">
                        <td className="p-3 font-semibold text-ink-900">
                          <span className="font-mono text-navy-700 mr-2">{row.route}</span>
                          <span className="bg-navy-100 text-navy-700 px-1.5 py-0.5 rounded-md text-[11px] font-mono">{row.flightNo}</span>
                        </td>
                        <td className="p-3 text-ink-500">{row.departureDate}</td>
                        <td className="p-3 text-right font-medium font-tabular">₹{row.directTotal.toLocaleString()}</td>
                        <td className="p-3 text-right font-medium text-ink-900 font-tabular">₹{row.mmtTotal.toLocaleString()}</td>
                        <td className="p-3 text-right font-semibold text-amber-700 bg-amber-50/50 font-tabular">
                          {row.markup >= 0 ? '+' : ''}₹{row.markup} <span className="text-[10px] text-amber-600 block font-normal">(Convenience Fee)</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200" title={row.auditRefDirect}>
                            Raw JSON Stored
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(sources.data?.flights.length ?? 0) === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-ink-500">
                          No matched flights found across both sources for this corridor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-ink-50 p-4 rounded-lg border border-ink-100 flex items-start space-x-3 text-xs text-ink-500">
              <Info className="w-4 h-4 text-navy-700 shrink-0 mt-0.5" />
              <p>
                <strong>Methodology Distinction for NSO/MoSPI:</strong> Direct carrier scrapers (IndiGo) capture base fare and mandatory UDF/CUTE charges. OTA scrapers (MakeMyTrip) capture total consumer out-of-pocket costs including non-refundable convenience charges. The difference is isolated here to preserve pure price index integrity vs. retail expenditure tracking.
              </p>
            </div>
          </div>
        )}

        {/* HEATMAP SECTION */}
        {activeTab === 'heatmap' && (
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-ink-900 flex items-center">
                <Grid className="w-4 h-4 mr-1.5 text-navy-700" />
                Fare Matrix: Route vs. Booking Window (₹ Average)
              </h3>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-ink-500">Legend:</span>
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-navy-800 rounded-md mr-1"></span> Expensive (₹7k+)</span>
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-navy-600 rounded-md mr-1"></span> Moderate (₹4.5k–₹7k)</span>
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-navy-100 rounded-md border border-navy-200 mr-1"></span> Affordable (&lt;₹3k)</span>
              </div>
            </div>

            {!DEMO_MODE && trends.loading && <LoadingPanel label="Aggregating fare matrix across DGCA basket..." />}
            {!DEMO_MODE && trends.error && <ErrorPanel message={trends.error} onRetry={trends.refetch} />}

            {(DEMO_MODE || (!trends.loading && !trends.error)) && (
              <div className="overflow-x-auto border border-ink-100 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
                    <tr>
                      <th className="p-3 border-r border-ink-100">Corridor Route</th>
                      {WINDOWS.map((w) => (
                        <th key={w} className="p-3 text-center">
                          {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(DEMO_MODE ? HEATMAP_DATA : trends.data?.heatmap ?? []).map((row: Record<string, string | number | null>) => (
                      <tr key={row.route as string} className="border-b border-ink-100">
                        <td className="p-3 font-semibold text-ink-900 border-r border-ink-100 bg-ink-50 font-mono">{row.route}</td>
                        {WINDOWS.map((w) => {
                          const key = DEMO_MODE ? w.replace('T+', 't') : w;
                          const val = typeof row[key] === 'number' ? (row[key] as number) : null;
                          return (
                            <td key={w} className="p-1 text-center">
                              <div className={`p-2.5 rounded-md text-xs font-tabular transition-transform hover:scale-105 ${getHeatmapColor(val)}`}>
                                {val != null ? `₹${val.toLocaleString()}` : 'N/A'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-ink-50 p-4 rounded-lg border border-ink-100 flex items-start space-x-3 text-xs text-ink-500">
              <Info className="w-4 h-4 text-navy-700 shrink-0 mt-0.5" />
              <p>
                <strong>Statistical Insight for Inflation Analysts:</strong> Fares experience severe non-linear escalation within $T+7$ window due to airline revenue management algorithms. Tracking $T+15$ and $T+30$ provides a more stable baseline for core CPI inflation calculation.
              </p>
            </div>
          </div>
        )}

        {/* ELASTICITY SECTION */}
        {activeTab === 'elasticity' && (
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-ink-900">Booking Window Lead-Time Elasticity Curve</h3>

            {!DEMO_MODE && trends.loading && <LoadingPanel label="Computing elasticity curve across DGCA basket..." />}
            {!DEMO_MODE && trends.error && <ErrorPanel message={trends.error} onRetry={trends.refetch} />}

            {(DEMO_MODE || (!trends.loading && !trends.error)) && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={DEMO_MODE ? ELASTICITY_DATA : trends.data?.elasticity ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7ebf1" />
                    <XAxis dataKey="window" stroke="#7c8aa3" fontSize={12} tickLine={false} />
                    <YAxis domain={['auto', 'auto']} stroke="#7c8aa3" fontSize={12} tickLine={false} />
                    <Tooltip formatter={(val) => [`₹${val ?? ''}`, 'Average Price']} contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7ebf1', borderRadius: '10px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="avgFare" stroke="#003f87" fill="#eef3fa" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex items-center space-x-3 text-xs text-emerald-900">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
              {DEMO_MODE || !trends.data?.optimalWindow ? (
                <div>
                  <span className="font-semibold block">Sweet Spot Recommendation:</span>
                  Booking 15 to 30 days in advance consistently yields lower fares than last-minute (T+1) pricing across the monitored basket.
                </div>
              ) : (
                <div>
                  <span className="font-semibold block">
                    Optimal Booking Window: {trends.data.optimalWindow.optimalWindow}
                  </span>
                  Average fare ₹{trends.data.optimalWindow.optimalAvgFare.toLocaleString('en-IN')} at{' '}
                  {trends.data.optimalWindow.optimalWindow} vs ₹
                  {trends.data.optimalWindow.worstAvgFare.toLocaleString('en-IN')} at{' '}
                  {trends.data.optimalWindow.worstWindow} — a saving of{' '}
                  ₹{trends.data.optimalWindow.savingsAmount.toLocaleString('en-IN')} (
                  {trends.data.optimalWindow.savingsPct}%) across the monitored basket.
                </div>
              )}
            </div>
          </div>
        )}

        {/* VOLATILITY SECTION WITH CHART */}
        {activeTab === 'volatility' && (
          <div className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-900 flex items-center">
                  <Activity className="w-4 h-4 mr-1.5 text-navy-700" />
                  Corridor Price Volatility (Booking-Window Fare Spread)
                </h3>
                <p className="text-xs text-ink-500">
                  Coefficient of variation across each corridor&apos;s T+1..T+45 average fares. Higher values indicate
                  aggressive lead-time-based pricing.
                </p>
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-rose-600 rounded-md mr-1"></span> High (&gt;16%)</span>
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-navy-700 rounded-md mr-1"></span> Moderate (10–16%)</span>
                <span className="flex items-center text-ink-700"><span className="w-3 h-3 bg-emerald-600 rounded-md mr-1"></span> Low/Stable (&lt;10%)</span>
              </div>
            </div>

            {!DEMO_MODE && trends.loading && <LoadingPanel label="Computing volatility index..." />}
            {!DEMO_MODE && trends.error && <ErrorPanel message={trends.error} onRetry={trends.refetch} />}

            {(DEMO_MODE || (!trends.loading && !trends.error)) && (
              <div className="panel h-[280px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={
                      DEMO_MODE
                        ? [
                            { corridor: 'DEL-BOM', volatility: 22.4 },
                            { corridor: 'MAA-DEL', volatility: 19.8 },
                            { corridor: 'DEL-BLR', volatility: 18.1 },
                            { corridor: 'BOM-BLR', volatility: 11.5 },
                            { corridor: 'BLR-HYD', volatility: 8.2 },
                          ]
                        : (trends.data?.volatility ?? []).map((v) => ({ corridor: v.corridor, volatility: v.volatilityPct }))
                    }
                    margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7ebf1" vertical={false} />
                    <XAxis dataKey="corridor" stroke="#7c8aa3" fontSize={11} tickLine={false} />
                    <YAxis unit="%" domain={[0, 'auto']} stroke="#7c8aa3" fontSize={11} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7ebf1', borderRadius: '10px', fontSize: '12px' }}
                      formatter={(val) => [`${val}%`, 'Volatility Index']}
                    />
                    <Bar dataKey="volatility" radius={[4, 4, 0, 0]}>
                      {(DEMO_MODE
                        ? [22.4, 19.8, 18.1, 11.5, 8.2]
                        : (trends.data?.volatility ?? []).map((v) => v.volatilityPct)
                      ).map((val, index) => (
                        <Cell key={`cell-${index}`} fill={val > 16 ? '#e11d48' : val >= 10 ? '#003f87' : '#059669'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/40 text-xs">
              <h4 className="font-semibold text-amber-900 mb-2 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                Reading This Chart
              </h4>
              <p className="text-[11px] text-ink-500">
                Volatility here is derived from the spread between a corridor&apos;s cheapest (T+45) and most urgent (T+1)
                average fares — a proxy for revenue-management aggressiveness, not intraday price capture.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
