/**
 * The showcase application's own state keys — declared by the app, not by core.
 *
 * Storage is seeded BEFORE app-state loads, the way a returning visitor's
 * browser would be: the split must not reset anyone's saved settings.
 */
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
