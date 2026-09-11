/**
 * The runtime in a real browser (Chromium), under the production CSP.
 *
 * These cover what node cannot: navigation, history, scroll, Shadow DOM event
 * paths, View Transitions, and the Content-Security-Policy itself. Most pin a
 * behaviour this repository has broken before; the fixing commit is named.
 */
import { test, expect } from '@playwright/test';

// In-page witness for CSP violations. Init scripts are injected by the driver,
// outside the page's own policy.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
});

/** Uncaught errors and console errors for the life of the page. */
// "ResizeObserver loop completed with undelivered notifications" is the spec's
// signal that some observations were deferred a frame; WebKit surfaces it as an
// uncaught error. It is not a failure. Its source (a layout change inside an
// observer) is tracked with the layout-shift work, not hidden: see the ledger.
const BENIGN = /ResizeObserver loop completed with undelivered notifications/;
const watch = (page) => {
  const problems = [];
  page.on('pageerror', (e) => { if (!BENIGN.test(e.message)) problems.push(`pageerror: ${e.message}`); });
  // The logger prints every level through console.log; its errors count too.
  page.on('console', (m) => { if (m.type() === 'error' || m.text().includes('[Axiom::ERROR]')) problems.push(`console: ${m.text()}`); });
  return problems;
};
const violations = (page) => page.evaluate(() => window.__csp);
/**
 * The route is done: its host rendered and the router finished its commit frames
 * (transitioning back to false). Scrolling before that races the router's own
 * restore, which is what the first draft of the scroll tests did.
 */
/**
 * Layout has stopped moving: document height unchanged for 8 frames. /components
 * keeps laying out for ~350 ms after it reports rendered (6,322 -> 4,623 px);
 * scrolling before that lets the browser move the reader, and the router then
 * faithfully saves wherever the page really was.
 */
const stable = (page) => page.evaluate(() => new Promise((resolve) => {
  let last = -1;
  let still = 0;
  const tick = () => {
    const h = document.documentElement.scrollHeight;
    still = h === last ? still + 1 : 0;
    last = h;
    if (still >= 8) resolve(h); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}));
const settled = async (page, tag) => {
  // The predicate must be SYNCHRONOUS: an async one returns a Promise, which is
  // truthy, and waitForFunction resolves on its first poll without waiting.
  await page.evaluate(async () => { window.__axState ??= (await import('/src/core/state.js')).state; });
  await page.waitForFunction((t) => {
    const el = document.querySelector(`#app-container > ${t}`);
    return el?.shadowRoot?.childElementCount > 0 && window.__axState.get('transitioning') === false;
  }, tag);
};
const navigateInPage = (page, paths) => page.evaluate(async (list) => {
  const { router } = await import('/src/core/router.js');
  for (const p of list) router.navigate(p);
}, paths);

test('boots clean under the production policy', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  expect(problems).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

for (const [route, tag] of [['/dashboard', 'dashboard-ui'], ['/components', 'components-ui'], ['/contact', 'contact-ui'], ['/counter', 'counter-ui']]) {
  test(`deep link ${route} renders with zero violations`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(route);
    await expect(page.locator(`#app-container > ${tag}`)).toBeAttached();
    expect(problems).toEqual([]);
    expect(await violations(page)).toEqual([]);
  });
}

test('dashboard data arrives through connect-src', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('dashboard-ui ax-stat').first()).toBeAttached();
  await expect(page.locator('dashboard-ui .error-panel')).toHaveCount(0);
});

test('an unknown path renders the 404 page', async ({ page }) => {
  await page.goto('/definitely/not/here');
  await expect(page.locator('#app-container > not-found-ui')).toBeAttached();
});

test('rapid navigation lands on the last route with no unhandled rejection (bd68e2f)', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await navigateInPage(page, ['/dashboard', '/components', '/contact', '/home', '/dashboard', '/components']);
  await expect(page.locator('#app-container > components-ui')).toBeAttached();
  await expect(page).toHaveURL(/\/components$/);
  await page.waitForTimeout(500); // let every superseded transition settle and report
  expect(problems).toEqual([]);
});

