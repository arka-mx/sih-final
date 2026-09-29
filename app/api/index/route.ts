import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface BacktestSeriesPoint {
  date: string;
  apix_index: number;
  dgca_avg_fare: number;
  variance_pct: number;
}

interface BacktestResponse {
  status: string;
  period: { start: string; end: string; total_days: number };
  metrics: { pearson_r: number; mape: number; rmse: number; target_met: boolean };
  series: BacktestSeriesPoint[];
}

// Used by HomeView: real APIx index trend vs DGCA benchmark, backed by
// GET /api/backtest/dgca-comparison on the FastAPI service.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '30';

  try {
    const backend = await backendFetchJson<BacktestResponse>(
      `/api/backtest/dgca-comparison?days=${encodeURIComponent(days)}`
    );

    const dgcaFares = backend.series.map((p) => p.dgca_avg_fare);
    const minFare = dgcaFares.length ? Math.min(...dgcaFares) : null;
    const maxFare = dgcaFares.length ? Math.max(...dgcaFares) : null;
    const avgFare = dgcaFares.length ? dgcaFares.reduce((a, b) => a + b, 0) / dgcaFares.length : null;

    return NextResponse.json({
      status: 'success',
      basePeriod: '2025-01-01=100',
      period: backend.period,
      metrics: backend.metrics,
      stats: { minFare, maxFare, avgFare },
      points: backend.series.map((p) => ({
        date: p.date,
        apixIndex: p.apix_index,
        dgcaAvgFare: p.dgca_avg_fare,
        variancePct: p.variance_pct,
      })),
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
