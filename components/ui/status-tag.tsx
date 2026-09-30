'use client';

import React from 'react';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const DOT_COLOR: Record<StatusTone, string> = {
  neutral: 'bg-ink-400',
  info: 'bg-navy-600',
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  danger: 'bg-rose-600',
};

const TEXT_COLOR: Record<StatusTone, string> = {
  neutral: 'text-ink-600',
  info: 'text-navy-700',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
};

interface StatusTagProps {
  tone?: StatusTone;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}

// A dot + label instead of a filled color pill - reads as a status signal
// without the "candy chip" look of bg-{color}-50/border-{color}-200 badges.
export function StatusTag({ tone = 'neutral', icon: IconComp, children, className = '' }: StatusTagProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${TEXT_COLOR[tone]} ${className}`}>
      {IconComp ? <IconComp className="w-3 h-3 shrink-0" /> : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLOR[tone]}`} />}
      {children}
    </span>
  );
}
