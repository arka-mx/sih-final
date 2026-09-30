'use client';

import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { AIRLINE_COMPARISON, ELASTICITY_DATA, POPULAR_ROUTES } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { Download, Funnel as Filter, ShareNetwork as Share2, Check, Calendar, AirplaneTakeoff as PlaneTakeoff } from '@phosphor-icons/react';

interface ApiFareRecord {
  id: string;
  airline: string;
  date: string;
  bookingWindow: string;
  totalFare: number;
}

interface FaresApiResponse {
  totalCount: number;
  summary: { median_fare: number; iqr_spread: number; min_fare: number; max_fare: number } | null;
  fares: ApiFareRecord[];
}

interface RouteMetaItem {
  pair: string;
  origin: string;
  originName: string;
  destination: string;
  destinationName: string;
}

interface RouteMetadataResponse {
  routes: RouteMetaItem[];
}

// Fallback list used until the live route basket loads (or in demo mode) —
// keeps the picker limited to routes that actually exist in the DGCA basket,
// instead of letting origin/destination be chosen independently, which let
// users land on unmonitored pairs like BOM-DEL or CCU-HYD that 404.
const FALLBACK_ROUTES: RouteMetaItem[] = POPULAR_ROUTES.map((r) => {
  const [origin, destination] = r.code.split('-');
  const [originName, destinationName] = r.name.split(' ↔ ');
  return { pair: r.code, origin, originName, destination, destinationName };
});

const WINDOWS = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'] as const;
const WINDOW_LABELS: Record<string, string> = {
  'T+1': '1 Day (Last Minute)',
  'T+7': '7 Days Advance',
  'T+15': '15 Days Advance',
  'T+30': '30 Days Advance',
  'T+45': '45 Days Advance',
};

