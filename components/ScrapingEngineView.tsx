'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { SCRAPER_LOGS, ScraperLogItem } from '@/lib/mockData';
import { Cpu, ShieldCheck, Play, CheckCircle2, AlertTriangle, RefreshCw, Lock, Terminal, FileCode2, ActivitySquare } from 'lucide-react';
import DarkPatternPanel from './DarkPatternPanel';

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
      <div className="panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-navy-700 uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4 text-navy-700" />
            <span>Multi-Source Fixture Engine</span>
          </div>
          <h2 className="text-xl font-semibold text-ink-900">Simulated Data Mode &amp; Pipeline Monitor</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Five deterministic source fixtures. No HTTP, browser automation, scraping framework, or booking integration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <label className="text-ink-500 font-semibold">Corridor:</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 font-mono text-navy-700 font-semibold text-xs cursor-pointer"
            >
              <option value="DEL-BOM">DEL-BOM (Delhi ↔ Mumbai)</option>
              <option value="DEL-BLR">DEL-BLR (Delhi ↔ Bengaluru)</option>
              <option value="BOM-BLR">BOM-BLR (Mumbai ↔ Bengaluru)</option>
              <option value="DEL-CCU">DEL-CCU (Delhi ↔ Kolkata)</option>
              <option value="BLR-HYD">BLR-HYD (Bengaluru ↔ Hyderabad)</option>
              <option value="MAA-DEL">MAA-DEL (Chennai ↔ Delhi)</option>
              <option value="DEL-PNQ">DEL-PNQ (Delhi ↔ Pune)</option>
              <option value="BOM-GOI">BOM-GOI (Mumbai ↔ Goa)</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <label className="text-ink-500 font-semibold">Window:</label>
            <select
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(Number(e.target.value))}
              className="bg-white border border-ink-200 rounded-lg px-2.5 py-1.5 font-mono text-navy-700 font-semibold text-xs cursor-pointer"
            >
              <option value={1}>T+1 (Surge)</option>
              <option value={7}>T+7 (Weekly)</option>
              <option value={15}>T+15 (Base)</option>
              <option value={30}>T+30 (Advance)</option>
              <option value={45}>T+45 (Early)</option>
            </select>
          </div>

          <button
            onClick={handleTriggerScrape}
            disabled={isRunningScraper}
            className="bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isRunningScraper ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Fixture Records...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Simulated Source Batch</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Architecture Flow Diagram */}
      <div className="panel p-6 space-y-4">
        <h3 className="text-sm font-semibold text-ink-900 flex items-center">
          <FileCode2 className="w-4 h-4 mr-2 text-navy-700" />
          High-Level Pipeline Architecture (Scrape → Index → API)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
          <div className="p-3 bg-navy-50 border border-navy-200 rounded-lg flex flex-col items-center justify-center space-y-1">
            <span className="font-semibold text-navy-700">1. Fixture Layer</span>
            <span className="text-[10px] text-ink-500">Deterministic Python providers</span>
          </div>
          <div className="p-3 bg-ink-50 border border-ink-100 rounded-lg flex flex-col items-center justify-center space-y-1">
            <span className="font-semibold text-ink-900">2. Raw Data Lake</span>
            <span className="text-[10px] text-ink-500">Raw JSON / Staging Store</span>
          </div>
          <div className="p-3 bg-ink-50 border border-ink-100 rounded-lg flex flex-col items-center justify-center space-y-1">
            <span className="font-semibold text-ink-900">3. Cleaning &amp; IQR</span>
            <span className="text-[10px] text-ink-500">Outlier detection &amp; tax split</span>
          </div>
          <div className="p-3 bg-ink-50 border border-ink-100 rounded-lg flex flex-col items-center justify-center space-y-1">
            <span className="font-semibold text-ink-900">4. Index Engine</span>
            <span className="text-[10px] text-ink-500">DGCA Weighted Laspeyres</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col items-center justify-center space-y-1">
            <span className="font-semibold text-emerald-900">5. REST API &amp; UI</span>
            <span className="text-[10px] text-emerald-700">NSO/RBI Consumption</span>
          </div>
        </div>
      </div>

      {/* Selector / Schema-Change Health Check */}
      <div className="panel p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink-900 flex items-center">
            <ActivitySquare className="w-4 h-4 mr-2 text-navy-700" />
            Selector / Schema-Change Health Check
          </h3>
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
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              SELECTOR_MISS on {sourceHealth.selectorMissSources.length} source(s): {sourceHealth.selectorMissSources.join(', ')}.
              Expected fields are missing or invalid — the source&apos;s payload shape may have changed, and downstream cleaning may be receiving bad data.
            </span>
          </div>
        )}
        {sourceHealth && sourceHealth.status === 'ok' && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            All <span className="font-tabular">{sourceHealth.checkedSources}</span> source(s) passed the selector/field health probe.
          </div>
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
                      {s.status === 'ok' && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                        </span>
                      )}
                      {s.status === 'selector_miss' && (
                        <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" /> SELECTOR_MISS
                        </span>
                      )}
                      {s.status === 'no_availability' && (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" /> NO_AVAILABILITY
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-ink-900 font-tabular">{s.records_found}</td>
                    <td className="p-3 text-ink-500 font-tabular">{new Date(s.checked_at).toLocaleTimeString()}</td>
                    <td className="p-3 text-[11px] text-ink-500">{s.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ethical Compliance Principles Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="panel p-4 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Live Scraping Disabled</span>
          </div>
          <p className="text-[11px] text-ink-500">
            No external domain is contacted, so there is no robots.txt result to claim.
          </p>
        </div>

        <div className="panel p-4 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>No Network Automation</span>
          </div>
          <p className="text-[11px] text-ink-500">
            The current providers use in-code fixtures only; no browser session, CAPTCHA flow, or login is present.
          </p>
        </div>

        <div className="panel p-4 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-navy-700">
            <Lock className="w-4 h-4 text-navy-700" />
            <span>Zero PII Collection</span>
          </div>
          <p className="text-[11px] text-ink-500">
            Fixture generation has no user input collection or external account access.
          </p>
        </div>

        <div className="panel p-4 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-navy-700">
            <Terminal className="w-4 h-4 text-navy-700" />
            <span>No Proxy Pool</span>
          </div>
          <p className="text-[11px] text-ink-500">
            Proxies are unnecessary in simulated data mode. Any future live integration needs its own review.
          </p>
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
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${log.type === 'Airline' ? 'bg-navy-50 text-navy-700' : 'bg-indigo-50 text-indigo-700'}`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="p-3 font-semibold font-mono text-[11px] text-ink-900">{log.route}</td>
                  <td className="p-3">
                    {log.status === 'SUCCESS' && (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> SUCCESS
                      </span>
                    )}
                    {log.status === 'RATE_LIMITED' && (
                      <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" /> THROTTLED (429)
                      </span>
                    )}
                    {log.status === 'BLOCKED_QUEUE' && (
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-semibold px-2 py-0.5 rounded-md inline-flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> FALLBACK QUEUE
                      </span>
                    )}
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
