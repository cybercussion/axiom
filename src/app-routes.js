export const ROUTE_DEPTHS = { 'home': 0, 'default': 1 };
export const ROUTE_ORDER = ['home', 'counter', 'dashboard'];
export const DEFAULT_ROUTE = 'home';

export const ROUTES = {
  'home': { path: '@features/home/home.js' },
  'counter': { path: '@features/counter/counter.js' },
  'dashboard': {
    path: '@features/dashboard/dashboard.js',
    api: () => import('@features/dashboard/dashboard-api.js').then(m => m.fetchDashboardData()),
    dataKey: 'dashboardData'
  },
  'navigation': { path: '@features/navigation/navigation.js' },
  'not-found': { path: '@features/not-found/not-found.js' }
};
