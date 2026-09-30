import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface BacktestSeriesPoint {
  date: string;
  apix_index: number;
  dgca_avg_fare: number;
  variance_pct: number;
  ci_lower?: number;
  ci_upper?: number;
}

interface BacktestResponse {
  status: string;
  period: { start: string; end: string; total_days: number };
  metrics: { pearson_r: number; mape: number; rmse: number; target_met: boolean };
  series: BacktestSeriesPoint[];
  methodology_note: string;
}

// Used by BacktestView: full DGCA backtest series + metrics, proxied from
// GET /api/backtest/dgca-comparison on the FastAPI service.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '30';

  try {
    const backend = await backendFetchJson<BacktestResponse>(
      `/api/backtest/dgca-comparison?days=${encodeURIComponent(days)}`
    );

    // Derive implied fare / tracking residual client-facing fields using the
    // same formula the backend uses internally (base_implied anchored to the
    // first observation), since BacktestSeriesPoint only exposes variance_pct.
    const series = backend.series;
    let baseImplied = 0;
    if (series.length > 0 && series[0].apix_index !== 0) {
      baseImplied = series[0].dgca_avg_fare * (100 / series[0].apix_index);
    }

    const points = series.map((p) => {
      const impliedFare = baseImplied * (p.apix_index / 100);
      const margin = 1.96 * (p.apix_index * 0.004);
      const ciLower = p.ci_lower != null ? p.ci_lower : Math.round((p.apix_index - margin) * 100) / 100;
      const ciUpper = p.ci_upper != null ? p.ci_upper : Math.round((p.apix_index + margin) * 100) / 100;
      return {
        date: p.date,
        apixIndex: p.apix_index,
        dgcaAvgFare: p.dgca_avg_fare,
        impliedFare: Math.round(impliedFare * 100) / 100,
        variancePct: p.variance_pct,
        trackingResidual: Math.round((impliedFare - p.dgca_avg_fare) * 100) / 100,
        ciLower,
        ciUpper,
        ciRange: [ciLower, ciUpper],
      };
    });

    // t-statistic for the Pearson correlation (n-2 degrees of freedom),
    // computed from the real sample size instead of a hardcoded figure.
    const n = series.length;
    const r = backend.metrics.pearson_r;
    const tStat =
      n > 2 && Math.abs(r) < 1 ? r * Math.sqrt((n - 2) / (1 - r * r)) : null;

    return NextResponse.json({
      status: 'success',
      period: backend.period,
      metrics: backend.metrics,
      significance: {
        n,
        degreesOfFreedom: Math.max(n - 2, 0),
        tStatistic: tStat !== null ? Math.round(tStat * 100) / 100 : null,
      },
      methodologyNote: backend.methodology_note,
      points,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