test('a link inside Shadow DOM routes without a full reload (composedPath)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.locator('nav-dock a[href="dashboard"]').click();
  await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  expect(await page.evaluate(() => window.__sameDocument)).toBe(true);
});

test('one click is one navigation and one history entry', async ({ page }) => {
  // Regression: nav-dock routed its click, then the router's document listener
  // routed the same event again — two navigations and two history entries per
  // click, so Back needed two presses.
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await page.evaluate(async () => {
    const { router } = await import('/src/core/router.js');
    window.__starts = 0;
    router.onNavigation((nav) => { if (nav?.phase === 'start') window.__starts += 1; });
  });
  const before = await page.evaluate(() => history.length);
  await page.locator('nav-dock a[href="dashboard"]').click();
  await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__starts)).toBe(1);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test('a target="_blank" link is left to the browser', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await page.evaluate(() => {
    document.body.append(Object.assign(document.createElement('a'), { href: '/dashboard', target: '_blank', id: 'new-tab', textContent: 'open' }));
  });
  const opened = context.waitForEvent('page');
  await page.locator('#new-tab').click();
  await (await opened).close();
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
});

test('back and forward restore routes through popstate', async ({ page }) => {
  await page.goto('/');
  await page.locator('nav-dock a[href="dashboard"]').click();
  await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  await page.locator('nav-dock a[href="components"]').click();
  await expect(page.locator('#app-container > components-ui')).toBeAttached();
  await page.goBack();
  await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  await page.goForward();
  await expect(page.locator('#app-container > components-ui')).toBeAttached();
});

test('a push lands at the top; back returns to the saved offset (f970f5e)', async ({ page }) => {
  await page.goto('/components');
  await settled(page, 'components-ui');
  await stable(page);
  const target = await page.evaluate(() => Math.min(1200, document.documentElement.scrollHeight - innerHeight - 10));
  expect(target, 'the page must actually scroll for this test to mean anything').toBeGreaterThan(300);
  // Instant, and wait for it: the theme sets scroll-behavior: smooth, so a plain
  // scrollTo animates — Firefox was still mid-animation when the test clicked
  // away, and the router correctly saved the offset the page was actually at.
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(target);
  await page.locator('nav-dock a[href="contact"]').click();
  await expect(page.locator('#app-container > contact-ui')).toBeAttached();
  // The ordinary Back: the contact navigation has finished. The in-flight case
  // has its own test below.
  await settled(page, 'contact-ui');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.locator('#app-container > components-ui')).toBeAttached();
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 3000 }).toBeGreaterThan(target - 60);
});

test('Back during an in-flight navigation still restores the offset', async ({ page }) => {
  // Regression: a superseded navigation kept going once its page rendered — it
  // scrolled to its own target (0) after Back had restored the offset. Holding
  // the contact stylesheet keeps that navigation in flight when Back fires.
  await page.goto('/components');
  await settled(page, 'components-ui');
  await stable(page);
  const target = await page.evaluate(() => Math.min(1200, document.documentElement.scrollHeight - innerHeight - 10));
  // Instant, and wait for it: the theme sets scroll-behavior: smooth, so a plain
  // scrollTo animates — Firefox was still mid-animation when the test clicked
  // away, and the router correctly saved the offset the page was actually at.
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), target);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(target);
  await page.route('**/features/contact/*.css*', (route) => setTimeout(() => route.continue(), 800));
  await page.locator('nav-dock a[href="contact"]').click();
  await expect(page.locator('#app-container > contact-ui')).toBeAttached();
  await page.goBack();
  await expect(page.locator('#app-container > components-ui')).toBeAttached();
  await page.waitForTimeout(1300); // outlast the held stylesheet and any late frames
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(target - 60);
});

