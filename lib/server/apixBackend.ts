// Server-only helper for calling the FastAPI backend (apix-api) from Next.js
// Route Handlers. Never import this from a client component - it injects a
// server-side API key that must not reach the browser.

const BACKEND_BASE_URL =
  process.env.APIX_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8001';

// Demo NSO key used to authenticate the dashboard's own server-side proxy
// calls against the FastAPI backend. In production this should be set to a
// dedicated service credential via APIX_SERVER_API_KEY.
const SERVER_API_KEY = process.env.APIX_SERVER_API_KEY || process.env.NEXT_PUBLIC_DEMO_NSO_KEY || '';

export class BackendError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Calls the FastAPI backend and returns the parsed JSON body.
 * Throws BackendError on non-2xx responses so route handlers can translate
 * it into a consistent error JSON payload for the frontend.
 */
export async function backendFetchJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${BACKEND_BASE_URL.replace(/\/$/, '')}${path}`;
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (SERVER_API_KEY && !headers.has('X-API-Key')) {
    headers.set('X-API-Key', SERVER_API_KEY);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch (err) {
    throw new BackendError(
      `Unable to reach APIx backend at ${BACKEND_BASE_URL}. Is FastAPI running (uvicorn app.main:app)?`,
      0,
      { details: err instanceof Error ? err.message : String(err) }
    );
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? (body as { detail: unknown }).detail
        : body;
    throw new BackendError(
      typeof detail === 'string' ? detail : `APIx backend request failed (${res.status})`,
      res.status,
      body
    );
  }

  return body as T;
}

export function backendErrorResponse(err: unknown) {
  if (err instanceof BackendError) {
    return {
      status: err.status || 502,
      payload: {
        error: err.message,
        backendStatus: err.status,
        details: err.body,
      },
    };
  }
  return {
    status: 500,
    payload: {
      error: err instanceof Error ? err.message : 'Unknown error contacting APIx backend',
    },
  };
}
