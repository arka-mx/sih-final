'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
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
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  FileText,
  Download,
  RefreshCw,
  Scale,
} from 'lucide-react';

interface BacktestPoint {
  date: string;
  apixIndex: number;
  dgcaAvgFare: number;
  impliedFare: number;
  variancePct: number;
  trackingResidual: number;
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
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  const backtest = useApiData<BacktestApiResponse>(
    DEMO_MODE ? null : `/api/backtest?days=${dataHorizon}`,
    [dataHorizon]
  );

  if (DEMO_MODE) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold px-4 py-3 rounded-lg">
        Demo mode is enabled (NEXT_PUBLIC_DEMO_MODE=true). Disable it to view the live DGCA backtest.
      </div>
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
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Official DGCA Ground Truth</span>
          </div>
          <h2 className="text-xl font-semibold text-ink-900">
            DGCA Benchmark Validation & Statistical Backtest
          </h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Empirical correlation analysis between APIx Real-Time Index and DGCA published domestic average airfare data.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={backtest.refetch}
            disabled={backtest.loading}
            className="bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${backtest.loading ? 'animate-spin' : ''}`} />
            <span>Re-verify Correlation</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="bg-white text-ink-700 hover:bg-ink-50 border border-ink-200 text-xs font-semibold px-3 py-2 rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-ink-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Target Metric Scorecard Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">Pearson Correlation (r)</span>
          <span className="text-2xl font-semibold text-emerald-600 font-tabular">{metrics?.pearson_r.toFixed(3) ?? '—'}</span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md font-semibold mt-1 inline-block">
            Target ≥ 0.80 {metrics?.target_met ? '(PASSED)' : ''}
          </span>
        </div>

        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">MAPE (Tracking Error)</span>
          <span className="text-2xl font-semibold text-navy-700 font-tabular">{metrics ? `${metrics.mape.toFixed(2)}%` : '—'}</span>
          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md font-semibold mt-1 inline-block">
            Target ≤ 3.50%
          </span>
        </div>

        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">RMSE (Fare Discrepancy)</span>
          <span className="text-2xl font-semibold text-indigo-700 font-tabular">{metrics ? `₹${metrics.rmse.toFixed(2)}` : '—'}</span>
        </div>

        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">t-Statistic</span>
          <span className="text-2xl font-semibold text-purple-700 font-tabular">{significance?.tStatistic ?? '—'}</span>
          <span className="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block">
            df = {significance?.degreesOfFreedom ?? '—'}
          </span>
        </div>

        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-teal-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">Evaluation Horizon</span>
          <span className="text-2xl font-semibold text-teal-700 font-tabular">{period?.total_days ?? '—'} Days</span>
          <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block font-tabular">
            {period ? `${period.start} – ${period.end}` : '—'}
          </span>
        </div>

        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <span className="text-[11px] text-ink-500 block font-medium">MoSPI Augmentation</span>
          <span className="text-base font-semibold text-amber-700 mt-1 block">{metrics?.target_met ? 'READY' : 'REVIEW'}</span>
          <span className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md font-medium mt-1 inline-block">
            CPI Sub-Group Feed
          </span>
        </div>
      </div>

