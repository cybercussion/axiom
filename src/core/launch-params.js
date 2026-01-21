/**
 * Project Axiom: SCORM Launch Parameters
 * Parses and provides access to URL querystring parameters
 * commonly used in SCORM/AICC content launches.
 * 
 * Common SCORM Launch Parameters:
 * - endpoint / url      - LMS API endpoint
 * - auth / token        - Authentication token
 * - actor / learner_id  - Learner identifier
 * - registration        - Enrollment/registration ID
 * - activity_id         - Course/SCO identifier
 * - attempt             - Attempt number
 * - debug               - Enable debug mode
 */
import { log } from '@core/logger.js';

class LaunchParams {
  constructor() {
    this._params = new URLSearchParams(window.location.search);
    this._parsed = this._parseAll();
  }

  /**
   * Parse all querystring parameters into an object
   */
  _parseAll() {
    const result = {};
    for (const [key, value] of this._params.entries()) {
      // Handle arrays (same key multiple times)
      if (result[key]) {
        if (Array.isArray(result[key])) {
          result[key].push(value);
        } else {
          result[key] = [result[key], value];
        }
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Get a specific parameter value
   * @param {string} key - Parameter name
   * @param {*} defaultValue - Default if not present
   * @returns {string|null} Parameter value
   */
  get(key, defaultValue = null) {
    return this._params.get(key) ?? defaultValue;
  }

  /**
   * Check if a parameter exists (even if empty)
   * @param {string} key - Parameter name
   * @returns {boolean}
   */
  has(key) {
    return this._params.has(key);
  }

  /**
   * Get all values for a parameter (for repeated keys)
   * @param {string} key - Parameter name
   * @returns {string[]}
   */
  getAll(key) {
    return this._params.getAll(key);
  }

  /**
   * Get all parameters as an object
   * @returns {Object}
   */
  get all() {
    return { ...this._parsed };
  }

  // ============================================
  // SCORM/AICC Specific Accessors
  // ============================================

  /**
   * Debug mode flag
   * Usage: ?debug or ?debug=true
   */
  get debug() {
    if (!this.has('debug')) return false;
    const val = this.get('debug');
    return val === '' || val === 'true' || val === '1';
  }

  /**
   * LMS endpoint URL (AICC/xAPI)
   * Usage: ?endpoint=https://lms.example.com/api
   */
  get endpoint() {
    return this.get('endpoint') || this.get('url');
  }

  /**
   * Authentication token
   * Usage: ?auth=token123 or ?token=token123
   */
  get authToken() {
    return this.get('auth') || this.get('token');
  }

  /**
   * Learner/Actor ID
   * Usage: ?learner_id=user123 or ?actor=user123
   */
  get learnerId() {
    return this.get('learner_id') || this.get('actor') || this.get('student_id');
  }

  /**
   * Registration/Enrollment ID
   * Usage: ?registration=reg123
   */
  get registration() {
    return this.get('registration') || this.get('enrollment_id');
  }

  /**
   * Activity/Course ID
   * Usage: ?activity_id=course123
   */
  get activityId() {
    return this.get('activity_id') || this.get('course_id') || this.get('sco_id');
  }

  /**
   * Attempt number
   * Usage: ?attempt=2
   */
  get attempt() {
    const val = this.get('attempt');
    return val ? parseInt(val, 10) : null;
  }

  /**
   * Launch mode (normal, browse, review)
   * Usage: ?mode=review
   */
  get mode() {
    return this.get('mode') || this.get('launch_mode') || 'normal';
  }

  /**
   * Return URL after completion
   * Usage: ?return_url=https://lms.example.com/courses
   */
  get returnUrl() {
    return this.get('return_url') || this.get('returnUrl') || this.get('exit_url');
  }

  /**
   * Learner name
   * Usage: ?learner_name=John%20Doe
   */
  get learnerName() {
    return this.get('learner_name') || this.get('student_name');
  }

  /**
   * Get a summary of SCORM-relevant launch params
   * Useful for debugging
   */
  get scormParams() {
    return {
      debug: this.debug,
      endpoint: this.endpoint,
      authToken: this.authToken,
      learnerId: this.learnerId,
      learnerName: this.learnerName,
      registration: this.registration,
      activityId: this.activityId,
      attempt: this.attempt,
      mode: this.mode,
      returnUrl: this.returnUrl
    };
  }

  /**
   * Log all launch parameters (for debugging)
   */
  log() {
    log.debug('Launch Parameters - Raw:', window.location.search);
    log.debug('Launch Parameters - Parsed:', this.all);
    log.debug('Launch Parameters - SCORM:', this.scormParams);
  }
}

// Export singleton instance
export const launchParams = new LaunchParams();

// Also export class for testing
export { LaunchParams };
