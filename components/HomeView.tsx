'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceDot } from 'recharts';
import { INITIAL_INDEX_DATA, POPULAR_ROUTES } from '@/lib/mockData';
import { ArrowUpRight, TrendingUp, CheckCircle2, FileText, ArrowRight, ShieldCheck, Info, AlertCircle, Flame, Calendar, Fuel } from 'lucide-react';
import { TabType } from './Header';

// 30-Day, 90-Day, and 1-Year historical datasets for dynamic timeline switching
const INDEX_DATA_30D = INITIAL_INDEX_DATA;

const INDEX_DATA_90D = [
  { date: 'Jun 20', apixValue: 94.5, dgcaBenchmark: 94.2, minFare: 2950, maxFare: 7800, avgFare: 4210 },
  { date: 'Jun 30', apixValue: 95.8, dgcaBenchmark: 95.3, minFare: 3000, maxFare: 7950, avgFare: 4280 },
  { date: 'Jul 10', apixValue: 96.4, dgcaBenchmark: 96.0, minFare: 3050, maxFare: 8050, avgFare: 4320 },
  { date: 'Jul 20', apixValue: 97.1, dgcaBenchmark: 96.8, minFare: 3080, maxFare: 8120, avgFare: 4360 },
  { date: 'Jul 30', apixValue: 97.6, dgcaBenchmark: 97.2, minFare: 3100, maxFare: 8180, avgFare: 4390 },
  { date: 'Aug 10', apixValue: 98.0, dgcaBenchmark: 97.6, minFare: 3120, maxFare: 8220, avgFare: 4410 },
  { date: 'Aug 20', apixValue: 99.2, dgcaBenchmark: 98.8, minFare: 3180, maxFare: 8380, avgFare: 4490 },
  { date: 'Aug 30', apixValue: 101.2, dgcaBenchmark: 100.9, minFare: 3280, maxFare: 8650, avgFare: 4680 },
  { date: 'Sep 10', apixValue: 102.2, dgcaBenchmark: 101.9, minFare: 3370, maxFare: 8840, avgFare: 4820 },
  { date: 'Sep 20', apixValue: 102.5, dgcaBenchmark: 102.1, minFare: 3400, maxFare: 8900, avgFare: 4850 },
];

const INDEX_DATA_1Y = [
  { date: 'Oct 24', apixValue: 91.2, dgcaBenchmark: 91.0, minFare: 2800, maxFare: 7400, avgFare: 4020 },
  { date: 'Dec 24', apixValue: 98.8, dgcaBenchmark: 98.2, minFare: 3200, maxFare: 8600, avgFare: 4620 },
  { date: 'Feb 25', apixValue: 93.4, dgcaBenchmark: 93.1, minFare: 2900, maxFare: 7600, avgFare: 4150 },
  { date: 'Apr 25', apixValue: 95.0, dgcaBenchmark: 94.7, minFare: 2980, maxFare: 7850, avgFare: 4250 },
  { date: 'Jun 25', apixValue: 96.2, dgcaBenchmark: 95.9, minFare: 3020, maxFare: 8000, avgFare: 4330 },
  { date: 'Aug 25', apixValue: 100.4, dgcaBenchmark: 100.0, minFare: 3240, maxFare: 8550, avgFare: 4610 },
  { date: 'Sep 25', apixValue: 102.5, dgcaBenchmark: 102.1, minFare: 3400, maxFare: 8900, avgFare: 4850 },
];

const RANGE_STATS = {
  '30d': { minFare: '₹3,200', maxFare: '₹8,900', avgFare: '₹4,850', mape: '3.12%', obs: '30 Daily Cycles' },
  '90d': { minFare: '₹2,950', maxFare: '₹8,900', avgFare: '₹4,480', mape: '2.84%', obs: '90 Daily Cycles' },
  '1y': { minFare: '₹2,800', maxFare: '₹9,200', avgFare: '₹4,390', mape: '2.61%', obs: '12 Monthly Batches' },
};

