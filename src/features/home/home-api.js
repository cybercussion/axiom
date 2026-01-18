/**
 * Home Feature API
 * Pure functions for data retrieval.
 */
import { gateway } from '@core/gateway.js';

export const getHeroData = async () => {
  // Realized through the Gateway
  return await gateway.get('/v1/hero-content');
};
