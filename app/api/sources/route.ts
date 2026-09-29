import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface DecomposedFlight {
  route_pair: string;
  carrier: string;
  flight_no: string;
  departure_date: string;
  advance_days: number;
  direct_total: number;
  mmt_total: number;
  inferred_convenience_fee: number;
  direct_base: number;
  mmt_base: number;
  base_fare_diff: number;
  raw_direct_ref: string;
  raw_mmt_ref: string;
}

interface SourcesCompareResponse {
  status: string;
  route_pair: string;
  advance_days: number;
  departure_date: string;
  matched_flights_count: number;
  fan_out_all_carriers_count: number;
  decomposed_flights: DecomposedFlight[];
}

// Used by MarketAnalysisView's cross-source (IndiGo-direct vs MakeMyTrip) diff
// tab. Proxies the public GET /api/sources/compare endpoint (no API key
// required on the backend).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const route = searchParams.get('route') || 'DEL-BOM';
  const advanceDays = searchParams.get('advance_days') || '7';

  try {
    const backend = await backendFetchJson<SourcesCompareResponse>(
      `/api/sources/compare?route=${encodeURIComponent(route)}&advance_days=${encodeURIComponent(advanceDays)}`
    );

    return NextResponse.json({
      status: 'success',
      routePair: backend.route_pair,
      advanceDays: backend.advance_days,
      departureDate: backend.departure_date,
      matchedFlightsCount: backend.matched_flights_count,
      flights: backend.decomposed_flights.map((f) => ({
        route: f.route_pair,
        carrier: f.carrier,
        flightNo: f.flight_no,
        departureDate: f.departure_date,
        advanceDays: f.advance_days,
        directTotal: f.direct_total,
        mmtTotal: f.mmt_total,
        markup: f.inferred_convenience_fee,
        auditRefDirect: f.raw_direct_ref,
        auditRefMmt: f.raw_mmt_ref,
      })),
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
