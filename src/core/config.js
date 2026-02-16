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
  NAV_STYLE: 'dock', // or 'sidebar'

  // Auth Configuration (Cognito)
  AUTH: {
    USER_POOL_DOMAIN: '',
    CLIENT_ID: '',
    REDIRECT_URI: location.origin
  },

  // API Configuration
  GRAPHQL_ENDPOINT: '',
  GRAPHQL_API_KEY: ''
});
