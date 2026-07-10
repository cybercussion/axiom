/**
 * Project Axiom: Course State Extension
 * E-learning specific state management and selectors.
 * Additive to core state.js - no modifications to existing code.
 */
import { state } from '@state';

// Course-specific default values
const courseDefaults = {
  courseActive: false,        // Whether player mode is active
  courseData: null,           // scobot.json content
  coursePosition: 0,          // Current page index
  courseProgress: {},         // Per-page completion { 0: { complete: true, score: 100 } }
  interactions: [],           // SCORM interactions array
  scorm: null,                // SCOBot instance reference
  feedbackOpen: false,        // Feedback drawer visibility
  toolsOpen: false,           // Tools panel visibility
  glossaryOpen: false,        // Glossary modal visibility
  learnerComments: '',        // Notes from learner
  lmsComments: ''             // Comments from LMS/instructor
};

/**
 * Initialize course state keys
 * Called when entering player mode
 */
export function initCourseState() {
  Object.entries(courseDefaults).forEach(([key, value]) => {
    if (state.get(key) === undefined) {
      state.set(key, value);
    }
  });
}

/**
 * Reset course state for a new attempt
 * Clears progress, interactions, learner comments, and localStorage
 * @param {boolean} clearStorage - Also clear SCOBot localStorage (standalone mode)
 */
export function resetCourseState(clearStorage = true) {
  // Clear in-memory state
  state.set('coursePosition', 0);
  state.set('courseProgress', {});
  state.set('interactions', []);
  state.set('feedbackOpen', false);
  state.set('toolsOpen', false);
  state.set('allComments', []);
  state.set('learnerComments', '');

  // Clear SCORM data for fresh attempt (never in review mode — restored state is read-only)
  const scorm = course.scorm;
  if (scorm && scorm.isConnectionActive() && !course.isReviewMode) {
    scorm.setBookmark('0');

    // Clear learner comments by overwriting with empty values
    // Note: SCORM doesn't support "delete", so we just blank them out
    const countStr = scorm.getvalue('cmi.comments_from_learner._count');
    const count = parseInt(countStr, 10) || 0;
    for (let i = 0; i < count; i++) {
      scorm.setvalue(`cmi.comments_from_learner.${i}.comment`, '');
      scorm.setvalue(`cmi.comments_from_learner.${i}.location`, '');
      scorm.setvalue(`cmi.comments_from_learner.${i}.timestamp`, '');
    }

    // Reset completion/success status
    scorm.setvalue('cmi.completion_status', 'incomplete');
    scorm.setvalue('cmi.success_status', 'unknown');
    scorm.setvalue('cmi.score.raw', '0');
    scorm.setvalue('cmi.score.scaled', '0');
    scorm.setvalue('cmi.progress_measure', '0');

    // Clear SCOBot's in-memory suspend pages, then persist the empty set.
    // (Reach-in: candidate for an upstream clearSuspendData() in 5.3.)
    if (scorm.settings?.suspend_data) {
      scorm.settings.suspend_data.pages = [];
    }
    scorm.setSuspendData();

    scorm.commit();
  }

  // Clear SCOBot localStorage (for standalone mode)
  if (clearStorage) {
    localStorage.removeItem('SCOBot');
  }
}

/**
 * Course Selectors
 * Computed values derived from course state
 */
