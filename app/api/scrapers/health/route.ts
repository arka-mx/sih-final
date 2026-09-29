import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface SourceHealthStatus {
  source_key: string;
  status: string;
  checked_at: string;
  records_found: number;
  missing_or_invalid_fields: string[];
  detail: string | null;
}

interface SourceHealthResponse {
  status: 'ok' | 'degraded';
  checked_sources: number;
  selector_miss_sources: string[];
  sources: Record<string, SourceHealthStatus>;
}

// Thin proxy for the selector/schema-change health check on the FastAPI backend.
// Polled by ScrapingEngineView to surface SELECTOR_MISS alerts instead of
// silently letting a drifted/empty source payload pass through.
export async function GET(req: NextRequest) {
  try {
    const refresh = req.nextUrl.searchParams.get('refresh') === 'true';
    const backend = await backendFetchJson<SourceHealthResponse>(
      `/api/sources/health${refresh ? '?refresh=true' : ''}`
    );

    return NextResponse.json({
      status: backend.status,
      checkedSources: backend.checked_sources,
      selectorMissSources: backend.selector_miss_sources,
      sources: backend.sources,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json({ status: 'ERROR', message: payload.error }, { status });
  }
}