test('router-error: a handled terminal failure is left to the app', async ({ page }) => {
  await page.route('**/src/features/not-found/not-found.js*', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await page.evaluate(() => window.addEventListener('axiom:router-error', (e) => {
    e.preventDefault();
    window.__routerError = e.detail.reason;
  }));
  await navigateInPage(page, ['/nowhere']);
  await expect.poll(() => page.evaluate(() => window.__routerError)).toBe('not-found-component-failed');
  await expect(page.locator('#app-container .axiom-router-panic')).toHaveCount(0);
});

test('router-error: unhandled, it draws into the container and the shell survives (a6390fe)', async ({ page }) => {
  await page.route('**/src/features/not-found/not-found.js*', (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await navigateInPage(page, ['/nowhere']);
  const panic = page.locator('#app-container > .axiom-router-panic');
  await expect(panic).toBeAttached();
  await expect(panic).toHaveAttribute('role', 'alert');
  await expect(page.locator('nav-orchestrator')).toBeAttached();
  await expect(page.locator('toast-manager')).toBeAttached();
});

for (const honours of [false, true]) {
  test(`a navigation that lost leaves no data behind (its loader ${honours ? 'honours' : 'ignores'} the AbortSignal)`, async ({ page }) => {
    // The review's A/B race: /item/1 (slow) then /item/2 (fast). Before the fix,
    // the page ended on /item/2 showing item 1's data — or, with a loader that
    // honours its signal, flashed an error state for the navigation that lost.
    await page.goto('/');
    await expect(page.locator('#app-container > home-ui')).toBeAttached();
    const out = await page.evaluate(async (honoursSignal) => {
      const { router } = await import('/src/core/router.js');
      const { state } = await import('/src/core/state.js');
      const writes = [];
      state.subscribe(({ key, value }) => { if (key === 'item') writes.push(`id=${value?.data?.id ?? '-'} ${value?.status ?? 'cleared'}`); });
      router.routes['item/:id'] = {
        path: '@features/counter/counter.js',
        dataKey: 'item',
        api: (params, signal) => new Promise((resolve, reject) => {
          const t = setTimeout(() => resolve({ id: params.id }), params.id === '1' ? 900 : 150);
          if (honoursSignal) signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
        }),
      };
      router.navigate('/item/1');
      setTimeout(() => router.navigate('/item/2'), 50);
      await new Promise((r) => setTimeout(r, 1500));
      return { url: location.pathname, shows: state.get('item')?.data?.id, writes };
    }, honours);
    expect(out.url).toBe('/item/2');
    expect(out.shows, out.writes.join(' | ')).toBe('2');
    expect(out.writes.filter((w) => w.startsWith('id=1')), 'the navigation that lost wrote its data').toEqual([]);
    expect(out.writes.filter((w) => w.includes('error')), 'the navigation that lost wrote an error').toEqual([]);
  });
}

const brokenCounter = (phase) => `import { BaseComponent } from '/src/shared/base-component.js';
class CounterUI extends BaseComponent {
  async setup() { ${phase === 'setup' ? "throw new Error('setup exploded');" : ''} }
  render() { ${phase === 'render' ? "throw new Error('render exploded');" : "this.shadowRoot.textContent = 'ok';"} }
}
customElements.define('counter-ui', CounterUI);`;

for (const phase of ['setup', 'render']) {
  test(`a component that throws in ${phase}() is contained — its navigation still completes`, async ({ page }) => {
    // Regression: the router awaits `rendered`, which a throwing component never
    // resolved — URL and host swapped, transitioning stuck true, no focus or scroll.
    const problems = watch(page);
    await page.route('**/src/features/counter/counter.js*', (r) => r.fulfill({ contentType: 'text/javascript', body: brokenCounter(phase) }));
    await page.goto('/');
    await expect(page.locator('#app-container > home-ui')).toBeAttached();
    await navigateInPage(page, ['/counter']);
    await settled(page, 'counter-ui');
    await expect(page.locator('counter-ui .axiom-component-error')).toHaveAttribute('role', 'alert');
    await expect(page.locator('nav-orchestrator')).toBeAttached();
    const containment = `Axiom Component Error [counter-ui · ${phase}]`;
    expect(problems.filter((p) => p.includes(containment)), 'the failure is logged, once').toHaveLength(1);
    expect(problems.filter((p) => !p.includes(containment)), 'contained: nothing else went wrong').toEqual([]);
    await navigateInPage(page, ['/dashboard']);
    await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  });
}

test('an ancestor can own a component failure — preventDefault on axiom:component-error', async ({ page }) => {
  await page.route('**/src/features/counter/counter.js*', (r) => r.fulfill({ contentType: 'text/javascript', body: brokenCounter('setup') }));
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await page.evaluate(() => document.getElementById('app-container').addEventListener('axiom:component-error', (e) => {
    e.preventDefault();
    window.__caught = `${e.detail.component}:${e.detail.phase}`;
  }));
  await navigateInPage(page, ['/counter']);
  await expect.poll(() => page.evaluate(() => window.__caught)).toBe('counter-ui:setup');
  await expect(page.locator('counter-ui .axiom-component-error')).toHaveCount(0);
});

test('notify() renders a markup payload as text (6564943)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { state } = await import('/src/core/state.js');
    state.notify('<img src=x onerror="window.__xss = 1">payload', 'error', 0);
  });
  const toast = page.locator('toast-manager .toast').filter({ hasText: 'payload' });
  await expect(toast).toContainText('<img src=x');
  await expect(toast.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('the policy blocks an injected inline script and reports it', async ({ page }) => {
  await page.goto('/');
  const ran = await page.evaluate(() => {
    const s = document.createElement('script');
    s.textContent = 'window.__inline = true';
    document.head.append(s);
    return window.__inline === true;
  });
  expect(ran).toBe(false);
  await expect.poll(async () => (await violations(page)).some((v) => v.startsWith('script-src'))).toBe(true);
});

test('app settings persist under their historical keys; the slider keeps a 44px target (124b2c2, 227a7c1)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const { state } = await import('/src/core/state.js');
    state.set('audioLevel', 42);
  });
  expect(await page.evaluate(() => localStorage.getItem('axiom-audioLevel'))).toBe('42');
  await page.reload();
  await page.locator('nav-dock .settings-btn').click();
  const slider = page.locator('nav-dock .audio-slider');
  await expect.poll(() => slider.evaluate((el) => el.value)).toBe(42);
  // offsetHeight, not boundingBox(): the popover scales in, and a bounding box
  // measured mid-animation reads 44 × 0.92.
  expect(await slider.evaluate((el) => el.offsetHeight)).toBeGreaterThanOrEqual(44);
});

