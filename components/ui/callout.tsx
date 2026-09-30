'use client';

import React from 'react';

export type CalloutTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_STYLES: Record<CalloutTone, { rule: string; icon: string }> = {
  neutral: { rule: 'border-l-ink-300', icon: 'text-ink-500' },
  info: { rule: 'border-l-navy-500', icon: 'text-navy-600' },
  success: { rule: 'border-l-emerald-500', icon: 'text-emerald-600' },
  warning: { rule: 'border-l-amber-500', icon: 'text-amber-600' },
  danger: { rule: 'border-l-rose-500', icon: 'text-rose-600' },
};

interface CalloutProps {
  tone?: CalloutTone;
  icon?: React.ElementType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// A colored rule + icon instead of a bordered/filled box - notes read as an
// annotation on the surface they sit on rather than a card nested inside a
// card. Safe to drop into a .panel or any other bordered container without
// creating a "box within a box".
export function Callout({ tone = 'neutral', icon: IconComp, title, children, className = '' }: CalloutProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div className={`flex items-start gap-2.5 border-l-2 ${styles.rule} pl-3 py-0.5 ${className}`}>
      {IconComp && <IconComp className={`w-4 h-4 shrink-0 mt-0.5 ${styles.icon}`} />}
      <div className="text-xs text-ink-600 leading-relaxed">
        {title && <span className="font-semibold text-ink-900 block mb-0.5">{title}</span>}
        {children}
      </div>
    </div>
  );
}
