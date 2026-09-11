/**
 * auth.init({ tokenStore }) — where persisted identity lives.
 *
 * The default stays localStorage (2026-09-05 auth spec; in-app browsers finish
 * the OAuth redirect in a fresh tab). The point of the option is that an app
 * CAN choose a shorter-lived store — and that choosing one actually retires the
 * long-lived copy rather than leaving it behind.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { auth } from '@core/auth.js';

const fakeJwt = (payload) => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
// Expiry well outside the refresh window: init restores it without a network call.
const bundle = () => ({
  accessToken: 'at', refreshToken: 'rt',
  idToken: fakeJwt({ sub: 'u1', email: 'u@example.com' }),
  expiresAt: Date.now() + 60 * 60 * 1000,
});

beforeEach(() => {
  auth._clear();
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth tokenStore', () => {
  test("default 'local' persists to localStorage — unchanged behaviour", async () => {
    await auth.init({ keepAlive: false });
    auth._tokens = bundle(); auth._persistTokens();
    assert.ok(localStorage.getItem('axiom_auth'));
    assert.equal(sessionStorage.getItem('axiom_auth'), null);
  });

  test("default 'local' still restores a stored session", async () => {
    localStorage.setItem('axiom_auth', JSON.stringify(bundle()));
    await auth.init({ keepAlive: false });
    assert.equal(auth.isAuthenticated(), true);
    assert.equal(auth.getUser()?.sub, 'u1');
  });

  test("'session' persists to sessionStorage only", async () => {
    await auth.init({ keepAlive: false, tokenStore: 'session' });
    auth._tokens = bundle(); auth._persistTokens();
    assert.ok(sessionStorage.getItem('axiom_auth'));
    assert.equal(localStorage.getItem('axiom_auth'), null);
  });

  test("'session' restores from sessionStorage", async () => {
    sessionStorage.setItem('axiom_auth', JSON.stringify(bundle()));
    await auth.init({ keepAlive: false, tokenStore: 'session' });
    assert.equal(auth.isAuthenticated(), true);
    assert.equal(auth.getUser()?.sub, 'u1');
  });

  test("'memory' persists nowhere", async () => {
    await auth.init({ keepAlive: false, tokenStore: 'memory' });
    auth._tokens = bundle(); auth._persistTokens(); auth._writeProfile({ sub: 'u1' });
    assert.equal(localStorage.length + sessionStorage.length, 0);
    assert.equal(auth._tokens.accessToken, 'at');
  });

  test('choosing a shorter-lived store retires identity left in localStorage', async () => {
    localStorage.setItem('axiom_auth', JSON.stringify(bundle()));
    localStorage.setItem('axiom_profile', '{"sub":"u1"}');
    localStorage.setItem('axiom-avatar', '{"key":"u1"}');
    await auth.init({ keepAlive: false, tokenStore: 'session' });
    for (const k of ['axiom_auth', 'axiom_profile', 'axiom-avatar']) {
      assert.equal(localStorage.getItem(k), null, `${k} outlived the choice`);
    }
  });

  test('a custom adapter receives the writes', async () => {
    const calls = [];
    const adapter = {
      getItem: (k) => { calls.push(['get', k]); return null; },
      setItem: (k) => { calls.push(['set', k]); },
      removeItem: (k) => { calls.push(['remove', k]); },
    };
    await auth.init({ keepAlive: false, tokenStore: adapter });
    auth._tokens = bundle(); auth._persistTokens();
    assert.ok(calls.some(([op, k]) => op === 'set' && k === 'axiom_auth'));
  });

  test('an unknown store is refused, not silently treated as local', async () => {
    await assert.rejects(auth.init({ tokenStore: 'cookie' }), /tokenStore/);
  });

  test('an incomplete adapter is refused', async () => {
    await assert.rejects(auth.init({ tokenStore: { getItem() {} } }), /getItem, setItem and removeItem/);
  });

  test('clear removes identity from the chosen store and flow keys from localStorage', async () => {
    await auth.init({ keepAlive: false, tokenStore: 'session' });
    auth._tokens = bundle(); auth._persistTokens(); auth._writeProfile({ sub: 'u1' });
    localStorage.setItem('axiom_pkce_verifier', 'v');
    localStorage.setItem('axiom_oauth_state', 's');
    // Precondition: without it, "absent from sessionStorage" passes vacuously on
    // code that never wrote there at all.
    assert.ok(sessionStorage.getItem('axiom_auth'), 'precondition: identity is in the chosen store');
    auth._clear();
    assert.equal(sessionStorage.getItem('axiom_auth'), null);
    assert.equal(sessionStorage.getItem('axiom_profile'), null);
    assert.equal(localStorage.getItem('axiom_pkce_verifier'), null);
    assert.equal(localStorage.getItem('axiom_oauth_state'), null);
  });
});
