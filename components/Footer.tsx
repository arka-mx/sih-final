'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-ink-100 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center space-y-2">
        <p className="text-xs text-ink-500">
          &copy; 2026 Ministry of Statistics &amp; Programme Implementation &middot; Data Informatics &amp; Innovation Division &middot; SIH 26056
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>All systems operational</span>
          </span>
          <span className="text-ink-200">&middot;</span>
          <span>Daily extraction 02:00 IST</span>
          <span className="text-ink-200">&middot;</span>
          <a href="mailto:airfare-index@mospi.gov.in" className="text-navy-700 hover:underline">
            airfare-index@mospi.gov.in
          </a>
        </div>
      </div>
    </footer>
  );
}
