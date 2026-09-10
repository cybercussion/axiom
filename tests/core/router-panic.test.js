/**
 * Router terminal-failure contract.
 *
 * The router must not decide what a fatal navigation error LOOKS like. It
 * announces the failure and lets the application choose; only if nobody
 * chooses does it draw a minimal fallback, and never over document.body.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, registerElement, resetDom } from '../helpers/dom.js';
import { router } from '@core/router.js';

describe('router._panic()', () => {
  let container;

  beforeEach(() => {
    resetDom();
    container = registerElement('app-container', makeElement('div'));
  });

  test('announces the failure as a cancelable axiom:router-error', () => {
    let seen = null;
    const handler = (e) => { seen = e; };
    window.addEventListener('axiom:router-error', handler);
    router._panic('not-found-component-failed', new Error('boom'), 'dashboard');
    window.removeEventListener('axiom:router-error', handler);

    assert.ok(seen, 'an event was dispatched');
    assert.equal(seen.cancelable, true, 'the app must be able to take over');
    assert.equal(seen.detail.reason, 'not-found-component-failed');
    assert.equal(seen.detail.slug, 'dashboard');
    assert.equal(seen.detail.error.message, 'boom');
  });

  test('an app calling preventDefault owns the outcome — the router draws nothing', () => {
    const handler = (e) => e.preventDefault();
    window.addEventListener('axiom:router-error', handler);
    const handled = router._panic('reason', new Error('x'), 'slug');
    window.removeEventListener('axiom:router-error', handler);

    assert.equal(handled, true, 'reports that the app handled it');
    assert.equal(container.children.length, 0, 'container left alone');
  });

  test('unhandled failures render into the app container', () => {
    const handled = router._panic('reason', new Error('x'), 'slug');

    assert.equal(handled, false);
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].getAttribute('role'), 'alert');
  });

  test('never overwrites document.body — the shell and live components survive', () => {
    // Regression: the old path assigned document.body.innerHTML, tearing out
    // the app shell and every mounted component instance with it.
    router._panic('reason', new Error('x'), 'slug');

    assert.equal(document.body.children.length, 0, 'body untouched');
    assert.equal(document.body.textContent, '', 'body text untouched');
  });

  test('falls back to body only when there is no app container', () => {
    resetDom(); // no #app-container registered
    router._panic('reason', new Error('x'), 'slug');

    assert.equal(document.body.children.length, 1, 'last resort still shows something');
  });

  test('builds its message as text, not markup', () => {
    router._panic('reason', new Error('x'), 'slug');
    const panel = container.children[0];

    assert.ok(panel.children.every((c) => typeof c.textContent === 'string' && c.textContent.length));
    assert.equal(panel.getAttribute('role'), 'alert');
  });
});
