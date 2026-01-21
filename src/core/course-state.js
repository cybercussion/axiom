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
 */
export function resetCourseState() {
  state.set('coursePosition', 0);
  state.set('courseProgress', {});
  state.set('interactions', []);
  state.set('feedbackOpen', false);
  state.set('toolsOpen', false);
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
      this.syncToScorm();
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
    this.syncToScorm();
  },

  /**
   * Record an interaction (question response)
   */
  recordInteraction(interaction) {
    const interactions = [...(state.get('interactions') || [])];
    
    // Check if this interaction already exists (for retries)
    const existingIndex = interactions.findIndex(i => i.id === interaction.id);
    
    if (existingIndex >= 0) {
      interactions[existingIndex] = interaction;
    } else {
      interactions.push(interaction);
    }

    state.set('interactions', interactions);

    // Send to SCOBot if connected
    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive()) {
      scorm.setInteraction(interaction);
    }
  },

  /**
   * Sync current state to SCORM
   */
  syncToScorm() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return;

    const pos = state.get('coursePosition');
    const progress = state.get('courseProgress');

    // Location
    scorm.setvalue('cmi.location', String(pos));

    // Suspend data (full progress state)
    const suspendObj = {
      position: pos,
      progress,
      interactions: state.get('interactions')
    };
    console.log('[CourseState] Saving to suspend_data:', suspendObj);
    scorm.setvalue('cmi.suspend_data', JSON.stringify(suspendObj));

    // Completion status
    const completionPercent = course.completionPercent;
    if (completionPercent === 100) {
      scorm.setvalue('cmi.completion_status', 'completed');
    } else {
      scorm.setvalue('cmi.completion_status', 'incomplete');
    }

    // Score (if we have interactions)
    const score = course.score;
    if (score > 0) {
      scorm.setvalue('cmi.score.scaled', String(score / 100));
      scorm.setvalue('cmi.score.raw', String(score));
      scorm.setvalue('cmi.score.max', '100');
      scorm.setvalue('cmi.score.min', '0');

      // Success status
      scorm.setvalue('cmi.success_status', course.isPassing ? 'passed' : 'failed');
    }

    scorm.commit();
  },

  /**
   * Restore state from SCORM suspend_data
   */
  restoreFromScorm() {
    const scorm = course.scorm;
    if (!scorm || !scorm.isConnectionActive()) return false;

    const suspendData = scorm.getvalue('cmi.suspend_data');
    if (!suspendData || suspendData === 'false') {
      return false;
    }

    try {
      const data = JSON.parse(suspendData);
      console.log('[CourseState] Restoring from suspend_data:', data);
      
      // Restore all state - order doesn't matter since we render AFTER restore
      if (data.progress) {
        state.set('courseProgress', data.progress);
        console.log('[CourseState] Restored progress:', data.progress);
      }
      if (data.interactions) {
        state.set('interactions', data.interactions);
      }
      if (data.position !== undefined) {
        state.set('coursePosition', data.position);
      }

      return true;
    } catch (e) {
      console.warn('[CourseState] Failed to restore suspend_data:', e, suspendData);
      return false;
    }
  },

  /**
   * Save learner comments
   */
  saveLearnerComments(text) {
    state.set('learnerComments', text);
    
    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive()) {
      scorm.setvalue('cmi.comments_from_learner.0.comment', text);
      scorm.commit();
    }

    state.notify('Notes saved!', 'success');
  }
};
