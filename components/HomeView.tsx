'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { POPULAR_ROUTES, INITIAL_INDEX_DATA } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { ArrowUpRight, TrendUp as TrendingUp, CheckCircle as CheckCircle2, FileText, ArrowRight, ShieldCheck, Info, WarningCircle as AlertCircle, Flame, Calendar, GasPump as Fuel } from '@phosphor-icons/react';
import { TabType } from './Sidebar';

interface TrendPoint {
  date: string;
  apixIndex: number;
  dgcaAvgFare: number;
  variancePct: number;
  ciLower?: number;
  ciUpper?: number;
  ciRange?: [number, number];
}

interface TrendResponse {
  period: { start: string; end: string; total_days: number };
  metrics: { pearson_r: number; mape: number; rmse: number; target_met: boolean };
  stats: { minFare: number | null; maxFare: number | null; avgFare: number | null };
  points: TrendPoint[];
}

interface PublicSummaryResponse {
  latestDailyIndex: number;
  latestMonthlyIndex: number;
  momChangePct: number;
  yoyChangePct: number;
  topRoutes: { pair: string; index: number; currentAvgFare: number; trend: string }[];
}

interface AnomalyTag {
  cause: string;
  label: string;
  confidence: string;
  detail: string;
}

interface AnomalySpike {
  date: string;
  indexValue: number;
  dayChangePct: number;
  zScore: number;
  tags: AnomalyTag[];
}

interface AnomalyResponse {
  windowStart: string;
  windowEnd: string;
  totalDays: number;
  zThreshold: number;
  spikes: AnomalySpike[];
  methodologyNote: string;
}

const ANOMALY_CAUSE_STYLES: Record<string, { icon: typeof Calendar; wrap: string; iconWrap: string; title: string; body: string }> = {
  FESTIVAL_CALENDAR_MATCH: {
    icon: Calendar,
    wrap: 'bg-amber-50/70 border-amber-200',
    iconWrap: 'bg-amber-100 text-amber-700',
    title: 'text-amber-950',
    body: 'text-amber-900/80',
  },
  ATF_FUEL_PRICE_REVISION: {
    icon: Fuel,
    wrap: 'bg-rose-50/70 border-rose-200',
    iconWrap: 'bg-rose-100 text-rose-700',
    title: 'text-rose-950',
    body: 'text-rose-900/80',
  },
  UNEXPLAINED_STATISTICAL_VOLATILITY: {
    icon: Flame,
    wrap: 'bg-navy-50/70 border-navy-200',
    iconWrap: 'bg-navy-100 text-navy-700',
    title: 'text-navy-950',
    body: 'text-navy-900/80',
  },
};

interface HomeViewProps {
  onNavigate: (tab: TabType) => void;
}

const RANGE_DAYS: Record<'30d' | '90d' | '1y', number> = { '30d': 30, '90d': 90, '1y': 90 };

