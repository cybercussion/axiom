/**
 * Project Axiom: Router Singleton
 * Native navigation with zero bloat.
 */
import { state } from '@state';
import { log } from '@core/logger.js';
import { config } from '@core/config.js';
import { auth } from '@core/auth.js';
import { announce } from '@core/announce.js';
import { emit, elapsed, reason } from '@core/observe.js';

/**
 * A route. `path` is the feature module; `api` loads its data in parallel with it.
 * @typedef {{
 *   path: string,
 *   title?: string,
 *   guard?: () => boolean|Promise<boolean>,
 *   api?: string | ((params: Record<string, string>, signal: AbortSignal) => Promise<any>),
 *   dataKey?: string
 * }} RouteConfig
 *
 * One navigation, as published to state.navigation and onNavigation().
 * @typedef {{
 *   phase: 'start'|'commit',
 *   navigationId: number,
 *   path: string,
 *   cleanPath: string,
 *   slug: string,
 *   params?: Record<string, string>,
 *   direction: string,
 *   timestamp: number
 * }} Navigation
 *
 * @typedef {{
 *   routes?: Record<string, RouteConfig>,
 *   depths?: Record<string, number>,
 *   order?: string[],
 *   defaultRoute?: string,
 *   basePath?: string,
 *   appName?: string,
 *   loginPath?: string
 * }} RouterOptions
 */
/** How long a navigation waits for the browser to begin its view transition. */
const VT_STALL_MS = 1000;

