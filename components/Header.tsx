'use client';

import React from 'react';
import { ArrowsClockwise as RefreshCw, User, ShieldCheck, Pulse as Activity, Database, ChartLine as LineChart, Cpu, Code as Code2, Sparkle as Sparkles } from '@phosphor-icons/react';

export type TabType = 'home' | 'routes' | 'analysis' | 'backtest' | 'scrapers' | 'cleaning' | 'data' | 'api';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenLogin: () => void;
  userRole: 'analyst' | 'public';
  onRefresh: () => void;
  isRefreshing: boolean;
}

const NAV_ITEMS: { id: TabType; label: string; icon: typeof LineChart; badge?: string }[] = [
  { id: 'home', label: 'Main Index View', icon: LineChart },
  { id: 'backtest', label: 'DGCA Backtest', icon: ShieldCheck, badge: 'r = 0.892' },
  { id: 'routes', label: 'Route Explorer', icon: Activity },
  { id: 'analysis', label: 'Market Analysis', icon: Database },
  { id: 'scrapers', label: 'Scraping & Compliance', icon: Cpu, badge: 'Live' },
  { id: 'cleaning', label: 'Cleaning & IQR Pipeline', icon: Sparkles },
  { id: 'data', label: 'Data Explorer', icon: Database },
  { id: 'api', label: 'REST API & Docs', icon: Code2 },
];

export default function Header({
  activeTab,
  setActiveTab,
  onOpenLogin,
  userRole,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header className="w-full bg-white border-b border-ink-100 sticky top-0 z-50">
      {/* Top Government Banner */}
      <div className="bg-navy-900 text-navy-100 text-[11px] py-1.5 px-4 sm:px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-medium tracking-wide">
            Government of India &middot; Ministry of Statistics &amp; Programme Implementation
          </span>
        </div>
        <div className="hidden md:flex items-center text-navy-300 font-mono tracking-tight">
          <span>Data Informatics &amp; Innovation Division</span>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        {/* Logo & Title */}
        <button
          className="flex items-center gap-3 shrink-0 cursor-pointer text-left"
          onClick={() => setActiveTab('home')}
        >
          <div className="w-10 h-10 rounded-lg bg-navy-700 text-white flex items-center justify-center font-serif font-semibold text-lg tracking-tight">
            Ax
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] sm:text-base font-semibold text-ink-900 leading-tight tracking-tight">
                Airfare Price Index
              </h1>
              <span className="text-[10px] font-semibold text-navy-700 bg-navy-50 px-1.5 py-0.5 rounded border border-navy-100 tracking-wide">
                MoSPI
              </span>
            </div>
            <p className="text-[11px] text-ink-500">
              National CPI Augmentation Engine &middot; Transport &amp; Communication
            </p>
          </div>
        </button>

        {/* Right Side Status & User Session */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-ink-500 bg-ink-50 pl-3 pr-1.5 py-1.5 rounded-lg border border-ink-100">
            <span>Updated <strong className="text-ink-900 font-semibold font-tabular">2m ago</strong></span>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh real-time index data"
              className="p-1.5 hover:bg-white hover:shadow-panel rounded-md transition-all text-navy-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <button
            onClick={onOpenLogin}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer ${
              userRole === 'analyst'
                ? 'bg-navy-700 text-white hover:bg-navy-800'
                : 'bg-white text-navy-700 border border-navy-200 hover:bg-navy-50'
            }`}
          >
            {userRole === 'analyst' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Analyst Mode</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                <span>Official Login</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="border-t border-ink-100">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto no-scrollbar">
          {NAV_ITEMS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-3 px-3 text-[13px] font-medium flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive ? 'text-navy-800' : 'text-ink-500 hover:text-ink-900'
                }`}
              >
                <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-navy-700' : 'text-ink-400'}`} />
                <span className={isActive ? 'font-semibold' : ''}>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-navy-700" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
