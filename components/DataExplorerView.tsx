'use client';

import React, { useMemo, useState } from 'react';
import { MOCK_RAW_FARES } from '@/lib/mockData';
import { DEMO_MODE } from '@/lib/demoMode';
import { useApiData } from '@/lib/useApiData';
import { LoadingPanel, ErrorPanel } from './ApiStateBanner';
import { Search, Download, Copy, Check, X, Filter } from './icons';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Callout } from './ui/callout';

interface ApiFareRecord {
  id: string;
  route: string;
  airline: string;
  date: string;
  bookingWindow: string;
  baseFare: number;
  tax: number;
  totalFare: number;
  scrapedAt: string;
  source: string;
}

interface FaresApiResponse {
  totalCount: number;
  fares: ApiFareRecord[];
}

const ROUTE_OPTIONS = ['ALL', 'DEL-BOM', 'DEL-BLR', 'BOM-BLR', 'DEL-CCU', 'BLR-HYD'];
const AIRLINE_OPTIONS = ['ALL', 'IndiGo', 'Air India', 'SpiceJet', 'Akasa Air'];

export default function DataExplorerView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedAirline, setSelectedAirline] = useState('ALL');
  const [copied, setCopied] = useState(false);

  const query = new URLSearchParams({ route: selectedRoute, airline: selectedAirline, limit: '60' }).toString();
  const fares = useApiData<FaresApiResponse>(DEMO_MODE ? null : `/api/fares?${query}`, [selectedRoute, selectedAirline]);

  const filteredFares = useMemo(() => {
    const records: ApiFareRecord[] = DEMO_MODE
      ? MOCK_RAW_FARES.map((r) => ({
          id: r.id,
          route: r.route,
          airline: r.airline,
          date: r.date,
          bookingWindow: r.bookingWindow,
          baseFare: r.baseFare,
          tax: r.tax,
          totalFare: r.totalFare,
          scrapedAt: r.scrapedAt,
          source: r.source,
        }))
      : fares.data?.fares ?? [];

    return records.filter((record) => {
      const matchesSearch =
        record.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.airline.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.source.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [fares.data, searchTerm]);

  const handleDownloadCSV = () => {
    let csv = 'Date,Route,Airline,Window,BaseFare,Tax,TotalFare,Source\n';
    filteredFares.forEach((r) => {
      csv += `${r.date},${r.route},${r.airline},${r.bookingWindow},${r.baseFare},${r.tax},${r.totalFare},${r.source}\n`;
    });
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apix_raw_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredFares, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `apix_raw_data_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {DEMO_MODE && (
        <Callout tone="warning">
          Demo mode - showing static sample data, not live APIx backend results.
        </Callout>
      )}

      {/* Header & Controls */}
      <div className="panel p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Raw Data Explorer</h2>
          <p className="text-xs text-ink-500">
            Audit individual scraped quotes, base fares, taxes, and source tracking metadata
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search route, airline, or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-ink-200 rounded-lg bg-white focus:outline-none focus:border-navy-700"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-ink-500 hover:text-ink-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-ink-500 shrink-0" />
            <Select value={selectedRoute} onValueChange={(v) => v && setSelectedRoute(v)}>
              <SelectTrigger className="h-9! w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={6} className="p-1">
                {ROUTE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r} className="text-xs py-2 px-2.5 rounded-md">
                    {r === 'ALL' ? 'All Routes' : r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAirline} onValueChange={(v) => v && setSelectedAirline(v)}>
              <SelectTrigger className="h-9! w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={6} className="p-1">
                {AIRLINE_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a} className="text-xs py-2 px-2.5 rounded-md">
                    {a === 'ALL' ? 'All Airlines' : a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(selectedRoute !== 'ALL' || selectedAirline !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedRoute('ALL');
                  setSelectedAirline('ALL');
                  setSearchTerm('');
                }}
                className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {!DEMO_MODE && fares.loading && <LoadingPanel label="Fetching raw fare records..." />}
      {!DEMO_MODE && fares.error && <ErrorPanel message={fares.error} onRetry={fares.refetch} />}

      {(DEMO_MODE || (!fares.loading && !fares.error)) && (
        <div className="panel p-6 space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="text-ink-500">
              Showing <strong className="text-ink-900 font-tabular">1–{filteredFares.length}</strong> of <strong className="text-ink-900 font-tabular">{filteredFares.length}</strong> records
            </span>

            <div className="flex space-x-2">
              <button
                onClick={handleDownloadCSV}
                className="px-3 py-1.5 text-xs font-semibold text-navy-700 border border-ink-200 rounded-lg hover:bg-ink-50 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download CSV</span>
              </button>
              <button
                onClick={handleDownloadJSON}
                className="px-3 py-1.5 text-xs font-semibold text-navy-700 border border-ink-200 rounded-lg hover:bg-ink-50 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 text-xs font-semibold text-ink-700 border border-ink-200 rounded-lg hover:bg-ink-50 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-ink-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-ink-50 text-ink-700 font-semibold text-[10px] uppercase tracking-wider border-b border-ink-100">
                <tr>
                  <th className="p-3">Record ID</th>
                  <th className="p-3">Scrape Date</th>
                  <th className="p-3">Route</th>
                  <th className="p-3">Airline</th>
                  <th className="p-3">Lead Window</th>
                  <th className="p-3">Base Fare (₹)</th>
                  <th className="p-3">Taxes/UDF (₹)</th>
                  <th className="p-3">Total Fare (₹)</th>
                  <th className="p-3">Scrape Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredFares.map((f) => (
                  <tr key={f.id} className="hover:bg-ink-50/60 transition-colors">
                    <td className="p-3 font-mono text-[11px] text-navy-700">{f.id}</td>
                    <td className="p-3 text-ink-500 font-tabular">{f.date}</td>
                    <td className="p-3 font-semibold text-ink-900 font-mono">{f.route}</td>
                    <td className="p-3 font-medium">{f.airline}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-semibold text-navy-700 font-mono">
                        {f.bookingWindow}
                      </span>
                    </td>
                    <td className="p-3 font-tabular">₹{f.baseFare.toLocaleString()}</td>
                    <td className="p-3 text-ink-500 font-tabular">₹{f.tax.toLocaleString()}</td>
                    <td className="p-3 font-semibold text-ink-900 font-tabular">₹{f.totalFare.toLocaleString()}</td>
                    <td className="p-3 text-ink-500 text-[11px]">{f.source}</td>
                  </tr>
                ))}
                {filteredFares.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-ink-500">
                      No records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
