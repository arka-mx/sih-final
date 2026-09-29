import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface FareItem {
  id: string;
  origin: string;
  destination: string;
  carrier: string;
  flight_no: string;
  departure_date: string;
  scrape_date: string;
  advance_purchase_days: number;
  fare_class: string;
  base_fare: number;
  taxes_udf: number;
  convenience_fee: number;
  total_fare: number;
  seat_availability_flag: boolean;
  source: string;
  audit_hash: string;
}

interface RouteFaresResponse {
  status: string;
  pair: string;
  summary: {
    median_fare: number;
    iqr_spread: number;
    min_fare: number;
    max_fare: number;
    carrier_share: Record<string, number>;
  };
  total_count: number;
  limit: number;
  offset: number;
  fares: FareItem[];
}

interface RouteMetadataResponse {
  status: string;
  routes: { pair: string }[];
}

function mapFare(pair: string, f: FareItem) {
  return {
    id: f.id,
    route: pair,
    origin: f.origin,
    destination: f.destination,
    airline: f.carrier,
    flightNo: f.flight_no,
    departureDate: f.departure_date,
    date: f.scrape_date,
    bookingWindow: `T+${f.advance_purchase_days}`,
    baseFare: f.base_fare,
    tax: f.taxes_udf,
    convenienceFee: f.convenience_fee,
    totalFare: f.total_fare,
    scrapedAt: f.scrape_date,
    source: f.source,
    auditHash: f.audit_hash,
  };
}

// Used by DataExplorerView (raw record audit table) and RouteExplorerView
// (per-route fare trend/airline breakdown). Proxies GET
// /api/routes/{pair}/fares; when route=ALL, fans out across the DGCA basket.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const route = (searchParams.get('route') || 'ALL').toUpperCase();
  const airline = searchParams.get('airline');
  const window = searchParams.get('window');
  const limit = searchParams.get('limit') || '50';

  const qs = new URLSearchParams();
  if (airline && airline !== 'ALL') qs.set('airline', airline);
  if (window && window !== 'ALL') qs.set('window', window);

  try {
    if (route !== 'ALL') {
      qs.set('limit', limit);
      const backend = await backendFetchJson<RouteFaresResponse>(
        `/api/routes/${encodeURIComponent(route)}/fares?${qs.toString()}`
      );
      return NextResponse.json({
        status: 'success',
        totalCount: backend.total_count,
        summary: backend.summary,
        fares: backend.fares.map((f) => mapFare(backend.pair, f)),
      });
    }

    // route=ALL: fan out across the monitored DGCA basket and merge results.
    const metadata = await backendFetchJson<RouteMetadataResponse>('/api/metadata/routes');
    const pairs = metadata.routes.map((r) => r.pair);
    const perRouteLimit = Math.max(1, Math.min(20, Math.ceil(Number(limit) / Math.max(pairs.length, 1))));
    qs.set('limit', String(perRouteLimit));

    const results = await Promise.allSettled(
      pairs.map((pair) =>
        backendFetchJson<RouteFaresResponse>(`/api/routes/${encodeURIComponent(pair)}/fares?${qs.toString()}`)
      )
    );

    const fares = results
      .filter((r): r is PromiseFulfilledResult<RouteFaresResponse> => r.status === 'fulfilled')
      .flatMap((r) => r.value.fares.map((f) => mapFare(r.value.pair, f)));

    return NextResponse.json({
      status: 'success',
      totalCount: fares.length,
      summary: null,
      fares,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
