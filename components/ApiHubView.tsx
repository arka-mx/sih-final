'use client';

import React, { useState } from 'react';
import { Play, Copy, Check, Terminal, ExternalLink, ShieldCheck } from './icons';
import { StatusTag } from './ui/status-tag';

interface EndpointConfig {
  path: string;
  method: 'GET' | 'POST';
  desc: string;
  authRequired: boolean;
  category: 'Index' | 'Microdata' | 'Backtest' | 'OpenData' | 'Operations';
}

const AVAILABLE_ENDPOINTS: EndpointConfig[] = [
  {
    path: '/api/scrapers/run',
    method: 'POST',
    desc: 'Trigger live extraction job across IndiGo Direct & MakeMyTrip with matched flight diffing',
    authRequired: false,
    category: 'Operations',
  },
  {
    path: '/api/sources/compare?route=DEL-BOM&advance_days=7',
    method: 'GET',
    desc: 'Cross-source fee decomposition diffing identical IndiGo flight vs MakeMyTrip listing',
    authRequired: false,
    category: 'Microdata',
  },
  {
    path: '/api/public/summary',
    method: 'GET',
    desc: 'Public read-only summary (headline indices, top routes, 30 req/min)',
    authRequired: false,
    category: 'OpenData',
  },
  {
    path: '/api/index/daily',
    method: 'GET',
    desc: 'Daily raw Laspeyres & Fisher index, CI bands, and lead-time windows (T+1..T+45)',
    authRequired: true,
    category: 'Index',
  },
  {
    path: '/api/index/weekly',
    method: 'GET',
    desc: 'Rolling 7-day average index with lead-time breakdown',
    authRequired: true,
    category: 'Index',
  },
  {
    path: '/api/index/monthly?year=2026&month=8',
    method: 'GET',
    desc: 'Monthly index aligned with MoSPI CPI release cycle and sector weights',
    authRequired: true,
    category: 'Index',
  },
  {
    path: '/api/routes/DEL-BOM/fares?limit=10',
    method: 'GET',
    desc: 'Microdata: Fare records with components (base/taxes/fee) and audit hash',
    authRequired: true,
    category: 'Microdata',
  },
  {
    path: '/api/backtest/dgca-comparison?days=30',
    method: 'GET',
    desc: '30-day statistical backtest vs DGCA benchmark (Pearson r >= 0.8, MAPE, RMSE)',
    authRequired: true,
    category: 'Backtest',
  },
  {
    path: '/api/metadata/routes',
    method: 'GET',
    desc: 'Covered route basket and DGCA passenger traffic share weights',
    authRequired: true,
    category: 'Operations',
  },
  {
    path: '/api/metadata/methodology',
    method: 'GET',
    desc: 'Index methodology specifications, weighting diagrams, and quality controls',
    authRequired: true,
    category: 'Operations',
  },
  {
    path: '/api/health',
    method: 'GET',
    desc: 'Operational health check: Database and Rate Limiter connection status',
    authRequired: false,
    category: 'Operations',
  },
];

type RoleType = 'none' | 'nso' | 'rbi' | 'custom';

