/**
 * Router ↔ saved sign-in destination.
 *
 * The guard saves where a signed-out visitor was going; router.init resumes it
 * after sign-in. Three defects relayed from scobot (Arc intent 48):
 *  - nav links use RELATIVE hrefs (nav-sidebar href="dashboard"); saving the raw
 *    href meant the resume's leading-slash check dropped it,
 *  - a signed-in user failing a role guard re-saved the path, ambushing their
 *    next visit,
 *  - init resumed a stored destination whatever URL the user actually opened.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { router } from '@core/router.js';
import { auth } from '@core/auth.js';
import { saveRedirect, takeRedirect, REDIRECT_KEY } from '@core/auth-redirect.js';

const deny = { path: 'x', guard: async () => false };

beforeEach(() => {
  auth._clear();
  localStorage.clear();
  globalThis.history = { state: { index: 0 }, replaceState() {}, pushState() {} };
  router.routes = { library: deny, join: deny, admin: deny };
  router.base = '/';
  router.loginPath = '/login';
});

// Run one real navigation; the guard's own follow-up redirect to loginPath is
// recorded instead of performed.
const navigateOnce = async (t, href) => {
  const original = router.navigate.bind(router);
  const followUps = [];
  let first = true;
  t.mock.method(router, 'navigate', (p, ...rest) => {
    if (!first) { followUps.push(p); return Promise.resolve(); }
    first = false;
    return original(p, ...rest);
  });
  await router.navigate(href, true);
  return followUps;
};

describe('router guard saves a resumable destination', () => {
  for (const href of ['library', '/library', 'join?code=ABC123', '/join?code=ABC123']) {
    test(`href "${href}" is saved as a leading-slash app path`, async (t) => {
      const followUps = await navigateOnce(t, href);
      assert.deepEqual(followUps, ['/login']);
      const expected = href.startsWith('/') ? href : `/${href}`;
      assert.equal(takeRedirect(localStorage, '/', Date.now()), expected);
    });
  }

  test('a signed-in user failing a role guard saves nothing', async (t) => {
    auth._tokens = { accessToken: 'at', expiresAt: Date.now() + 3_600_000 };
    await navigateOnce(t, 'admin');
    assert.equal(localStorage.getItem(REDIRECT_KEY), null);
  });
});

describe('router.init resumes only a fresh destination on a sign-in landing', () => {
  const boot = (t, pathname) => {
    globalThis.location.pathname = pathname;
    globalThis.location.search = '';
    globalThis.location.hash = '';
    document.addEventListener ??= () => {};
    const calls = [];
    t.mock.method(router, 'navigate', (p, push) => { calls.push([p, push]); return Promise.resolve(); });
    router.init({ routes: router.routes });
    return calls;
  };

  test('a stale destination does not hijack a deep link, and is cleared', (t) => {
    auth._tokens = { accessToken: 'at', expiresAt: Date.now() + 3_600_000 };
    saveRedirect(localStorage, '/dashboard', Date.now() - 1000);
    const calls = boot(t, '/join');
    assert.deepEqual(calls, [['/join', false]]);
    assert.equal(localStorage.getItem(REDIRECT_KEY), null);
  });

  test('a fresh destination resumes when landing at the root after sign-in', (t) => {
    auth._tokens = { accessToken: 'at', expiresAt: Date.now() + 3_600_000 };
    saveRedirect(localStorage, '/dashboard', Date.now() - 1000);
    const calls = boot(t, '/');
    assert.deepEqual(calls, [['/dashboard', true]]);
  });
});
