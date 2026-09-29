'use client';

import React from 'react';
import { RefreshCw, User, ShieldCheck, Activity, Database, LineChart, Cpu, Code2, Sparkles } from 'lucide-react';

export type TabType = 'home' | 'routes' | 'analysis' | 'backtest' | 'scrapers' | 'cleaning' | 'data' | 'api';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenLogin: () => void;
  userRole: 'analyst' | 'public';
  onRefresh: () => void;
  isRefreshing: boolean;
}

export default function Header({
  activeTab,
  setActiveTab,
  onOpenLogin,
  userRole,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header className="w-full bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shadow-xs">
      {/* Top Government Banner */ }
      <div className="bg-[#003f87] text-white text-xs py-1.5 px-4 sm:px-8 flex justify-between items-center font-medium">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Government of India • Ministry of Statistics & Programme Implementation (MoSPI)</span>
        </div>
        <div className="flex items-center space-x-4 text-[11px] opacity-90">
          <span>SIH Problem Statement ID: 26056</span>
          <span className="hidden md:inline">|</span>
          <span className="hidden md:inline">Data Informatics & Innovation Division (DIID)</span>
        </div>
      </div>

      {/* Main Header Row */ }
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Title */ }
        <div className="flex items-center space-x-3 cursor-pointer" onClick={ () => setActiveTab('home') }>
          <div className="w-10 h-10 rounded bg-[#003f87] text-white flex items-center justify-center font-bold text-lg shadow-sm border border-[#002d62]">
            APIx
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-[#1f2937] leading-tight">
                Airfare Price Index <span className="text-xs text-[#003f87] font-semibold bg-[#e8f4f8] px-1.5 py-0.5 rounded border border-[#bbeeef]">MoSPI</span>
              </h1>
            </div>
            <p className="text-[11px] text-[#6b7280]">
              National CPI Augmentation Engine • Transport & Communication
            </p>
          </div>
        </div>

        {/* Right Side Status & User Session */ }
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-xs text-[#6b7280] bg-[#f9fafb] px-2.5 py-1.5 rounded border border-[#e5e7eb]">
            <span>Last updated: <strong className="text-[#1f2937]">2m ago</strong></span>
            <button
              onClick={ onRefresh }
              disabled={ isRefreshing }
              title="Refresh real-time index data"
              className="p-1 hover:bg-[#e5e7eb] rounded transition-colors text-[#003f87]"
            >
              <RefreshCw className={ `w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}` } />
            </button>
          </div>

          <button
            onClick={ onOpenLogin }
            className={ `flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-all border ${userRole === 'analyst'
                ? 'bg-[#003f87] text-white border-[#003f87] hover:bg-[#002d62]'
                : 'bg-white text-[#003f87] border-[#003f87] hover:bg-[#f9fafb]'
              }` }
          >
            { userRole === 'analyst' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>MoSPI Analyst Mode</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                <span>Official Login</span>
              </>
            ) }
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */ }
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#f3f4f6]">
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar py-0.5">
          { [
            { id: 'home', label: 'Main Index View', icon: LineChart },
            { id: 'backtest', label: 'DGCA Backtest (Credibility)', icon: ShieldCheck, badge: 'r=0.892' },
            { id: 'routes', label: 'Route Explorer', icon: Activity },
            { id: 'analysis', label: 'Market Analysis', icon: Database },
            { id: 'scrapers', label: 'Scraping Engine & Compliance', icon: Cpu, badge: 'Live' },
            { id: 'cleaning', label: 'Cleaning & IQR Pipeline', icon: Sparkles },
            { id: 'data', label: 'Data Explorer', icon: Database },
            { id: 'api', label: 'REST API & Docs', icon: Code2 },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={ tab.id }
                onClick={ () => setActiveTab(tab.id as TabType) }
                className={ `py-3 text-xs sm:text-sm font-medium flex items-center space-x-2 whitespace-nowrap transition-all border-b-2 ${isActive
                    ? 'border-[#003f87] text-[#003f87] font-bold'
                    : 'border-transparent text-[#6b7280] hover:text-[#003f87] hover:border-[#d0d0d0]'
                  }` }
              >
                <IconComponent className={ `w-4 h-4 ${isActive ? 'text-[#003f87]' : 'text-[#6b7280]'}` } />
                <span>{ tab.label }</span>
                { tab.badge && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded ml-1">
                    Live
                  </span>
                ) }
              </button>
            );
          }) }
        </nav>
      </div>
    </header>
  );
}
