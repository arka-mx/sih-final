import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface FareItem {
  origin: string;
  destination: string;
  carrier: string;
  scrape_date: string;
  advance_purchase_days: number;
  base_fare: number;
  taxes_udf: number;
  total_fare: number;
  source: string;
}

interface RouteFaresResponse {
  status: string;
  pair: string;
  fares: FareItem[];
}

interface RouteMetadataResponse {
  status: string;
  routes: { pair: string }[];
}

const PER_ROUTE_EXPORT_LIMIT = 100;

// Thin proxy for the microdata export feature: fans out over the real
// per-route fare records on the FastAPI backend (GET /api/routes/{pair}/fares)
// instead of exporting the static MOCK_RAW_FARES fixture.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({ format: 'json' }));
    const format = body.format || 'json';

    const metadata = await backendFetchJson<RouteMetadataResponse>('/api/metadata/routes');
    const pairs = metadata.routes.map((r) => r.pair);

    const results = await Promise.allSettled(
      pairs.map((pair) =>
        backendFetchJson<RouteFaresResponse>(
          `/api/routes/${encodeURIComponent(pair)}/fares?limit=${PER_ROUTE_EXPORT_LIMIT}`
        )
      )
    );

    const records = results
      .filter((r): r is PromiseFulfilledResult<RouteFaresResponse> => r.status === 'fulfilled')
      .flatMap((r) =>
        r.value.fares.map((f) => ({
          date: f.scrape_date,
          route: r.value.pair,
          airline: f.carrier,
          bookingWindow: `T+${f.advance_purchase_days}`,
          baseFare: f.base_fare,
          tax: f.taxes_udf,
          totalFare: f.total_fare,
          source: f.source,
        }))
      );

    if (format === 'csv') {
      let csv = 'Date,Route,Airline,Window,BaseFare,Tax,TotalFare,Source\n';
      records.forEach((r) => {
        csv += `${r.date},${r.route},${r.airline},${r.bookingWindow},${r.baseFare},${r.tax},${r.totalFare},${r.source}\n`;
      });
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="apix_export.csv"',
        },
      });
    }

    return NextResponse.json({
      success: true,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
