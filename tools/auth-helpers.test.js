import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAuthorizeUrl, generateCodeVerifier, generateCodeChallenge, base64UrlEncode,
  hydrateProfile, normalizeAvatarUrl, isRefreshRejected, refreshDelayMs
} from '../src/core/auth-helpers.js';

test('buildAuthorizeUrl carries PKCE + state and merges provider extras', () => {
  const url = new URL(buildAuthorizeUrl({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: 'cid', redirectUri: 'https://app.example', challenge: 'CH', state: 'ST',
    extra: { access_type: 'offline', prompt: 'consent' }
  }));
  const p = url.searchParams;
  assert.equal(p.get('response_type'), 'code');
  assert.equal(p.get('client_id'), 'cid');
  assert.equal(p.get('redirect_uri'), 'https://app.example');
  assert.equal(p.get('scope'), 'openid profile email');
  assert.equal(p.get('code_challenge'), 'CH');
  assert.equal(p.get('code_challenge_method'), 'S256');
  assert.equal(p.get('state'), 'ST');
  assert.equal(p.get('access_type'), 'offline');
  assert.equal(p.get('prompt'), 'consent');
});

test('buildAuthorizeUrl refuses to build without state', () => {
  assert.throws(() => buildAuthorizeUrl({ authorizationEndpoint: 'https://x', clientId: 'c', redirectUri: 'r', challenge: 'ch' }), /state/);
});

test('PKCE: verifier is base64url, challenge is the S256 of it', async () => {
  const v = generateCodeVerifier();
  assert.match(v, /^[A-Za-z0-9_-]{43}$/);
  const c = await generateCodeChallenge(v);
  assert.match(c, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(c, v);
  assert.equal(await generateCodeChallenge(v), c); // deterministic
  assert.equal(base64UrlEncode(new Uint8Array([251, 255])), '-_8');
});

test('hydrateProfile backfills parsed > in-memory > stored, and never invents fields', () => {
  const lean = { sub: 's1', email: 'a@b', exp: 1 };
  const prev = { sub: 's1', name: 'Prev Name', picture: 'https://p/prev' };
  const stored = { sub: 's1', name: 'Stored Name', picture: 'https://p/stored' };
  assert.deepEqual(hydrateProfile(lean, prev, stored), { sub: 's1', email: 'a@b', exp: 1, name: 'Prev Name', picture: 'https://p/prev' });
  assert.deepEqual(hydrateProfile(lean, null, stored), { sub: 's1', email: 'a@b', exp: 1, name: 'Stored Name', picture: 'https://p/stored' });
  assert.deepEqual(hydrateProfile(lean, null, null), lean);
  // a full token wins over both caches
  const full = { sub: 's1', name: 'Fresh', picture: 'https://p/fresh' };
  assert.equal(hydrateProfile(full, prev, stored).name, 'Fresh');
  // a different identity never borrows another user's profile
  assert.equal(hydrateProfile({ sub: 's2' }, prev, stored).name, undefined);
  assert.equal(hydrateProfile(null, prev, stored), null);
});

test('normalizeAvatarUrl pins only a Google size suffix', () => {
  assert.equal(normalizeAvatarUrl('https://lh3.googleusercontent.com/a/x=s400-c'), 'https://lh3.googleusercontent.com/a/x=s96-c');
  assert.equal(normalizeAvatarUrl('https://lh3.googleusercontent.com/a/x=s64'), 'https://lh3.googleusercontent.com/a/x=s96-c');
  assert.equal(normalizeAvatarUrl('https://cdn.example/avatar.png'), 'https://cdn.example/avatar.png');
  assert.equal(normalizeAvatarUrl(''), '');
  assert.equal(normalizeAvatarUrl(undefined), undefined);
});

test('isRefreshRejected: only an explicit rejection clears a session', () => {
  assert.equal(isRefreshRejected(Object.assign(new Error('x'), { status: 401 })), true);
  assert.equal(isRefreshRejected(Object.assign(new Error('x'), { status: 400, code: 'invalid_grant' })), true);
  assert.equal(isRefreshRejected(Object.assign(new Error('x'), { status: 400, code: 'invalid_request' })), false);
  assert.equal(isRefreshRejected(Object.assign(new Error('x'), { status: 500 })), false);
  assert.equal(isRefreshRejected(Object.assign(new Error('x'), { status: 502 })), false);
  assert.equal(isRefreshRejected(new TypeError('Failed to fetch')), false);
  assert.equal(isRefreshRejected(Object.assign(new Error('aborted'), { name: 'AbortError' })), false);
  // the old substring heuristic must NOT fire: 400 in a message is not a rejection
  assert.equal(isRefreshRejected(new Error('Refresh request failed: 400')), false);
  assert.equal(isRefreshRejected(null), false);
});

test('refreshDelayMs schedules ahead of expiry and clamps to the timer range', () => {
  const now = 1_000_000;
  const lead = 5 * 60 * 1000;
  assert.equal(refreshDelayMs(now + 60 * 60 * 1000, now, lead), 55 * 60 * 1000);
  assert.equal(refreshDelayMs(now + 1000, now, lead), 1000);      // already inside the window → soon, never 0
  assert.equal(refreshDelayMs(now - 5000, now, lead), 1000);      // expired → soon
  assert.equal(refreshDelayMs(now + 1e12, now, lead), 2147483647); // setTimeout ceiling
  assert.equal(refreshDelayMs(undefined, now, lead), null);
  assert.equal(refreshDelayMs(NaN, now, lead), null);
});
