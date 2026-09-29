import { NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface TopRouteSummary {
  pair: string;
  index: number;
  current_avg_fare: number;
  trend: string;
}

interface PublicSummaryResponse {
  status: string;
  latest_daily_index: number;
  latest_monthly_index: number;
  mom_change_pct: number;
  yoy_change_pct: number;
  top_routes: TopRouteSummary[];
  last_updated: string;
  data_classification: string;
  notice: string;
}

// Used by HomeView hero + "High-Density Flight Corridors" grid. Proxies the
// public, unauthenticated GET /api/public/summary endpoint.
export async function GET() {
  try {
    const backend = await backendFetchJson<PublicSummaryResponse>('/api/public/summary');

    return NextResponse.json({
      status: 'success',
      latestDailyIndex: backend.latest_daily_index,
      latestMonthlyIndex: backend.latest_monthly_index,
      momChangePct: backend.mom_change_pct,
      yoyChangePct: backend.yoy_change_pct,
      topRoutes: backend.top_routes.map((r) => ({
        pair: r.pair,
        index: r.index,
        currentAvgFare: r.current_avg_fare,
        trend: r.trend,
      })),
      lastUpdated: backend.last_updated,
      notice: backend.notice,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
