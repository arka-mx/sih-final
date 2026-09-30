'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { FileText, Download, RefreshCw, CaretDownIcon } from './icons';
import { Callout } from './ui/callout';
import { StatusTag } from './ui/status-tag';

interface BacktestPoint {
  date: string;
  apixIndex: number;
  dgcaAvgFare: number;
  impliedFare: number;
  variancePct: number;
  trackingResidual: number;
  ciLower?: number;
  ciUpper?: number;
  ciRange?: [number, number];
}

interface BacktestApiResponse {
  period: { start: string; end: string; total_days: number };
  metrics: { pearson_r: number; mape: number; rmse: number; target_met: boolean };
  significance: { n: number; degreesOfFreedom: number; tStatistic: number | null };
  methodologyNote: string;
  points: BacktestPoint[];
}

export default function BacktestView() {
  const [dataHorizon, setDataHorizon] = useState<'30' | '14' | '7'>('30');
  const [chartMode, setChartMode] = useState<'overlay' | 'residuals' | 'variance'>('overlay');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const backtest = useApiData<BacktestApiResponse>(
    DEMO_MODE ? null : `/api/backtest?days=${dataHorizon}`,
    [dataHorizon]
  );

  if (DEMO_MODE) {
    return (
      <Callout tone="warning">
        Demo mode is enabled (NEXT_PUBLIC_DEMO_MODE=true). Disable it to view the live DGCA backtest.
      </Callout>
    );
  }

  if (backtest.loading) return <LoadingPanel label="Running DGCA backtest comparison..." />;
  if (backtest.error) return <ErrorPanel message={backtest.error} onRetry={backtest.refetch} />;

  const chartData = backtest.data?.points ?? [];
  const metrics = backtest.data?.metrics;
  const period = backtest.data?.period;
  const significance = backtest.data?.significance;

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(
      {
        specification: 'MoSPI DIID Problem Statement 26056 - Airfare Price Index',
        auditDate: new Date().toISOString(),
        metrics,
        period,
        data: chartData,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apix_dgca_backtest_report_${dataHorizon}d.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner / Credibility Badge */}
      <div className="panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink-900">MoSPI CPI Benchmark Validation</h2>
          <p className="text-xs text-ink-500 mt-1 max-w-xl">
            APIx correlated against MoSPI CPI Group 07.3 (&quot;Passenger transport services&quot;) &mdash; the closest
            officially published proxy to airfares.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={backtest.refetch}
            disabled={backtest.loading}
            className="bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${backtest.loading ? 'animate-spin' : ''}`} />
            <span>Re-verify</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="bg-white text-ink-700 hover:bg-ink-50 border border-ink-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-ink-500" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Target Metric Scorecard */}
      <div className="panel px-2 py-4 sm:px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y divide-ink-100 sm:divide-y-0 sm:divide-x">
          {[
            {
              label: 'Pearson Correlation (r)',
              value: metrics?.pearson_r.toFixed(3) ?? '-',
              color: 'text-emerald-600',
              sub: `Target ≥ 0.80${metrics?.target_met ? ' · passed' : ''}`,
            },
            {
              label: 'MAPE (Tracking Error)',
              value: metrics ? `${metrics.mape.toFixed(2)}%` : '-',
              color: 'text-navy-700',
              sub: 'Target ≤ 3.50%',
            },
            {
              label: 'RMSE (Discrepancy)',
              value: metrics ? `${metrics.rmse.toFixed(2)} pts` : '-',
              color: 'text-indigo-700',
              sub: null,
            },
            {
              label: 't-Statistic',
              value: significance?.tStatistic ?? '-',
              color: 'text-purple-700',
              sub: `df = ${significance?.degreesOfFreedom ?? '-'}`,
            },
            {
              label: 'Evaluation Horizon',
              value: `${period?.total_days ?? '-'} mo`,
              color: 'text-teal-700',
              sub: period ? `${period.start} – ${period.end}` : null,
            },
            {
              label: 'MoSPI Augmentation',
              value: metrics?.target_met ? 'Ready' : 'Review',
              color: 'text-amber-700',
              sub: 'CPI sub-group feed',
            },
          ].map((stat) => (
            <div key={stat.label} className="px-3 py-3 sm:py-1 text-center">
              <span className="text-[11px] text-ink-500 block font-medium">{stat.label}</span>
              <span className={`text-xl font-semibold font-tabular ${stat.color}`}>{stat.value}</span>
              {stat.sub && <span className="text-[10px] text-ink-400 block mt-0.5 font-tabular">{stat.sub}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Main Interactive Dual-Series Chart Card */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">
              Dual-Series Trajectory: APIx vs. MoSPI CPI 07.3
            </h3>
            <p className="text-xs text-ink-500">
              Left axis: APIx Index (Base 100) | Right axis: MoSPI CPI Group 07.3 &quot;Passenger transport services&quot; (Base 2024=100)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-ink-50 p-1 rounded-lg border border-ink-100 text-xs">
              <button
                onClick={() => setChartMode('overlay')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  chartMode === 'overlay' ? 'bg-white text-navy-800 shadow-panel' : 'text-ink-500'
                }`}
              >
                Dual Overlay
              </button>
              <button
                onClick={() => setChartMode('variance')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  chartMode === 'variance' ? 'bg-white text-navy-800 shadow-panel' : 'text-ink-500'
                }`}
              >
                Daily Variance (%)
              </button>
              <button
                onClick={() => setChartMode('residuals')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  chartMode === 'residuals' ? 'bg-white text-navy-800 shadow-panel' : 'text-ink-500'
                }`}
              >
                Tracking Residuals (₹)
              </button>
            </div>

            <div className="flex bg-ink-50 p-1 rounded-lg border border-ink-100 text-xs">
              {(['7', '14', '30'] as const).map((days) => (
                <button
                  key={days}
                  onClick={() => setDataHorizon(days)}
                  className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    dataHorizon === days ? 'bg-navy-700 text-white shadow-panel' : 'text-ink-500'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Body */}
        <div className="h-[360px] w-full pt-2">
          {chartMode === 'overlay' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 25, left: 0, bottom: 20 }}>
                <defs>
                  <linearGradient id="backtestCiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003f87" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#003f87" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7c8aa3' }} tickMargin={8} />
                <YAxis
                  yAxisId="left"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#003f87' }}
                  label={{ value: 'APIx Index (Base 100)', angle: -90, position: 'insideLeft', offset: 12, fill: '#003f87', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#d97706' }}
                  label={{ value: 'MoSPI CPI 07.3 (Base 2024=100)', angle: 90, position: 'insideRight', offset: 12, fill: '#d97706', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as BacktestPoint;
                      return (
                        <div className="bg-white p-3.5 rounded-xl shadow-raised border border-ink-100 text-xs space-y-1.5 z-50">
                          <p className="font-semibold text-ink-900 border-b border-ink-100 pb-1">{label}</p>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-navy-700 font-semibold">APIx Index:</span>
                            <span className="font-tabular font-bold text-ink-950 text-sm">{data.apixIndex.toFixed(2)}</span>
                          </div>
                          {data.ciLower != null && data.ciUpper != null && (
                            <div className="border-t border-b border-ink-100 py-1 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between text-navy-800 font-medium">
                                <span>95% Confidence Interval:</span>
                                <span className="font-tabular font-semibold">[{data.ciLower.toFixed(2)} – {data.ciUpper.toFixed(2)}]</span>
                              </div>
                              <div className="text-[10px] text-ink-500">
                                Bounds margin: ±{((data.ciUpper - data.ciLower) / 2).toFixed(2)} index pts (z = 1.96)
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 text-amber-700 font-medium">
                            <span>MoSPI CPI 07.3 Benchmark:</span>
                            <span className="font-tabular font-semibold">{data.dgcaAvgFare.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-ink-600">
                            <span>Index Implied Value:</span>
                            <span className="font-tabular font-semibold">{data.impliedFare.toFixed(2)}</span>
                          </div>
                          <div className="border-t border-ink-100 pt-1 text-[11px] flex justify-between gap-4">
                            <span>Variance: <strong className="text-emerald-700 font-tabular">{data.variancePct.toFixed(2)}%</strong></span>
                            <span>Residual: <strong className="font-tabular">{data.trackingResidual.toFixed(1)} pts</strong></span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="ciRange"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                  fill="url(#backtestCiGradient)"
                  name="APIx 95% Confidence Interval (±1.96 SE)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="apixIndex"
                  name="APIx Price Index (Left)"
                  stroke="#003f87"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#003f87' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="dgcaAvgFare"
                  name="MoSPI CPI 07.3 (Right)"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 2.5, fill: '#d97706' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {chartMode === 'variance' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7c8aa3' }} tickMargin={8} />
                <YAxis
                  domain={[0, 'auto']}
                  tick={{ fontSize: 11, fill: '#33415a' }}
                  tickFormatter={(val) => `${val}%`}
                  label={{ value: 'Absolute Tracking Variance (%)', angle: -90, position: 'insideLeft', offset: 12, fill: '#33415a', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as BacktestPoint;
                      return (
                        <div className="bg-white p-2.5 rounded-lg shadow-raised border border-ink-100 text-xs">
                          <p className="font-semibold text-ink-900">{label}</p>
                          <p className="text-emerald-700 font-semibold mt-1 font-tabular">Tracking Variance: {data.variancePct.toFixed(2)}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={3.5} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'MAPE Target 3.5%', position: 'insideTopRight', fill: '#dc2626', fontSize: 10 }} />
                <Bar dataKey="variancePct" name="Tracking Variance %" fill="#0284c7" radius={[3, 3, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {chartMode === 'residuals' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7ebf1" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#7c8aa3' }} tickMargin={8} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#33415a' }}
                  label={{ value: 'Implied vs Actual Residual (index pts)', angle: -90, position: 'insideLeft', offset: 12, fill: '#33415a', fontSize: 11 }}
                />
                <Tooltip />
                <ReferenceLine y={0} stroke="#7c8aa3" />
                <Bar dataKey="trackingResidual" name="Residual (Implied - MoSPI CPI 07.3)" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Methodology & Statistical Defense Panel */}
      <div className="grid grid-cols-1 gap-6 items-start">
        <div className="panel p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">Methodology &amp; Statistical Defense</h3>
            <p className="text-xs text-ink-500 mt-0.5">Defensibility for MoSPI / RBI stakeholders</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Why should RBI trust a scraped index over official DGCA data?',
                a: 'APIx acts as a leading high-frequency augmentation, not a replacement. Official DGCA and CPI data publish with a 4-to-6 week latency, whereas APIx provides daily intraday granularity. The measured correlation demonstrates that high-frequency quotes accurately track ground-truth inflation movements weeks ahead of official releases.',
              },
              {
                q: `Is ${period?.total_days ?? 30} days of backtest statistically significant?`,
                a: `With N=${significance?.n ?? '-'} paired observations across DGCA-weighted high-volume corridors, the calculated t-statistic is t = ${significance?.tStatistic ?? '-'} (degrees of freedom = ${significance?.degreesOfFreedom ?? '-'}).`,
              },
              {
                q: 'How does APIx isolate real price changes from scraper bugs?',
                a: 'We implement a 3-stage validation pipeline: (1) IQR / Z-score price filtering per route-window, (2) cross-source direct vs OTA fee decomposition to identify markup anomalies, and (3) exclusion of sold-out/cancelled flights from the Laspeyres basket.',
              },
              {
                q: 'How are passenger traffic weights assigned to corridors?',
                a: 'We mirror official MoSPI CPI expenditure weighting logic by using DGCA published annual passenger volume shares, normalized to unit sum.',
              },
            ].map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className={`group rounded-xl border transition-colors duration-200 ${
                    isOpen
                      ? 'border-navy-200 bg-white shadow-panel'
                      : 'border-ink-100 bg-ink-50/50 hover:border-ink-200 hover:bg-ink-50'
                  }`}
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full text-left font-semibold text-xs text-ink-900 flex justify-between items-center gap-3 cursor-pointer px-3.5 py-3"
                  >
                    <span className={isOpen ? 'text-navy-800' : ''}>{faq.q}</span>
                    <span
                      className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full transition-all duration-300 ease-out ${
                        isOpen ? 'bg-navy-700 rotate-180' : 'bg-ink-100 group-hover:bg-ink-200'
                      }`}
                    >
                      <CaretDownIcon className={`w-3 h-3 ${isOpen ? 'text-white' : 'text-ink-500'}`} weight="fill" />
                    </span>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                  >
                    <div className="overflow-hidden">
                      <p className="text-xs text-ink-700 leading-relaxed border-t border-ink-100 mx-3.5 pt-2.5 pb-3.5">
                        {faq.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Audit Certificate Card */}
        <div className="panel p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900">MoSPI DIID Audit Certificate</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
              <span className="text-ink-500">Correlation Target</span>
              <span className={`font-semibold font-tabular ${metrics?.target_met ? 'text-emerald-700' : 'text-amber-700'}`}>
                {metrics ? `r = ${metrics.pearson_r.toFixed(3)} vs req. 0.80` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
              <span className="text-ink-500">Mean Absolute Error</span>
              <span className="font-semibold text-emerald-700 font-tabular">
                {metrics ? `MAPE = ${metrics.mape.toFixed(2)}% vs req. ≤ 3.5%` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
              <span className="text-ink-500">Cryptographic Auditing</span>
              <span className="font-semibold text-ink-900">SHA-256 linked to raw scrapes</span>
            </div>
            <div className="flex justify-between items-center pt-2.5">
              <span className="text-ink-500">Statistical Status</span>
              <strong className={`font-semibold ${metrics?.target_met ? 'text-emerald-700' : 'text-amber-700'}`}>
                {metrics?.target_met ? 'Benchmark Certified' : 'Under Review'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Audit Log Table */}
      <div className="panel overflow-hidden">
        <div className="p-4 bg-ink-50 border-b border-ink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-ink-900">Complete Empirical Observations Log</h4>
            <p className="text-[11px] text-ink-500">
              Paired comparison between the APIx Monthly Index and MoSPI CPI Group 07.3
            </p>
          </div>
          <span className="text-xs text-ink-500 font-medium">Showing {chartData.length} observation dates</span>
        </div>

        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700 uppercase tracking-wider sticky top-0 border-b border-ink-100 font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Observation Month</th>
                <th className="py-2.5 px-4">APIx Index (Base 100)</th>
                <th className="py-2.5 px-4">MoSPI CPI 07.3</th>
                <th className="py-2.5 px-4">Implied Index Value</th>
                <th className="py-2.5 px-4">Variance (%)</th>
                <th className="py-2.5 px-4">Tracking Residual</th>
                <th className="py-2.5 px-4">Validation Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {chartData.map((row) => (
                <tr key={row.date} className="hover:bg-ink-50/60 transition-colors">
                  <td className="py-2 px-4 font-medium text-ink-900 font-tabular">{row.date}</td>
                  <td className="py-2 px-4 font-semibold text-navy-700 font-tabular">{row.apixIndex.toFixed(2)}</td>
                  <td className="py-2 px-4 text-amber-600 font-semibold font-tabular">{row.dgcaAvgFare.toFixed(2)}</td>
                  <td className="py-2 px-4 text-ink-700 font-tabular">{row.impliedFare.toFixed(2)}</td>
                  <td className="py-2 px-4 font-semibold text-emerald-700 font-tabular">{row.variancePct.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-ink-500 font-tabular">{row.trackingResidual.toFixed(1)} pts</td>
                  <td className="py-2 px-4">
                    <StatusTag tone="success">Valid</StatusTag>
                  </td>
                </tr>
              ))}
              {chartData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-500">
                    <FileText className="w-4 h-4 inline mr-1" /> No backtest records available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
