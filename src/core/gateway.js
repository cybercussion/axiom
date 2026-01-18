/**
 * Project Axiom: API Gateway
 * Centralized fetch wrapper with configuration and logging.
 */
import { config } from '@core/config.js';
import { log } from '@core/logger.js';

export const gateway = {
  /**
   * Generic request handler
   * @param {string} method 
   * @param {string} endpoint 
   * @param {Object} [body] 
   * @param {Object} [customHeaders] 
   */
  async request(method, endpoint, body = null, customHeaders = {}) {
    // Ensure endpoint starts with /
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${config.API_BASE}${path}`;

    const headers = {
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

      if (!response.ok) {
        throw new Error(`Gateway Error: ${response.status} ${response.statusText}`);
      }

      // Content-Type Agnostic Parsing
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType && (contentType.includes('text/xml') || contentType.includes('application/xml'))) {
        const text = await response.text();
        return new DOMParser().parseFromString(text, "text/xml");
      } else if (contentType && contentType.includes('text/')) {
        return await response.text();
      } else {
        return await response.blob();
      }

    } catch (err) {
      log.error(`Gateway Request Failed: ${method} ${url}`, err);
      throw err;
    }
  },

  get(endpoint, headers) { return this.request('GET', endpoint, null, headers); },
  post(endpoint, body, headers) { return this.request('POST', endpoint, body, headers); },
  put(endpoint, body, headers) { return this.request('PUT', endpoint, body, headers); },
  delete(endpoint, headers) { return this.request('DELETE', endpoint, null, headers); }
};
