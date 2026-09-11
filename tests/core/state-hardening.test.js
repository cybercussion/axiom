/**
 * Threat model: prototype pollution. The store must have no prototype to
 * overwrite and no inherited names to shadow — '__proto__' and 'constructor'
 * are ordinary keys or nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state } from '@state';

test('the store has no prototype', () => {
  assert.equal(Object.getPrototypeOf(state.data), null);
});

test("'__proto__' is an ordinary key, not a prototype swap", () => {
  state.set('__proto__', { polluted: true });
  assert.equal('polluted' in state.data, false);
  assert.deepEqual(state.get('__proto__'), { polluted: true });
  assert.equal({}.polluted, undefined);
});

test("'constructor' is not a key until an application declares it", () => {
  assert.equal('constructor' in state.data, false);
  state.define('constructor', { initial: 'c' });
  assert.equal(state.get('constructor'), 'c');
});