export default function HomeView({ onNavigate }: HomeViewProps) {
  const [range, setRange] = useState<'30d' | '90d' | '1y'>('30d');

  const trend = useApiData<TrendResponse>(DEMO_MODE ? null : `/api/index?days=${RANGE_DAYS[range]}`, [range]);
  const summary = useApiData<PublicSummaryResponse>(DEMO_MODE ? null : '/api/public/summary');
  const anomalies = useApiData<AnomalyResponse>(DEMO_MODE ? null : '/api/anomalies');

  if (DEMO_MODE) {
    return <HomeViewDemo onNavigate={onNavigate} />;
  }

  const isLoading = trend.loading || summary.loading;
  const hasError = trend.error || summary.error;

  if (isLoading) return <LoadingPanel label="Loading APIx index & DGCA backtest data..." />;
  if (hasError) {
    return (
      <ErrorPanel
        message={trend.error || summary.error || 'Failed to load dashboard data'}
        onRetry={() => {
          trend.refetch();
          summary.refetch();
        }}
      />
    );
  }

  const chartData = trend.data?.points ?? [];
  const stats = trend.data?.stats;
  const metrics = trend.data?.metrics;
  const topRoutes = summary.data?.topRoutes ?? [];
  const latestIndex = summary.data?.latestDailyIndex;
  const momChange = summary.data?.momChangePct;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Section */}
      <div className="panel p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-navy-700 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>National CPI Augmentation Baseline</span>
          </div>
          <h2 className="font-sans text-4xl sm:text-5xl font-semibold text-ink-950 tracking-tighter font-tabular">
            {latestIndex?.toFixed(2) ?? '—'}
            {typeof momChange === 'number' && (
              <span
                className={`ml-4 align-middle text-sm font-sans font-semibold px-2.5 py-1 rounded-lg border inline-flex items-center ${
                  momChange >= 0
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-rose-700 bg-rose-50 border-rose-200'
                }`}
              >
                {momChange >= 0 ? '↑' : '↓'} {Math.abs(momChange)}%{' '}
                <span className="text-xs font-normal text-ink-500 ml-1">MoM</span>
              </span>
            )}
          </h2>
          <p className="text-xs text-ink-500 max-w-md leading-relaxed">
            Base period = 100 (Jan 2025) &middot; Weighted across top DGCA flight corridors
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <button
            onClick={() => onNavigate('backtest')}
            className="text-left bg-ink-50 hover:bg-emerald-50 hover:border-emerald-200 p-4 rounded-xl border border-ink-100 text-xs space-y-1.5 cursor-pointer transition-colors group min-w-[190px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-ink-500 font-medium">DGCA Backtest Correlation</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-ink-300 group-hover:text-emerald-600 transition-colors" />
            </div>
            <span className="text-base font-semibold text-emerald-700 flex items-center gap-1.5 font-tabular">
              <CheckCircle2 className="w-4 h-4" />
              {metrics ? `r = ${metrics.pearson_r.toFixed(3)}` : '—'}
              {metrics?.target_met && <span className="text-[10px] font-sans font-semibold text-emerald-600">TARGET MET</span>}
            </span>
          </button>
          <div className="bg-ink-50 p-4 rounded-xl border border-ink-100 text-xs space-y-1.5 min-w-[150px]">
            <span className="text-ink-500 font-medium block">Tracking Error (MAPE)</span>
            <span className="text-base font-semibold text-navy-800 flex items-center font-tabular">
              {metrics ? `${metrics.mape.toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Index Trend Chart Section */}
      <div className="panel p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-navy-700" />
                APIx vs. Official DGCA Benchmark
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-navy-50 text-navy-700 border border-navy-200">
                <span className="w-1.5 h-1.5 rounded-full bg-navy-600 animate-pulse"></span>
                95% CI Bounded (±1.96 SE)
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-0.5">
              Daily scraped index with statistical confidence bands vs. DGCA average fare &middot; {range.toUpperCase()} window{range === '1y' ? ' (max 90 days)' : ''}
            </p>
          </div>

          <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1 border border-ink-100">
            {(['30d', '90d', '1y'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  range === r
                    ? 'bg-white text-navy-800 shadow-panel'
                    : 'text-ink-500 hover:text-ink-900'
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
              <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="homeCiBandGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003f87" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#003f87" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
                <XAxis dataKey="date" stroke="#7c8aa3" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7ebf1' }} />
                <YAxis yAxisId="left" domain={['auto', 'auto']} stroke="#7c8aa3" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7ebf1' }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as TrendPoint;
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-raised border border-ink-100 text-xs space-y-1.5 z-50">
                          <p className="font-semibold text-ink-900 border-b border-ink-100 pb-1">{label}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-navy-700 font-semibold">APIx Index:</span>
                            <span className="font-tabular font-bold text-ink-950 text-sm">{data.apixIndex.toFixed(2)}</span>
                          </div>
                          {data.ciLower != null && data.ciUpper != null && (
                            <div className="bg-navy-50/70 p-2 rounded-lg border border-navy-100/80 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-navy-800 font-medium">
                                <span>95% Confidence Interval:</span>
                                <span className="font-tabular font-semibold">[{data.ciLower.toFixed(2)} – {data.ciUpper.toFixed(2)}]</span>
                              </div>
                              <div className="text-[10px] text-ink-500">
                                Margin of error: ±{( (data.ciUpper - data.ciLower) / 2 ).toFixed(2)} pts (z = 1.96)
                              </div>
                            </div>
                          )}
                          {data.dgcaAvgFare != null && (
                            <div className="flex items-center justify-between gap-4 pt-0.5 border-t border-ink-100 text-ink-600">
                              <span>DGCA Avg Fare:</span>
                              <span className="font-tabular font-semibold text-amber-700">₹{Math.round(data.dgcaAvgFare).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="ciRange"
                  stroke="#60a5fa"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  fill="url(#homeCiBandGradient)"
                  name="95% Confidence Interval (±1.96 SE)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="apixIndex"
                  stroke="#003f87"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#003f87' }}
                  activeDot={{ r: 5 }}
                  name="APIx Scraped Index (Daily)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Key Stats Side Panel */}
          <div className="bg-ink-50 p-4 rounded-xl border border-ink-100 space-y-4 flex flex-col justify-between">
            <div>
              <h4 className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider mb-3">
                Key Statistics &middot; {range.toUpperCase()}
              </h4>
              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-ink-100">
                  <dt className="text-ink-500">Minimum DGCA Fare</dt>
                  <dd className="font-semibold text-ink-900 font-tabular">
                    {stats?.minFare != null ? `₹${Math.round(stats.minFare).toLocaleString()}` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100">
                  <dt className="text-ink-500">Maximum DGCA Fare</dt>
                  <dd className="font-semibold text-ink-900 font-tabular">
                    {stats?.maxFare != null ? `₹${Math.round(stats.maxFare).toLocaleString()}` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100">
                  <dt className="text-ink-500">Average DGCA Fare</dt>
                  <dd className="font-semibold text-navy-700 font-tabular">
                    {stats?.avgFare != null ? `₹${Math.round(stats.avgFare).toLocaleString()}` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between py-1.5 border-b border-ink-100">
                  <dt className="text-ink-500">Mean Abs % Error</dt>
                  <dd className="font-semibold text-emerald-700 font-tabular">{metrics ? `${metrics.mape.toFixed(2)}%` : '—'}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-500">Observation Depth</dt>
                  <dd className="font-medium text-ink-900 font-tabular">{chartData.length} days</dd>
                </div>
              </dl>
            </div>

            <div className="bg-white p-3 rounded-lg border border-ink-100 text-[11px] text-ink-500 leading-relaxed">
              <span className="font-semibold text-ink-900 flex items-center gap-1.5 mb-1">
                <Info className="w-3.5 h-3.5 text-navy-700" /> Methodological Note
              </span>
              Route weights are derived from DGCA monthly passenger traffic distribution.
            </div>
          </div>
        </div>

        {/* Anomaly Explainability Panel */}
        <div className="border-t border-ink-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[11px] font-semibold text-ink-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Anomaly Explainability &amp; Spike Tagger
            </h4>
            <span className="text-[11px] text-ink-400 font-mono">
              {anomalies.data
                ? `${anomalies.data.windowStart} → ${anomalies.data.windowEnd} · z > ${anomalies.data.zThreshold}`
                : 'pipeline/anomaly_tagger.py'}
            </span>
          </div>

          {anomalies.loading && (
            <p className="text-xs text-ink-500 py-2">Running IQR/Z-score spike detection...</p>
          )}
          {anomalies.error && (
            <p className="text-xs text-rose-700 py-2">Anomaly tagger unavailable: {anomalies.error}</p>
          )}
          {!anomalies.loading && !anomalies.error && anomalies.data && anomalies.data.spikes.length === 0 && (
            <p className="text-xs text-ink-500 py-2">
              No statistically significant day-over-day spikes (IQR/Z-score, z &gt; {anomalies.data.zThreshold}) detected
              in the last {anomalies.data.totalDays} observed days.
            </p>
          )}

          {!anomalies.loading && !anomalies.error && anomalies.data && anomalies.data.spikes.length > 0 && (
            <div className="space-y-3">
              {anomalies.data.spikes.map((spike) => (
                <div key={spike.date} className="border border-ink-100 rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-ink-900 font-tabular">
                      {spike.date} &middot; Index {spike.indexValue.toFixed(2)}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md font-tabular ${spike.dayChangePct >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {spike.dayChangePct >= 0 ? '+' : ''}{spike.dayChangePct.toFixed(2)}% (z={spike.zScore.toFixed(2)})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {spike.tags.map((tag, idx) => {
                      const style = ANOMALY_CAUSE_STYLES[tag.cause] ?? ANOMALY_CAUSE_STYLES.UNEXPLAINED_STATISTICAL_VOLATILITY;
                      const TagIcon = style.icon;
                      return (
                        <div key={idx} className={`p-3 border rounded-lg flex items-start gap-3 text-xs ${style.wrap}`}>
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${style.iconWrap}`}>
                            <TagIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className={`font-semibold ${style.title}`}>
                              {tag.label} <span className="font-normal">({tag.confidence})</span>
                            </span>
                            <p className={`text-[11px] mt-1 leading-snug ${style.body}`}>{tag.detail}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {anomalies.data && (
            <p className="text-[10px] text-ink-400 mt-3 leading-snug">{anomalies.data.methodologyNote}</p>
          )}
        </div>
      </div>

      {/* Most Searched Corridors */}
      <div className="panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">High-Density Flight Corridors (DGCA Basket)</h3>
          <button
            onClick={() => onNavigate('routes')}
            className="text-xs text-navy-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Explore All Routes <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topRoutes.map((route) => (
            <div key={route.pair} className="p-4 rounded-xl border border-ink-100 bg-ink-50 hover:bg-white hover:border-navy-200 hover:shadow-panel transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-sm text-ink-900 group-hover:text-navy-700 transition-colors">
                    {route.pair}
                  </h4>
                  <span className="text-[11px] text-ink-500 font-tabular">APIx Index: {route.index.toFixed(2)}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md font-tabular ${route.trend.startsWith('+') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {route.trend}
                </span>
              </div>

              <div className="flex justify-between items-end mt-4">
                <div>
                  <span className="text-[10px] text-ink-500 block">Average Ticket Fare</span>
                  <span className="text-lg font-semibold text-ink-900 font-tabular">₹{Math.round(route.currentAvgFare).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
          {topRoutes.length === 0 && (
            <p className="text-xs text-ink-500 col-span-full">No route data available yet.</p>
          )}
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { tab: 'scrapers' as TabType, icon: ShieldCheck, title: 'Scraping Engine & Compliance', body: 'Review deterministic fixture runs, data-mode labeling, and pipeline health.' },
          { tab: 'analysis' as TabType, icon: TrendingUp, title: 'Market Heatmap & Elasticity', body: 'Analyze route x booking window pricing matrix (T+1 to T+45 lead time).' },
          { tab: 'api' as TabType, icon: FileText, title: 'REST API & OpenAPI Docs', body: 'Direct REST endpoints for NSO statisticians and RBI monetary policy consumption.' },
        ].map((card) => (
          <button
            key={card.tab}
            onClick={() => onNavigate(card.tab)}
            className="panel text-left p-5 hover:border-navy-200 hover:shadow-raised transition-all cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center mb-3">
              <card.icon className="w-4.5 h-4.5" />
            </div>
            <h4 className="font-semibold text-sm text-ink-900 group-hover:text-navy-700 flex items-center transition-colors">
              {card.title} <ArrowUpRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-ink-500 mt-1 leading-relaxed">{card.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// Demo-mode rendering path (NEXT_PUBLIC_DEMO_MODE=true): static sample data,
// no network calls. Kept minimal and separate from the live-data path above.
function HomeViewDemo({ onNavigate }: HomeViewProps) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
        <Info className="w-3.5 h-3.5" /> Demo mode — showing static sample data, not live APIx backend results.
      </div>
      <div className="panel p-6 sm:p-8 space-y-2">
        <h2 className="font-sans text-4xl font-semibold text-ink-950 tracking-tighter font-tabular">102.45</h2>
        <p className="text-xs text-ink-500">Airfare Price Index (APIx) &middot; Base Period = 100 (Jan 2025)</p>
      </div>
      <div className="panel p-6 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={INITIAL_INDEX_DATA}>
            <defs>
              <linearGradient id="demoCiBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#003f87" stopOpacity={0.14} />
                <stop offset="95%" stopColor="#003f87" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" stroke="#7c8aa3" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7ebf1' }} />
            <YAxis domain={['auto', 'auto']} stroke="#7c8aa3" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7ebf1' }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="ciRange" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 3" fill="url(#demoCiBandGradient)" name="95% Confidence Interval (±1.96 SE)" isAnimationActive={false} />
            <Line type="monotone" dataKey="apixValue" stroke="#003f87" strokeWidth={2.5} name="APIx Scraped Index" />
            <Line type="monotone" dataKey="dgcaBenchmark" stroke="#4e83c0" strokeDasharray="5 5" name="DGCA Benchmark" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {POPULAR_ROUTES.map((route) => (
          <div key={route.code} className="p-4 rounded-xl border border-ink-100 bg-ink-50">
            <h4 className="font-semibold text-sm text-ink-900">{route.name}</h4>
            <span className="text-lg font-semibold text-ink-900 font-tabular">₹{route.price.toLocaleString()}</span>
          </div>
        ))}
      </div>
      <button onClick={() => onNavigate('backtest')} className="text-xs text-navy-700 font-semibold hover:underline cursor-pointer">
        View Backtest &rarr;
      </button>
    </div>
  );
}
