'use client';

import React from 'react';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

export function LoadingPanel({ label = 'Loading live data from APIx backend...' }: { label?: string }) {
  return (
    <div className="panel p-10 flex flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="w-5 h-5 text-navy-700 animate-spin" />
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-rose-950">Unable to load live data</p>
          <p className="text-xs text-rose-800 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
