import { NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface FareItem {
  carrier: string;
  total_fare: number;
}

interface RouteFaresResponse {
  status: string;
  pair: string;
  fares: FareItem[];
}

interface RouteMetadataResponse {
  status: string;
  routes: { pair: string; dgca_traffic_weight: number }[];
}

const WINDOWS = ['T+1', 'T+7', 'T+15', 'T+30', 'T+45'] as const;
const MAX_ROUTES = 6;
const PER_WINDOW_LIMIT = 8;

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Used by MarketAnalysisView: route x booking-window fare heatmap, lead-time
// elasticity curve, airline price/market-share comparison, and a
// window-spread volatility approximation - all aggregated from real fare
// records via GET /api/routes/{pair}/fares (there is no single backend
// endpoint for these views, so this route fans out and aggregates).
export async function GET() {
  try {
    const metadata = await backendFetchJson<RouteMetadataResponse>('/api/metadata/routes');
    const topPairs = [...metadata.routes]
      .sort((a, b) => b.dgca_traffic_weight - a.dgca_traffic_weight)
      .slice(0, MAX_ROUTES)
      .map((r) => r.pair);

    const cells = await Promise.allSettled(
      topPairs.flatMap((pair) =>
        WINDOWS.map(async (win) => {
          const data = await backendFetchJson<RouteFaresResponse>(
            `/api/routes/${encodeURIComponent(pair)}/fares?window=${encodeURIComponent(win)}&limit=${PER_WINDOW_LIMIT}`
          );
          return { pair, window: win, fares: data.fares };
        })
      )
    );

    const byRoute: Record<string, Record<string, number | null>> = {};
    const byWindow: Record<string, number[]> = Object.fromEntries(WINDOWS.map((w) => [w, []]));
    const byCarrier: Record<string, { total: number; count: number }> = {};

    for (const result of cells) {
      if (result.status !== 'fulfilled') continue;
      const { pair, window, fares } = result.value;
      const avgFare = average(fares.map((f) => f.total_fare));

      if (!byRoute[pair]) byRoute[pair] = {};
      byRoute[pair][window] = avgFare !== null ? Math.round(avgFare) : null;

      if (avgFare !== null) byWindow[window].push(avgFare);
      for (const f of fares) {
        if (!byCarrier[f.carrier]) byCarrier[f.carrier] = { total: 0, count: 0 };
        byCarrier[f.carrier].total += f.total_fare;
        byCarrier[f.carrier].count += 1;
      }
    }

    const heatmap: Record<string, string | number | null>[] = topPairs
      .filter((pair) => byRoute[pair])
      .map((pair) => ({ route: pair, ...byRoute[pair] }));

    const elasticity = WINDOWS.map((w) => ({
      window: w,
      label:
        w === 'T+1'
          ? '1 Day (Last Minute)'
          : w === 'T+7'
          ? '7 Days Advance'
          : w === 'T+15'
          ? '15 Days Advance'
          : w === 'T+30'
          ? '30 Days Advance'
          : '45 Days Advance',
      avgFare: average(byWindow[w]) !== null ? Math.round(average(byWindow[w])!) : null,
    }));

    // Optimal booking window: turns the elasticity curve above into an
    // explicit "book on this window" answer (PRD stand-out feature #4),
    // mirroring index_math/elasticity.py::find_optimal_window. Per-route
    // recommendations are also available via
    // GET /api/routes/{pair}/optimal-window on the FastAPI backend.
    const elasticityWithFares = elasticity.filter(
      (e): e is typeof e & { avgFare: number } => e.avgFare !== null
    );
    const optimalWindow = elasticityWithFares.length
      ? (() => {
          const cheapest = elasticityWithFares.reduce((a, b) => (b.avgFare < a.avgFare ? b : a));
          const priciest = elasticityWithFares.reduce((a, b) => (b.avgFare > a.avgFare ? b : a));
          const savingsAmount = Math.round(priciest.avgFare - cheapest.avgFare);
          const savingsPct = priciest.avgFare
            ? Math.round((savingsAmount / priciest.avgFare) * 1000) / 10
            : 0;
          return {
            optimalWindow: cheapest.window,
            optimalAvgFare: cheapest.avgFare,
            worstWindow: priciest.window,
            worstAvgFare: priciest.avgFare,
            savingsAmount,
            savingsPct,
          };
        })()
      : null;

    const totalCarrierRecords = Object.values(byCarrier).reduce((a, c) => a + c.count, 0);
    const airlines = Object.entries(byCarrier)
      .map(([name, { total, count }]) => ({
        name,
        avgPrice: Math.round(total / count),
        marketShare: totalCarrierRecords ? `${((count / totalCarrierRecords) * 100).toFixed(0)}%` : '0%',
        observations: count,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice);

    // Volatility approximation: coefficient of variation across each route's
    // T+1..T+45 average fares (real fare spread, not intraday capture).
    const volatility = heatmap
      .map((row) => {
        const values = WINDOWS.map((w) => row[w]).filter((v): v is number => typeof v === 'number');
        if (values.length < 2) return null;
        const mean = average(values)!;
        const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
        const stdDev = Math.sqrt(variance);
        return { corridor: row.route, volatilityPct: mean ? Math.round((stdDev / mean) * 1000) / 10 : 0 };
      })
      .filter((v): v is { corridor: string; volatilityPct: number } => v !== null)
      .sort((a, b) => b.volatilityPct - a.volatilityPct);

    return NextResponse.json({
      status: 'success',
      windows: WINDOWS,
      heatmap,
      elasticity,
      optimalWindow,
      airlines,
      volatility,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
