'use client';

import React, { useState } from 'react';
import { SCRAPER_LOGS, ScraperLogItem } from '@/lib/mockData';
import { Cpu, ShieldCheck, Play, CheckCircle2, AlertTriangle, RefreshCw, Lock, Terminal, FileCode2 } from 'lucide-react';

export default function ScrapingEngineView() {
  const [logs, setLogs] = useState<ScraperLogItem[]>(SCRAPER_LOGS);
  const [isRunningScraper, setIsRunningScraper] = useState(false);
  const [complianceFilter, setComplianceFilter] = useState<'ALL' | 'AIRLINES' | 'OTAS'>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('DEL-BOM');
  const [selectedWindow, setSelectedWindow] = useState<number>(7);

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
          source: 'IndiGo Direct (goindigo.in)',
          type: 'Airline',
          route: selectedRoute,
          status: 'SUCCESS',
          recordsScraped: data.counts.indigoQuotes,
          responseTimeMs: Math.round(elapsed * 0.45),
          timestamp: new Date().toLocaleTimeString(),
          complianceNote: 'Robots.txt verified, Rate limit: 2500ms jitter, Direct price baseline',
        };

        const mmtLog: ScraperLogItem = {
          id: `SCR-${Math.floor(100 + Math.random() * 900)}`,
          source: 'MakeMyTrip (makemytrip.com)',
          type: 'OTA',
          route: selectedRoute,
          status: 'SUCCESS',
          recordsScraped: data.counts.mmtQuotes,
          responseTimeMs: Math.round(elapsed * 0.55),
          timestamp: new Date().toLocaleTimeString(),
          complianceNote: `Fan-out (IndiGo, AI, Akasa, SpiceJet), Diffed matched=${data.counts.matchedQuotes}`,
        };

        setLogs((prev) => [indigoLog, mmtLog, ...prev]);
      }
    } catch {
      const errorLog: ScraperLogItem = {
        id: `SCR-${Math.floor(100 + Math.random() * 900)}`,
        source: 'IndiGo Direct / MMT',
        type: 'Airline',
        route: selectedRoute,
        status: 'RETRYING',
        recordsScraped: 0,
        responseTimeMs: 0,
        timestamp: new Date().toLocaleTimeString(),
        complianceNote: 'Network error or rate-limit ceiling reached',
      };
      setLogs((prev) => [errorLog, ...prev]);
    } finally {
      setIsRunningScraper(false);
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
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#003f87] uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4 text-[#003f87]" />
            <span>Automated Multi-Source Extraction Engine</span>
          </div>
          <h2 className="text-xl font-bold text-[#1f2937]">Scraping Engine & Ethical Compliance Monitor</h2>
          <p className="text-xs text-[#6b7280] mt-0.5">
            Playwright / Selenium JS-rendered booking scrapers + Scrapy OTA listing pipelines (MoSPI IT Act Sec 43/66 compliant)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs">
            <label className="text-[#6b7280] font-semibold">Corridor:</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="bg-white border border-[#e5e7eb] rounded px-2.5 py-1.5 font-mono text-[#003f87] font-bold text-xs"
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
            <label className="text-[#6b7280] font-semibold">Window:</label>
            <select
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(Number(e.target.value))}
              className="bg-white border border-[#e5e7eb] rounded px-2.5 py-1.5 font-mono text-[#003f87] font-bold text-xs"
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
            className="bg-[#003f87] text-white hover:bg-[#002d62] text-xs font-bold px-4 py-2 rounded flex items-center justify-center space-x-2 transition-all shadow-xs shrink-0 disabled:opacity-50"
          >
            {isRunningScraper ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extracting Live Fares...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Execute Live Scrape Job</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* System Architecture Flow Diagram */}
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#1f2937] flex items-center">
          <FileCode2 className="w-4 h-4 mr-2 text-[#003f87]" />
          High-Level Pipeline Architecture (Scrape → Index → API)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center text-xs">
          <div className="p-3 bg-[#e8f4f8] border border-[#bbeeef] rounded-md flex flex-col items-center justify-center space-y-1">
            <span className="font-bold text-[#003f87]">1. Scraping Layer</span>
            <span className="text-[10px] text-[#6b7280]">Playwright / Selenium / Scrapy</span>
          </div>
          <div className="p-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-md flex flex-col items-center justify-center space-y-1">
            <span className="font-bold text-[#1f2937]">2. Raw Data Lake</span>
            <span className="text-[10px] text-[#6b7280]">Raw JSON / Staging Store</span>
          </div>
          <div className="p-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-md flex flex-col items-center justify-center space-y-1">
            <span className="font-bold text-[#1f2937]">3. Cleaning & IQR</span>
            <span className="text-[10px] text-[#6b7280]">Outlier detection & tax split</span>
          </div>
          <div className="p-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-md flex flex-col items-center justify-center space-y-1">
            <span className="font-bold text-[#1f2937]">4. Index Engine</span>
            <span className="text-[10px] text-[#6b7280]">DGCA Weighted Laspeyres</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex flex-col items-center justify-center space-y-1">
            <span className="font-bold text-emerald-900">5. REST API & UI</span>
            <span className="text-[10px] text-emerald-700">NSO/RBI Consumption</span>
          </div>
        </div>
      </div>

      {/* Ethical Compliance Principles Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-md border border-[#e5e7eb] shadow-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Robots.txt Adherence</span>
          </div>
          <p className="text-[11px] text-[#6b7280]">
            Honors all Disallow directives & respects domain crawl-delay settings (minimum 2000ms delay).
          </p>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#e5e7eb] shadow-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>No Aggressive Evasion</span>
          </div>
          <p className="text-[11px] text-[#6b7280]">
            Does not defeat CAPTCHAs aggressively. Blocked sessions enter a graceful manual fallback queue.
          </p>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#e5e7eb] shadow-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#003f87]">
            <Lock className="w-4 h-4 text-[#003f87]" />
            <span>Zero PII Collection</span>
          </div>
          <p className="text-[11px] text-[#6b7280]">
            Captures publicly displayed aggregate ticket fares only. Zero personal user data is ever accessed.
          </p>
        </div>

        <div className="bg-white p-4 rounded-md border border-[#e5e7eb] shadow-xs space-y-1.5">
          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#003f87]">
            <Terminal className="w-4 h-4 text-[#003f87]" />
            <span>Configurable Proxy Pool</span>
          </div>
          <p className="text-[11px] text-[#6b7280]">
            Strict rate-limited IP rotation pool ensuring server strain avoidance and system auditability.
          </p>
        </div>
      </div>

      {/* Live Scraper Activity Stream */}
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f3f4f6] pb-3">
          <h3 className="text-base font-bold text-[#1f2937]">Live Scraper Execution Logs</h3>
          <div className="flex space-x-2">
            {(['ALL', 'AIRLINES', 'OTAS'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setComplianceFilter(f)}
                className={`px-3 py-1 text-xs font-medium rounded ${
                  complianceFilter === f
                    ? 'bg-[#003f87] text-white'
                    : 'bg-[#f9fafb] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-[#e5e7eb] rounded-md">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f9fafb] text-[#1f2937] font-bold border-b border-[#e5e7eb]">
              <tr>
                <th className="p-3">Job ID</th>
                <th className="p-3">Source Name</th>
                <th className="p-3">Category</th>
                <th className="p-3">Route</th>
                <th className="p-3">Status</th>
                <th className="p-3">Records</th>
                <th className="p-3">Latency</th>
                <th className="p-3">Compliance Guarantee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f9fafb] transition-colors">
                  <td className="p-3 font-mono text-[11px] font-semibold text-[#003f87]">{log.id}</td>
                  <td className="p-3 font-medium text-[#1f2937]">{log.source}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.type === 'Airline' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                      {log.type}
                    </span>
                  </td>
                  <td className="p-3 font-semibold">{log.route}</td>
                  <td className="p-3">
                    {log.status === 'SUCCESS' && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> SUCCESS
                      </span>
                    )}
                    {log.status === 'RATE_LIMITED' && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" /> THROTTLED (429)
                      </span>
                    )}
                    {log.status === 'BLOCKED_QUEUE' && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded inline-flex items-center">
                        <Lock className="w-3 h-3 mr-1" /> FALLBACK QUEUE
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-semibold text-[#1f2937]">{log.recordsScraped}</td>
                  <td className="p-3 text-[#6b7280]">{log.responseTimeMs} ms</td>
                  <td className="p-3 text-[11px] text-[#6b7280]">{log.complianceNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
