'use client';

import React, { useState } from 'react';
import {
  Code2,
  Play,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ShieldCheck,
  Key,
  Info,
} from 'lucide-react';

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
      <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#003f87] uppercase tracking-wider">
            <Code2 className="w-4 h-4 text-[#003f87]" />
            <span>FastAPI REST Layer • PRD Section 6 Implementation</span>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={`${apiBaseUrl}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#003f87]/10 hover:bg-[#003f87]/20 text-[#003f87] text-xs font-semibold px-3 py-1.5 rounded flex items-center space-x-1.5 transition-colors"
            >
              <span>Swagger UI (/docs)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={`${apiBaseUrl}/redoc`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded flex items-center space-x-1.5 transition-colors"
            >
              <span>ReDoc (/redoc)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <h2 className="text-xl font-bold text-[#1f2937]">
          MoSPI & RBI Real-Time Airfare Price Index API
        </h2>
        <p className="text-xs text-[#6b7280]">
          High-frequency FastAPI endpoints designed for integration into MoSPI National
          Statistical Office (NSO) Consumer Price Index (CPI) and the Reserve Bank of India (RBI)
          Monetary Policy Department.
        </p>

        {/* API Base URL and Credentials Bar */}
        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100">
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              FastAPI Service Base URL
            </label>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              className="w-full text-xs font-mono px-3 py-1.5 rounded border border-gray-300 focus:outline-none focus:border-[#003f87]"
              placeholder="http://localhost:8000"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1 flex items-center space-x-1">
              <Key className="w-3 h-3 text-[#003f87]" />
              <span>Authentication Persona (X-API-Key)</span>
            </label>
            {isDev ? (
              <div className="space-y-1.5">
                <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                  DEMO MODE — Keys are local-only and rotate in production.
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('none')}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium ${
                      selectedRole === 'none'
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-300'
                    }`}
                  >
                    Public (No Key)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('nso')}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium ${
                      selectedRole === 'nso'
                        ? 'bg-[#003f87] text-white border-[#003f87]'
                        : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200'
                    }`}
                  >
                    NSO Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('rbi')}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium ${
                      selectedRole === 'rbi'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    RBI Analyst
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedRole('custom')}
                    className={`text-xs px-2.5 py-1.5 rounded border font-medium ${
                      selectedRole === 'custom'
                        ? 'bg-purple-700 text-white border-purple-700'
                        : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border-purple-200'
                    }`}
                  >
                    Custom Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-3 py-2 rounded">
                Custom API key required for authorized access. Persona presets are disabled in production.
              </div>
            )}
          </div>
        </div>

        {selectedRole === 'custom' && (
          <div className="pt-2">
            <input
              type="text"
              placeholder="Enter custom API Key"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              className="w-full text-xs font-mono px-3 py-1.5 rounded border border-purple-300 focus:outline-none focus:border-purple-600"
            />
          </div>
        )}
      </div>

      {/* Endpoint List & Live Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints List */}
        <div className="bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#f3f4f6] pb-2">
            <h3 className="text-sm font-bold text-[#1f2937]">REST Endpoints (PRD §6)</h3>
            <span className="text-[10px] bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded">
              {AVAILABLE_ENDPOINTS.length} Endpoints
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
                  className={`p-3 rounded-md border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#e8f4f8] border-[#003f87] shadow-xs'
                      : 'bg-[#f9fafb] border-[#e5e7eb] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#003f87]">
                        {ep.path.split('?')[0]}
                      </span>
                    </div>
                    {ep.authRequired ? (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center space-x-0.5">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Key Required</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-gray-100 text-gray-600">
                        Public
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6b7280] leading-snug">{ep.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Runner & Response Box */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-[#e5e7eb] shadow-xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-[#f3f4f6] pb-3">
              <div>
                <span className="text-xs text-[#6b7280] block">Target Endpoint</span>
                <span className="font-mono text-sm font-bold text-[#003f87]">
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
                className="bg-[#003f87] text-white hover:bg-[#002d62] text-xs font-bold px-4 py-2 rounded flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isLoading ? 'Executing Request...' : 'Send Live Request'}</span>
              </button>
            </div>

            {/* Metrics & Header telemetry bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-gray-50 p-2.5 rounded border border-gray-200">
              <div>
                <span className="text-[10px] text-gray-500 block">HTTP Status</span>
                <span
                  className={`font-mono font-bold ${
                    httpStatus === 200
                      ? 'text-emerald-600'
                      : httpStatus && httpStatus >= 400
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {httpStatus ? `${httpStatus} ${httpStatus === 200 ? 'OK' : ''}` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Latency</span>
                <span className="font-mono font-bold text-gray-700">
                  {responseTime !== null ? `${responseTime} ms` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Rate Limit Remaining</span>
                <span className="font-mono font-bold text-[#003f87]">
                  {rateLimitInfo.remaining !== null
                    ? `${rateLimitInfo.remaining} / ${rateLimitInfo.limit}`
                    : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block">Rate Limiter Backend</span>
                <span className="font-mono font-semibold text-gray-700">
                  {rateLimitInfo.backend || '—'}
                </span>
              </div>
            </div>

            {/* Response Console */}
            <div className="bg-[#1f2937] rounded-md p-4 font-mono text-xs text-emerald-400 space-y-2 relative min-h-[320px] max-h-[460px] overflow-auto">
              <div className="flex justify-between items-center text-[11px] text-gray-400 border-b border-gray-700 pb-2">
                <span className="flex items-center">
                  <Terminal className="w-3.5 h-3.5 mr-1" />
                  {httpStatus
                    ? `HTTP ${httpStatus} • application/json`
                    : 'Waiting for live request execution...'}
                </span>
                {apiResponse && (
                  <button
                    onClick={handleCopyCode}
                    className="hover:text-white flex items-center space-x-1"
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

              <pre className="whitespace-pre-wrap text-[11px] leading-relaxed">
                {apiResponse ||
                  `// Select an endpoint and persona above, then click "Send Live Request"\n// Base URL: ${apiBaseUrl}\n// Active API Key: ${
                    getEffectiveApiKey() || '(None - Public Mode)'
                  }`}
              </pre>
            </div>
          </div>

          {/* Compliance Footer */}
          <div className="bg-[#f9fafb] p-3 rounded border border-[#e5e7eb] text-xs text-[#6b7280] flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <span className="flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-[#003f87] shrink-0" />
              <span>
                Rate Limits: <strong>30 req/min</strong> for Public IP •{' '}
                <strong>600 req/min</strong> for NSO/RBI API Keys.
              </span>
            </span>
            <a
              href={`${apiBaseUrl}/openapi.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#003f87] font-semibold hover:underline flex items-center space-x-1"
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
