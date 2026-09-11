/**
 * Gateway response handling. The default stays content-type sniffing, for
 * compatibility; `expect` turns a caller's type assumption into an assertion,
 * so "the server sent a login page with 200 OK" fails loudly and specifically.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gateway, GatewayError } from '@core/gateway.js';

const realFetch = globalThis.fetch;
const respond = (body, { status = 200, type } = {}) => {
  globalThis.fetch = async () => new Response(body, { status, headers: type ? { 'content-type': type } : {} });
};
afterEach(() => { globalThis.fetch = realFetch; });

const HTML = '<!doctype html><html><body>Sign in</body></html>';

describe('gateway: default (auto) behaviour is unchanged', () => {
  test('parses JSON by content type', async () => {
    respond('{"ok":true}', { type: 'application/json; charset=utf-8' });
    assert.deepEqual(await gateway.get('/thing'), { ok: true });
  });

  test('returns text for a text/html 200 — the case expect exists for', async () => {
    respond(HTML, { type: 'text/html' });
    assert.equal(await gateway.get('/thing'), HTML);
  });
});

describe('gateway: expect', () => {
  test("expect:'json' rejects an HTML 200 with a GatewayError naming what arrived", async () => {
    respond(HTML, { type: 'text/html; charset=utf-8' });
    await assert.rejects(gateway.get('/thing', {}, { expect: 'json' }), (err) => {
      assert.ok(err instanceof GatewayError);
      assert.equal(err.status, 200);
      assert.match(err.contentType, /text\/html/);
      assert.match(err.body, /Sign in/);
      assert.match(err.message, /expected json/i);
      return true;
    });
  });

  test("expect:'json' accepts +json media types", async () => {
    respond('{"a":1}', { type: 'application/problem+json' });
    assert.deepEqual(await gateway.get('/thing', {}, { expect: 'json' }), { a: 1 });
  });

  test("expect:'json' with a malformed body is a GatewayError, not a bare SyntaxError", async () => {
    respond('{not json', { type: 'application/json' });
    await assert.rejects(gateway.get('/thing', {}, { expect: 'json' }), GatewayError);
  });

  test("expect:'text' and 'blob' return those types whatever the content type", async () => {
    respond('{"a":1}', { type: 'application/json' });
    assert.equal(await gateway.get('/t', {}, { expect: 'text' }), '{"a":1}');
    respond('bytes', { type: 'application/octet-stream' });
    const blob = await gateway.get('/b', {}, { expect: 'blob' });
    assert.equal(await blob.text(), 'bytes');
  });

  test("expect:'response' hands back the raw Response", async () => {
    respond('x', { type: 'text/plain' });
    assert.ok((await gateway.get('/r', {}, { expect: 'response' })) instanceof Response);
  });

  test('an unknown expect is refused, not silently treated as auto', async () => {
    respond('x', { type: 'text/plain' });
    await assert.rejects(gateway.get('/r', {}, { expect: 'jsn' }), /expect/);
  });
});

describe('gateway: failures carry their facts', () => {
  test('a non-2xx is a GatewayError with status and body, keeping the old message', async () => {
    respond('{"error":"nope"}', { status: 500, type: 'application/json' });
    await assert.rejects(gateway.get('/boom'), (err) => {
      assert.ok(err instanceof GatewayError);
      assert.ok(err instanceof Error);
      assert.equal(err.status, 500);
      assert.match(err.message, /^Gateway Error: 500/);
      assert.match(err.body, /nope/);
      return true;
    });
  });

  test('204 No Content resolves null for any expect', async () => {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await gateway.delete('/x', {}, { expect: 'json' }), null);
  });

  test('graphql: an HTML 200 is a GatewayError, not a JSON SyntaxError', async () => {
    respond(HTML, { type: 'text/html' });
    await assert.rejects(gateway.graphql('{ me { id } }'), GatewayError);
  });

  test('graphql: errors[] surface as a GatewayError carrying them', async () => {
    respond('{"errors":[{"message":"denied"}],"data":null}', { type: 'application/json' });
    await assert.rejects(gateway.graphql('{ me { id } }'), (err) => {
      assert.ok(err instanceof GatewayError);
      assert.deepEqual(err.errors.map((e) => e.message), ['denied']);
      return true;
    });
  });
});
