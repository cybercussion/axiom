export const ROUTE_DEPTHS = { 'home': 0, 'default': 1 };
export const ROUTE_ORDER = ['home', 'counter', 'dashboard', 'components'];
export const DEFAULT_ROUTE = 'home';

export const ROUTES = {
  'home': { path: '@features/home/home.js' },
  'counter': { path: '@features/counter/counter.js', title: 'Counter' },
  'dashboard': {
    path: '@features/dashboard/dashboard.js',
    title: 'Dashboard',
    api: () => import('@features/dashboard/dashboard-api.js').then(m => m.fetchDashboardData()),
    dataKey: 'dashboardData'
  },
  'components': { path: '@features/components/components.js', title: 'Components' },
  'contact': { path: '@features/contact/contact.js', title: 'Contact' },
  'login': { path: '@features/login/login.js', title: 'Sign In' }, // template sign-in; auth.js is a placeholder
  'not-found': { path: '@features/not-found/not-found.js', title: 'Not Found' }
};
