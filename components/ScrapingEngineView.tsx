'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SCRAPER_LOGS, ScraperLogItem } from '@/lib/mockData';
import { ShieldCheck, Play, CheckCircle2, AlertTriangle, RefreshCw, Lock, Terminal } from './icons';
import DarkPatternPanel from './DarkPatternPanel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Callout } from './ui/callout';
import { StatusTag } from './ui/status-tag';

const ROUTES = [
  { value: 'DEL-BOM', label: 'DEL–BOM · Delhi ↔ Mumbai' },
  { value: 'DEL-BLR', label: 'DEL–BLR · Delhi ↔ Bengaluru' },
  { value: 'BOM-BLR', label: 'BOM–BLR · Mumbai ↔ Bengaluru' },
  { value: 'DEL-CCU', label: 'DEL–CCU · Delhi ↔ Kolkata' },
  { value: 'BLR-HYD', label: 'BLR–HYD · Bengaluru ↔ Hyderabad' },
  { value: 'MAA-DEL', label: 'MAA–DEL · Chennai ↔ Delhi' },
  { value: 'DEL-PNQ', label: 'DEL–PNQ · Delhi ↔ Pune' },
  { value: 'BOM-GOI', label: 'BOM–GOI · Mumbai ↔ Goa' },
];

const SCRAPE_WINDOWS = [
  { value: '1', label: 'T+1 · Surge' },
  { value: '7', label: 'T+7 · Weekly' },
  { value: '15', label: 'T+15 · Base' },
  { value: '30', label: 'T+30 · Advance' },
  { value: '45', label: 'T+45 · Early' },
];

interface SourceHealthStatus {
  source_key: string;
  status: string;
  checked_at: string;
  records_found: number;
  missing_or_invalid_fields: string[];
  detail: string | null;
}

interface SourceHealthState {
  status: 'ok' | 'degraded';
  checkedSources: number;
  selectorMissSources: string[];
  sources: Record<string, SourceHealthStatus>;
}

const HEALTH_POLL_INTERVAL_MS = 60_000;