test('/login renders — and says so when no provider is configured', async ({ page }) => {
  const problems = watch(page);
  await page.goto('/login');
  await expect(page.locator('#app-container > login-ui')).toBeAttached();
  await expect(page.locator('login-ui h1')).toHaveText('Sign in');
  await expect(page.locator('login-ui [role="status"]')).toContainText("isn't configured");
  await expect(page.locator('login-ui [data-ref="google"]')).toHaveCount(0);
  expect(problems).toEqual([]);
  expect(await violations(page)).toEqual([]);
});

test("the dock's Login link reaches the login page", async ({ page }) => {
  // Regression: it led to the 404 — the template linked a page it did not have.
  await page.goto('/');
  await page.locator('nav-dock a[href="login"]').click();
  await expect(page.locator('#app-container > login-ui')).toBeAttached();
  await expect(page).toHaveURL(/\/login$/);
});

test('a route change is announced to screen readers; the first load is not', async ({ page }) => {
  await page.goto('/');
  await settled(page, 'home-ui');
  expect(await page.locator('#a11y-announcer').textContent()).toBe('');
  await page.locator('nav-dock a[href="dashboard"]').click();
  await settled(page, 'dashboard-ui');
  const title = await page.title();
  await expect.poll(() => page.evaluate(() => document.getElementById('a11y-announcer').textContent)).toBe(title);
});