export const router = {
  _activeTransition: null,
  _currentController: null,
  // Path of the last COMMITTED route — the page the user is actually on.
  // location.pathname is unreliable for this during popstate handling.
  _activePath: null,
  _lastIndex: 0,
  _navSeq: 0,
  _activeNavId: null,
  _committedNavId: null,
  _announced: false,

  // Configurable state
  /** @type {Record<string, RouteConfig>} */
  routes: {},
  /** @type {Record<string, number>} */
  depths: {},
  /** @type {string[]} */
  order: [],
  /** @type {string} */
  defaultRoute: 'home', // Fallback, but should be overridden by config

  /** @type {string} */
  base: '/',

  /** @param {RouterOptions} [options] */
  init(options = {}) {
    this.routes = options.routes || {};
    this.depths = options.depths || { 'default': 1 };
    this.order = options.order || [];
    this.defaultRoute = options.defaultRoute || 'home';
    // The app's, not the router's: the name in every page title, and where a
    // failed guard sends the user.
    this.appName = options.appName ?? '';
    this.loginPath = options.loginPath || '/login';

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
      this.navigate(`${location.pathname}${location.search}${location.hash}`, false, direction);
    });

    document.addEventListener('click', e => this.handleIntercept(e));
    this._lastIndex = history.state?.index ?? 0;

    // Post-Auth Redirect Logic
    const pendingRedirect = localStorage.getItem('axiom_auth_redirect');
    if (pendingRedirect && auth.isAuthenticated()) {
      log.info(`Auth sequence complete. Resuming destination: ${pendingRedirect}`);
      localStorage.removeItem('axiom_auth_redirect');
      this.navigate(pendingRedirect, true);
    } else {
      this.navigate(`${location.pathname}${location.search}${location.hash}`, false);
    }
  },

  /** @param {string} slug @returns {number} */
  getDepth(slug) {
    return this.depths[slug] ?? this.depths['default'] ?? 1;
  },

  /** @param {string} slug @returns {number} */
  getOrder(slug) {
    const index = this.order.indexOf(slug);
    return index === -1 ? 99 : index;
  },

  /**
   * Subscribe to navigation lifecycle events.
   * Callback receives the latest navigation object:
   * { phase: 'start' | 'commit', navigationId, path, cleanPath, slug, params?, direction, timestamp }
   * Returns an unsubscribe function.
   * @param {(nav: Navigation|null) => void} callback
   * @returns {() => void}
   */
  onNavigation(callback) {
    return state.subscribe(({ key, value }) => {
      if (key === 'navigation') callback(value);
    });
  },

  /**
   * Subscribe to route/params matches at commit time.
   * This is a convenience wrapper over navigation events for features
   * that care about the resolved route + params rather than raw paths.
   * @param {(match: { route: string, params: Record<string, string>, navigation: Navigation }) => void} callback
   * @returns {() => void}
   */
  onMatch(callback) {
    return this.onNavigation((nav) => {
      if (!nav || nav.phase !== 'commit') return;
      const params = nav.params || state.get('params') || {};
      const route = state.get('route') || nav.slug;
      callback({ route, params, navigation: nav });
    });
  },

  /**
   * @param {string} path
   * @param {boolean} [push] - true pushes a history entry; false replaces (back/forward, boot)
   * @param {string|null} [customDirection] - 'forward' | 'backward' | 'fade'; derived when omitted
   * @returns {Promise<void>}
   */
  async navigate(path, push = true, customDirection = null) {

    // Force Save: Capture final scroll position before leaving (if pushing new state)
    // The debounce listener might lose the last few milliseconds of scrolling.
    if (push) {
      const currentState = history.state || {};
      history.replaceState({ ...currentState, scrollY: window.scrollY }, '');
    }

    // Capture Scroll Position (SessionStorage)
    // We save the DEPARTING page's scroll before we leave it — keyed by
    // _activePath (the path the router last committed), never by
    // location.pathname: on a popstate the browser has ALREADY moved
    // location.pathname to the destination, so reading it here saved the
    // old page's scroll under the NEW page's key, clobbering the position
    // this very navigation is about to restore (the "back to home lands at
    // the top" bug). Null until the first commit — nothing to save on boot,
    // which also stops the boot pass writing scrollY=0 over a same-session
    // refresh-restore target.
    // Only when the previous navigation COMMITTED: while one is still in flight
    // the page on screen is mid-swap and window.scrollY belongs to no route —
    // saving it would overwrite the offset of the page Back is about to restore.
    if (this._activePath && this._committedNavId === this._activeNavId) this._saveScroll(this._activePath);

    // Abort previous pending request
    if (this._currentController) {
      this._currentController.abort();
    }
    // A navigation still in flight ends here, as an abort: it will never commit.
    if (this._openNav) this._endNav(this._openNav.navigationId, 'abort', { supersededBy: this._navSeq + 1 });
    this._currentController = new AbortController();
    const signal = this._currentController.signal;



    const inputPath = typeof path === 'string' ? path : String(path || '/');
    const hashIndex = inputPath.indexOf('#');
    const hashPart = hashIndex >= 0 ? inputPath.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? inputPath.slice(0, hashIndex) : inputPath;
    const queryIndex = withoutHash.indexOf('?');
    const queryPart = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
    const queryString = queryPart.startsWith('?') ? queryPart.slice(1) : '';

    // 1. Surgical Sanitization
    let cleanPath = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

    // Check if we need to enter "Subdirectory Mode" and strip base
    if (cleanPath.startsWith(this.base) || (cleanPath + '/').startsWith(this.base)) {
      cleanPath = cleanPath.substring(this.base.length);
    }

    // Ensure leading slash for internal consistency
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;

    // NOW strip trailing slashes
    cleanPath = cleanPath.replace(/\/+$/, '') || '/';

    // ensure no trailing slash for the segment split logic, unless it's root
    cleanPath = cleanPath.replace(/\/+$/, '');

    // Ensure slug is ONLY the first segment of the internal path
    const pathSegments = cleanPath.split('/').filter(Boolean);
    let slug = pathSegments[0] || this.defaultRoute;
    if (slug === 'index' || !slug) slug = this.defaultRoute;

    log.debug(`[Router] Input: ${inputPath} | cleanPath: ${cleanPath} | Slug: ${slug}`);

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

    // 3b. Early navigation bookkeeping: assign navigation id, push history,
    // set pendingRoute, and mark transitioning so the UI can react immediately.
    const navigationId = ++this._navSeq;
    this._activeNavId = navigationId;

    if (push) {
      const nextIndex = this._lastIndex + 1;
      const fullPath = this.base + (cleanPath ? cleanPath : '');
      const pathname = fullPath.replace('//', '/');
      const finalUrl = `${pathname}${queryPart}${hashPart}`;
      history.pushState({ index: nextIndex, navigationId }, '', finalUrl);
      this._lastIndex = nextIndex;
    }

    try {
      state.set('pendingRoute', {
        navigationId,
        path,
        cleanPath,
        slug,
        direction,
        timestamp: Date.now()
      });
    } catch (e) {
      log.warn('Failed to set pendingRoute', e);
    }

    state.set('transitioning', true);

    // Emit a navigation "start" signal so features can react
    // even when the root route slug remains the same (e.g., sub-routes).
    try {
      state.set('navigation', {
        phase: 'start',
        navigationId,
        path,
        cleanPath,
        slug,
        direction,
        timestamp: Date.now()
      });
      this._openNav = { navigationId, path: cleanPath, slug, t0: performance.now() };
      emit('axiom:navigation', { phase: 'start', navigationId, path: cleanPath, slug });
    } catch (e) {
      // Non-fatal; navigation should still proceed even if telemetry fails.
      log.warn('Navigation start signal failed', e);
    }

    const performUpdate = async () => {
      try {
        log.debug(`[Router] performUpdate Slug: ${slug}`);

        let config = null;
        let params = {};

        // 1. Prioritize Dynamic Route Matching (Patterns with :)
        for (const pattern in this.routes) {
          if (pattern.includes(':')) {
            const match = this.matchRoute(pattern, cleanPath);
            if (match) {
              config = this.routes[pattern];
              params = match;
              // Convention: The feature slug for the tag is the first segment of the pattern
              slug = pattern.split('/')[0];
              break;
            }
          }
        }

        // 2. Fallback to Exact Slug Match
        if (!config) {
          config = this.routes[slug];
        }

        // Default Fallback
        if (!config) {
          // Dynamic Feature Loading (Zero-Build)
          // We assume the feature structure matches the slug, e.g. features/foo/foo.js
          config = { path: `@features/${slug}/${slug}.js` };
        }

        // Route Guard Check
        if (config.guard) {
          const isAllowed = await config.guard();
          if (!isAllowed) {
            log.warn(`Access Denied for [${slug}]. Redirecting to login.`);

            // Save the intended destination for a post-login jump
            localStorage.setItem('axiom_auth_redirect', path);
            state.notify('Authentication Required', 'warning');

            // Redirect to login
            return this.navigate(this.loginPath, true, 'fade');
          }
        }

        if (signal.aborted || navigationId !== this._activeNavId) return; // Guard
        // Cache-busting is the build's: tools/minify.js stamps every lazy-route path.
        // Parallelize: Load Code + Fetch Data
        await Promise.all([
          import(config.path),
          config.api ? state.query(config.dataKey, async () => {
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            // Pass params AND signal to API function
            return (typeof config.api === 'function')
              ? config.api(params, signal)
              : fetch(config.api, { signal }).then(r => r.json());
          }, undefined, { signal }).catch(err => {
            if (err.name === 'AbortError') throw err; // Re-throw to catch block
            log.error('Data Fetch Failed', err);
          }) : null
        ]);

        if (signal.aborted || navigationId !== this._activeNavId) return;

        const queryObject = Object.fromEntries(new URLSearchParams(queryString));

        document.documentElement.setAttribute('data-transition', direction);

        // Update State
        state.set('route', slug);
        state.set('query', queryObject);
        state.set('params', params);

        // Document title: the route's `title`, a sub-view when the URL has one (so
        // history entries differ), and the app's name — all three the app's to set.
        const subView = params.view || pathSegments[1] || '';
        const heading = subView
          ? [subView.charAt(0).toUpperCase() + subView.slice(1).replace(/-/g, ' '), config.title || slug]
          : (config.title ? [config.title] : []);
        document.title = [...heading, this.appName].filter(Boolean).join(' — ') || config.title || slug;

        // Emit a navigation "commit" signal after state is updated,
        // providing a unique event even when slug stays the same.
        try {
          state.set('navigation', {
            phase: 'commit',
            navigationId,
            path,
            cleanPath,
            slug,
            params,
            direction,
            timestamp: Date.now()
          });
          state.set('pendingRoute', null);
        } catch (e) {
          log.warn('Navigation commit signal failed', e);
        }
        this._endNav(navigationId, 'commit');

        // Wait for the specific element to finish its internal setup/render
        const container = document.getElementById('app-container');
        const featureEl = container?.firstElementChild;

        if (featureEl) {
          if (featureEl.rendered) await featureEl.rendered;
        }

        // Superseded while its page rendered? Then it must not touch the active
        // path, focus or scroll: a late commit here scrolled to its own target
        // after Back had already restored the offset.
        if (signal.aborted || navigationId !== this._activeNavId) return;

        // Scroll Restoration
        // The URL is final here (pushState already ran on the push branch) —
        // record the committed path as the page any FUTURE navigation is
        // departing from.
        this._activePath = location.pathname;
        this._committedNavId = navigationId;

        // A PUSH is a new arrival and lands at the TOP. Only a POP restores the
        // offset saved when that page was left — back/forward, and the boot pass,
        // which navigates with push=false so a same-session refresh still returns
        // you to where you were. Restoring the destination's stale sessionStorage
        // offset on a push was the "navigate lands halfway down the page" bug:
        // clicking a link to a page you had scrolled earlier dropped you into the
        // middle of it. Reconciled from daystra; axiom carried this one.
        let targetY = 0;
        if (!push) {
          targetY = parseInt(sessionStorage.getItem(`scroll_${location.pathname}`) || '0', 10);
        }

        // One double-frame: the first lets layout resolve, the second commits
        // focus and scroll together. They used to be split across frames so the
        // restore could out-race focus-scroll — an ordering workaround that is
        // unnecessary now the cause is fixed below.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (navigationId !== this._activeNavId) return; // superseded during these frames
            const feature = document.getElementById('app-container')?.firstElementChild;
            // preventScroll: BaseComponent attaches its shadow root with
            // delegatesFocus on by default, so a bare focus() lands on the page's
            // FIRST FOCUSABLE child and scrolls it into view — putting the user
            // mid-page on any route whose first tabbable element is below the
            // fold. Keep the focus for a11y; never let it move the viewport.
            // Reconciled from daystra / scobot / tender; axiom carried this one.
            if (feature) { feature.tabIndex = -1; feature.focus({ preventScroll: true }); }
            window.scrollTo({ top: targetY, behavior: 'instant' });
            // Where it landed and how tall the page was — a restore the page is too
            // short to honour lands short, and this is the line a trace shows it in.
            log.debug(`[Router] scroll → ${targetY}: landed ${Math.round(window.scrollY)}, page ${document.documentElement.scrollHeight}px`);
            // Announce the new page — focus alone lands on a host with no
            // accessible name. Not on the first load: a screen reader reads a
            // fresh page on its own. A navigation that lost never gets here.
            if (this._announced) announce(document.title);
            this._announced = true;
            state.set('transitioning', false);
          });
        });

      } catch (err) {
        if (err.name === 'AbortError') {
          // Silent exit - user navigated away
          return;
        }

        log.error(`Navigation failed for [${slug}]`, err);
        state.set('transitioning', false);
        this._endNav(navigationId, 'error', { error: reason(err) });

        // Fallback Logic: Try to recover by loading 404
        if (slug !== 'not-found') {
          state.notify(`Route not found: ${slug}`, 'warning');

          // Recursive call isn't safe here because we need to force the swap.
          // Instead, we manually trigger the not-found load.
          try {
            await import('@features/not-found/not-found.js');
            state.set('route', 'not-found');

            // Update the URL so the user knows they are lost. BASE-AWARE: a
            // bare '/not-found' resolves against the DOMAIN root, so on the
            // /axiom/ Pages subpath a failed route rewrote the address out of
            // the deployment entirely and 404'd at the host.
            history.replaceState({ index: this._lastIndex }, '', this.base + 'not-found');
          } catch (panicErr) {
            this._panic('not-found-component-failed', panicErr, slug);
          }
        } else {
          // We were TRYING to load 404 and that failed too.
          this._panic('not-found-route-broken', err, slug);
        }
      }
    };


    // 4. View Transition Orchestration
    if (document.startViewTransition) {
      if (this._activeTransition) this._activeTransition.skipTransition();
      // The browser calls the update only once it has captured the old page. A
      // browser that never gets there must not hold the navigation: past
      // VT_STALL_MS the transition is skipped and the update runs anyway.
      // `update` starts performUpdate once; a late call is a no-op. (Prompted by
      // WebKit on Linux CI going 6 s without calling it — but there the whole main
      // thread was blocked and no timer could fire, this one included. No engine
      // has been seen to trip this bound; if none ever does, it can go.)
      let updating = null;
      let stallTimer;
      const update = () => (updating ??= performUpdate());
      const transition = document.startViewTransition(() => { clearTimeout(stallTimer); return update(); });
      const stalled = new Promise(resolve => {
        stallTimer = setTimeout(() => {
          if (updating) return;
          log.warn(`[Router] View transition did not start within ${VT_STALL_MS}ms; updating without it`);
          transition.skipTransition();
          resolve(update());
        }, VT_STALL_MS);
      });
      // `ready` rejects whenever the animation is skipped — a hidden tab
      // (InvalidStateError) or a superseding navigation (AbortError). The router
      // never awaits it, so every background-tab navigation raised an unhandled
      // rejection. The DOM update still runs either way; mark it handled.
      transition.ready.catch(() => {});
      this._activeTransition = transition;
      try {
        await Promise.race([transition.finished, stalled]);
      } catch (e) {
        // Silently handle AbortError from skipTransition()
        if (e.name !== 'AbortError') log.error('ViewTransition error:', e);
      } finally {
        if (this._activeTransition === transition) {
          document.documentElement.removeAttribute('data-transition');
          this._activeTransition = null;
        }
      }
    } else {
      await performUpdate();
    }
  },

  /** @internal The navigation in flight: started, and not yet committed, aborted or failed. */
  _openNav: null,

  /** @internal Close the navigation in flight with its one terminal phase. */
  _endNav(navigationId, phase, extra) {
    const open = this._openNav;
    if (open?.navigationId !== navigationId) return;
    this._openNav = null;
    emit('axiom:navigation', { phase, navigationId, path: open.path, slug: open.slug, ms: elapsed(open.t0), ...extra });
  },

  /** @param {MouseEvent} e */
  handleIntercept(e) {
    // A click is handled ONCE. nav-dock and nav-sidebar route their own clicks
    // (preventDefault + navigate), and the same event then bubbles to the
    // document listener installed by init(). Without this guard every such click
    // navigated twice and pushed two history entries: Back needed two presses,
    // and the second navigation skipped the first one's view transition.
    if (e.defaultPrevented) return;
    // Leave the browser's own affordances alone: a new tab or window, a
    // download, an explicit target, any button but the primary one.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // composedPath, not closest: clicks inside Shadow DOM are retargeted to the
    // shadow host, so e.target.closest('a') misses anchors rendered in a
    // component's shadow root → full page reload instead of a view transition.
    const link = e.composedPath().find(el => el && el.tagName === 'A' && el.href);
    if (!link || link.origin !== location.origin) return;
    // rel="external" is the explicit opt-out for a same-origin link the app does
    // not own — a server-rendered page, a download endpoint. Reconciled from ev.
    if ((link.target && link.target !== '_self') || link.hasAttribute('download') || link.relList.contains('external')) return;

    // Internal only: the browser-resolved URL must sit under our base.
    if (link.href.startsWith(location.origin + this.base) || this.base === '/') {
      e.preventDefault();
      this.navigate(link.getAttribute('href'));
    }
  },

  /** @param {string} pattern @param {string} path @returns {Record<string, string>|null} */
  matchRoute(pattern, path) {
    if (!pattern || !path) return null;
    const p = (pattern || '').split('/').filter(Boolean);
    const u = (path || '').split('/').filter(Boolean);

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

  /**
   * Terminal navigation failure.
   *
   * The router does NOT decide what a fatal error looks like — that is the
   * application's call. It emits a cancelable `axiom:router-error` on window;
   * an app that calls preventDefault() owns the outcome from there (error
   * boundary, toast, telemetry, full-screen panic — its choice).
   *
   * Only when nobody handles it does the router draw a last-resort message, and
   * it draws into the APP CONTAINER, not document.body. Overwriting
   * body.innerHTML tore out the shell and every live component instance with
   * it — a white screen with extra steps, not a graceful panic. Built with
   * textContent rather than markup so a route slug can never inject.
   *
   * @returns {boolean} true if the application handled it
   */
  _panic(reason, error, slug) {
    log.error(`Axiom Router panic [${reason}] on [${slug}]`, error);

    const handled = !window.dispatchEvent(new CustomEvent('axiom:router-error', {
      detail: { reason, error, slug, path: location.pathname },
      cancelable: true,
    }));
    if (handled) return true;

    const host = document.getElementById('app-container') || document.body;
    const panel = document.createElement('div');
    panel.className = 'axiom-router-panic';
    panel.setAttribute('role', 'alert');

    const heading = document.createElement('h1');
    heading.textContent = 'This page failed to load';
    const detail = document.createElement('p');
    detail.textContent = 'Try reloading. If it keeps happening, this route is broken.';

    panel.append(heading, detail);
    host.replaceChildren(panel);
    return false;
  },

  _saveScroll(path) {
    const y = window.scrollY || document.documentElement.scrollTop;
    sessionStorage.setItem(`scroll_${path}`, y);
  }
};
