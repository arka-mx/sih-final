'use client';

/**
 * Vayu icon system.
 *
 * A small, hand-drawn set built for this product instead of a generic
 * off-the-shelf pack. Shared language across every glyph:
 *  - 24x24 grid, 1.6px stroke (2px for the "fill"/active state), round caps
 *  - open right-angle chevrons for every arrowhead (no solid triangles)
 *  - square/angular frames instead of circular ones where a container is implied
 *  - a couple of icons (target, gauge, spring-coil elasticity) are drawn to
 *    literally match what they mean in this app rather than reaching for the
 *    nearest stock glyph (trophy -> target for backtest accuracy, etc).
 */

import React from 'react';

export interface IconProps {
  className?: string;
  weight?: 'regular' | 'fill';
}

function Svg({ className, weight, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={weight === 'fill' ? 2 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const dot = (cx: number, cy: number, r = 1) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
);

export function RefreshCw({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.6 5.5" />
      <path d="M17.5 4.8v3.4h-3.4" />
      <path d="M6.5 19.2v-3.4h3.4" />
    </Svg>
  );
}

export function User({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="12" cy="8.2" r="3.2" />
      <path d="M5 19.5c.9-3.3 3.6-5 7-5s6.1 1.7 7 5" />
    </Svg>
  );
}

export function ShieldCheck({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3.3 5.5 5.8v5.6c0 4.3 2.7 7.5 6.5 8.9 3.8-1.4 6.5-4.6 6.5-8.9V5.8L12 3.3Z" />
      <path d="m9 12 2 2 4.2-4.6" />
    </Svg>
  );
}

export function ShieldAlert({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3.3 5.5 5.8v5.6c0 4.3 2.7 7.5 6.5 8.9 3.8-1.4 6.5-4.6 6.5-8.9V5.8L12 3.3Z" />
      <path d="M12 8.5v4" />
      {dot(12, 15.2)}
    </Svg>
  );
}

export function Menu({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4 7h16" />
      <path d="M4 12h11" />
      <path d="M4 17h16" />
    </Svg>
  );
}

export function X({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function Loader2({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3.5v3.2" opacity={0.95} />
      <path d="m17.8 6.2-2.2 2.2" opacity={0.8} />
      <path d="M20.5 12h-3.2" opacity={0.65} />
      <path d="m17.8 17.8-2.2-2.2" opacity={0.5} />
      <path d="M12 20.5v-3.2" opacity={0.35} />
      <path d="m6.2 17.8 2.2-2.2" opacity={0.25} />
      <path d="M3.5 12h3.2" opacity={0.2} />
      <path d="m6.2 6.2 2.2 2.2" opacity={0.85} />
    </Svg>
  );
}

export function AlertTriangle({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3.8 21 19.2H3L12 3.8Z" />
      <path d="M12 9.5v4.3" />
      {dot(12, 17)}
    </Svg>
  );
}

export function AlertCircle({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.3" />
      {dot(12, 16.3)}
    </Svg>
  );
}

export function Code2({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M9 6.5 3.5 12 9 17.5" />
      <path d="M15 6.5 20.5 12 15 17.5" />
    </Svg>
  );
}

export function FileText({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M7 3.5h7l4 4v13h-11Z" />
      <path d="M14 3.5v4h4" />
      <path d="M9 9.5h2M9 12.5h6M9 15.5h6" />
    </Svg>
  );
}

export function FileCode2({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M7 3.5h7l4 4v13h-11Z" />
      <path d="M14 3.5v4h4" />
      <path d="m9.3 12.5-2 2 2 2" />
      <path d="m13.7 12.5 2 2-2 2" />
    </Svg>
  );
}

export function Terminal({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4 5.5h16v13H4Z" />
      <path d="m7.5 9.5 3 2.5-3 2.5" />
      <path d="M12.5 14.5h4" />
    </Svg>
  );
}

export function Play({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M8 5.5v13l11-6.5Z" />
    </Svg>
  );
}

export function Copy({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="9" y="9" width="10.5" height="10.5" rx="1.5" />
      <path d="M14.5 9V6.5A1.5 1.5 0 0 0 13 5H6a1.5 1.5 0 0 0-1.5 1.5V13A1.5 1.5 0 0 0 6 14.5h2.5" />
    </Svg>
  );
}

export function Check({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="m5 12.5 4.5 4.5L19.5 7" />
    </Svg>
  );
}

export function ExternalLink({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M9.5 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-3.5" />
      <path d="M13 4.5h6.5V11" />
      <path d="M19.5 4.5 11 13" />
    </Svg>
  );
}

export function Key({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="8" cy="12" r="4" />
      <path d="M11.5 12h9" />
      <path d="M17 12v3.2" />
      <path d="M20 12v2.2" />
    </Svg>
  );
}

export function Info({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 11v5.5" />
      {dot(12, 8)}
    </Svg>
  );
}

export function Sparkles({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3.5c.6 3 2 4.4 5 5-3 .6-4.4 2-5 5-.6-3-2-4.4-5-5 3-.6 4.4-2 5-5Z" />
      <path d="M18.5 14.5c.3 1.4.9 2 2.3 2.3-1.4.3-2 .9-2.3 2.3-.3-1.4-.9-2-2.3-2.3 1.4-.3 2-.9 2.3-2.3Z" />
    </Svg>
  );
}

export function CheckCircle2({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.3 12.3 2.6 2.6 5-5.6" />
    </Svg>
  );
}

export function Ban({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6.5 6.5 11 11" />
    </Svg>
  );
}

export function Layers({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 4 3.5 8.5 12 13l8.5-4.5Z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </Svg>
  );
}

export function ArrowUpRight({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M7 17 17 7" />
      <path d="M10 7h7v7" />
    </Svg>
  );
}

export function ArrowUp({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 20V5" />
      <path d="M6.5 10.5 12 5l5.5 5.5" />
    </Svg>
  );
}

export function ArrowDown({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 4v15" />
      <path d="M6.5 13.5 12 19l5.5-5.5" />
    </Svg>
  );
}

export function ArrowRight({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4 12h15" />
      <path d="M13.5 6.5 19 12l-5.5 5.5" />
    </Svg>
  );
}

export function TrendingUp({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M3.5 16.5 9 11l3.5 3.5L20 6.5" />
      <path d="M14.5 6.5H20v5.5" />
    </Svg>
  );
}

export function Flame({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3c1.6 2.8 4.6 4.7 4.6 8.1a4.6 4.6 0 0 1-9.2 0c0-1.1.4-1.9 1-2.7.1.9.7 1.5 1.4 1.6-.4-2.6.8-4.4 2.2-7Z" />
    </Svg>
  );
}

export function Calendar({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 9.5h16" />
      <path d="M8 3.5v3M16 3.5v3" />
      {dot(8.5, 13.5)}
      {dot(12, 13.5)}
      {dot(15.5, 13.5)}
    </Svg>
  );
}

export function Fuel({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M5 17.5a7 7 0 1 1 14 0" />
      <path d="M12 14 15.2 9.2" />
      {dot(12, 14, 1.1)}
      <path d="M3.5 20.5h17" />
    </Svg>
  );
}

export function Search({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M10.5 7.5v6M7.5 10.5h6" opacity={0.55} />
      <path d="m15.8 15.8 4.7 4.7" />
    </Svg>
  );
}

export function Download({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 3v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 15v4h16v-4" />
    </Svg>
  );
}

export function Filter({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <line x1="5" y1="6.5" x2="19" y2="6.5" />
      <line x1="5" y1="12" x2="19" y2="12" />
      <line x1="5" y1="17.5" x2="19" y2="17.5" />
      {dot(9, 6.5, 1.8)}
      {dot(15, 12, 1.8)}
      {dot(11, 17.5, 1.8)}
    </Svg>
  );
}

export function Lock({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function UserCheck({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="9" cy="8.2" r="3.2" />
      <path d="M3.5 19.5c.8-3.1 3.4-4.8 6.5-4.8" />
      <path d="m14 15.5 2.3 2.3L21 13" />
    </Svg>
  );
}

export function Share2({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="m8 10.8 8-3.6M8 13.2l8 3.6" />
    </Svg>
  );
}

export function PlaneTakeoff({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M3.5 19h6" />
      <path d="M8.5 19 19.5 6.5" />
      <path d="M13.5 6.5H19.5v6" />
      <path d="M8.5 19c2-.3 3.3-1.5 4-3.2" opacity={0.55} />
    </Svg>
  );
}

export function Eye({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M2.5 12c2.3-4.2 5.8-6.3 9.5-6.3S18.7 7.8 21 12c-2.3 4.2-5.8 6.3-9.5 6.3S4.8 16.2 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </Svg>
  );
}

export function Cpu({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 3.5v2.3M15 3.5v2.3M9 18.2v2.3M15 18.2v2.3" />
      <path d="M3.5 9h2.3M3.5 15h2.3M18.2 9h2.3M18.2 15h2.3" />
    </Svg>
  );
}

export function ActivitySquare({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M6.5 13.5h3l1.8-4.4 2.4 8 1.8-3.6h3.5" />
    </Svg>
  );
}

export function Activity({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M3 12.5h4l2-6 3 11 2.5-8.3 1.5 3.3h5" />
    </Svg>
  );
}

/** Backtest accuracy reads better as a target than a trophy. */
export function Award({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.6" />
      {dot(12, 12, 1.1)}
    </Svg>
  );
}

export function Scale({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M12 4v15.5" />
      <path d="M6 7.5h12" />
      <path d="M6 7.5 3.5 13a2.5 2.5 0 0 0 5 0L6 7.5Z" />
      <path d="M18 7.5 15.5 13a2.5 2.5 0 0 0 5 0L18 7.5Z" />
      <path d="M8.5 19.5h7" />
    </Svg>
  );
}

export const Scales = Scale;

export function Grid({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Svg>
  );
}

/** Literal spring coil -> elasticity, feeding into an ascending open chevron. */
export function Elasticity({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M3.5 17h3.3c.9 0 .9-3 1.8-3s.9 3 1.8 3 .9-3 1.8-3 .9 3 1.8 3H16" />
      <path d="M16 17 20.5 6.5" />
      <path d="M17 6.5h3.5V10" />
    </Svg>
  );
}

export function Database({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4.5 6.5c0-1.4 3.4-2.5 7.5-2.5s7.5 1.1 7.5 2.5-3.4 2.5-7.5 2.5-7.5-1.1-7.5-2.5Z" />
      <path d="M4.5 6.5V17c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6.5" />
      <path d="M4.5 11.75c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
    </Svg>
  );
}

export function LineChart({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M4 4v16h16" opacity={0.5} />
      <path d="M6.5 15 10 10.5 13 13.5 18.5 6" />
    </Svg>
  );
}

/* Base-UI primitive glyphs (select / dropdown / dialog / sheet chrome) */

export function CaretDownIcon({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M6 9.5 12 15.5 18 9.5" />
    </Svg>
  );
}

export function CaretUpIcon({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M6 14.5 12 8.5 18 14.5" />
    </Svg>
  );
}

export function CaretRightIcon({ className, weight }: IconProps) {
  return (
    <Svg className={className} weight={weight}>
      <path d="M9.5 6 15.5 12 9.5 18" />
    </Svg>
  );
}

export function CheckIcon({ className, weight }: IconProps) {
  return <Check className={className} weight={weight} />;
}

export function XIcon({ className, weight }: IconProps) {
  return <X className={className} weight={weight} />;
}