export const course = {
  /**
   * Get the current page data from scobot.json
   */
  get currentPage() {
    const data = state.get('courseData');
    const pos = state.get('coursePosition');
    return data?.pages?.[pos] || null;
  },

  /**
   * Total number of pages in the course
   */
  get totalPages() {
    return state.get('courseData')?.pages?.length || 0;
  },

  /**
   * Check if learner can navigate to next page
   * Respects requireAnswerToAdvance setting
   */
  get canNext() {
    const pos = state.get('coursePosition');
    const progress = state.get('courseProgress');
    const currentPage = this.currentPage;
    const settings = this.settings;
    
    // Can't go past last page
    if (pos >= this.totalPages - 1) return false;
    
    // Title pages and scorecards auto-complete (no interaction needed)
    const autoCompleteTypes = ['title-page', 'scorecard'];
    const isAutoComplete = autoCompleteTypes.includes(currentPage?.type);
    
    // Check if page is complete
    const isComplete = progress[pos]?.complete || isAutoComplete;
    
    // If requireAnswerToAdvance is enabled, must complete interactive pages
    if (settings.requireAnswerToAdvance !== false) {
      // Interactive page types that require answers
      const interactiveTypes = ['choice', 'match', 'wordpuzzle'];
      const isInteractive = interactiveTypes.includes(currentPage?.type);
      
      if (isInteractive && !progress[pos]?.complete) {
        return false;
      }
    }
    
    return isComplete;
  },

  /**
   * Check if learner can navigate to previous page
   */
  get canPrev() {
    const data = state.get('courseData');
    const forceSequential = data?.settings?.forceSequential ?? true;
    
    // If not forcing sequential, always allow back
    if (!forceSequential) return state.get('coursePosition') > 0;
    
    // If sequential, only allow back to completed pages
    return state.get('coursePosition') > 0;
  },

  /**
   * Formatted page status string
   */
  get pageStatus() {
    const pos = state.get('coursePosition') + 1;
    const total = this.totalPages;
    return `${pos} of ${total}`;
  },

  /**
   * Get SCOBot instance
   */
  get scorm() {
    return state.get('scorm');
  },

  /**
   * True when the LMS launched us in review mode — render restored state, write nothing.
   */
  get isReviewMode() {
    const scorm = this.scorm;
    return !!scorm && typeof scorm.getMode === 'function' && scorm.getMode() === 'review';
  },

  /**
   * Get course metadata
   */
  get meta() {
    return state.get('courseData')?.meta || {};
  },

  /**
   * Get course settings
   */
  get settings() {
    return state.get('courseData')?.settings || {};
  },

  /**
   * Get glossary terms
   */
  get glossary() {
    return state.get('courseData')?.glossary || [];
  },

  /**
   * Get resources
   */
  get resources() {
    return state.get('courseData')?.resources || [];
  },

  /**
   * Calculate overall course score
   */
  get score() {
    const interactions = state.get('interactions') || [];
    if (interactions.length === 0) return 0;

    let totalWeight = 0;
    let earnedWeight = 0;

    interactions.forEach(i => {
      const weight = parseFloat(i.weight) || 1;
      totalWeight += weight;
      if (i.result === 'correct') {
        earnedWeight += weight;
      }
    });

    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  },

  /**
   * Check if passing score achieved
   */
  get isPassing() {
    const passingScore = this.meta.passingScore || 80;
    return this.score >= passingScore;
  },

  /**
   * Get completion percentage
   */
  get completionPercent() {
    const progress = state.get('courseProgress');
    const total = this.totalPages;
    if (total === 0) return 0;

    const completed = Object.values(progress).filter(p => p.complete).length;
    return Math.round((completed / total) * 100);
  }
};

/**
 * Course Actions
 * Methods that modify course state
 */
