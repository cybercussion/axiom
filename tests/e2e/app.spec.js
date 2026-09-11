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
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
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
    expect(problems, 'contained: nothing uncaught').toEqual([]);
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

