/**
 * Post-sign-in destination handoff (src/core/auth-redirect.js).
 *
 * A saved destination is resumed only when the app has just landed from
 * sign-in, and only while fresh. Without both checks an abandoned sign-in
 * left a destination in storage that hijacked the user's NEXT visit —
 * including a deep link opened days later. Relayed from scobot (Arc intent
 * 48, docs/handoffs/2026-10-03-axiom-auth-relay.md in that repo).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveRedirect, takeRedirect, landingPath, REDIRECT_KEY, REDIRECT_TTL_MS
} from '@core/auth-redirect.js';

const mem = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    has: (k) => m.has(k),
  };
};
const T0 = 1_790_000_000_000;

describe('auth redirect handoff', () => {
  test('resumes a fresh destination when landing from sign-in at the root', () => {
    const s = mem();
    saveRedirect(s, '/join?code=ABC123', T0);
    assert.equal(takeRedirect(s, '/', T0 + 60_000), '/join?code=ABC123');
    assert.equal(s.has(REDIRECT_KEY), false);
  });

  test('also resumes on /login and /home landings', () => {
    for (const p of ['/login', '/home']) {
      const s = mem();
      saveRedirect(s, '/library?redeem=X', T0);
      assert.equal(takeRedirect(s, p, T0 + 1000), '/library?redeem=X', p);
    }
  });

  test("an app's own loginPath is a landing too", () => {
    const s = mem();
    saveRedirect(s, '/dashboard', T0);
    assert.equal(takeRedirect(s, '/signin', T0 + 1, REDIRECT_TTL_MS, '/', ['/signin']), '/dashboard');
  });

  test('a stale destination never hijacks a later deep link, and is cleared', () => {
    const s = mem();
    saveRedirect(s, '/insights', T0);
    assert.equal(takeRedirect(s, '/join', T0 + 1000), null); // user opened a deep link
    assert.equal(s.has(REDIRECT_KEY), false);
    assert.equal(takeRedirect(s, '/', T0 + 2000), null); // and it is gone for good
  });

  test('expires after the TTL even on a landing path', () => {
    const s = mem();
    saveRedirect(s, '/insights', T0);
    assert.equal(takeRedirect(s, '/', T0 + REDIRECT_TTL_MS + 1), null);
    assert.equal(s.has(REDIRECT_KEY), false);
  });

  test('rejects a timestamp from the future (clock skew or tampering)', () => {
    const s = mem();
    saveRedirect(s, '/insights', T0 + 60_000);
    assert.equal(takeRedirect(s, '/', T0), null);
  });

  test('accepts a legacy bare-string value only on a landing path', () => {
    const s = mem();
    s.setItem(REDIRECT_KEY, '/sessions');
    assert.equal(takeRedirect(s, '/', T0), '/sessions');
    s.setItem(REDIRECT_KEY, '/sessions');
    assert.equal(takeRedirect(s, '/library', T0), null);
  });

  test('refuses anything that is not a same-origin app path', () => {
    for (const bad of ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', '']) {
      const s = mem();
      saveRedirect(s, bad, T0);
      assert.equal(takeRedirect(s, '/', T0 + 1), null, bad);
    }
  });

  test('returns null when nothing is stored', () => {
    assert.equal(takeRedirect(mem(), '/', T0), null);
  });

  test('normalizes landing paths (trailing slash, index.html, deploy base)', () => {
    assert.equal(landingPath('/login/'), '/login');
    assert.equal(landingPath('/index.html'), '/');
    assert.equal(landingPath(''), '/');
    assert.equal(landingPath('/base/', '/base/'), '/');
    assert.equal(landingPath('/base', '/base/'), '/');
    assert.equal(landingPath('/base/login', '/base/'), '/login');
    const s = mem();
    saveRedirect(s, '/library', T0);
    assert.equal(takeRedirect(s, '/base/', T0 + 1, REDIRECT_TTL_MS, '/base/'), '/library');
  });
});