test('rel="external" opts a same-origin link out of client routing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app-container > home-ui')).toBeAttached();
  await page.evaluate(() => {
    window.__sameDocument = true;
    document.body.append(Object.assign(document.createElement('a'), { href: '/dashboard', rel: 'external', id: 'external-link', textContent: 'server page' }));
  });
  await page.locator('#external-link').click();
  await page.waitForURL('**/dashboard');
  await expect(page.locator('#app-container > dashboard-ui')).toBeAttached();
  expect(await page.evaluate(() => window.__sameDocument), 'a full document load happened').toBeUndefined();
});


// ---------------------------------------------------------------------------
// Performance budgets. Layout-shift entries are a Chromium API: the other
// engines skip the number but still run each invariant beneath it.
// ---------------------------------------------------------------------------
const CLS_BUDGET = 0.1; // web.dev's threshold for "good"
const recordShifts = (page) => page.addInitScript(() => {
  window.__cls = 0;
  if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) return;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
});

for (const route of ['components', 'dashboard']) {
  test(`/${route} loads within the layout-shift budget`, async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are Chromium-only');
    await recordShifts(page);
    await page.goto(`/${route}`);
    await settled(page, `${route}-ui`);
    await stable(page);
    expect(await page.evaluate(() => window.__cls)).toBeLessThan(CLS_BUDGET);
  });
}

test("the shadow theme is read from the page's own <link>: one request, not two", async ({ page }) => {
  const requests = [];
  page.on('request', (r) => { if (/\/styles\/theme\.css/.test(r.url())) requests.push(r.resourceType()); });
  await page.goto('/components');
  await settled(page, 'components-ui');
  expect(requests).toEqual(['stylesheet']);
});

