import { NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface RouteMetadataItem {
  pair: string;
  origin: string;
  origin_name: string;
  destination: string;
  destination_name: string;
  dgca_traffic_weight: number;
  monthly_passenger_volume: number;
  coverage_tier: string;
}

interface RouteMetadataResponse {
  status: string;
  basket_coverage_share: number;
  routes: RouteMetadataItem[];
}

// Used by RouteExplorerView (origin/destination pickers) and DataExplorerView
// (route filter). Proxies GET /api/metadata/routes on the FastAPI service.
export async function GET() {
  try {
    const backend = await backendFetchJson<RouteMetadataResponse>('/api/metadata/routes');

    return NextResponse.json({
      status: 'success',
      basketCoverageShare: backend.basket_coverage_share,
      routes: backend.routes.map((r) => ({
        pair: r.pair,
        origin: r.origin,
        originName: r.origin_name,
        destination: r.destination,
        destinationName: r.destination_name,
        dgcaWeight: r.dgca_traffic_weight,
        monthlyVolume: r.monthly_passenger_volume,
        tier: r.coverage_tier,
      })),
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
