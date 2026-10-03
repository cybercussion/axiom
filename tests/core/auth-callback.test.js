/**
 * auth.init only treats ?code= as an OAuth callback on the redirect path.
 *
 * Relayed from scobot (Arc intent 47): an app route that uses a `code` query
 * param (scobot's /join?code=ABC123) was handed to _handleCallback, failed with
 * "Login session expired" (no PKCE verifier), had its query stripped, and init
 * returned BEFORE hydrating the stored session — a signed-in user looked
 * signed out.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { auth } from '@core/auth.js';

const fakeJwt = (payload) => ['e30', Buffer.from(JSON.stringify(payload)).toString('base64url'), 'sig'].join('.');
const bundle = () => ({
  accessToken: 'at', refreshToken: 'rt',
  idToken: fakeJwt({ sub: 'u1', email: 'u@example.com' }),
  expiresAt: Date.now() + 60 * 60 * 1000,
});

let replaced;
beforeEach(() => {
  auth._clear();
  localStorage.clear();
  replaced = [];
  window.history = { replaceState: (...a) => replaced.push(a) };
});
afterEach(() => {
  location.pathname = '/';
  location.search = '';
});

describe('auth.init and app routes that use ?code=', () => {
  test('a signed-in user opening /join?code= stays signed in with the query intact', async () => {
    localStorage.setItem('axiom_auth', JSON.stringify(bundle()));
    location.pathname = '/join';
    location.search = '?code=ABC123';
    await auth.init({ keepAlive: false });
    assert.equal(auth.isAuthenticated(), true);
    assert.equal(replaced.length, 0, 'the URL is not rewritten');
  });
});
