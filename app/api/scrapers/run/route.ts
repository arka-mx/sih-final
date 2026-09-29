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

interface SourceCompareResponse {
  status: string;
  data_mode: 'simulated';
  is_live_data: false;
  disclaimer: string;
  route_pair: string;
  advance_days: number;
  departure_date: string;
  matched_flights_count: number;
  fan_out_all_carriers_count: number;
  indigo_quotes_count: number;
  mmt_quotes_count: number;
  decomposed_flights: DecomposedFlight[];
  mmt_other_carriers: unknown[];
}

// Thin proxy for the deterministic fixture comparison on the FastAPI backend.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const route = (body.route || 'DEL-BOM').toUpperCase();
    const advanceDays = Number(body.advanceDays || 7);

    const backend = await backendFetchJson<SourceCompareResponse>(
      `/api/sources/compare?route=${encodeURIComponent(route)}&advance_days=${advanceDays}`
    );

    return NextResponse.json({
      status: 'SUCCESS',
      dataMode: backend.data_mode,
      isLiveData: backend.is_live_data,
      disclaimer: backend.disclaimer,
      scrapedAt: new Date().toISOString(),
      route: backend.route_pair,
      advanceDays: backend.advance_days,
      departureDate: backend.departure_date,
      counts: {
        indigoQuotes: backend.indigo_quotes_count,
        mmtQuotes: backend.mmt_quotes_count,
        matchedQuotes: backend.matched_flights_count,
        totalIngested: backend.indigo_quotes_count + backend.mmt_quotes_count,
      },
      compliance: {
        networkAccess: 'Disabled: deterministic local fixtures only',
        robotsTxt: 'Not applicable in simulated data mode',
        dataMode: backend.data_mode,
      },
      matchedDiff: backend.decomposed_flights,
      mmtOtherCarriers: backend.mmt_other_carriers,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json({ status: 'ERROR', message: payload.error }, { status });
  }
}