export default function ScrapingEngineView() {
  const [logs, setLogs] = useState<ScraperLogItem[]>(() => SCRAPER_LOGS.map((log) => ({
    ...log,
    source: 'Simulated fixture seed',
    complianceNote: 'Deterministic local fixture; no network request or live fare claim.',
  })));
  const [isRunningScraper, setIsRunningScraper] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<'ALL' | 'AIRLINES' | 'OTAS'>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('DEL-BOM');
  const [selectedWindow, setSelectedWindow] = useState<number>(7);
  const [sourceHealth, setSourceHealth] = useState<SourceHealthState | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const fetchSourceHealth = useCallback(async (refresh: boolean = false) => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch(`/api/scrapers/health${refresh ? '?refresh=true' : ''}`);
      const data = await res.json();
      if (data.status !== 'ERROR') {
        setSourceHealth(data as SourceHealthState);
      }
    } catch {
      // Health polling failure is non-fatal; the panel just keeps its last known state.
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    fetchSourceHealth();
    const interval = setInterval(() => fetchSourceHealth(), HEALTH_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSourceHealth]);

  const handleTriggerScrape = async () => {
    setIsRunningScraper(true);
    const startTime = performance.now();
    try {
      const res = await fetch('/api/scrapers/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'ALL',
          route: selectedRoute,
          advanceDays: selectedWindow,
        }),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      if (data.status === 'SUCCESS') {
        const indigoLog: ScraperLogItem = {
          id: `SCR-${Math.floor(100 + Math.random() * 900)}`,
          source: 'Simulated IndiGo fixture',
          type: 'Airline',
          route: selectedRoute,
          status: 'SUCCESS',
          recordsScraped: data.counts.indigoQuotes,
          responseTimeMs: Math.round(elapsed * 0.45),
          timestamp: new Date().toLocaleTimeString(),
          complianceNote: 'Deterministic direct-channel scenario; no HTTP or booking request.',
        };

        const mmtLog: ScraperLogItem = {
          id: `SCR-${Math.floor(100 + Math.random() * 900)}`,
          source: 'Simulated MakeMyTrip fixture',
          type: 'OTA',
          route: selectedRoute,
          status: 'SUCCESS',
          recordsScraped: data.counts.mmtQuotes,
          responseTimeMs: Math.round(elapsed * 0.55),
          timestamp: new Date().toLocaleTimeString(),
          complianceNote: `Deterministic OTA scenario, matched fixture records=${data.counts.matchedQuotes}`,
        };

        setLogs((prev) => [indigoLog, mmtLog, ...prev]);
      }
    } catch {
      const errorLog: ScraperLogItem = {
        id: `SCR-${Math.floor(100 + Math.random() * 900)}`,
        source: 'Simulated fixture registry',
        type: 'Airline',
        route: selectedRoute,
        status: 'RETRYING',
        recordsScraped: 0,
        responseTimeMs: 0,
        timestamp: new Date().toLocaleTimeString(),
        complianceNote: 'Fixture generation failed before comparison completed',
      };
      setLogs((prev) => [errorLog, ...prev]);
    } finally {
      setIsRunningScraper(false);
      fetchSourceHealth(true);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (complianceFilter === 'AIRLINES') return log.type === 'Airline';
    if (complianceFilter === 'OTAS') return log.type === 'OTA';
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Trigger */}
      <div className="panel p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Simulated Data Mode</h2>
          <p className="text-xs text-ink-500 mt-1 max-w-lg">
            Five deterministic source fixtures - no live HTTP requests, browser automation, or booking integrations.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-4 border-t border-ink-100">
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold text-ink-400 uppercase tracking-wide">Corridor</label>
            <Select value={selectedRoute} onValueChange={(v) => v && setSelectedRoute(v)}>
              <SelectTrigger className="h-9! w-60 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={6} className="p-1">
                {ROUTES.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="text-xs font-mono py-2 px-2.5 rounded-md">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold text-ink-400 uppercase tracking-wide">Window</label>
            <Select value={String(selectedWindow)} onValueChange={(v) => v && setSelectedWindow(Number(v))}>
              <SelectTrigger className="h-9! w-40 text-xs font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={6} className="p-1">
                {SCRAPE_WINDOWS.map((w) => (
                  <SelectItem key={w.value} value={w.value} className="text-xs font-mono py-2 px-2.5 rounded-md">
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <button
            onClick={handleTriggerScrape}
            disabled={isRunningScraper}
            className="h-9 bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-4 rounded-lg flex items-center justify-center gap-2 transition-all shrink-0 disabled:opacity-50 cursor-pointer ml-auto"
          >
            {isRunningScraper ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Simulated Batch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Architecture Flow Diagram */}
      <div className="panel p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900">Pipeline Architecture</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
          {[
            { label: 'Fixture Layer', sub: 'Deterministic Python providers' },
            { label: 'Raw Data Lake', sub: 'Raw JSON / Staging Store' },
            { label: 'Cleaning & IQR', sub: 'Outlier detection & tax split' },
            { label: 'Index Engine', sub: 'DGCA Weighted Laspeyres' },
            { label: 'REST API & UI', sub: 'NSO/RBI Consumption' },
          ].map((stage, idx) => (
            <div key={stage.label} className="p-3 bg-ink-50 border border-ink-100 rounded-lg flex flex-col items-center justify-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-ink-900 text-white text-[10px] font-semibold flex items-center justify-center font-tabular">
                {idx + 1}
              </span>
              <span className="font-semibold text-ink-900">{stage.label}</span>
              <span className="text-[10px] text-ink-500">{stage.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selector / Schema-Change Health Check */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-900">Source Health Check</h3>
          <button
            onClick={() => fetchSourceHealth(true)}
            disabled={isCheckingHealth}
            className="text-xs font-semibold text-ink-700 bg-white border border-ink-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-ink-50 disabled:opacity-50 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
            Re-check now
          </button>
        </div>

        {sourceHealth && sourceHealth.status === 'degraded' && (
          <Callout tone="danger" icon={AlertTriangle}>
            Selector mismatch on {sourceHealth.selectorMissSources.length} source(s): {sourceHealth.selectorMissSources.join(', ')}.
            The payload shape may have changed, so downstream cleaning could receive bad data.
          </Callout>
        )}
        {sourceHealth && sourceHealth.status === 'ok' && (
          <Callout tone="success" icon={CheckCircle2}>
            All <span className="font-tabular">{sourceHealth.checkedSources}</span> source(s) passed the health check.
          </Callout>
        )}
        {!sourceHealth && (
          <p className="text-xs text-ink-500">Checking source selector health...</p>
        )}

        {sourceHealth && (
          <div className="overflow-x-auto border border-ink-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
                <tr>
                  <th className="p-3">Source</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Records Probed</th>
                  <th className="p-3">Checked At</th>
                  <th className="p-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {Object.values(sourceHealth.sources).map((s) => (
                  <tr key={s.source_key} className="hover:bg-ink-50/60 transition-colors">
                    <td className="p-3 font-mono text-[11px] font-semibold text-navy-700">{s.source_key}</td>
                    <td className="p-3">
                      {s.status === 'ok' && <StatusTag tone="success" icon={CheckCircle2}>OK</StatusTag>}
                      {s.status === 'selector_miss' && <StatusTag tone="danger" icon={AlertTriangle}>SELECTOR_MISS</StatusTag>}
                      {s.status === 'no_availability' && <StatusTag tone="warning" icon={AlertTriangle}>NO_AVAILABILITY</StatusTag>}
                    </td>
                    <td className="p-3 font-semibold text-ink-900 font-tabular">{s.records_found}</td>
                    <td className="p-3 text-ink-500 font-tabular">{new Date(s.checked_at).toLocaleTimeString()}</td>
                    <td className="p-3 text-[11px] text-ink-500">{s.detail ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ethical Compliance Principles Checklist */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-ink-900">Compliance checklist</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="panel p-4 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Live Scraping Disabled</span>
            </div>
            <p className="text-[11px] text-ink-500">No external domain is contacted.</p>
          </div>

          <div className="panel p-4 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>No Network Automation</span>
            </div>
            <p className="text-[11px] text-ink-500">In-code fixtures only - no browser session or login flow.</p>
          </div>

          <div className="panel p-4 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-navy-700">
              <Lock className="w-4 h-4 text-navy-700" />
              <span>Zero PII Collection</span>
            </div>
            <p className="text-[11px] text-ink-500">No user input or external account access.</p>
          </div>

          <div className="panel p-4 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-navy-700">
              <Terminal className="w-4 h-4 text-navy-700" />
              <span>No Proxy Pool</span>
            </div>
            <p className="text-[11px] text-ink-500">Not needed in simulated data mode.</p>
          </div>
        </div>
      </div>

      {/* Simulated fixture activity stream */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-ink-100 pb-3">
          <h3 className="text-base font-semibold text-ink-900">Simulated Fixture Generation Logs</h3>
          <div className="flex items-center gap-1 bg-ink-50 rounded-lg p-1 border border-ink-100">
            {(['ALL', 'AIRLINES', 'OTAS'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setComplianceFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  complianceFilter === f
                    ? 'bg-white text-navy-800 shadow-panel'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-ink-100 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
              <tr>
                <th className="p-3">Job ID</th>
                <th className="p-3">Source Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Route</th>
                <th className="p-3">Status</th>
                <th className="p-3">Records</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Data Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-ink-50/60 transition-colors">
                  <td className="p-3 font-mono text-[11px] font-semibold text-navy-700">{log.id}</td>
                  <td className="p-3 font-medium text-ink-900 font-mono text-[11px]">{log.source}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-semibold ${log.type === 'Airline' ? 'text-navy-700' : 'text-indigo-700'}`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="p-3 font-semibold font-mono text-[11px] text-ink-900">{log.route}</td>
                  <td className="p-3">
                    {log.status === 'SUCCESS' && <StatusTag tone="success" icon={CheckCircle2}>SUCCESS</StatusTag>}
                    {log.status === 'RATE_LIMITED' && <StatusTag tone="warning" icon={AlertTriangle}>THROTTLED (429)</StatusTag>}
                    {log.status === 'BLOCKED_QUEUE' && <StatusTag tone="danger" icon={Lock}>FALLBACK QUEUE</StatusTag>}
                  </td>
                  <td className="p-3 font-semibold text-ink-900 font-tabular">{log.recordsScraped}</td>
                  <td className="p-3 text-ink-500 font-tabular">{log.responseTimeMs} ms</td>
                  <td className="p-3 text-[11px] text-ink-500">{log.complianceNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fare-manipulation / dark pattern detector */}
      <DarkPatternPanel />
    </div>
  );
}
