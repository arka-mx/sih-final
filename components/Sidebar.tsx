'use client';

import React, { useEffect } from 'react';
import {
  ShieldCheck,
  Pulse as Activity,
  Database,
  ChartLine as LineChart,
  Cpu,
  Code as Code2,
  Sparkle as Sparkles,
  X,
} from '@phosphor-icons/react';

export type TabType = 'home' | 'routes' | 'analysis' | 'backtest' | 'scrapers' | 'cleaning' | 'data' | 'api';

interface NavItem {
  id: TabType;
  label: string;
  icon: typeof LineChart;
  badge?: string;
  badgeTone?: 'live' | 'metric';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Main Index View', icon: LineChart },
  { id: 'backtest', label: 'DGCA Backtest', icon: ShieldCheck, badge: 'r = 0.892', badgeTone: 'metric' },
  { id: 'routes', label: 'Route Explorer', icon: Activity },
  { id: 'analysis', label: 'Market Analysis', icon: Database },
  { id: 'scrapers', label: 'Scraping & Compliance', icon: Cpu, badge: 'Live', badgeTone: 'live' },
  { id: 'cleaning', label: 'Cleaning & IQR Pipeline', icon: Sparkles },
  { id: 'data', label: 'Data Explorer', icon: Database },
  { id: 'api', label: 'REST API & Docs', icon: Code2 },
];

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, isMobileOpen, onCloseMobile }: SidebarProps) {
  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobileOpen]);

  const content = (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Brand */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
        <button
          className="flex items-center gap-3 text-left cursor-pointer"
          onClick={() => {
            setActiveTab('home');
            onCloseMobile();
          }}
        >
          <div className="w-9 h-9 rounded-lg bg-navy-700 text-white flex items-center justify-center font-sans font-semibold text-[15px] tracking-tight shrink-0">
            Ax
          </div>
          <div className="min-w-0">
            <h1 className="text-[13.5px] font-semibold text-ink-900 leading-tight tracking-tight truncate">
              Airfare Price Index
            </h1>
            <p className="text-[10.5px] text-ink-400 leading-tight truncate">National CPI Engine</p>
          </div>
        </button>
        <button
          onClick={onCloseMobile}
          className="lg:hidden shrink-0 p-1.5 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-50 cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2.5 pt-1 pb-2 text-[10px] font-semibold tracking-wider text-ink-300 uppercase">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setActiveTab(item.id);
                    onCloseMobile();
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative w-full flex items-center gap-2.5 pl-3.5 pr-2.5 py-2.5 text-[13px] font-medium tracking-tight cursor-pointer transition-colors duration-150 ${
                    isActive
                      ? 'bg-navy-50 text-navy-800'
                      : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                  }`}
                >
                  <span
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-colors duration-150 ${
                      isActive ? 'bg-navy-700' : 'bg-transparent'
                    }`}
                  />
                  <Icon
                    weight={isActive ? 'fill' : 'regular'}
                    className={`w-[17px] h-[17px] shrink-0 transition-colors duration-150 ${
                      isActive ? 'text-navy-700' : 'text-ink-400 group-hover:text-ink-600'
                    }`}
                  />
                  <span className={`flex-1 text-left truncate ${isActive ? 'font-semibold' : ''}`}>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span
                      className={`shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 tracking-tight rounded-sm ${
                        item.badgeTone === 'live'
                          ? 'text-emerald-700 bg-emerald-50'
                          : isActive
                          ? 'text-navy-700 bg-white'
                          : 'text-ink-400 bg-ink-100'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-ink-100 sticky top-0 h-screen">
        {content}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-200 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!isMobileOpen}
      >
        <div className="absolute inset-0 bg-ink-950/40" onClick={onCloseMobile} />
        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-ink-100 shadow-overlay transition-transform duration-200 ease-out ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {content}
        </div>
      </div>
    </>
  );
}
