/**
 * Project Axiom: Config Singleton
 * Detection based on hostname to avoid process.env bloat.
 */
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Runtime configuration injected during deployment
const runtimeConfig = window.AXIOM_CONFIG || {};

/**
 * Runtime configuration. Everything here is PUBLIC — see axiom-config.js.
 * @typedef {{
 *   ENV: string,
 *   DEBUG: boolean,
 *   GRAPHQL_ENDPOINT: string,
 *   GRAPHQL_API_KEY: string,
 *   REST_ENDPOINT: string,
 *   readonly API_BASE: string,
 *   NEXUS_URL: string,
 *   AUTH: { USER_POOL_DOMAIN?: string, CLIENT_ID?: string, GOOGLE_CLIENT_ID?: string, REDIRECT_URI?: string, LOCAL_REDIRECT_URI?: string, TURNSTILE_SITE_KEY?: string },
 *   BASE_PATH: string,
 *   VERSION: string,
 *   NAV_STYLE: string,
 *   CONTENT_HOST: string,
 *   FEEDBACK_URL: string,
 *   TURNSTILE_SITE_KEY: string,
 *   [key: string]: any
 * }} AxiomConfig
 */
/** @type {Readonly<AxiomConfig>} */
export const config = Object.freeze({
  ENV: runtimeConfig.ENV || (isLocal ? 'development' : 'production'),
  DEBUG: runtimeConfig.DEBUG !== undefined ? runtimeConfig.DEBUG : isLocal,
  GRAPHQL_ENDPOINT: runtimeConfig.GRAPHQL_ENDPOINT || '',
  GRAPHQL_API_KEY: runtimeConfig.GRAPHQL_API_KEY || '',
  REST_ENDPOINT: runtimeConfig.REST_ENDPOINT || (isLocal ? 'http://localhost:3000' : 'https://api.yourdomain.com'),
  get API_BASE() { return this.REST_ENDPOINT; }, // Gateway compat
  NEXUS_URL: runtimeConfig.NEXUS_URL || (isLocal ? 'http://localhost:3000' : 'https://api.yourdomain.com'),
  AUTH: runtimeConfig.AUTH || {
    USER_POOL_DOMAIN: '',
    CLIENT_ID: '',
    GOOGLE_CLIENT_ID: '',
    REDIRECT_URI: isLocal ? 'http://localhost:3000' : window.location.origin
  },
  BASE_PATH: new URL(document.baseURI).pathname,
  VERSION: '1.0.0-axiom',
  NAV_STYLE: 'dock', // or 'sidebar'
  CONTENT_HOST: runtimeConfig.CONTENT_HOST || '',
  FEEDBACK_URL: runtimeConfig.FEEDBACK_URL || '',
  TURNSTILE_SITE_KEY: runtimeConfig.TURNSTILE_SITE_KEY || runtimeConfig.AUTH?.TURNSTILE_SITE_KEY || '',
  ...runtimeConfig // Allow arbitrary overrides
});