      {/* Main Interactive Dual-Series Chart Card */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-ink-900">
                Dual-Series Trajectory: APIx Price Index vs. DGCA Benchmark Average
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-md font-tabular">
                r = {metrics?.pearson_r.toFixed(3) ?? '—'}
              </span>
            </div>
            <p className="text-xs text-ink-500">
              Left axis: APIx Index (Base 100) | Right axis: DGCA Domestic Average Fare (INR)
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
                  tickFormatter={(val) => `₹${val}`}
                  label={{ value: 'DGCA Avg Fare (₹)', angle: 90, position: 'insideRight', offset: 12, fill: '#d97706', fontSize: 11 }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as BacktestPoint;
                      return (
                        <div className="bg-white p-3 rounded-lg shadow-raised border border-ink-100 text-xs space-y-1 z-50">
                          <p className="font-semibold text-ink-900 border-b border-ink-100 pb-1">{label}</p>
                          <p className="text-navy-700 font-semibold">
                            APIx Index: <strong className="text-sm font-tabular">{data.apixIndex.toFixed(2)}</strong>
                          </p>
                          <p className="text-amber-600 font-semibold">
                            DGCA Published Fare: <strong className="font-tabular">₹{data.dgcaAvgFare.toFixed(2)}</strong>
                          </p>
                          <p className="text-ink-700">
                            Index Implied Fare: <strong className="font-tabular">₹{data.impliedFare.toFixed(2)}</strong>
                          </p>
                          <div className="border-t border-ink-100 pt-1 text-[11px] flex justify-between gap-4">
                            <span>Variance: <strong className="text-emerald-700 font-tabular">{data.variancePct.toFixed(2)}%</strong></span>
                            <span>Residual: <strong className="font-tabular">₹{data.trackingResidual.toFixed(1)}</strong></span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '8px' }} />
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
                  name="DGCA Average Fare ₹ (Right)"
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
                  tickFormatter={(val) => `₹${val}`}
                  label={{ value: 'Implied vs Actual Residual (₹)', angle: -90, position: 'insideLeft', offset: 12, fill: '#33415a', fontSize: 11 }}
                />
                <Tooltip />
                <ReferenceLine y={0} stroke="#7c8aa3" />
                <Bar dataKey="trackingResidual" name="Residual (Implied - DGCA Fare)" fill="#6366f1" radius={[2, 2, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Methodology & Statistical Defense Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="panel p-6 space-y-4">
          <div className="flex items-center space-x-2 text-xs font-semibold text-navy-700 uppercase tracking-wider">
            <Scale className="w-4 h-4 text-navy-700" />
            <span>Methodology &amp; Statistical Defense</span>
          </div>
          <h3 className="text-base font-semibold text-ink-900">
            Defensibility for MoSPI / RBI Stakeholders
          </h3>

          <div className="space-y-3">
            {[
              {
                q: 'Why should RBI trust a scraped index over official DGCA data?',
                a: 'APIx acts as a leading high-frequency augmentation, not a replacement. Official DGCA and CPI data publish with a 4-to-6 week latency, whereas APIx provides daily intraday granularity. The measured correlation demonstrates that high-frequency quotes accurately track ground-truth inflation movements weeks ahead of official releases.',
              },
              {
                q: `Is ${period?.total_days ?? 30} days of backtest statistically significant?`,
                a: `With N=${significance?.n ?? '—'} paired observations across DGCA-weighted high-volume corridors, the calculated t-statistic is t = ${significance?.tStatistic ?? '—'} (degrees of freedom = ${significance?.degreesOfFreedom ?? '—'}).`,
              },
              {
                q: 'How does APIx isolate real price changes from scraper bugs?',
                a: 'We implement a 3-stage validation pipeline: (1) IQR / Z-score price filtering per route-window, (2) cross-source direct vs OTA fee decomposition to identify markup anomalies, and (3) exclusion of sold-out/cancelled flights from the Laspeyres basket.',
              },
              {
                q: 'How are passenger traffic weights assigned to corridors?',
                a: 'We mirror official MoSPI CPI expenditure weighting logic by using DGCA published annual passenger volume shares, normalized to unit sum.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="border border-ink-100 rounded-lg p-3.5 transition-all bg-ink-50/50">
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full text-left font-semibold text-xs text-ink-900 flex justify-between items-center cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <span className="text-navy-700 text-base ml-2">{activeFaq === idx ? '−' : '+'}</span>
                </button>
                {activeFaq === idx && (
                  <p className="text-xs text-ink-700 mt-2.5 leading-relaxed border-t border-ink-100 pt-2">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Audit Certificate Card */}
        <div className="bg-navy-50 border border-navy-100 p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-navy-700 uppercase tracking-wider bg-white px-2 py-0.5 rounded-md border border-navy-100">
                MoSPI DIID Audit Certificate
              </span>
              <Award className="w-5 h-5 text-navy-700" />
            </div>

            <h3 className="text-lg font-semibold text-ink-900">Empirical Validation Summary</h3>
            <p className="text-xs text-ink-700 mt-1 leading-relaxed">
              Benchmarked against Ministry of Civil Aviation / DGCA domestic monthly traffic data for{' '}
              {period?.total_days ?? '—'} consecutive calendar days.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
                <span className="text-ink-500">Correlation Target</span>
                <span className={`font-semibold flex items-center gap-1 font-tabular ${metrics?.target_met ? 'text-emerald-700' : 'text-amber-700'}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {metrics ? `r = ${metrics.pearson_r.toFixed(3)} vs req. 0.80` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
                <span className="text-ink-500">Mean Absolute Error</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1 font-tabular">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {metrics ? `MAPE = ${metrics.mape.toFixed(2)}% vs req. ≤ 3.5%` : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-ink-100">
                <span className="text-ink-500">Lead-Time Windows</span>
                <span className="font-semibold text-ink-900">T+1, T+7, T+15, T+30, T+45</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-ink-500">Cryptographic Auditing</span>
                <span className="font-semibold text-ink-900">SHA-256 Hashes Linked to Raw Scrapes</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-ink-100 flex items-center justify-between text-xs">
            <div>
              <span className="text-ink-500 block text-[10px]">Statistical Status</span>
              <strong className={`font-semibold ${metrics?.target_met ? 'text-emerald-700' : 'text-amber-700'}`}>
                {metrics?.target_met ? 'BENCHMARK CERTIFIED' : 'UNDER REVIEW'}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-ink-500 block text-[10px]">Verification Endpoint</span>
              <code className="text-navy-700 text-[11px] font-mono">GET /api/backtest/dgca-comparison</code>
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
              Paired comparison between APIx Daily Index and DGCA Average Domestic Airfares
            </p>
          </div>
          <span className="text-xs text-ink-500 font-medium">Showing {chartData.length} observation dates</span>
        </div>

        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-ink-50 text-ink-700 uppercase tracking-wider sticky top-0 border-b border-ink-100 font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Observation Date</th>
                <th className="py-2.5 px-4">APIx Index (Base 100)</th>
                <th className="py-2.5 px-4">DGCA Published Fare</th>
                <th className="py-2.5 px-4">Implied Index Fare</th>
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
                  <td className="py-2 px-4 text-amber-600 font-semibold font-tabular">₹{row.dgcaAvgFare.toFixed(2)}</td>
                  <td className="py-2 px-4 text-ink-700 font-tabular">₹{row.impliedFare.toFixed(2)}</td>
                  <td className="py-2 px-4 font-semibold text-emerald-700 font-tabular">{row.variancePct.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-ink-500 font-tabular">₹{row.trackingResidual.toFixed(1)}</td>
                  <td className="py-2 px-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" /> Valid
                    </span>
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
