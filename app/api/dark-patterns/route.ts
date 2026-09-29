import { NextRequest, NextResponse } from 'next/server';
import { backendFetchJson, backendErrorResponse } from '@/lib/server/apixBackend';

interface DarkPatternFlagItem {
  scrape_id: string;
  source_platform: string;
  route_pair: string;
  carrier: string;
  flight_no: string;
  departure_date: string;
  advance_days: number;
  pattern_type: string;
  severity: string;
  message: string;
  evidence: Record<string, unknown>;
  raw_payload_ref: string;
}

interface DarkPatternBackendResponse {
  status: string;
  route_pair: string;
  advance_days: number;
  departure_date: string;
  total_listings_scanned: number;
  total_flagged: number;
  flagged_by_pattern_type: Record<string, number>;
  flagged_by_severity: Record<string, number>;
  flags: DarkPatternFlagItem[];
  methodology_note: string;
}

// Used by the "Fare-Manipulation / Dark Pattern Detector" panel: scans a
// simulated OTA listing batch for artificial-scarcity copy and fare-cookie
// price escalation, backed by GET /api/public/dark-patterns on the FastAPI
// service (pipeline/dark_pattern_detector.py).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const route = searchParams.get('route') || 'DEL-BOM';
  const advanceDays = searchParams.get('advanceDays') || '7';

  try {
    const backend = await backendFetchJson<DarkPatternBackendResponse>(
      `/api/public/dark-patterns?route=${encodeURIComponent(route)}&advance_days=${encodeURIComponent(advanceDays)}`
    );

    return NextResponse.json({
      status: 'success',
      routePair: backend.route_pair,
      advanceDays: backend.advance_days,
      departureDate: backend.departure_date,
      totalListingsScanned: backend.total_listings_scanned,
      totalFlagged: backend.total_flagged,
      flaggedByPatternType: backend.flagged_by_pattern_type,
      flaggedBySeverity: backend.flagged_by_severity,
      flags: backend.flags.map((f) => ({
        scrapeId: f.scrape_id,
        sourcePlatform: f.source_platform,
        routePair: f.route_pair,
        carrier: f.carrier,
        flightNo: f.flight_no,
        departureDate: f.departure_date,
        advanceDays: f.advance_days,
        patternType: f.pattern_type,
        severity: f.severity,
        message: f.message,
        evidence: f.evidence,
      })),
      methodologyNote: backend.methodology_note,
    });
  } catch (err) {
    const { status, payload } = backendErrorResponse(err);
    return NextResponse.json(payload, { status });
  }
}
