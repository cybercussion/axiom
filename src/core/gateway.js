/**
 * Project Axiom: API Gateway
 * Centralized fetch wrapper with configuration and logging.
 *
 * Responses: by default the content type decides how the body is read (JSON,
 * XML, text, else Blob). Pass { expect } when the caller NEEDS a type — then a
 * response of any other type rejects with a GatewayError naming what arrived,
 * instead of handing an HTML login page to code expecting an object.
 */
import { config } from '@core/config.js';
import { log } from '@core/logger.js';
import { auth } from '@core/auth.js';

/**
 * @typedef {'auto'|'json'|'text'|'blob'|'xml'|'response'} Expect
 * @typedef {{ expect?: Expect }} GatewayOptions
 * @typedef {{ status?: number, statusText?: string, contentType?: string, url?: string, method?: string, body?: string, errors?: Array<{ message: string }>, data?: any, expect?: string, cause?: unknown }} GatewayFacts
 */

/**
 * A request that did not produce what the caller needed. Carries the facts a
 * handler branches on, so nobody parses a message string: status, statusText,
 * contentType, url, method, body (first 2 KB of the response text) — and for
 * GraphQL, errors[] and data.
 */
export class GatewayError extends Error {
  /** @type {number|undefined} */ status;
  /** @type {string|undefined} */ statusText;
  /** @type {string|undefined} */ contentType;
  /** @type {string|undefined} */ url;
  /** @type {string|undefined} */ method;
  /** @type {string|undefined} first 2 KB of the response text */ body;
  /** @type {Array<{ message: string }>|undefined} GraphQL errors[] */ errors;
  /** @type {any} GraphQL partial data */ data;
  /** @type {string|undefined} the refused expect value */ expect;

  /**
   * @param {string} message
   * @param {GatewayFacts} [facts]
   */
  constructor(message, { cause, ...facts } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'GatewayError';
    Object.assign(this, facts);
  }
}

const EXPECT = ['auto', 'json', 'text', 'blob', 'xml', 'response'];
const BODY_SNIPPET = 2048;
// application/json plus every structured-syntax +json type (problem+json,
// graphql-response+json, …); the same shape for XML.
const isJsonType = (ct) => /\/([\w.-]+\+)?json\b/i.test(ct);
const isXmlType = (ct) => /\/([\w.-]+\+)?xml\b/i.test(ct);
const snippet = async (response) => {
  try { return (await response.text()).slice(0, BODY_SNIPPET); } catch { return ''; }
};