export const courseActions = {
  /**
   * Navigate to a specific page
   */
  goToPage(index) {
    const total = course.totalPages;
    if (index >= 0 && index < total) {
      state.set('coursePosition', index);

      const scorm = course.scorm;
      if (scorm && scorm.isConnectionActive() && !course.isReviewMode) {
        scorm.setBookmark(String(index));
        scorm.commit();
      }
    }
  },

  /**
   * Navigate to next page
   */
  nextPage() {
    if (course.canNext) {
      this.goToPage(state.get('coursePosition') + 1);
    }
  },

  /**
   * Navigate to previous page
   */
  prevPage() {
    if (course.canPrev) {
      this.goToPage(state.get('coursePosition') - 1);
    }
  },

  /**
   * Mark current page as complete
   * Only updates if not already complete
   */
  markPageComplete(score = null, data = {}) {
    const pos = state.get('coursePosition');
    const page = course.currentPage;
    const progress = { ...state.get('courseProgress') };
    const existing = progress[pos];

    // Skip if page already completed (review mode - don't overwrite saved data)
    if (existing?.complete) {
      console.log('[CourseState] Page already complete, skipping mark:', pos);
      return;
    }

    progress[pos] = {
      complete: true,
      score,
      timestamp: Date.now(),
      ...data
    };
    state.set('courseProgress', progress);

    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive() && !course.isReviewMode && page) {
      scorm.setSuspendDataByPageID(page.id, page.title || page.type, progress[pos]);
      this.finalizeScore();
    }
  },

  /**
   * Record an interaction (question response) and its per-page objective.
   */
  recordInteraction(interaction) {
    const interactions = [...(state.get('interactions') || [])];
    const existingIndex = interactions.findIndex(i => i.id === interaction.id);

    if (existingIndex >= 0) {
      interactions[existingIndex] = interaction;
    } else {
      interactions.push(interaction);
    }
    state.set('interactions', interactions);

    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive() && !course.isReviewMode) {
      // SCOBot's setInteraction persists `data.weighting`, not `data.weight` —
      // pass both so templates' `weight` field actually reaches the CMI.
      scorm.setInteraction({ ...interaction, weighting: interaction.weight });

      // One objective per interactive page — LMS gradebooks show per-question mastery.
      const correct = interaction.result === 'correct';
      scorm.setObjective({
        id: interaction.objective || interaction.id,
        score: { scaled: correct ? '1' : '0', raw: correct ? '1' : '0', min: '0', max: '1' },
        success_status: correct ? 'passed' : 'failed',
        completion_status: 'completed',
        progress_measure: '1',
        description: course.currentPage?.title || ''
      });
      scorm.commit();
    }
  },

  /**
   * Push the current score through the Content API.
   * cmi.score.raw is gradeIt()'s input (min/max were declared by setTotals);
   * gradeIt derives scaled + success, and gates completion on progress_measure.
   */
  finalizeScore() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive() || course.isReviewMode) return;

    scorm.setvalue('cmi.score.raw', String(course.score));
    scorm.gradeIt();
    scorm.commit();
  },

  /**
   * Restore session via the Content API: bookmark for position,
   * per-page suspend records for progress, interaction read-back for answers.
   * Legacy/unparseable data → start fresh (never throw).
   */
  restoreFromScorm() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return false;

    const pages = state.get('courseData')?.pages || [];
    let restored = false;

    // 1. Per-page progress
    // Guarded: legacy cmi.suspend_data (pre-Content-API shape, e.g.
    // { position, progress, interactions }) has no `.pages` array, and
    // SCOBot's getSuspendDataByPageID/getInteraction reach into that
    // structure without a null-check — a legacy record must never crash
    // the player, so isolate each lookup.
    try {
      const progress = {};
      pages.forEach((page, i) => {
        const saved = scorm.getSuspendDataByPageID(page.id);
        if (saved && saved !== 'false' && typeof saved === 'object') {
          progress[i] = saved;
        }
      });
      if (Object.keys(progress).length > 0) {
        state.set('courseProgress', progress);
        restored = true;
        console.log('[CourseState] Restored per-page progress:', progress);
      }
    } catch (e) {
      console.warn('[CourseState] Failed to restore per-page progress (legacy suspend_data?):', e);
    }

    // 2. Interactions (answers) read back from cmi.interactions
    try {
      const interactions = [];
      pages.forEach((page) => {
        const found = scorm.getInteraction(String(page.id));
        if (found && found !== 'false') {
          interactions.push(found);
        }
      });
      if (interactions.length > 0) {
        state.set('interactions', interactions);
      }
    } catch (e) {
      console.warn('[CourseState] Failed to restore interactions:', e);
    }

    // 3. Bookmark → position
    try {
      const bookmark = scorm.getBookmark();
      const pos = parseInt(bookmark, 10);
      if (!Number.isNaN(pos) && pos >= 0 && pos < pages.length) {
        state.set('coursePosition', pos);
        restored = true;
      }
    } catch (e) {
      console.warn('[CourseState] Failed to restore bookmark:', e);
    }

    return restored;
  },

  /**
   * Get all comments from the LMS (instructor feedback)
   * @returns {Array} Array of comment objects with comment, location, timestamp
   */
  getCommentsFromLMS() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return [];

    // Use SCOBot's native API
    const result = scorm.getCommentsFromLMS();
    if (result === 'false' || !Array.isArray(result)) return [];

    // Add 'from' property for chat UI
    return result.map(c => ({ ...c, from: 'lms' }));
  },

  /**
   * Get all comments from the learner
   * @returns {Array} Array of comment objects with comment, location, timestamp
   */
  getCommentsFromLearner() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return [];

    // Use SCOBot's native API
    const result = scorm.getCommentsFromLearner();
    if (result === 'false' || !Array.isArray(result)) return [];

    // Add 'from' property for chat UI
    return result.map(c => ({ ...c, from: 'learner' }));
  },

  /**
   * Add a new comment from the learner
   * @param {string} text - The comment text
   * @param {string} location - Optional location reference (e.g., page title)
   * @returns {boolean} Success status
   */
  addLearnerComment(text, location = '') {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) {
      state.notify('Unable to save comment - not connected', 'error');
      return false;
    }

    // Use SCOBot's native API
    const result = scorm.addLearnerComment(text, location);
    
    if (result === 'true') {
      scorm.commit();
      state.notify('Comment saved!', 'success');
      return true;
    }
    
    state.notify('Failed to save comment', 'error');
    return false;
  },

  /**
   * Get all comments (from LMS and learner) merged and sorted by timestamp
   * @returns {Array} Merged array sorted by timestamp
   */
  getAllComments() {
    const lmsComments = this.getCommentsFromLMS();
    const learnerComments = this.getCommentsFromLearner();
    
    const all = [...lmsComments, ...learnerComments];
    
    // Sort by timestamp (oldest first for chat order)
    return all.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateA - dateB;
    });
  },

  /**
   * Save learner comments (legacy single-comment method)
   * @deprecated Use addLearnerComment for multi-comment support
   */
  saveLearnerComments(text) {
    state.set('learnerComments', text);
    
    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive()) {
      scorm.addLearnerComment(text);
      scorm.commit();
    }

    state.notify('Notes saved!', 'success');
  }
};
