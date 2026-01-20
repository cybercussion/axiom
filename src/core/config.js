/**
 * Project Axiom: Config Singleton
 * Detection based on hostname to avoid process.env bloat.
 */
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const config = Object.freeze({
  ENV: isLocal ? 'development' : 'production',
  DEBUG: isLocal,
  API_BASE: isLocal ? 'http://localhost:3000' : 'https://api.yourdomain.com',
  BASE_PATH: new URL(document.baseURI).pathname,
  VERSION: '1.0.0-axiom',
  NAV_STYLE: 'dock' // or 'sidebar'
});
