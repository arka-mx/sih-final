export type TabType = 'home' | 'routes' | 'analysis' | 'backtest' | 'scrapers' | 'cleaning' | 'data' | 'api';

export const TAB_ROUTES: Record<TabType, string> = {
  home: '/',
  backtest: '/backtest',
  routes: '/routes',
  analysis: '/analysis',
  scrapers: '/scrapers',
  cleaning: '/cleaning',
  data: '/data',
  api: '/api-docs',
};
