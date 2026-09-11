/**
 * axiom-config.js — PUBLIC runtime configuration.
 *
 * A classic script loaded before the app's modules; src/core/config.js reads
 * window.AXIOM_CONFIG. A deployment writes its real values into this file.
 *
 * EVERYTHING HERE IS PUBLIC — anyone who loads the page can read it. It is not
 * a place for secrets. An API key here (GRAPHQL_API_KEY, for one) is an
 * identifier for unauthenticated access, not a credential: protect the API with
 * authentication, rate limits and an origin allow-list, never with this value.
 *
 * The endpoints listed here also become the page's CSP connect-src at deploy
 * (tools/csp.js --config axiom-config.js), so a fetch to any unlisted origin is
 * refused by the browser. See SECURITY.md.
 *
 * Keys and their defaults: src/core/config.js.
 */
window.AXIOM_CONFIG = window.AXIOM_CONFIG || {};