export const gateway = {
  /**
   * Generic request handler
   * @param {string} method
   * @param {string} endpoint
   * @param {Object} [body]
   * @param {Object} [customHeaders]
   * @param {GatewayOptions} [options]
   *   'auto' (default) reads by content type, exactly as before. Any other value
   *   is an assertion (see the file header); 'response' returns the raw Response.
   * @returns {Promise<any>}
   */
  async request(method, endpoint, body = null, customHeaders = {}, { expect = 'auto' } = {}) {
    if (!EXPECT.includes(expect)) {
      throw new GatewayError(`Gateway: unknown expect '${expect}' — use ${EXPECT.join(' | ')}`, { method, expect });
    }

    // Ensure endpoint starts with /
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${config.API_BASE}${path}`;

    const token = await auth.getAccessToken();
    const headers = {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      // Default to JSON but allow override (e.g. for FormData)
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      'X-App-Version': config.VERSION,
      ...customHeaders
    };

    const options = {
      method,
      headers
    };

    if (body) {
      options.body = (typeof body === 'object' && !(body instanceof FormData))
        ? JSON.stringify(body)
        : body;
    }

    try {
      log.debug(`Gateway: ${method} ${url}`);
      const response = await fetch(url, options);
      return await this._read(response, { method, url, expect });
    } catch (err) {
      log.error(`Gateway Request Failed: ${method} ${url}`, err);
      throw err;
    }
  },

  /** @param {string} endpoint @param {Record<string, string>} [headers] @param {GatewayOptions} [options] @returns {Promise<any>} */
  get(endpoint, headers, options) { return this.request('GET', endpoint, null, headers, options); },
  /** @param {string} endpoint @param {any} [body] @param {Record<string, string>} [headers] @param {GatewayOptions} [options] @returns {Promise<any>} */
  post(endpoint, body, headers, options) { return this.request('POST', endpoint, body, headers, options); },
  /** @param {string} endpoint @param {any} [body] @param {Record<string, string>} [headers] @param {GatewayOptions} [options] @returns {Promise<any>} */
  put(endpoint, body, headers, options) { return this.request('PUT', endpoint, body, headers, options); },
  /** @param {string} endpoint @param {Record<string, string>} [headers] @param {GatewayOptions} [options] @returns {Promise<any>} */
  delete(endpoint, headers, options) { return this.request('DELETE', endpoint, null, headers, options); },

  /**
   * Execute a GraphQL operation. The response must be JSON; errors[] rejects
   * with a GatewayError carrying them (and any partial data).
   * @param {string} operation - The query/mutation string
   * @param {Object} [variables] - Operation variables
   * @param {Object} [customHeaders] - Custom headers
   */
  async graphql(operation, variables = {}, customHeaders = {}) {
    const url = config.GRAPHQL_ENDPOINT;

    const token = await auth.getAccessToken();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Version': config.VERSION,
        // Authentication Priority: User Token > API Key. The key is a PUBLIC
        // identifier (anything in browser config is) — see SECURITY.md.
        ...(token
          ? { 'Authorization': `Bearer ${token}` }
          : (config.GRAPHQL_API_KEY ? { 'x-api-key': config.GRAPHQL_API_KEY } : {})
        ),
        ...customHeaders
      },
      body: JSON.stringify({
        query: operation,
        variables
      })
    };

    try {
      log.debug(`Gateway GraphQL: ${url}`, { variables });
      const response = await fetch(url, options);
      const result = await this._read(response, { method: 'POST', url, expect: 'json', label: 'Gateway GraphQL Error' });

      if (result?.errors?.length) {
        const msgs = result.errors.map(e => e.message).join(', ');
        throw new GatewayError(`GraphQL Error: ${msgs}`, {
          status: response.status, url, method: 'POST', errors: result.errors, data: result.data
        });
      }

      return result.data;

    } catch (err) {
      log.error('Gateway GraphQL Request Failed', err);
      throw err;
    }
  },

  /** @internal Turn a Response into what `expect` asks for — or a GatewayError saying why not. */
  async _read(response, { method, url, expect = 'auto', label = 'Gateway Error' }) {
    const contentType = response.headers.get('content-type') || '';
    const facts = { status: response.status, statusText: response.statusText, contentType, url, method };

    if (!response.ok) {
      throw new GatewayError(`${label}: ${response.status} ${response.statusText}`, { ...facts, body: await snippet(response) });
    }
    if (expect === 'response') return response;
    // No content is a value, not a type mismatch — for any explicit expect.
    if (expect !== 'auto' && (response.status === 204 || response.status === 205)) return null;

    const mismatch = async (wanted) => new GatewayError(
      `Gateway: expected ${wanted} from ${method} ${url}, got ${contentType || 'no content-type'}`,
      { ...facts, body: await snippet(response) });

    switch (expect) {
      case 'text': return response.text();
      case 'blob': return response.blob();
      case 'json': {
        if (!isJsonType(contentType)) throw await mismatch('JSON');
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (cause) {
          throw new GatewayError(`Gateway: malformed JSON from ${method} ${url}`, { ...facts, body: text.slice(0, BODY_SNIPPET), cause });
        }
      }
      case 'xml': {
        if (!isXmlType(contentType)) throw await mismatch('XML');
        return new DOMParser().parseFromString(await response.text(), 'text/xml');
      }
      default: {
        // 'auto' — content-type sniffing, unchanged.
        if (contentType.includes('application/json')) return response.json();
        if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
          return new DOMParser().parseFromString(await response.text(), 'text/xml');
        }
        if (contentType.includes('text/')) return response.text();
        return response.blob();
      }
    }
  }
};
