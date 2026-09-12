/**
 * The showcase application's own state keys — declared by the app, not by core.
 *
 * Storage is seeded BEFORE app-state loads, the way a returning visitor's
 * browser would be: the split must not reset anyone's saved settings.
 */
import { log } from '@core/logger.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '@state';

localStorage.setItem('axiom-audioLevel', '33');
localStorage.setItem('axiom-autoplayEnabled', 'false');
await import('../../src/app-state.js');

describe('app-state', () => {
  test("a returning visitor's saved settings survive the move out of core", () => {
    assert.equal(state.get('audioLevel'), 33);
    assert.equal(state.get('autoplayEnabled'), false);
  });

  test('unsaved settings take their historical defaults', () => {
    assert.equal(state.get('captionsEnabled'), false);
    assert.equal(state.get('sessionId'), null);
  });

  test('changes persist under the historical storage keys', () => {
    state.set('audioLevel', 55);
    state.set('captionsEnabled', true);
    assert.equal(localStorage.getItem('axiom-audioLevel'), '55');
    assert.equal(localStorage.getItem('axiom-captionsEnabled'), 'true');
  });

  test('signing out clears the session context — owned by the app, not by auth', () => {
    state.set('sessionId', 'abc');
    assert.equal(localStorage.getItem('axiom-sessionId'), 'abc');
    state.set('user', { sub: 'u1' });
    state.set('user', null);
    assert.equal(state.get('sessionId'), null);
    assert.equal(localStorage.getItem('axiom-sessionId'), null);
  });
});

describe('the guard and this app agree', () => {
  // core/state.js warns on a read of a key nothing declared and nothing set. This
  // app must not trip its own guard: every key it reads is declared right here.
  test('nothing this app reads is undeclared', () => {
    const original = log.warn;
    const warnings = [];
    log.warn = (...args) => warnings.push(args.join(' '));
    try {
      ['count', 'user', 'theme', 'sessionId', 'audioLevel', 'captionsEnabled', 'autoplayEnabled']
        .forEach((k) => state.get(k));
    } finally {
      log.warn = original;
    }
    assert.deepEqual(warnings, [], 'declare it in src/app-state.js');
  });
});
