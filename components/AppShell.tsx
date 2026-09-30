'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import LoginModal from '@/components/LoginModal';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [userRole, setUserRole] = useState<'analyst' | 'public'>('public');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  React.useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-ink-50 text-ink-900 antialiased">
      <Sidebar isMobileOpen={isMobileNavOpen} onCloseMobile={() => setIsMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenLogin={() => setIsLoginOpen(true)}
          userRole={userRole}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
          lastUpdated={lastUpdated}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {children}
        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(role) => setUserRole(role)}
      />
    </div>
  );
}
