'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { HEATMAP_DATA, ELASTICITY_DATA } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { Grid, Activity, Layers, Scales, Elasticity } from './icons';
import { Callout } from './ui/callout';

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
    ci_lower?: number;
    ci_upper?: number;
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

  const SECTIONS = [
    { id: 'statistical-rigor', label: 'Index Rigor', icon: Layers },
    { id: 'cross-source', label: 'Cross-Source Audit', icon: Scales },
    { id: 'heatmap', label: 'Route Heatmap', icon: Grid },
    { id: 'elasticity', label: 'Elasticity', icon: Elasticity },
    { id: 'volatility', label: 'Volatility', icon: Activity },
  ] as const;

  return (
    <div className="space-y-6 animate-fadeIn">
      {DEMO_MODE && (
        <Callout tone="warning">
          Demo mode - showing static sample data, not live APIx backend results.
        </Callout>
      )}

      {/* Tab Header */}
      <div className="panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Market Analysis</h2>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-ink-100 -mx-6 px-6">
          {SECTIONS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`relative shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  isActive ? 'text-navy-800' : 'text-ink-500 hover:text-ink-800'
                }`}
              >
                <Icon weight={isActive ? 'fill' : 'regular'} className="w-3.75 h-3.75" />
                <span className={isActive ? 'font-semibold' : ''}>{t.label}</span>
                {isActive && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-navy-700" />}
              </button>
            );
          })}
        </div>

        {/* STATISTICAL RIGOR PANEL: Laspeyres vs. Fisher Ideal Index */}
        {activeTab === 'statistical-rigor' && (
          <div className="space-y-6 pt-2">
            {!DEMO_MODE && dailyIndex.loading && <LoadingPanel label="Loading latest daily Laspeyres/Fisher index..." />}
            {!DEMO_MODE && dailyIndex.error && <ErrorPanel message={dailyIndex.error} onRetry={dailyIndex.refetch} />}

            {(DEMO_MODE || (!dailyIndex.loading && !dailyIndex.error)) && (
              <>
                {/* Route Weighting Basket Derivation Table */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-ink-900">Corridor Sector Contributions</h4>
                  <p className="text-xs text-ink-500">
                    Weighted contribution of each DGCA corridor to today&apos;s Fisher index.
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

                <Callout tone="success" title="Methodology Note">
                  A naive arithmetic average of scraped fares is upward-biased by low-volume luxury flights. APIx instead uses <strong className="text-ink-900">elementary Jevons geometric means</strong> aggregated via <strong className="text-ink-900">DGCA traffic weights</strong>, per MoSPI&apos;s official CPI methodology.
                </Callout>
              </>
            )}
          </div>
        )}

        {/* CROSS-SOURCE DIFF SECTION (IndiGo-direct vs MakeMyTrip) */}
        {activeTab === 'cross-source' && (
          <div className="space-y-5 pt-2">
            <div className="bg-ink-50 border border-ink-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-ink-900 text-sm">Cross-Source Fee Audit: Direct vs. OTA</span>
                <p className="text-ink-500 mt-1">
                  Compares direct-carrier and OTA fixtures for the same flight to isolate consumer markup before
                  CPI basket inclusion.
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <select
                  value={sourceRoute}
                  onChange={(e) => setSourceRoute(e.target.value)}
                  className="text-xs font-mono px-2 py-1.5 rounded-lg border border-ink-200 bg-white cursor-pointer"
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
                          <span className="text-navy-700 text-[11px] font-mono">{row.flightNo}</span>
                        </td>
                        <td className="p-3 text-ink-500">{row.departureDate}</td>
                        <td className="p-3 text-right font-medium font-tabular">₹{row.directTotal.toLocaleString()}</td>
                        <td className="p-3 text-right font-medium text-ink-900 font-tabular">₹{row.mmtTotal.toLocaleString()}</td>
                        <td className="p-3 text-right font-semibold text-amber-700 font-tabular">
                          {row.markup >= 0 ? '+' : ''}₹{row.markup} <span className="text-[10px] text-amber-600 block font-normal">(Convenience Fee)</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-block text-[10px] font-mono text-emerald-700" title={row.auditRefDirect}>
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

            <Callout tone="info" title="Methodology Distinction for NSO/MoSPI">
              Direct carrier scrapers (IndiGo) capture base fare and mandatory UDF/CUTE charges. OTA scrapers (MakeMyTrip) capture total consumer out-of-pocket costs including non-refundable convenience charges. The difference is isolated here to preserve pure price index integrity vs. retail expenditure tracking.
            </Callout>
          </div>
        )}

        {/* HEATMAP SECTION */}
        {activeTab === 'heatmap' && (
          <div className="space-y-4 pt-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-ink-900">Fare Matrix: Route vs. Booking Window (₹ Average)</h3>
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

            <Callout tone="info" title="Statistical Insight for Inflation Analysts">
              Fares experience severe non-linear escalation within the T+7 window due to airline revenue management algorithms. Tracking T+15 and T+30 provides a more stable baseline for core CPI inflation calculation.
            </Callout>
          </div>
        )}

        {/* ELASTICITY SECTION */}
        {activeTab === 'elasticity' && (
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-ink-900">Lead-Time Elasticity Curve</h3>

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

            <Callout
              tone="success"
              title={
                DEMO_MODE || !trends.data?.optimalWindow
                  ? 'Sweet Spot Recommendation'
                  : `Optimal Booking Window: ${trends.data.optimalWindow.optimalWindow}`
              }
            >
              {DEMO_MODE || !trends.data?.optimalWindow ? (
                <>Booking 15 to 30 days in advance consistently yields lower fares than last-minute (T+1) pricing across the monitored basket.</>
              ) : (
                <>
                  Average fare ₹{trends.data.optimalWindow.optimalAvgFare.toLocaleString('en-IN')} at{' '}
                  {trends.data.optimalWindow.optimalWindow} vs ₹
                  {trends.data.optimalWindow.worstAvgFare.toLocaleString('en-IN')} at{' '}
                  {trends.data.optimalWindow.worstWindow} - a saving of{' '}
                  ₹{trends.data.optimalWindow.savingsAmount.toLocaleString('en-IN')} (
                  {trends.data.optimalWindow.savingsPct}%) across the monitored basket.
                </>
              )}
            </Callout>
          </div>
        )}

        {/* VOLATILITY SECTION WITH CHART */}
        {activeTab === 'volatility' && (
          <div className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Corridor Price Volatility</h3>
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
              <div className="h-[280px]">
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

            <Callout tone="warning" title="Reading This Chart">
              Volatility here is derived from the spread between a corridor&apos;s cheapest (T+45) and most urgent (T+1)
              average fares - a proxy for revenue-management aggressiveness, not intraday price capture.
            </Callout>
          </div>
        )}
      </div>
    </div>
  );
}
