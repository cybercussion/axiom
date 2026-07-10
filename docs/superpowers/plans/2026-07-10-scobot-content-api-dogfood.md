# SCOBot Content API Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the classic SCOBot Content API surface in `@cybercussion/scobot` 5.2.0 (upstream) and refactor the scobot-player2 player to consume it natively instead of raw `setvalue('cmi.…')` calls.

**Architecture:** Two repos, sequential. Phase 1 (Tasks 1–5) works in `~/cybercussion.com/SCOBot` on branch `v5`: add `setBookmark`/`getBookmark`, `getEntry`, `getSecondsFromStart`, `getInteraction`, `setTotals`, and restore the 4.x progress/completion "essence" (setObjective maintains `progress_measure`; gradeIt gates completion on `completion_threshold`). Phase 2 (Tasks 6–10) works in `~/cybercussion.com/axiom` on branch `scobot-player2`: player boots via `initSCO()`/`start()`, persists via `setBookmark` + `setSuspendDataByPageID`, reports objectives per interactive page, scores via `setTotals`+`gradeIt`, exits via `finish()`/`suspend()`, honors review mode.

**Tech Stack:** Vanilla ES modules; vitest (SCOBot repo only — the player repo has no src test harness, verification is build + mock-LMS browser run); SCOBot Mock API (`localStorage` persistence) for standalone verification.

**Spec:** `docs/superpowers/specs/2026-07-10-scobot-content-api-dogfood-design.md`

## Global Constraints

