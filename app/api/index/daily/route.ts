import { NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface DailyIndexItem {
  date: string;
  laspeyres: number;
  fisher: number;
  ci_lower: number;
  ci_upper: number;
  windows: Record<string, number>;
  sectors: { pair: string; index: number; weight: number }[];
}

interface DailyIndexResponse {
  status: string;
  base_period: string;
  total_records: number;
  data: DailyIndexItem[];
}

// Used by MarketAnalysisView's Laspeyres vs Fisher rigor panel: returns the
// most recent daily index reading with sector-level contributions.
export async function GET() {
  try {
    const backend = await backendFetchJson<DailyIndexResponse>('/api/index/daily');
    const latest = backend.data.length ? backend.data[backend.data.length - 1] : null;

    return NextResponse.json({
      status: 'success',
      basePeriod: backend.base_period,
      latest,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
