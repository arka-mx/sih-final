'use client';

import React from 'react';
import { RefreshCw, User, ShieldCheck, Menu } from './icons';

interface HeaderProps {
  onOpenLogin: () => void;
  userRole: 'analyst' | 'public';
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileNav: () => void;
  lastUpdated?: Date | null;
}

function getRelativeTimeString(date: Date | null | undefined): string {
  if (!date) return 'Just now';
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffInSeconds < 10) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export default function Header({
  onOpenLogin,
  userRole,
  onRefresh,
  isRefreshing,
  onOpenMobileNav,
  lastUpdated,
}: HeaderProps) {
  const [timeAgo, setTimeAgo] = React.useState<string>('Just now');

  React.useEffect(() => {
    const updateFormattedTime = () => {
      setTimeAgo(getRelativeTimeString(lastUpdated));
    };

    updateFormattedTime();
    const interval = setInterval(updateFormattedTime, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  return (
    <header className="w-full bg-white border-b border-ink-100 sticky top-0 z-40">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden shrink-0 p-2 -ml-2 rounded-md text-ink-500 hover:text-ink-900 hover:bg-ink-50 cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center h-9 gap-2 text-xs text-ink-500 bg-ink-50 pl-3 pr-1.5 rounded-lg border border-ink-100">
            <span>Updated <strong className="text-ink-900 font-semibold font-tabular">{timeAgo}</strong></span>
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh real-time index data"
              className="p-1.5 hover:bg-white hover:shadow-panel rounded-md transition-all text-navy-700 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Right Side: User Session */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenLogin}
            className={`flex items-center h-9 gap-1.5 text-xs font-semibold px-3.5 rounded-lg transition-colors cursor-pointer ${
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
    </header>
  );
}
