'use client';

import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from './icons';

export function LoadingPanel({ label = 'Loading live data from APIx backend...' }: { label?: string }) {
  return (
    <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="w-5 h-5 text-navy-700 animate-spin" />
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

// A colored rule + icon, not a boxed alert - stays legible whether it's the
// only thing on the page or sitting inside an already-bordered panel.
export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="border-l-2 border-l-rose-500 pl-4 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-ink-900">Unable to load live data</p>
          <p className="text-xs text-ink-500 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-rose-700 hover:text-rose-800 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
