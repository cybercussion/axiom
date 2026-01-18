import { gateway } from '@core/gateway.js';

export const fetchContactData = async () => {
  return await gateway.get('/contact');
};