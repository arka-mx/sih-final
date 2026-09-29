'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches JSON from a same-origin Next.js API route (which proxies the real
 * FastAPI backend) and exposes loading/error state for UI handling.
 * Pass `url: null` to skip fetching (e.g. while a required filter is unset).
 */
export function useApiData<T = unknown>(url: string | null, deps: unknown[] = []): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cancelledRef = useRef(false);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    cancelledRef.current = false;

    if (!url) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount/deps-change data hook
    setLoading(true);
    setError(null);

    fetch(url, { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const message = body?.error || body?.detail?.detail || body?.detail || `Request failed (${res.status})`;
          throw new Error(typeof message === 'string' ? message : `Request failed (${res.status})`);
        }
        return body as T;
      })
      .then((json) => {
        if (!cancelledRef.current) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce, ...deps]);

  return { data, loading: url ? loading : false, error: url ? error : null, refetch };
}
