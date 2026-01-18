import { router } from '@core/router.js';
import { state } from '@state';
import { log } from '@core/logger.js';
import { config } from '@core/config.js';
import { ROUTES, ROUTE_DEPTHS, ROUTE_ORDER, DEFAULT_ROUTE } from './app-routes.js';

const app = document.querySelector('#app-container');

// We listen for 'route' because the router sets this to the feature slug (e.g., 'home')
state.subscribe(({ key, value }) => {
  if (key === 'route') {
    const featureTag = `${value}-ui`;

    // Prevent unnecessary re-renders
    const currentTag = app.firstElementChild?.tagName.toLowerCase();
    if (currentTag === featureTag) return;

    const element = document.createElement(featureTag);
    element.tabIndex = -1; // Makes it focusable for the Router's a11y logic
    app.replaceChildren(element);

    log.debug(`Switched to ${value}`);
  }

  if (key === 'theme') {
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('axiom-theme', value);
    log.debug(`Theme set to ${value}`);
  }
});

// Initial Theme Application
document.documentElement.setAttribute('data-theme', state.data.theme);

router.init({
  routes: ROUTES,
  depths: ROUTE_DEPTHS,
  order: ROUTE_ORDER,
  defaultRoute: DEFAULT_ROUTE
});
log.info(`Bootstrapped [${config.ENV}]`);