export default function ApiHubView() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/public/summary');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(
    process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
  );
  const [selectedRole, setSelectedRole] = useState<RoleType>('none');
  const [customKey, setCustomKey] = useState<string>('');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    limit: string | null;
    remaining: string | null;
    backend: string | null;
  }>({ limit: null, remaining: null, backend: null });
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const NSO_KEY = process.env.NEXT_PUBLIC_DEMO_NSO_KEY ?? '';
  const RBI_KEY = process.env.NEXT_PUBLIC_DEMO_RBI_KEY ?? '';
  const isDev = process.env.NODE_ENV !== 'production';

  const getEffectiveApiKey = (): string | null => {
    if (selectedRole === 'nso') return NSO_KEY || null;
    if (selectedRole === 'rbi') return RBI_KEY || null;
    if (selectedRole === 'custom') return customKey.trim() || null;
    return null;
  };

  const handleTestApi = async () => {
    setIsLoading(true);
    setApiResponse(null);
    setHttpStatus(null);
    setResponseTime(null);

    const startTime = performance.now();
    const fullUrl = `${apiBaseUrl.replace(/\/$/, '')}${selectedEndpoint}`;
    const key = getEffectiveApiKey();

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (key) {
      headers['X-API-Key'] = key;
    }

    try {
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers,
      });

      const elapsed = Math.round(performance.now() - startTime);
      setResponseTime(elapsed);
      setHttpStatus(res.status);

      // Extract rate limit headers
      setRateLimitInfo({
        limit: res.headers.get('x-ratelimit-limit'),
        remaining: res.headers.get('x-ratelimit-remaining'),
        backend: res.headers.get('x-ratelimit-backend'),
      });

      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - startTime);
      setResponseTime(elapsed);
      setHttpStatus(0);
      setApiResponse(
        JSON.stringify(
          {
            error: 'Failed to connect to FastAPI service',
            targetUrl: fullUrl,
            message:
              'Ensure FastAPI server is running (`uvicorn app.main:app --port 8000`) at ' +
              apiBaseUrl,
            details: err instanceof Error ? err.message : String(err),
          },
          null,
          2
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (apiResponse) {
      navigator.clipboard.writeText(apiResponse);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentEpConfig =
    AVAILABLE_ENDPOINTS.find((ep) => ep.path === selectedEndpoint) || AVAILABLE_ENDPOINTS[0];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="panel p-6 space-y-5">
        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-xl font-semibold text-ink-900">Airfare Price Index API</h2>
            <p className="text-xs text-ink-500">
              FastAPI REST endpoints for MoSPI/NSO and RBI integration.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1 bg-ink-50 border border-ink-100 rounded-lg p-1">
            <a
              href={`${apiBaseUrl}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy-700 text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <span>Swagger UI</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`${apiBaseUrl}/redoc`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-600 text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer"
            >
              <span>ReDoc</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Connection settings */}
        <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-semibold text-ink-500 mb-1.5">
                Base URL
              </label>
              <input
                type="text"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-ink-200 bg-white focus:outline-none focus:border-navy-700"
                placeholder="http://localhost:8000"
              />
            </div>

            <div className="lg:w-auto">
              <div className="flex items-baseline gap-2 mb-1.5">
                <label className="text-[11px] font-semibold text-ink-500">API Key Persona</label>
                {isDev && (
                  <span className="text-[10px] text-ink-400">Demo mode · local-only</span>
                )}
              </div>
              {isDev ? (
                <div className="flex gap-1.5">
                  {(
                    [
                      { id: 'none', label: 'Public' },
                      { id: 'nso', label: 'NSO Team' },
                      { id: 'rbi', label: 'RBI Analyst' },
                      { id: 'custom', label: 'Custom' },
                    ] as const
                  ).map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        selectedRole === role.id
                          ? 'bg-ink-900 text-white border-ink-900'
                          : 'bg-white text-ink-700 hover:bg-ink-100 border-ink-200'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-ink-500 bg-white border border-ink-100 px-3 py-2 rounded-lg">
                  Custom API key required for authorized access. Persona presets are disabled in production.
                </div>
              )}
            </div>
          </div>

          {selectedRole === 'custom' && (
            <input
              type="text"
              placeholder="Enter custom API Key"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-purple-300 bg-white focus:outline-none focus:border-purple-600"
            />
          )}
        </div>
      </div>

      {/* Endpoint List & Live Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-ink-100 pb-2">
            <h3 className="text-sm font-semibold text-ink-900">Endpoints</h3>
            <span className="text-[10px] bg-ink-100 text-ink-700 font-semibold px-2 py-0.5 rounded-md font-tabular">
              {AVAILABLE_ENDPOINTS.length}
            </span>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {AVAILABLE_ENDPOINTS.map((ep) => {
              const isSelected = selectedEndpoint === ep.path;
              return (
                <div
                  key={ep.path}
                  onClick={() => {
                    setSelectedEndpoint(ep.path);
                    setApiResponse(null);
                    setHttpStatus(null);
                  }}
                  className={`p-3 rounded-lg border-l-[3px] border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-navy-50 border-l-navy-700 border-navy-200'
                      : 'bg-ink-50 border-l-transparent border-ink-100 hover:bg-white hover:border-l-ink-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`shrink-0 text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                        ep.method === 'GET'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-navy-100 text-navy-700'
                      }`}
                    >
                      {ep.method}
                    </span>
                    {ep.authRequired ? (
                      <StatusTag tone="warning" icon={ShieldCheck} className="shrink-0 whitespace-nowrap text-[9px]">
                        Key Required
                      </StatusTag>
                    ) : (
                      <StatusTag tone="neutral" className="shrink-0 whitespace-nowrap text-[9px]">
                        Public
                      </StatusTag>
                    )}
                  </div>
                  <p className="font-mono text-xs font-semibold text-navy-700 break-all leading-snug mb-1">
                    {ep.path.split('?')[0]}
                  </p>
                  <p className="text-[11px] text-ink-500 leading-snug">{ep.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Runner & Response Box */}
        <div className="lg:col-span-2 panel p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-ink-100 pb-3">
              <div>
                <span className="text-xs text-ink-500 block">Target Endpoint</span>
                <span className="font-mono text-sm font-semibold text-navy-700">
                  {selectedEndpoint}
                </span>
                {currentEpConfig.authRequired && (
                  <span className="text-[11px] text-amber-700 block mt-0.5">
                    Requires API key with NSO or RBI role.
                  </span>
                )}
              </div>
              <button
                onClick={handleTestApi}
                disabled={isLoading}
                className="bg-navy-700 text-white hover:bg-navy-800 text-xs font-semibold px-4 py-2 rounded-lg flex items-center justify-center space-x-1.5 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isLoading ? 'Executing Request...' : 'Send Live Request'}</span>
              </button>
            </div>

            {/* Metrics & Header telemetry bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-ink-50 p-2.5 rounded-lg border border-ink-100">
              <div>
                <span className="text-[10px] text-ink-500 block">HTTP Status</span>
                <span
                  className={`font-mono font-semibold font-tabular ${
                    httpStatus === 200
                      ? 'text-emerald-600'
                      : httpStatus && httpStatus >= 400
                      ? 'text-rose-600'
                      : 'text-ink-500'
                  }`}
                >
                  {httpStatus ? `${httpStatus} ${httpStatus === 200 ? 'OK' : ''}` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-500 block">Latency</span>
                <span className="font-mono font-semibold font-tabular text-ink-700">
                  {responseTime !== null ? `${responseTime} ms` : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-500 block">Rate Limit Remaining</span>
                <span className="font-mono font-semibold font-tabular text-navy-700">
                  {rateLimitInfo.remaining !== null
                    ? `${rateLimitInfo.remaining} / ${rateLimitInfo.limit}`
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-ink-500 block">Limiter Backend</span>
                <span className="font-mono font-semibold text-ink-700">
                  {rateLimitInfo.backend || '-'}
                </span>
              </div>
            </div>

            {/* Response Console */}
            <div className="bg-ink-950 text-ink-100 rounded-lg p-4 font-mono text-xs space-y-2 relative min-h-[320px] max-h-[460px] overflow-auto">
              <div className="flex justify-between items-center text-[11px] text-ink-400 border-b border-ink-800 pb-2">
                <span className="flex items-center">
                  <Terminal className="w-3.5 h-3.5 mr-1" />
                  {httpStatus
                    ? `HTTP ${httpStatus} • application/json`
                    : 'Awaiting request...'}
                </span>
                {apiResponse && (
                  <button
                    onClick={handleCopyCode}
                    className="hover:text-white flex items-center space-x-1 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-100">
                {apiResponse ||
                  `// Select an endpoint above, then Send Live Request\n// Base URL: ${apiBaseUrl}\n// API Key: ${
                    getEffectiveApiKey() || '(none - public mode)'
                  }`}
              </pre>
            </div>
          </div>

          {/* Compliance Footer */}
          <div className="bg-ink-50 p-3 rounded-lg border border-ink-100 text-xs text-ink-500 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <span>
              Rate Limits: <strong className="font-semibold">30 req/min</strong> for Public IP •{' '}
              <strong className="font-semibold">600 req/min</strong> for NSO/RBI API Keys.
            </span>
            <a
              href={`${apiBaseUrl}/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-navy-700 font-semibold hover:underline flex items-center space-x-1"
            >
              <span>OpenAPI 3.1 Spec JSON</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