export default function RouteExplorerView() {
  const routeMeta = useApiData<RouteMetadataResponse>(DEMO_MODE ? null : '/api/metadata/routes', []);
  const availableRoutes = routeMeta.data?.routes.length ? routeMeta.data.routes : FALLBACK_ROUTES;

  const [pair, setPair] = useState('DEL-BOM');
  const [windowFilter, setWindowFilter] = useState<'T+1' | 'T+7' | 'T+15' | 'T+30' | 'T+45'>('T+7');
  const [linkCopied, setLinkCopied] = useState(false);

  // The default selection ('DEL-BOM') is present in both the fallback list
  // and every real route basket, so no reconciliation effect is needed —
  // just fall back to the first available route if a stale pair ever isn't found.
  const selectedRoute = availableRoutes.find((r) => r.pair === pair) ?? availableRoutes[0];
  const fromCity = selectedRoute?.origin ?? pair.split('-')[0];
  const toCity = selectedRoute?.destination ?? pair.split('-')[1];

  const handleShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('route', pair);
    url.searchParams.set('window', windowFilter);
    navigator.clipboard.writeText(url.toString());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const routeFares = useApiData<FaresApiResponse>(
    DEMO_MODE ? null : `/api/fares?route=${pair}&window=${windowFilter}&limit=30`,
    [pair, windowFilter]
  );

  // Fetch all 5 windows in parallel to build the route-specific elasticity curve.
  const elasticityUrls = WINDOWS.map((w) => `/api/fares?route=${pair}&window=${w}&limit=15`);
  const w1 = useApiData<FaresApiResponse>(DEMO_MODE ? null : elasticityUrls[0], [pair]);
  const w7 = useApiData<FaresApiResponse>(DEMO_MODE ? null : elasticityUrls[1], [pair]);
  const w15 = useApiData<FaresApiResponse>(DEMO_MODE ? null : elasticityUrls[2], [pair]);
  const w30 = useApiData<FaresApiResponse>(DEMO_MODE ? null : elasticityUrls[3], [pair]);
  const w45 = useApiData<FaresApiResponse>(DEMO_MODE ? null : elasticityUrls[4], [pair]);
  const windowResults = [w1, w7, w15, w30, w45];

  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);

  const routeElasticity = WINDOWS.map((w, idx) => ({
    window: w,
    label: WINDOW_LABELS[w],
    avgFare: avg(windowResults[idx].data?.fares.map((f) => f.totalFare) ?? []),
  }));

  const routeAirlines = useMemo(() => {
    const fares = routeFares.data?.fares ?? [];
    const byCarrier: Record<string, { total: number; count: number }> = {};
    for (const f of fares) {
      if (!byCarrier[f.airline]) byCarrier[f.airline] = { total: 0, count: 0 };
      byCarrier[f.airline].total += f.totalFare;
      byCarrier[f.airline].count += 1;
    }
    const totalRecords = fares.length;
    return Object.entries(byCarrier)
      .map(([name, { total, count }]) => ({
        name,
        avgPrice: Math.round(total / count),
        marketShare: totalRecords ? `${((count / totalRecords) * 100).toFixed(0)}%` : '0%',
        observations: count,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice);
  }, [routeFares.data]);

  // Build a price-by-scrape-date trend from the individual fare records.
  const chartData = useMemo(() => {
    const fares = routeFares.data?.fares ?? [];
    const byDate: Record<string, number[]> = {};
    for (const f of fares) {
      if (!byDate[f.date]) byDate[f.date] = [];
      byDate[f.date].push(f.totalFare);
    }
    return Object.entries(byDate)
      .map(([date, prices]) => ({ date, price: Math.round(avg(prices) ?? 0) }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [routeFares.data]);

  const handleDownloadCSV = () => {
    let csv = 'Date,Route,Window,Price\n';
    chartData.forEach((row) => {
      csv += `${row.date},${pair},${windowFilter},${row.price}\n`;
    });
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `route_${fromCity}_${toCity}_${windowFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = !DEMO_MODE && routeFares.loading;
  const hasError = !DEMO_MODE && routeFares.error;

  const displayAirlines = DEMO_MODE ? AIRLINE_COMPARISON : routeAirlines;
  const displayElasticity = DEMO_MODE ? ELASTICITY_DATA : routeElasticity;
  const summary = routeFares.data?.summary;

  return (
    <div className="space-y-6 animate-fadeIn">
      {DEMO_MODE && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl">
          Demo mode — showing static sample data, not live APIx backend results.
        </div>
      )}

      {/* Route Filter Controls */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center gap-2 text-navy-700 font-semibold text-sm">
          <Filter className="w-4 h-4" />
          <span>Route & Booking Window Explorer</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-ink-900 block mb-1">Route (DGCA-monitored basket):</label>
            <div className="relative">
              <PlaneTakeoff className="w-4 h-4 absolute left-3 top-3 text-ink-500" />
              <select
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-ink-200 rounded-lg bg-white focus:outline-none focus:border-navy-700 focus:ring-1 focus:ring-navy-700"
              >
                {availableRoutes.map((r) => (
                  <option key={r.pair} value={r.pair}>
                    {r.originName} ({r.origin}) → {r.destinationName} ({r.destination})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-ink-500 mt-1">
              Limited to the {availableRoutes.length} routes actually tracked in the DGCA-weighted basket — other
              city pairs aren&apos;t scraped yet.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-900 block mb-1">Departure Date:</label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-3 text-ink-500" />
              <input
                type="date"
                defaultValue="2026-09-14"
                className="w-full pl-9 pr-3 py-2 text-xs border border-ink-200 rounded-lg bg-white focus:outline-none focus:border-navy-700"
              />
            </div>
          </div>
        </div>

        {/* Advance Purchase Buttons */}
        <div className="pt-2 border-t border-ink-100">
          <span className="text-xs font-semibold text-ink-900 block mb-2">Advance Purchase Window (Lead Time):</span>
          <div className="flex flex-wrap gap-1 bg-ink-50 border border-ink-100 rounded-lg p-1 w-fit">
            {WINDOWS.map((win) => (
              <button
                key={win}
                onClick={() => setWindowFilter(win)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  windowFilter === win
                    ? 'bg-white text-navy-800 shadow-panel'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {WINDOW_LABELS[win]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && <LoadingPanel label={`Loading simulated fares for ${pair}...`} />}
      {hasError && <ErrorPanel message={routeFares.error!} onRetry={routeFares.refetch} />}

      {(DEMO_MODE || (!isLoading && !hasError)) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 panel p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-ink-100 pb-3">
              <div>
                <h3 className="text-base font-semibold text-ink-900 font-mono">
                  {fromCity} → {toCity} | {windowFilter} Lead Time Trend
                </h3>
                <p className="text-xs text-ink-500">
                  {summary
                    ? `Observed price range: ₹${Math.round(summary.min_fare).toLocaleString()} to ₹${Math.round(
                        summary.max_fare
                      ).toLocaleString()}`
                    : 'Observed price range unavailable'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-ink-500">Median Fare</span>
                <span className="text-base font-semibold text-navy-700 block font-tabular">
                  {summary ? `₹${Math.round(summary.median_fare).toLocaleString()}` : '—'}
                </span>
              </div>
            </div>

            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7ebf1" />
                  <XAxis dataKey="date" stroke="#7c8aa3" fontSize={12} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} stroke="#7c8aa3" fontSize={12} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e7ebf1', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(val) => [`₹${val ?? ''}`, 'Average Fare']}
                  />
                  <Line type="monotone" dataKey="price" stroke="#003f87" strokeWidth={2.5} dot={{ r: 4, fill: '#003f87' }} />
                </LineChart>
              </ResponsiveContainer>
              {chartData.length === 0 && (
                <p className="text-xs text-center text-ink-500 -mt-32">No scraped observations for this window yet.</p>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-ink-100">
              <div className="flex space-x-2">
                <button
                  onClick={handleDownloadCSV}
                  className="text-xs font-semibold text-navy-700 border border-ink-200 px-3 py-1.5 rounded-lg hover:bg-ink-50 flex items-center cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Download CSV
                </button>
                <button
                  onClick={handleShareLink}
                  className="text-xs font-semibold text-ink-700 border border-ink-200 px-3 py-1.5 rounded-lg hover:bg-ink-50 flex items-center cursor-pointer transition-colors"
                >
                  {linkCopied ? (
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  {linkCopied ? 'Link Copied' : 'Share Route Link'}
                </button>
              </div>
              <span className="text-[11px] text-ink-500">
                IQR Spread: <strong className="text-ink-900 font-tabular">{summary ? `₹${Math.round(summary.iqr_spread).toLocaleString()}` : '—'}</strong>
              </span>
            </div>
          </div>

          {/* Airline Breakdown Panel */}
          <div className="panel p-6 space-y-4">
            <h3 className="text-base font-semibold text-ink-900 border-b border-ink-100 pb-2 font-mono">
              Airline Price Comparison ({fromCity}–{toCity})
            </h3>

            <div className="space-y-3">
              {displayAirlines.map((air) => (
                <div key={air.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-ink-900">{air.name}</span>
                    <span className="font-semibold text-navy-700 font-tabular">₹{air.avgPrice.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-ink-100 overflow-hidden">
                    <div
                      className="h-full transition-all bg-navy-700"
                      style={{ width: `${Math.min((air.avgPrice / 9000) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-500">
                    <span className="font-tabular">Market Share: {air.marketShare}</span>
                  </div>
                </div>
              ))}
              {displayAirlines.length === 0 && (
                <p className="text-xs text-ink-500">No carrier data for this route yet.</p>
              )}
            </div>

            <div className="pt-3 border-t border-ink-100 space-y-2">
              <h4 className="text-xs font-semibold text-ink-900">Lead Time Price Progression</h4>
              <div className="space-y-1 text-xs">
                {displayElasticity.map((e) => (
                  <div key={e.window} className="flex justify-between py-1 border-b border-ink-50">
                    <span className="text-ink-500">{e.label}:</span>
                    <span className="font-semibold text-ink-900 font-tabular">{e.avgFare != null ? `₹${Math.round(e.avgFare).toLocaleString()}` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