test('without a theme <link>, a late theme still never paints a component unstyled', async ({ page, browserName }) => {
  // A page that does not link theme.css makes BaseComponent fetch it, and every
  // component waits. Hold that fetch: nothing may render before it lands, and the
  // dock must survive (the default render once landed after it and erased it).
  // Before the wait, /components painted unstyled and shifted 0.19 when it landed.
  await recordShifts(page);
  await page.route((url) => url.pathname === '/components', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace(/<link[^>]*theme\.css[^>]*>/, '') });
  });
  await page.route('**/styles/theme.css*', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.addInitScript(() => {
    window.__unstyled = new Set();
    const visit = (root) => {
      for (const el of root.querySelectorAll('*')) {
        const shadow = el.shadowRoot;
        if (!shadow) continue;
        const theme = shadow.adoptedStyleSheets[0];
        // Content that paints: not a <style>, not another component (each is visited itself).
        const paints = [...shadow.children].some((c) => c.localName !== 'style' && !c.localName.includes('-'));
        if (paints && theme && !theme.cssRules.length) window.__unstyled.add(el.localName);
        visit(shadow);
      }
    };
    const tick = () => { visit(document); if (performance.now() < 5000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.goto('/components');
  expect(await page.locator('link[href*="theme.css"]').count(), 'the page must really lack the link').toBe(0);
  await settled(page, 'components-ui');
  await stable(page);
  await expect(page.locator('nav-dock')).toBeAttached();
  expect(await page.evaluate(() => [...window.__unstyled])).toEqual([]);
  if (browserName === 'chromium') expect(await page.evaluate(() => window.__cls)).toBeLessThan(CLS_BUDGET);
});

test('a view transition that never starts does not hold the navigation', async ({ page }) => {
  // A browser that never calls a transition's update must not hold the
  // navigation. Stub the worst case in every engine — the update is never
  // called, and skipping does not call it — and the router must commit on its own.
  await page.addInitScript(() => {
    const never = new Promise(() => {});
    document.startViewTransition = () => ({ ready: never, finished: never, updateCallbackDone: never, skipTransition() {} });
  });
  const problems = watch(page);
  const logged = []; // the logger prints every level through console.log
  page.on('console', (m) => logged.push(m.text()));
  await page.goto('/');
  await settled(page, 'home-ui');
  await page.locator('nav-dock a[href="contact"]').click();
  await expect(page.locator('#app-container > contact-ui')).toBeAttached({ timeout: 3000 });
  await settled(page, 'contact-ui');
  expect(page.url()).toMatch(/\/contact$/);
  expect(logged.join('\n')).toContain('View transition did not start');
  expect(problems).toEqual([]);
});

test('a late dock stylesheet does not reflow the page', async ({ page, browserName }) => {
  // The orchestrator pads the content by the nav's measured size, and it measured
  // the dock before the dock had drawn: unstyled at the top of the page, the dock
  // read as a sidebar, the content was padded 1280px to the left, and /components
  // collapsed to one column until the real dock landed. Holding the dock's
  // stylesheet makes that window certain instead of a race.
  await recordShifts(page);
  await page.route('**/features/navigation/navigation.css*', (route) => setTimeout(() => route.continue(), 1000));
  await page.addInitScript(() => {
    window.__leftPads = new Set();
    const tick = () => {
      const pad = document.documentElement.style.getPropertyValue('--nav-left-pad');
      if (pad && pad !== '0px') window.__leftPads.add(pad);
      if (performance.now() < 5000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto('/components');
  await settled(page, 'components-ui');
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--nav-bottom-pad'))).toMatch(/px$/);
  await stable(page);
  expect(await page.evaluate(() => [...window.__leftPads]), 'a dock never pads the left').toEqual([]);
  if (browserName === 'chromium') expect(await page.evaluate(() => window.__cls)).toBeLessThan(CLS_BUDGET);
});

test('every navigation that starts ends exactly once — only the last of a burst commits', async ({ page }) => {
  await page.addInitScript(() => {
    window.__nav = [];
    window.addEventListener('axiom:navigation', (e) => window.__nav.push(e.detail));
  });
  await page.goto('/');
  await settled(page, 'home-ui');
  await navigateInPage(page, ['/dashboard', '/components', '/contact']);
  await settled(page, 'contact-ui');
  await navigateInPage(page, ['/nowhere']);
  await expect(page.locator('#app-container > not-found-ui')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.__nav.at(-1)?.phase)).toBe('error');

  const nav = await page.evaluate(() => window.__nav);
  const phases = new Map();
  for (const e of nav) phases.set(e.navigationId, [...(phases.get(e.navigationId) ?? []), e.phase]);
  for (const [id, p] of phases) expect(p, `navigation ${id}`).toHaveLength(2);
  expect([...phases.values()].map((p) => p.join('→'))).toEqual([
    'start→commit', // the boot navigation
    'start→abort', 'start→abort', 'start→commit', // the burst: only the last commits
    'start→error', // an unknown route
  ]);
  const ends = nav.filter((e) => e.phase !== 'start');
  expect(ends.every((e) => typeof e.ms === 'number')).toBe(true);
  expect(nav.find((e) => e.phase === 'abort').supersededBy).toBeGreaterThan(0);
});

test("a page's title comes from its route; the default route is the app's name", async ({ page }) => {
  // The router used to carry this app's titles and name in a table of its own,
  // so every project that borrowed it either showed Axiom's titles or edited it.
  await page.goto('/');
  await settled(page, 'home-ui');
  expect(await page.title()).toBe('Axiom');
  await navigateInPage(page, ['/dashboard']);
  await settled(page, 'dashboard-ui');
  expect(await page.title()).toBe('Dashboard — Axiom');
  await navigateInPage(page, ['/components']);
  await settled(page, 'components-ui');
  expect(await page.title()).toBe('Components — Axiom');
});
