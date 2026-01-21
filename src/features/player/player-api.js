/**
 * Player API
 * Course data fetching utilities
 */
import { gateway } from '@core/gateway.js';

/**
 * Fetch course data from scobot.json
 * @param {string} path - Path to scobot.json (default: data/scobot.json)
 */
export async function fetchCourseData(path = 'data/scobot.json') {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load course: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch remote course data (for LMS-hosted content)
 * @param {string} endpoint - API endpoint
 */
export async function fetchRemoteCourse(endpoint) {
  return gateway.get(endpoint);
}
