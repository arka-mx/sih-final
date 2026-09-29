import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface CleanedFareItem {
  id: string;
  pair: string;
  origin: string;
  destination: string;
  carrier: string;
  flight_no: string;
  departure_date: string;
  scrape_date: string;
  advance_days: number;
  fare_class: string;
  base_fare: number;
  taxes_udf: number;
  convenience_fee: number;
  total_fare: number;
  seat_avail: boolean;
  seat_availability_flag: string;
  source: string;
  audit_hash: string;
  imputation_applied: boolean;
  imputed_fields: string[];
  is_outlier: boolean;
  outlier_reason: string | null;
  is_duplicate: boolean;
  include_in_cpi_index: boolean;
  z_score: number;
}

interface PipelineAuditSummary {
  total_raw_ingested: number;
  valid_cleaned_records: number;
  duplicates_merged: number;
  outliers_flagged: number;
  imputed_records_count: number;
  sold_out_excluded: number;
  cpi_eligible_records: number;
  data_quality_score_percent: number;
}

interface PipelineCleanResponse {
  status: string;
  timestamp: string;
  audit_summary: PipelineAuditSummary;
  cleaned_records: CleanedFareItem[];
}

// Thin proxy for DataPipelineView: delegates the real cleaning, de-duplication,
// imputation (78/22 base/tax split) and IQR/Z-score outlier pipeline to
// GET/POST /api/pipeline/clean on the FastAPI backend (pipeline/cleaning.py +
// pipeline/outlier_detection.py), which is the single source of truth for
// this logic.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const route = searchParams.get('route');

  try {
    const qs = route ? `?route=${encodeURIComponent(route)}` : '';
    const backend = await backendFetchJson<PipelineCleanResponse>(`/api/pipeline/clean${qs}`);
    return NextResponse.json({
      status: backend.status,
      timestamp: backend.timestamp,
      auditSummary: backend.audit_summary,
      cleanedRecords: backend.cleaned_records,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body) ? body : body.records;

    const backend = await backendFetchJson<PipelineCleanResponse>('/api/pipeline/clean', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });

    return NextResponse.json({
      status: backend.status,
      timestamp: backend.timestamp,
      auditSummary: backend.audit_summary,
      cleanedRecords: backend.cleaned_records,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
