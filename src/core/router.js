/**
 * Project Axiom: Router Singleton
 * Native navigation with zero bloat.
 */
import { state } from '@state';
import { log } from '@core/logger.js';
import { config } from '@core/config.js';

export const router = {
  _activeTransition: null,
  _currentController: null,
  _scrollTimeout: null,
  _lastIndex: 0,

  // Configurable state
  routes: {},
  depths: {},
  order: [],
  defaultRoute: 'home', // Fallback, but should be overridden by config

  base: '/',

  init(options = {}) {
    this.routes = options.routes || {};
    this.depths = options.depths || { 'default': 1 };
    this.order = options.order || [];
    this.defaultRoute = options.defaultRoute || 'home';

    this.base = options.basePath || config.BASE_PATH;
    if (!this.base.endsWith('/')) this.base += '/';

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    if (!history.state || typeof history.state.index === 'undefined') {
      history.replaceState({ index: 0 }, '');
    }

    window.addEventListener('popstate', (e) => {
      const currentIndex = e.state?.index ?? 0;
      const direction = currentIndex < this._lastIndex ? 'backward' : 'forward';
      this._lastIndex = currentIndex;
      this.navigate(location.pathname, false, direction);
    });

    document.addEventListener('click', e => this.handleIntercept(e));
    this._lastIndex = history.state?.index ?? 0;
    this.navigate(location.pathname, false);
  },

  getDepth(slug) {
    return this.depths[slug] ?? this.depths['default'] ?? 1;
  },

  getOrder(slug) {
    const index = this.order.indexOf(slug);
    return index === -1 ? 99 : index;
  },

  async navigate(path, push = true, customDirection = null) {
    if (this._scrollTimeout) clearTimeout(this._scrollTimeout);

    // Force Save: Capture final scroll position before leaving (if pushing new state)
    // The debounce listener might lose the last few milliseconds of scrolling.
    if (push) {
      const currentState = history.state || {};
      history.replaceState({ ...currentState, scrollY: window.scrollY }, '');
    }

    // Capture Scroll Position (SessionStorage)
    // We save the CURRENT page's scroll before we leave it.
    this._saveScroll(location.pathname);

    // Abort previous pending request
    if (this._currentController) {
      this._currentController.abort();
    }
    this._currentController = new AbortController();
    const signal = this._currentController.signal;



    // 1. Surgical Sanitization
    // If the path starts with our base, strip it to find the internal route
    let cleanPath = path.split('?')[0].replace(/\/+$/, '') || '/';
    // Normalize cleanPath to ensure it works with the replace logic
    if (!cleanPath.endsWith('/')) cleanPath += '/';

    // Check if we need to enter "Subdirectory Mode"
    if (path.startsWith(this.base) || (path + '/').startsWith(this.base)) {
      cleanPath = path.substring(this.base.length);
      // Clean up any remaining leading slash
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
    }

    // ensure no trailing slash for the segment split logic, unless it's root
    cleanPath = cleanPath.replace(/\/+$/, '');

    const rawSegment = cleanPath.split('/').pop() || this.defaultRoute;
    let slug = rawSegment.split('.')[0].replace(/[^a-zA-Z0-9-]/g, '') || this.defaultRoute;
    if (slug === 'index') slug = this.defaultRoute;

    // 2. Early Guard (Preventing the 404 loop)
    // NOTE: We allow dynamic routes, so we only force 404 if it's explicitly 'not-found' logic failure
    // or if we want to whitelist. For now, we trust the fallback.

    // 3. Direction Calculation
    let direction = customDirection;
    if (!direction) {
      const currentRoute = state.get('route') || this.defaultRoute;
      if (push) {
        const currentDepth = this.getDepth(currentRoute);
        const nextDepth = this.getDepth(slug);
        direction = (nextDepth !== currentDepth)
          ? (nextDepth > currentDepth ? 'forward' : 'backward')
          : (this.getOrder(slug) > this.getOrder(currentRoute) ? 'forward' : 'backward');
      } else {
        direction = 'fade';
      }
    }



    const performUpdate = async () => {
      try {
        let config = this.routes[slug];
        let params = {};

        // Dynamic Route Matching
        if (!config) {
          // We look for a pattern match before falling back to the "slug" guess
          for (const pattern in this.routes) {
            if (pattern.includes(':')) {
              const match = this.matchRoute(pattern, cleanPath);
              if (match) {
                config = this.routes[pattern];
                params = match;
                slug = pattern; // Use the pattern as the stable slug key
                break;
              }
            }
          }
        }

        // Default Fallback
        if (!config) config = { path: `@features/${slug}/${slug}.js` };

        // Route Guard Check
        if (config.guard) {
          const isAllowed = await config.guard();
          if (!isAllowed) {
            log.warn(`Access Denied for [${slug}]. Redirecting to login.`);

            // Save the intended destination for a post-login jump
            state.set('redirectAfterAuth', path);
            state.notify('Authentication Required', 'warning');

            // Redirect to login
            return this.navigate('/login', true, 'fade');
          }
        }

        if (signal.aborted) return; // Guard

        state.set('transitioning', true);

        // Critical: Set params BEFORE loading component so it can read them
        state.set('params', params);

        // Parallelize: Load Code + Fetch Data
        const [module] = await Promise.all([
          import(config.path),
          config.api ? state.query(config.dataKey, async () => {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            // Pass params AND signal to API function
            return (typeof config.api === 'function')
              ? config.api(params, signal)
              : fetch(config.api, { signal }).then(r => r.json());
          }).catch(err => {
            if (err.name === 'AbortError') throw err; // Re-throw to catch block
            log.error('Data Fetch Failed', err);
          }) : null
        ]);

        if (signal.aborted) return;

        if (push) {
          const nextIndex = this._lastIndex + 1;
          // Construct the full URL including base for the browser
          const fullPath = this.base + (cleanPath ? cleanPath : '');
          // normalize double slashes if base is '/' and path is empty/root
          const finalUrl = fullPath.replace('//', '/');

          history.pushState({ index: nextIndex }, '', finalUrl);
          this._lastIndex = nextIndex;
        }

        document.documentElement.setAttribute('data-transition', direction);
        state.set('route', slug);

        // Wait for the specific element to finish its internal setup/render
        const container = document.getElementById('app-container');
        const featureEl = container?.firstElementChild;

        if (featureEl) {
          if (featureEl.rendered) await featureEl.rendered;
        } else {
          console.warn(`[Router] No feature element found!`);
        }

        // Scroll Restoration (SessionStorage Strategy)
        // Robust fallback if History API is FLAKY.
        const storageKey = `scroll_${path}`;
        const rawStored = sessionStorage.getItem(storageKey);
        const savedScroll = parseInt(rawStored || '0', 10);

        // App-Like Behavior: Always restore scroll if we have it.
        // Whether we pushed (Link) or popped (Back), if we've been here before, 
        // put us back where we were.
        const targetY = savedScroll;

        // Force a double-frame for layout calculation
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, behavior: 'instant' });
            state.set('transitioning', false);
          });
        });

        // 4. A11y & Focus
        requestAnimationFrame(() => {
          const feature = document.getElementById('app-container')?.firstElementChild;
          if (feature) { feature.tabIndex = -1; feature.focus(); }
        });

      } catch (err) {
        if (err.name === 'AbortError') {
          // Silent exit - user navigated away
          return;
        }

        log.error(`Navigation failed for [${slug}]`, err);
        state.set('transitioning', false);

        // Fallback Logic: Try to recover by loading 404
        if (slug !== 'not-found') {
          state.notify(`Route not found: ${slug}`, 'warning');

          // Recursive call isn't safe here because we need to force the swap.
          // Instead, we manually trigger the not-found load.
          try {
            await import('@features/not-found/not-found.js');
            state.set('route', 'not-found');

            // Update URL to /not-found so user knows they are lost
            history.replaceState({ index: this._lastIndex }, '', '/not-found');
          } catch (panicErr) {
            // If 404 fails, we panic.
            document.body.innerHTML = '<h1>System Panic: 404 Component Failed</h1>';
            console.error(panicErr);
          }
        } else {
          // If we were TRYING to load 404 and it failed...
          document.body.innerHTML = '<h1>System Panic: 404 Logic Broken</h1>';
        }
      }
    };


    // 4. View Transition Orchestration
    if (document.startViewTransition) {
      if (this._activeTransition) this._activeTransition.skipTransition();
      const transition = document.startViewTransition(() => performUpdate());
      this._activeTransition = transition;
      try { await transition.finished; }
      finally {
        if (this._activeTransition === transition) {
          document.documentElement.removeAttribute('data-transition');
          this._activeTransition = null;
        }
      }
    } else {
      await performUpdate();
    }
  },

  handleIntercept(e) {
    const link = e.target.closest('a');
    if (link && link.origin === location.origin && !e.metaKey && !e.ctrlKey) {
      // Must start with our base to be an internal link
      const href = link.getAttribute('href');

      // If the href is absolute (starts with /), checking if it matches base context is tricky
      // But typically internal links are written as /home or just home
      // Let's rely on standard navigation which will resolve the relative path
      // Against the current location.

      // Actually, safest is to let the browser resolve the full URL, 
      // then check if it starts with our base URI.
      if (link.href.startsWith(location.origin + this.base) || this.base === '/') {
        e.preventDefault();
        this.navigate(href);
      }
    }
  },

  matchRoute(pattern, path) {
    const p = pattern.split('/').filter(Boolean);
    const u = path.split('/').filter(Boolean);

    if (p.length !== u.length) return null;

    const params = {};
    const isMatch = p.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = u[i];
        return true;
      }
      return part === u[i];
    });

    return isMatch ? params : null;
  },

  _saveScroll(path) {
    const y = window.scrollY || document.documentElement.scrollTop;
    sessionStorage.setItem(`scroll_${path}`, y);
  }
};