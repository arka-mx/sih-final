'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Sidebar, { TabType } from '@/components/Sidebar';
import Footer from '@/components/Footer';
import HomeView from '@/components/HomeView';
import RouteExplorerView from '@/components/RouteExplorerView';
import MarketAnalysisView from '@/components/MarketAnalysisView';
import ScrapingEngineView from '@/components/ScrapingEngineView';
import DataPipelineView from '@/components/DataPipelineView';
import DataExplorerView from '@/components/DataExplorerView';
import ApiHubView from '@/components/ApiHubView';
import BacktestView from '@/components/BacktestView';
import LoginModal from '@/components/LoginModal';

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [userRole, setUserRole] = useState<'analyst' | 'public'>('public');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex bg-ink-50 text-ink-900 antialiased">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenLogin={() => setIsLoginOpen(true)}
          userRole={userRole}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileNav={() => setIsMobileNavOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {activeTab === 'home' && <HomeView onNavigate={setActiveTab} />}
          {activeTab === 'backtest' && <BacktestView />}
          {activeTab === 'routes' && <RouteExplorerView />}
          {activeTab === 'analysis' && <MarketAnalysisView />}
          {activeTab === 'scrapers' && <ScrapingEngineView />}
          {activeTab === 'cleaning' && <DataPipelineView />}
          {activeTab === 'data' && <DataExplorerView />}
          {activeTab === 'api' && <ApiHubView />}
        </main>

        {/* Footer */}
        <Footer />
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