interface HomeViewProps {
  onNavigate: (tab: TabType) => void;
}

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [range, setRange] = useState<'30d' | '90d' | '1y'>('30d');

  const chartData = range === '30d' ? INDEX_DATA_30D : range === '90d' ? INDEX_DATA_90D : INDEX_DATA_1Y;
  const currentStats = RANGE_STATS[range];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Section */}
      <div className="bg-white p-6 sm:p-8 rounded-lg border border-[#e5e7eb] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#003f87] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#003f87]" />
            <span>National CPI Augmentation Baseline</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1f2937] tracking-tight">
            102.45
            <span className="ml-3 text-base font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-flex items-center">
              ↑ 1.2% <span className="text-xs font-normal text-[#6b7280] ml-1">from yesterday</span>
            </span>
          </h2>
          <p className="text-xs text-[#6b7280]">
            Airfare Price Index (APIx) • Base Period = 100 (Jan 2025) • Statistically weighted across top 15 DGCA flight corridors
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div
            onClick={() => onNavigate('backtest')}
            className="bg-[#f9fafb] hover:bg-emerald-50/50 hover:border-emerald-300 p-3.5 rounded border border-[#e5e7eb] text-xs space-y-1 cursor-pointer transition-all group"
            title="Click to view full 30-day DGCA backtesting & validation analysis"
          >
            <div className="flex items-center justify-between">
              <span className="text-[#6b7280] block font-medium">DGCA Backtest Correlation</span>
              <span className="text-[10px] text-emerald-700 font-semibold group-hover:underline flex items-center">
                View 30D Analysis &rarr;
              </span>
            </div>
            <span className="text-base font-bold text-emerald-700 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> r = 0.892 (Target Met)
            </span>
          </div>
          <div className="bg-[#f9fafb] p-3.5 rounded border border-[#e5e7eb] text-xs space-y-1">
            <span className="text-[#6b7280] block font-medium">Scrape Coverage</span>
            <span className="text-base font-bold text-[#003f87] flex items-center">
              5 Airlines • 3 OTAs
            </span>
          </div>
        </div>
      </div>

      {/* Main Index Trend Chart Section */}
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f3f4f6] pb-4">
          <div>
            <h3 className="text-lg font-bold text-[#1f2937] flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-[#003f87]" />
              Airfare Price Index (APIx) vs. Official DGCA Benchmark
            </h3>
            <p className="text-xs text-[#6b7280]">
              Overlaying daily scraped fare index against published monthly DGCA averages for policy validation ({range.toUpperCase()} window)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {(['30d', '90d', '1y'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer ${
                  range === r
                    ? 'bg-[#003f87] text-white shadow-xs'
                    : 'bg-[#f9fafb] text-[#6b7280] hover:bg-[#e5e7eb] hover:text-[#1f2937]'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} />
                <YAxis domain={['auto', 'auto']} stroke="#6b7280" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                  formatter={(value, name) => [String(value ?? ''), name === 'apixValue' ? 'APIx Scraped Index' : 'DGCA Official Baseline']}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="apixValue" stroke="#003f87" strokeWidth={2.5} dot={{ r: 4, fill: '#003f87' }} name="APIx Scraped Index (Daily)" />
                <Line type="monotone" dataKey="dgcaBenchmark" stroke="#0284c7" strokeWidth={2} strokeDasharray="5 5" dot={false} name="DGCA Official Benchmark" />

                {/* Event Anomaly Markers */}
                {range === '30d' && (
                  <ReferenceDot x="Aug 30" y={101.2} r={6} fill="#ea580c" stroke="#ffffff" strokeWidth={2} />
                )}
                {range === '30d' && (
                  <ReferenceDot x="Sep 14" y={102.45} r={6} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                )}
                {range === '90d' && (
                  <ReferenceDot x="Aug 30" y={101.2} r={6} fill="#ea580c" stroke="#ffffff" strokeWidth={2} />
                )}
                {range === '1y' && (
                  <ReferenceDot x="Dec 24" y={98.8} r={6} fill="#dc2626" stroke="#ffffff" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Key Stats Side Panel */}
          <div className="bg-[#f9fafb] p-4 rounded-md border border-[#e5e7eb] space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-[#1f2937] uppercase tracking-wider mb-3">
                Key Statistics ({range.toUpperCase()})
              </h4>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#e5e7eb]">
                  <dt className="text-[#6b7280]">Minimum Fare Observed:</dt>
                  <dd className="font-bold text-[#1f2937]">{currentStats.minFare}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[#e5e7eb]">
                  <dt className="text-[#6b7280]">Maximum Fare Observed:</dt>
                  <dd className="font-bold text-[#1f2937]">{currentStats.maxFare}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[#e5e7eb]">
                  <dt className="text-[#6b7280]">Average Corridor Fare:</dt>
                  <dd className="font-bold text-[#003f87]">{currentStats.avgFare}</dd>
                </div>
                <div className="flex justify-between py-1 border-b border-[#e5e7eb]">
                  <dt className="text-[#6b7280]">Mean Abs % Error (MAPE):</dt>
                  <dd className="font-bold text-emerald-700">{currentStats.mape}</dd>
                </div>
                <div className="flex justify-between py-1">
                  <dt className="text-[#6b7280]">Observation Depth:</dt>
                  <dd className="font-medium text-[#1f2937]">{currentStats.obs}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white p-3 rounded border border-[#e5e7eb] text-[11px] text-[#6b7280]">
              <span className="font-semibold text-[#1f2937] flex items-center gap-1 mb-1">
                <Info className="w-3.5 h-3.5 text-[#003f87]" /> Methodological Note
              </span>
              Route weights are derived from DGCA monthly passenger traffic distribution (e.g. DEL-BOM = 18%).
            </div>
          </div>
        </div>

        {/* Anomaly Explainability Panel (PRD Sec 12.2: Turning Numbers Into A Story) */}
        <div className="border-t border-[#f3f4f6] pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-[#1f2937] uppercase tracking-wider flex items-center">
              <AlertCircle className="w-4 h-4 mr-1.5 text-amber-600" />
              Automated Anomaly Explainability & Spike Tagger (Rules Engine)
            </h4>
            <span className="text-[11px] text-[#6b7280] font-mono">
              Auto-correlated with Ministry calendars & petroleum data
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start space-x-3 text-xs">
              <div className="w-7 h-7 rounded bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950">Late Aug Spike (+2.3%)</span>
                  <span className="text-[10px] font-mono bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded">Aug 27–30</span>
                </div>
                <p className="text-[11px] text-amber-900/80 mt-1 leading-snug">
                  <strong>Trigger:</strong> Janmashtami & Ganesh Chaturthi long weekend travel surge on DEL-BOM and BOM-GOI corridors.
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-lg flex items-start space-x-3 text-xs">
              <div className="w-7 h-7 rounded bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                <Fuel className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-950">Fuel Surcharge Shift</span>
                  <span className="text-[10px] font-mono bg-rose-200/80 text-rose-900 px-1.5 py-0.2 rounded">Sep 01</span>
                </div>
                <p className="text-[11px] text-rose-900/80 mt-1 leading-snug">
                  <strong>Trigger:</strong> +3.2% Aviation Turbine Fuel (ATF) price hike notification issued by OMCs, pass-through into base fare.
                </p>
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-start space-x-3 text-xs">
              <div className="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950">Current Elevation (102.45)</span>
                  <span className="text-[10px] font-mono bg-blue-200/80 text-blue-900 px-1.5 py-0.2 rounded">Sep 14</span>
                </div>
                <p className="text-[11px] text-blue-900/80 mt-1 leading-snug">
                  <strong>Trigger:</strong> Advanced pre-booking compression for Dussehra & Diwali festive corridors (T+30 / T+45 window).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Most Searched Corridors */}
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1f2937]">High-Density Flight Corridors (DGCA Basket)</h3>
          <button
            onClick={() => onNavigate('routes')}
            className="text-xs text-[#003f87] font-semibold hover:underline flex items-center"
          >
            Explore All Routes <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {POPULAR_ROUTES.map((route) => (
            <div key={route.code} className="p-4 rounded-md border border-[#e5e7eb] bg-[#f9fafb] hover:bg-white hover:border-[#003f87] transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-sm text-[#1f2937] group-hover:text-[#003f87] transition-colors">
                    {route.name}
                  </h4>
                  <span className="text-[11px] text-[#6b7280]">Code: {route.code} • Traffic: {route.volume}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${route.trend.startsWith('+') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {route.trend}
                </span>
              </div>

              <div className="flex justify-between items-end mt-4">
                <div>
                  <span className="text-[10px] text-[#6b7280] block">Average Ticket Fare</span>
                  <span className="text-lg font-bold text-[#1f2937]">₹{route.price.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#6b7280] block">DGCA Weight</span>
                  <span className="text-xs font-semibold text-[#003f87]">{(route.dgcaWeight * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('scrapers')}
          className="bg-white p-5 rounded-lg border border-[#e5e7eb] hover:border-[#003f87] transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-[#e8f4f8] text-[#003f87] flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1f2937] group-hover:text-[#003f87] flex items-center">
            Scraping Engine & Compliance <ArrowUpRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h4>
          <p className="text-xs text-[#6b7280] mt-1">
            Monitor Playwright/Scrapy runs, robots.txt adherence, and CAPTCHA rate-limits.
          </p>
        </div>

        <div
          onClick={() => onNavigate('analysis')}
          className="bg-white p-5 rounded-lg border border-[#e5e7eb] hover:border-[#003f87] transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-[#e8f4f8] text-[#003f87] flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1f2937] group-hover:text-[#003f87] flex items-center">
            Market Heatmap & Elasticity <ArrowUpRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h4>
          <p className="text-xs text-[#6b7280] mt-1">
            Analyze route x booking window pricing matrix (T+1 to T+45 lead time).
          </p>
        </div>

        <div
          onClick={() => onNavigate('api')}
          className="bg-white p-5 rounded-lg border border-[#e5e7eb] hover:border-[#003f87] transition-all cursor-pointer group"
        >
          <div className="w-8 h-8 rounded bg-[#e8f4f8] text-[#003f87] flex items-center justify-center mb-3">
            <FileText className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-sm text-[#1f2937] group-hover:text-[#003f87] flex items-center">
            REST API & OpenAPI Docs <ArrowUpRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </h4>
          <p className="text-xs text-[#6b7280] mt-1">
            Direct REST endpoints for NSO statisticians and RBI monetary policy consumption.
          </p>
        </div>
      </div>
    </div>
  );
}