- SCOBot repo: branch `v5`, all additions in `src/core/SCOBot.js` (the "type less, pass payloads" layer) — never in `src/connector/SCOBotBase.js` (raw version-unification layer).
- SCOBot code style: 4-space indent, methods return `'true'`/`'false'` strings, guard with `this.isConnectionActive()` or `this.isActive`, use `this.isBadValue()` / `this.trueRound()`, debug via `this.debug(\`${this.settings.prefix}: …\`, n)`.
- Player repo: branch `scobot-player2`, 2-space indent, `BUILD_PROFILE = 'scorm'` in minify.js must NOT change.
- No raw `setvalue`/`getvalue` in player code where a Content API method exists. Allowed raw survivors: `cmi.score.raw` (gradeIt's input), the blanking loops in `resetCourseState` (SCORM has no delete).
- `happyEnding: false` in player options — `gradeIt()` is the honest path.
- Player `package.json` keeps `"^5.1.1"` until Mark publishes 5.2.0 (dev uses `npm install <tarball> --no-save`); final dependency bump is a separate, explicitly-flagged step.
- Commit after every task (both repos are git; SCOBot commits go on `v5`).

---

### Task 1: setBookmark / getBookmark (SCOBot repo)

**Files:**
- Create: `~/cybercussion.com/SCOBot/tests/content-api.test.js`
- Modify: `~/cybercussion.com/SCOBot/src/core/SCOBot.js` (insert after `getSuspendDataByPageID`, ~line 371)

**Interfaces:**
- Produces: `setBookmark(location: string) → 'true'|'false'`; `getBookmark() → string | 'false'` (empty string when unset). Task 7 (player) consumes both.

- [ ] **Step 1: Write the failing tests**

Create `tests/content-api.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import SCOBot from '../src/core/SCOBot.js';
import SCOBot_API_1484_11 from '../src/mocks/SCOBot_API_1484_11.js';

describe('Content API additions (5.2.0)', () => {
    let scobot;

    beforeEach(() => {
        document.body.innerHTML = '';
        window.API_1484_11 = undefined;
        window.API = undefined;
        window.API_1484_11 = new SCOBot_API_1484_11();
        scobot = new SCOBot();
        scobot.initSCO();
    });

    describe('Bookmarking', () => {
        it('setBookmark stores cmi.location and getBookmark returns it', () => {
            expect(scobot.setBookmark('page_4')).toBe('true');
            expect(scobot.getBookmark()).toBe('page_4');
            expect(scobot.getvalue('cmi.location')).toBe('page_4');
        });

        it('getBookmark returns empty string when never set', () => {
            expect(scobot.getBookmark()).toBe('');
        });

        it('setBookmark returns false when not connected', () => {
            scobot.terminate();
            expect(scobot.setBookmark('x')).toBe('false');
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/cybercussion.com/SCOBot && npx vitest run tests/content-api.test.js`
Expected: FAIL — `scobot.setBookmark is not a function`

- [ ] **Step 3: Implement**

In `src/core/SCOBot.js`, insert after the closing brace of `getSuspendDataByPageID` (~line 371):

```javascript
    // --- Bookmarking ---

    /**
     * Set Bookmark (classic Content API): stores the resume location.
     * SCORM 2004 allows up to 1000 chars; 1.2 allows 255.
     * @param {String} v Location value (e.g. a page id or index)
     * @returns {String} 'true' or 'false'
     */
    setBookmark(v) {
        if (this.isConnectionActive()) {
            this.settings.location = '' + v;
            return this.setvalue('cmi.location', this.settings.location);
        }
        return 'false';
    }

    /**
     * Get Bookmark (classic Content API)
     * @returns {String} stored cmi.location ('' when unset), or 'false' if not connected
     */
    getBookmark() {
        if (this.isConnectionActive()) {
            return this.getvalue('cmi.location');
        }
        return 'false';
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/content-api.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full suite (no regressions), then commit**

Run: `npx vitest run`
Expected: all pre-existing tests still PASS.

```bash
git add tests/content-api.test.js src/core/SCOBot.js
git commit -m "feat: restore setBookmark/getBookmark from classic Content API"
```

---

### Task 2: getEntry + getSecondsFromStart (SCOBot repo)

**Files:**
- Modify: `~/cybercussion.com/SCOBot/tests/content-api.test.js`
- Modify: `~/cybercussion.com/SCOBot/src/core/SCOBot.js` (insert after `getBookmark` from Task 1)

**Interfaces:**
- Consumes: `this.settings.entry` / `this.settings.startTime` (set by `start()`).
- Produces: `getEntry() → string` ('' | 'ab-initio' | 'resume'); `getSecondsFromStart() → number`. Task 6 (player) consumes `getEntry`.

- [ ] **Step 1: Add failing tests**

Append inside the top-level `describe` in `tests/content-api.test.js`:

```javascript
    describe('Session info', () => {
        it('getEntry returns the cmi.entry captured at start', () => {
            expect(typeof scobot.getEntry()).toBe('string');
            expect(['', 'ab-initio', 'resume']).toContain(scobot.getEntry());
        });

        it('getSecondsFromStart returns non-negative elapsed seconds', async () => {
            await new Promise((r) => setTimeout(r, 20));
            const s = scobot.getSecondsFromStart();
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThan(5);
        });
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/content-api.test.js`
Expected: FAIL — `scobot.getEntry is not a function`

- [ ] **Step 3: Implement**

Insert after `getBookmark`:

```javascript
    /**
     * Get Entry (classic Content API): '' | 'ab-initio' | 'resume', captured by start().
     * @returns {String}
     */
    getEntry() {
        return this.settings.entry;
    }

    /**
     * Get Seconds From Start (classic Content API).
     * NOTE: the 4.x original returned startTime - now (negative); corrected here.
     * @returns {Number} elapsed seconds since start(), rounded to 2 places
     */
    getSecondsFromStart() {
        return this.trueRound((new Date().getTime() - this.settings.startTime) / 1000, 2);
    }
```

- [ ] **Step 4: Verify pass, full suite, commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add tests/content-api.test.js src/core/SCOBot.js
git commit -m "feat: restore getEntry/getSecondsFromStart (fixes 4.x sign bug)"
```

---

### Task 3: getInteraction (SCOBot repo)

**Files:**
- Modify: `~/cybercussion.com/SCOBot/tests/content-api.test.js`
- Modify: `~/cybercussion.com/SCOBot/src/core/SCOBot.js` (insert after `setInteraction`'s closing brace, ~line 847)

**Interfaces:**
- Consumes: `this.decodeInteractionType(type, raw)`, `this.getAPIVersion()`.
- Produces: `getInteraction(id: string) → object | 'false'` — object mirrors `setInteraction`'s input shape (`{id, type, learner_response, result, weight, latency, timestamp, description}`). Task 7 (player restore) consumes it.

- [ ] **Step 1: Add failing tests**

Append inside the top-level `describe`:

```javascript
    describe('getInteraction', () => {
        it('returns a previously set interaction by id (decoded)', () => {
            scobot.setInteraction({
                id: 'q1',
                type: 'choice',
                learner_response: ['a'],
                result: 'correct',
                weight: '1',
                timestamp: new Date().toISOString(),
                latency: 'PT5S'
            });
            const found = scobot.getInteraction('q1');
            expect(found).not.toBe('false');
            expect(found.id).toBe('q1');
            expect(found.type).toBe('choice');
            expect(found.result).toBe('correct');
        });

        it('returns false for an unknown id', () => {
            expect(scobot.getInteraction('nope')).toBe('false');
        });
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/content-api.test.js`
Expected: FAIL — `scobot.getInteraction is not a function`

- [ ] **Step 3: Implement**

First check what key `setInteraction` writes for weight: `grep -n "weighting\|weight" src/core/SCOBot.js` around line 667–847 — use the same CMI key it writes (expected `weighting`). Then insert after `setInteraction`:

```javascript
    /**
     * Get Interaction (classic Content API): find by id, return decoded object
     * (inverse of setInteraction, mirrors getObjective's shape).
     * @param {String} id
     * @returns {Object|String} interaction object or 'false'
     */
    getInteraction(id) {
        if (this.isConnectionActive()) {
            const count = parseInt(this.getvalue('cmi.interactions._count'), 10);
            if (isNaN(count)) {
                return 'false';
            }
            const version = this.getAPIVersion();
            for (let i = 0; i < count; i++) {
                if (this.getvalue(`cmi.interactions.${i}.id`) === id) {
                    const p1 = `cmi.interactions.${i}.`;
                    const type = this.getvalue(p1 + 'type');
                    const responseKey = version !== '1.2' ? 'learner_response' : 'student_response';
                    return {
                        id: id,
                        type: type,
                        learner_response: this.decodeInteractionType(type, this.getvalue(p1 + responseKey)),
                        result: this.getvalue(p1 + 'result'),
                        weight: this.getvalue(p1 + 'weighting'),
                        latency: version !== '1.2' ? this.getvalue(p1 + 'latency') : '',
                        timestamp: version !== '1.2' ? this.getvalue(p1 + 'timestamp') : this.getvalue(p1 + 'time'),
                        description: version !== '1.2' ? this.getvalue(p1 + 'description') : ''
                    };
                }
            }
        }
        return 'false';
    }
```

- [ ] **Step 4: Verify pass, full suite, commit**

Run: `npx vitest run`
Expected: PASS.

```bash
git add tests/content-api.test.js src/core/SCOBot.js
git commit -m "feat: restore getInteraction read-back from classic Content API"
```

---

### Task 4: setTotals + progress_measure maintenance + gradeIt completion gate (SCOBot repo)

This is the "missed essence" task. 4.x flow: `setTotals` declares totals → each completed `setObjective` recomputes `progress_measure = completedObjectives / totalObjectives` → `gradeIt` gates completion on `progress_measure >= completion_threshold` (v5 currently marks completion unconditionally with a `// simplified` comment).

**Files:**
- Modify: `~/cybercussion.com/SCOBot/tests/content-api.test.js`
- Modify: `~/cybercussion.com/SCOBot/src/core/SCOBot.js` — constructor (~line 66), `setObjective` (~line 849), `gradeIt` (~line 433)

**Interfaces:**
- Produces: `setTotals({totalInteractions, totalObjectives, scoreMin, scoreMax}) → 'true'|'false'`; side effects on `setObjective` (maintains `cmi.progress_measure`) and `gradeIt` (threshold gate). Tasks 6/8/9 (player) consume.

- [ ] **Step 1: Add failing tests**

Append inside the top-level `describe`:

```javascript
    describe('Scoring essence (restored from 4.x)', () => {
        const obj = (id) => ({
            id,
            score: { scaled: '1', raw: '1', min: '0', max: '1' },
            success_status: 'passed',
            completion_status: 'completed',
            progress_measure: '1',
            description: `Objective ${id}`
        });

        it('setTotals sets score bounds', () => {
            expect(scobot.setTotals({
                totalInteractions: '2', totalObjectives: '2', scoreMin: '0', scoreMax: '100'
            })).toBe('true');
            expect(scobot.getvalue('cmi.score.min')).toBe('0');
            expect(scobot.getvalue('cmi.score.max')).toBe('100');
        });

        it('setObjective maintains progress_measure against totalObjectives', () => {
            scobot.setTotals({ totalObjectives: '2', scoreMin: '0', scoreMax: '100' });
            scobot.setObjective(obj('obj1'));
            expect(parseFloat(scobot.getvalue('cmi.progress_measure'))).toBeCloseTo(0.5);
            scobot.setObjective(obj('obj2'));
            expect(parseFloat(scobot.getvalue('cmi.progress_measure'))).toBeCloseTo(1);
        });

        it('gradeIt gates completion on completion_threshold', () => {
            window.API_1484_11 = new SCOBot_API_1484_11();
            const sb = new SCOBot({ completion_threshold: 1 });
            sb.initSCO();
            sb.setTotals({ totalObjectives: '2', scoreMin: '0', scoreMax: '100' });
            sb.setObjective(obj('obj1'));
            sb.setvalue('cmi.score.raw', '50');
            sb.gradeIt();
            expect(sb.getvalue('cmi.completion_status')).toBe('incomplete');
            sb.setObjective(obj('obj2'));
            sb.gradeIt();
            expect(sb.getvalue('cmi.completion_status')).toBe('completed');
        });
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/content-api.test.js`
Expected: FAIL — `scobot.setTotals is not a function`

- [ ] **Step 3: Implement — constructor flag**

In the constructor near `this.isStarted = false;` (~line 66), add (only if not already defined — `grep -n "SCOBotManagedStatus" src/core/SCOBot.js` first; `updateStatus` references it):

```javascript
        this.SCOBotManagedStatus = false;
```

- [ ] **Step 4: Implement — setTotals**

Insert immediately BEFORE `gradeIt()` (~line 433):

```javascript
    /**
     * Set Totals (classic Content API): declare totals so SCOBot manages
     * progress_measure and score bounds. Call once after start().
     * @param {Object} data {totalInteractions, totalObjectives, scoreMin, scoreMax}
     * @returns {String} 'true' or 'false'
     */
    setTotals(data) {
        this.SCOBotManagedStatus = true;
        if (this.isConnectionActive()) {
            if (!this.isBadValue(data.totalInteractions)) {
                this.settings.totalInteractions = parseInt(data.totalInteractions, 10);
            }
            if (!this.isBadValue(data.totalObjectives)) {
                this.settings.totalObjectives = parseInt(data.totalObjectives, 10);
            }
            if (!this.isBadValue(data.scoreMin)) {
                this.buffer.score.min = '' + this.trueRound(data.scoreMin, 7);
                this.setvalue('cmi.score.min', this.buffer.score.min);
            }
            if (!this.isBadValue(data.scoreMax)) {
                this.buffer.score.max = '' + this.trueRound(data.scoreMax, 7);
                this.setvalue('cmi.score.max', this.buffer.score.max);
            }
            return 'true';
        }
        return 'false';
    }
```

- [ ] **Step 5: Implement — setObjective progress maintenance**

In `setObjective`, after the `this.setvalue(\`cmi.objectives.${idx}.description\`, data.description);` line and before `return 'true';`, add:

```javascript
            // Maintain progress_measure (restored 4.x behavior):
            // completed objectives / totalObjectives declared via setTotals.
            if (this.settings.totalObjectives > 0 && data.completion_status === 'completed') {
                const objCount = parseInt(this.getvalue('cmi.objectives._count'), 10);
                let completedCount = 0;
                for (let j = 0; j < objCount; j++) {
                    if (this.getvalue(`cmi.objectives.${j}.completion_status`) === 'completed') {
                        completedCount++;
                    }
                }
                this.buffer.progress_measure = '' + this.trueRound(completedCount / this.settings.totalObjectives, 7);
                this.setvalue('cmi.progress_measure', this.buffer.progress_measure);
            }
```

- [ ] **Step 6: Implement — gradeIt gate**

In `gradeIt()`, replace this block:

```javascript
        // Completion
        if (this.buffer.completion_status !== "completed") {
            // Logic check
            this.buffer.completion_status = 'completed'; // simplified
            this.setvalue('cmi.completion_status', 'completed');
        }
```

with:

```javascript
        // Completion (restored 4.x gate): progress_measure vs completion_threshold.
        // Default threshold 0 keeps prior behavior (always completed).
        if (this.buffer.completion_status !== "completed") {
            this.buffer.completion_status =
                (parseFloat(this.buffer.progress_measure) >= parseFloat(this.buffer.completion_threshold))
                    ? 'completed' : 'incomplete';
            this.setvalue('cmi.completion_status', this.buffer.completion_status);
        }
```

- [ ] **Step 7: Verify pass, full suite, commit**

Run: `npx vitest run`
Expected: all PASS (if a pre-existing test asserted unconditional completion, update it to declare `completion_threshold: 0` explicitly — the default preserves old behavior, so none should break).

```bash
git add tests/content-api.test.js src/core/SCOBot.js
git commit -m "feat: restore setTotals + progress_measure/completion_threshold essence from 4.x"
```

---

### Task 5: Version 5.2.0, build, pack, install into player (SCOBot repo → axiom)

**Files:**
- Modify: `~/cybercussion.com/SCOBot/package.json` (version)
- Modify: `~/cybercussion.com/SCOBot/src/core/SCOBot.js` (`version: "5.1.0"` in `scoBotDefaults`, ~line 21)

**Interfaces:**
- Produces: `cybercussion-scobot-5.2.0.tgz`; player `node_modules/@cybercussion/scobot` at 5.2.0 (package.json unchanged). All Phase-2 tasks consume.

- [ ] **Step 1: Bump versions**

In `~/cybercussion.com/SCOBot/package.json`: `"version": "5.2.0"`. In `src/core/SCOBot.js` scoBotDefaults: `version: "5.2.0"`.

- [ ] **Step 2: Full test + build + pack**

```bash
cd ~/cybercussion.com/SCOBot
npx vitest run          # expected: all PASS
npm run build           # regenerates dist/ (repo dist was stale vs npm)
npm pack                # produces cybercussion-scobot-5.2.0.tgz
```

- [ ] **Step 3: Commit the bump**

```bash
git add package.json src/core/SCOBot.js dist/
git commit -m "chore: 5.2.0 — classic Content API restoration (bookmark, entry, getInteraction, setTotals, completion gate)"
```

- [ ] **Step 4: Install tarball into the player WITHOUT touching package.json**

```bash
cd ~/cybercussion.com/axiom
npm install ~/cybercussion.com/SCOBot/cybercussion-scobot-5.2.0.tgz --no-save
node -e "import('./node_modules/@cybercussion/scobot/dist/scobot.js').then(m => console.log(typeof m.SCOBot.prototype.setBookmark, typeof m.SCOBot.prototype.setTotals))"
```

Expected output: `function function`

**GATE (Mark):** publishing 5.2.0 to npm is Mark's manual action. After publish: `npm install @cybercussion/scobot@^5.2.0 --save` and commit `package.json`/`package-lock.json`. Until then, do NOT commit dependency changes in axiom.

---

### Task 6: Player boot via initSCO + setTotals + review mode + lifecycle exit (axiom repo)

**Files:**
- Modify: `~/cybercussion.com/axiom/src/features/player/player.js:54-125` (`disconnectedCallback`, `initScorm`)
- Modify: `~/cybercussion.com/axiom/src/core/course-state.js` (add `isReviewMode` selector after the `scorm` getter, ~line 166)

**Interfaces:**
- Consumes: `initSCO()`, `getEntry()`, `getMode()`, `setTotals()`, `finish()`, `suspend()` (Tasks 1–5).
- Produces: `course.isReviewMode → boolean`; `courseActions.finalizeScore()` is called here but DEFINED in Task 7 — implement Tasks 6 and 7 together before building.

- [ ] **Step 1: Add the review-mode selector**

In `src/core/course-state.js`, after the `get scorm()` getter (~line 166), add:

```javascript
  /**
   * True when the LMS launched us in review mode — render restored state, write nothing.
   */
  get isReviewMode() {
    const scorm = this.scorm;
    return !!scorm && typeof scorm.getMode === 'function' && scorm.getMode() === 'review';
  },
```

- [ ] **Step 2: Replace initScorm in player.js**

Replace the whole `initScorm()` method (lines 84–125) with:

```javascript
  async initScorm() {
    // SCOBot is imported directly via import map
    if (SCOBot) {
      try {
        // Enable debug: URL param overrides config.DEBUG
        const debugEnabled = launchParams.debug || config.DEBUG;
        if (debugEnabled) {
          launchParams.log();
        }

        const data = state.get('courseData');
        const passingScore = (data?.meta?.passingScore ?? 80) / 100;

        const options = {
          debug: debugEnabled,
          prefix: 'SCOBot',
          use_standalone: true,        // Failover to Mock API if no LMS found
          compression: true,           // Compress suspend_data (lz-string)
          exit_type: 'suspend',        // Safety default; finish() overrides at the end
          happyEnding: false,          // gradeIt() is the honest scoring path
          scaled_passing_score: passingScore,
          completion_threshold: 1      // completed = every objective completed
        };

        const scorm = new SCOBot(options);
        // initSCO = initialize() + start(): learner info, entry/mode, suspend restore
        const connected = scorm.initSCO();

        if (connected === 'true') {
          state.set('scorm', scorm);
          log.info(`SCORM initialized (entry: ${scorm.getEntry() || 'ab-initio'}, mode: ${scorm.getMode()})`);

          // Declare totals so SCOBot maintains progress_measure.
          // Objectives = interactive pages (one objective per question page).
          const interactiveTypes = ['choice', 'match', 'wordpuzzle'];
          const totals = (data?.pages || []).filter(p => interactiveTypes.includes(p.type)).length;
          scorm.setTotals({
            totalInteractions: String(totals),
            totalObjectives: String(totals),
            scoreMin: '0',
            scoreMax: '100'
          });

          // Restore previous session if available
          courseActions.restoreFromScorm();
        } else {
          log.info('SCORM API not found - running in standalone mode');
        }
      } catch (err) {
        log.warn('SCORM initialization failed (standalone mode)', err);
      }
    }
  }
```

- [ ] **Step 3: Replace disconnectedCallback in player.js**

Replace the whole `disconnectedCallback()` (lines 54–66) with:

```javascript
  disconnectedCallback() {
    // Cleanup course mode
    state.set('courseActive', false);

    // Close the SCORM session via the Content API lifecycle
    const scorm = course.scorm;
    if (scorm && scorm.isConnectionActive()) {
      if (course.isReviewMode) {
        scorm.suspend();                      // review: never rewrite status
      } else if (course.completionPercent === 100) {
        courseActions.finalizeScore();        // cmi.score.raw + gradeIt()
        scorm.finish();                       // exit normal — the attempt ends
      } else {
        scorm.suspend();                      // save-and-resume
      }
    }

    super.disconnectedCallback();
  }
```

- [ ] **Step 4: Do NOT build yet**

`finalizeScore()` does not exist until Task 7 — proceed directly to Task 7 before building. Commit happens at the end of Task 7.

---

### Task 7: Bookmark + per-page suspend + restore (axiom repo)

**Files:**
- Modify: `~/cybercussion.com/axiom/src/core/course-state.js` — `goToPage` (~line 246), `markPageComplete` (~line 276), delete `syncToScorm` (~line 325), rewrite `restoreFromScorm` (~line 370), add `finalizeScore`

**Interfaces:**
- Consumes: `setBookmark`/`getBookmark`, `setSuspendDataByPageID(id, title, data)`/`getSuspendDataByPageID(id)`, `getInteraction(id)`, `gradeIt()`, `commit()`.
- Produces: `courseActions.finalizeScore()` (Task 6 calls it); per-page suspend shape `{complete, score, timestamp, response?}` (what `getSuspendDataByPageID` returns on restore).

- [ ] **Step 1: Confirm the only syncToScorm callers are internal**

Run: `grep -rn "syncToScorm" src/`
Expected: hits ONLY inside `src/core/course-state.js` (`goToPage`, `markPageComplete`, definition) — Task 6 already removed the `player.js` call. If any other file calls it, list them and update them with the replacements below.

- [ ] **Step 2: Replace goToPage**

```javascript
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
```

- [ ] **Step 3: Replace markPageComplete**

```javascript
  /**
   * Mark current page as complete.
   * Persists via the Content API: one suspend record per page id.
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
```

- [ ] **Step 4: Delete syncToScorm, add finalizeScore in its place**

```javascript
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
```

- [ ] **Step 5: Rewrite restoreFromScorm**

```javascript
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

    // 2. Interactions (answers) read back from cmi.interactions
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

    // 3. Bookmark → position
    const bookmark = scorm.getBookmark();
    const pos = parseInt(bookmark, 10);
    if (!Number.isNaN(pos) && pos >= 0 && pos < pages.length) {
      state.set('coursePosition', pos);
      restored = true;
    }

    return restored;
  },
```

- [ ] **Step 6: Update resetCourseState to the Content API where methods exist**

In `resetCourseState` (~line 40): replace `scorm.setvalue('cmi.location', '0');` with `scorm.setBookmark('0');`, and after the score/status blanking block add (SCOBot keeps suspend pages in memory — clear them or old pages resurface on the next save):

```javascript
    // Clear SCOBot's in-memory suspend pages, then persist the empty set.
    // (Reach-in: candidate for an upstream clearSuspendData() in 5.3.)
    if (scorm.settings?.suspend_data) {
      scorm.settings.suspend_data.pages = [];
    }
    scorm.setSuspendData();
```

Keep the raw blanking loops for comments/score/status — SCORM has no delete; that layer is legitimately below the Content API.

- [ ] **Step 7: Build + tests, then commit Tasks 6+7 together**

```bash
cd ~/cybercussion.com/axiom
npm run test:tools    # expected: 13/13 PASS
npm run build         # expected: guards pass, Build Complete
grep -rn "syncToScorm" src/   # expected: no matches
git add src/features/player/player.js src/core/course-state.js
git commit -m "feat(player): boot via initSCO, bookmark + per-page suspend, gradeIt scoring, finish/suspend lifecycle"
```

---

### Task 8: Objectives per interactive page (axiom repo)

**Files:**
- Modify: `~/cybercussion.com/axiom/src/features/templates/template-base.js:85-114` (`recordInteraction`)
- Modify: `~/cybercussion.com/axiom/src/core/course-state.js` (`recordInteraction`, ~line 301)

**Interfaces:**
- Consumes: `setObjective(payload)`, `setInteraction(interaction)` (SCOBot); `interaction-submit` event detail.
- Produces: interaction objects now carry `objective: string` (= `pageData.objectiveId ?? pageData.id`).

- [ ] **Step 1: Template emits the objective id**

In `template-base.js` `recordInteraction`, inside the `const interaction = {` literal, add one line after `id`:

```javascript
      id: String(this.interactionId),
      objective: String(this.pageData?.objectiveId || this.interactionId),
```

- [ ] **Step 2: course-state records interaction + objective**

Replace `courseActions.recordInteraction` with:

```javascript
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
      scorm.setInteraction(interaction);

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
```

- [ ] **Step 3: Build + commit**

```bash
npm run build   # expected: guards pass
git add src/features/templates/template-base.js src/core/course-state.js
git commit -m "feat(player): per-page SCORM objectives via setObjective"
```

---

### Task 9: Sweep — no raw CMI writes outside the allowed list (axiom repo)

**Files:**
- Modify: any file the sweep finds (expected: none beyond allowed)

- [ ] **Step 1: Sweep**

Run: `grep -rn "setvalue\|getvalue" src/ --include="*.js"`

Expected surviving calls, exactly:
- `src/core/course-state.js` — `finalizeScore`: `setvalue('cmi.score.raw', …)` (gradeIt input — allowed)
- `src/core/course-state.js` — `resetCourseState`: blanking loops (allowed)

Any other hit (e.g. `cmi.suspend_data`, `cmi.location`, `cmi.completion_status`, `cmi.score.scaled`, comments loops in feedback UI) must be replaced with its Content API equivalent per the table in the spec. If `feedback-drawer.js` or `player-nav.js` carry raw calls, apply the same patterns as Tasks 7–8.

- [ ] **Step 2: Build + commit (only if changes were needed)**

```bash
npm run build
git add -A src/
git commit -m "refactor(player): remove remaining raw CMI calls in favor of Content API"
```

---

### Task 10: End-to-end verification (axiom repo)

**Files:** none (verification only)

- [ ] **Step 1: Fresh build + package**

```bash
cd ~/cybercussion.com/axiom
npm run test:tools     # 13/13 PASS
npm run build          # guards pass
npm run scorm          # SCORM 2004 zip builds
```

- [ ] **Step 2: Standalone mock-LMS run (Chrome against dist)**

Serve dist (`npx serve dist`) and drive in Chrome (claude-in-chrome). Script:
1. Load the player. Expected console: `SCORM initialized (entry: ab-initio, mode: normal)`.
2. Answer the first interactive page correctly. Expected: `localStorage.getItem('SCOBot')` JSON contains `cmi.interactions.0.id` = that page's id, `cmi.objectives.0.id` = same id with `completion_status: 'completed'`, and `cmi.progress_measure` > 0.
3. Navigate two pages, reload the tab. Expected: player resumes at the bookmarked page (console shows `entry: resume`), completed pages still marked, previous answer restored in review display.
4. Complete every page. Expected: `cmi.completion_status` = `completed`, `cmi.success_status` reflects pass/fail vs `passingScore`, `cmi.score.scaled` = raw/100.
5. Navigate away from the player route (unload). Expected: mock records `cmi.exit` = `normal` (finished) — or `suspend` if the run was left incomplete.

- [ ] **Step 3: Reset regression**

In the running player, trigger the reset control (player-nav). Expected: position back to 0, `cmi.suspend_data` empty of pages, objectives/score blanked per `resetCourseState`, no console errors.

- [ ] **Step 4: SCORM Cloud (Mark, manual)**

Hand the `scorm-packages/*.zip` to Mark for a SCORM Cloud pass: verify bookmark/resume, interactions + objectives in the report, score/success/completion — including the review-mode launch after completion (no data rewrites).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "test(player): verified Content API dogfood — mock LMS roundtrip + scorm package"
```

---

## Post-plan follow-ups (not tasks)

- Mark publishes `@cybercussion/scobot@5.2.0` → axiom: `npm i @cybercussion/scobot@^5.2.0 --save`, commit lockfile.
- Candidate upstream 5.3: `clearSuspendData()` (removes the reset reach-in), `startTimer`/max_time_allowed (v5 TODO at `start()` step 6).
- SCOBot repo MANIFEST.toml does not exist; worth registering the 5.2.0 Content API capability in the fleet registry.
