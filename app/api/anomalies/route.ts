import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface AnomalyTag {
  cause: string;
  label: string;
  confidence: string;
  detail: string;
}

interface TaggedSpike {
  date: string;
  index_value: number;
  day_change_pct: number;
  z_score: number;
  tags: AnomalyTag[];
}

interface AnomalyBackendResponse {
  status: string;
  window_start: string;
  window_end: string;
  total_days: number;
  z_threshold: number;
  spikes: TaggedSpike[];
  festival_calendar_source: string;
  fuel_price_source: string;
  methodology_note: string;
}

// Used by HomeView's "Automated Anomaly Explainability & Spike Tagger" panel:
// real spike detection + festival/ATF-fuel-price cause tagging, backed by
// GET /api/public/anomalies on the FastAPI service (pipeline/anomaly_tagger.py).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = searchParams.get('days') || '90';

  try {
    const backend = await backendFetchJson<AnomalyBackendResponse>(
      `/api/public/anomalies?days=${encodeURIComponent(days)}`
    );

    return NextResponse.json({
      status: 'success',
      windowStart: backend.window_start,
      windowEnd: backend.window_end,
      totalDays: backend.total_days,
      zThreshold: backend.z_threshold,
      spikes: backend.spikes.map((s) => ({
        date: s.date,
        indexValue: s.index_value,
        dayChangePct: s.day_change_pct,
        zScore: s.z_score,
        tags: s.tags.map((t) => ({
          cause: t.cause,
          label: t.label,
          confidence: t.confidence,
          detail: t.detail,
        })),
      })),
      methodologyNote: backend.methodology_note,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
