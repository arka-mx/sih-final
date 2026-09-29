'use client';

import React from 'react';
import { DarkPatternFlagItem, MOCK_DARK_PATTERN_FLAGS } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { ShieldAlert, Eye, TrendingUp, RefreshCw } from 'lucide-react';

interface DarkPatternApiResponse {
  routePair: string;
  totalListingsScanned: number;
  totalFlagged: number;
  flags: DarkPatternFlagItem[];
  methodologyNote: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  HIGH: 'bg-rose-50 text-rose-700 border-rose-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  LOW: 'bg-ink-100 text-ink-600 border-ink-200',
};

const PATTERN_ICON: Record<string, React.ReactNode> = {
  SCARCITY_COPY_MISMATCH: <ShieldAlert className="w-3.5 h-3.5" />,
  SCARCITY_MESSAGING: <Eye className="w-3.5 h-3.5" />,
  REPEAT_VIEW_PRICE_ESCALATION: <TrendingUp className="w-3.5 h-3.5" />,
};

export default function DarkPatternPanel() {
  const dp = useApiData<DarkPatternApiResponse>(DEMO_MODE ? null : '/api/dark-patterns?route=DEL-BOM&advanceDays=7', []);

  const flags: DarkPatternFlagItem[] = DEMO_MODE ? MOCK_DARK_PATTERN_FLAGS : dp.data?.flags ?? [];
  const totalScanned = DEMO_MODE ? 5 : dp.data?.totalListingsScanned ?? 0;

  return (
    <div className="panel p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-navy-700 uppercase tracking-wider mb-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Consumer Protection</span>
          </div>
          <h3 className="text-sm font-semibold text-ink-900">Fare-Manipulation / Dark Pattern Detector</h3>
          <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">
            Flags artificial-scarcity listing copy and fare-cookie repeat-view price escalation on the simulated OTA fixture (DEL-BOM, T+7).
          </p>
        </div>
        {!DEMO_MODE && (
          <button
            onClick={dp.refetch}
            disabled={dp.loading}
            className="text-xs font-semibold text-navy-700 border border-ink-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-ink-50 disabled:opacity-50 shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dp.loading ? 'animate-spin' : ''}`} />
            Re-scan
          </button>
        )}
      </div>

      {!DEMO_MODE && dp.loading && !dp.data && <LoadingPanel label="Scanning simulated OTA listings for dark patterns..." />}
      {!DEMO_MODE && dp.error && <ErrorPanel message={dp.error} onRetry={dp.refetch} />}

      {(DEMO_MODE || dp.data) && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-ink-500">
              Scanned <span className="font-semibold text-ink-900 font-tabular">{totalScanned}</span> listing(s) &middot;{' '}
              <span className="font-semibold text-rose-600 font-tabular">{flags.length}</span> flagged
            </span>
          </div>

          {flags.length === 0 ? (
            <p className="text-xs text-ink-500 py-6 text-center">No suspicious pricing signals detected in this batch.</p>
          ) : (
            <div className="overflow-x-auto border border-ink-100 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-ink-50 text-ink-700 font-semibold border-b border-ink-100">
                  <tr>
                    <th className="p-3">Flight</th>
                    <th className="p-3">Carrier</th>
                    <th className="p-3">Pattern</th>
                    <th className="p-3">Severity</th>
                    <th className="p-3">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {flags.map((f, i) => (
                    <tr key={`${f.scrapeId}-${f.flightNo}-${i}`} className="hover:bg-ink-50/60 transition-colors align-top">
                      <td className="p-3 font-mono text-[11px] font-semibold text-navy-700">{f.flightNo}</td>
                      <td className="p-3 font-medium text-ink-900">{f.carrier}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink-800">
                          {PATTERN_ICON[f.patternType]}
                          {f.patternType.replaceAll('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.LOW}`}>
                          {f.severity}
                        </span>
                      </td>
                      <td className="p-3 text-[11px] text-ink-500">{f.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-ink-400 pt-1">
            Rule-based heuristics over deterministic simulated fixture data &mdash; not a live scan of any real OTA, and not a legal finding.
          </p>
        </>
      )}
    </div>
  );
}
