export const ROUTE_DEPTHS = { 'player': 0, 'default': 1 };
export const ROUTE_ORDER = ['player'];
export const DEFAULT_ROUTE = 'player';

export const ROUTES = {
  'player': {
    path: '@features/player/player.js',
    api: () => import('@features/player/player-api.js').then(m => m.fetchCourseData()),
    dataKey: 'courseData'
  },
  'not-found': { path: '@features/not-found/not-found.js' }
};
