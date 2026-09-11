/**
 * state.define() — how a key declares its initial value and persistence — and
 * the invariant that motivated it: core/state.js knows no application's keys.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { state } from '@state';

let n = 0;
const k = (label) => `def_${label}_${n++}`;

describe('state.define()', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

  test('uses the initial value when nothing is stored', () => {
    const key = k('initial');
    assert.equal(state.define(key, { initial: 80, storage: localStorage, storageKey: key }), 80);
    assert.equal(state.get(key), 80);
  });

  test('a stored value wins over the initial one, through parse', () => {
    const key = k('stored');
    localStorage.setItem(key, '42');
    state.define(key, { initial: 80, storage: localStorage, storageKey: key, parse: (raw) => parseInt(raw, 10) });
    assert.equal(state.get(key), 42);
  });

  test('declaring a default does not write it to storage', () => {
    const key = k('nowrite');
    state.define(key, { initial: 'dark', storage: localStorage, storageKey: key });
    assert.equal(localStorage.getItem(key), null);
  });

  test('sets write through; null and undefined remove the entry', () => {
    const key = k('writethrough');
    state.define(key, { initial: null, storage: sessionStorage, storageKey: key });
    state.set(key, 'abc');
    assert.equal(sessionStorage.getItem(key), 'abc');
    state.set(key, null);
    assert.equal(sessionStorage.getItem(key), null);
  });

  test('serialize controls what is written', () => {
    const key = k('serialize');
    state.define(key, { initial: {}, storage: localStorage, storageKey: key, parse: JSON.parse, serialize: JSON.stringify });
    state.set(key, { a: 1 });
    assert.equal(localStorage.getItem(key), '{"a":1}');
  });

  test('without storage the key is memory-only', () => {
    const key = k('memory');
    state.define(key, { initial: [] });
    state.set(key, [1]);
    assert.equal(localStorage.length + sessionStorage.length, 0);
    assert.deepEqual(state.get(key), [1]);
  });

  test('is idempotent — a second define never clobbers a live value', () => {
    const key = k('idem');
    state.define(key, { initial: 1 });
    state.set(key, 2);
    state.define(key, { initial: 1 });
    assert.equal(state.get(key), 2);
  });

  test('notifies subscribers of the declared value', () => {
    const key = k('notify');
    const seen = [];
    const off = state.subscribe(({ key: kk, value }) => { if (kk === key) seen.push(value); });
    state.define(key, { initial: 'v' });
    off();
    assert.deepEqual(seen, ['v']);
  });

  test('a storage that throws (private mode, quota) degrades to memory, never a crash', () => {
    const key = k('hostile');
    const hostile = {
      getItem() { throw new Error('denied'); },
      setItem() { throw new Error('quota'); },
      removeItem() { throw new Error('denied'); },
    };
    assert.doesNotThrow(() => state.define(key, { initial: 'x', storage: hostile, storageKey: key }));
    assert.doesNotThrow(() => state.set(key, 'y'));
    assert.equal(state.get(key), 'y');
  });

  test('theme is a framework key: declared by core, persisted under axiom-theme', () => {
    assert.equal(state.get('theme'), 'dark');
    state.set('theme', 'light');
    assert.equal(localStorage.getItem('axiom-theme'), 'light');
  });
});

describe('core/state.js is application-agnostic', () => {
  const APP_KEYS = ['audioLevel', 'captionsEnabled', 'autoplayEnabled', 'sessionId', 'guestId', 'activeStudentId', 'studentName'];

  test('declares no application keys at runtime', () => {
    for (const key of APP_KEYS) assert.equal(key in state.data, false, `${key} belongs to the application`);
  });

  test('its source names no application key — the fleet-divergence guard', () => {
    // Eight projects copied this file and each added its own keys to it, which is
    // why no two copies match. Core must stay a file no application has to edit.
    const src = readFileSync(new URL('../../src/core/state.js', import.meta.url), 'utf8');
    for (const key of APP_KEYS) assert.ok(!src.includes(key), `core/state.js mentions ${key}`);
  });
});
