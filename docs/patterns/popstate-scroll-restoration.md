# popstate Scroll Restoration — the Axiom fleet pattern

**Origin:** axiom (canonical). **Found:** 2026-08-13 by reading the router, not from a bug
report. **Verified in a live browser:** cybercussion.com, 2026-08-14. **Applies to:** every
Axiom app with `_saveScroll` in `src/core/router.js` — which is all of them.

The symptom users report is *"going Back always lands me at the top of the page."* It is not
a scroll-restoration failure. The position is saved correctly, then overwritten by the very
navigation that is about to read it.

## The bug

`navigate()` saves the departing page's scroll before leaving it:

```js
// BROKEN
this._saveScroll(location.pathname);
```

On a **push** navigation that is correct — `location.pathname` is still the departing page.
On a **popstate** it is not. The browser moves `location.pathname` to the destination
*before* the handler runs, so this writes the departing page's `scrollY` under the
**destination's** storage key. Going back from `/scobot` to `/` saves `/scobot`'s scroll
under `scroll_/`, clobbering home's real position — and the restore two hundred lines later
reads that freshly-clobbered value. The user lands wherever they happened to be on the page
they just left, which is usually the top.

The push path masks it: pushes save under the correct key, so the bug only shows on
Back/Forward, which is also the only path where scroll restoration matters.

## The fix — three edits, all in `src/core/router.js`

**1. Track the last committed path** (property on the router object):

```js
// Path of the last COMMITTED route — the page the user is actually on.
// location.pathname is unreliable for this during popstate handling.
_activePath: null,
```

**2. Save under it, never under `location.pathname`** (in `navigate()`, where the old
`_saveScroll` call was):

```js
if (this._activePath) this._saveScroll(this._activePath);
```

**3. Record it once the URL is final** (in the commit block, immediately before the
existing `scrollPath` line):

```js
// The URL is final here (pushState already ran on the push branch) —
// record the committed path as the page any FUTURE navigation is departing from.
this._activePath = location.pathname;
```

### Why the null guard is load-bearing

`_activePath` is `null` until the first commit. Without the guard, the boot pass would
call `_saveScroll` before any route committed and write `scrollY=0` — destroying a
same-session refresh-restore target. "Nothing to save yet" is a real state, not an edge case.

### Why the keys stay symmetric

The save key comes from `_activePath` (i.e. `location.pathname`). The restore key is
`push ? (base + cleanPath).replace('//','/') : location.pathname`. With `base = '/'` and
`cleanPath` slash-normalized, `('/' + '/scobot').replace('//','/')` is `/scobot` — identical
to `location.pathname`. Both branches agree. If a project ever sets a non-root
`config.BASE_PATH`, re-check this equality before assuming the fix holds.

## Verifying it — a unit test cannot see this

There is no assertion that catches this without a real browser and real history. Drive it:

```js
window.scrollTo({top: 900, behavior: 'instant'});   // on some route
// …click an internal link to another route…
history.back();
// assert scrollY came back to ~900 — pre-fix it returns ~0
```

Measured on cybercussion.com after the fix: scrolled to **747**, navigated away, `history.back()`
→ restored **747**. Pre-fix that restore was ~0.

## Fleet status (2026-08-14 — update this table when you patch one)

| Project | `_saveScroll` | fix applied |
|---|---|---|
| axiom (canonical) | yes | **yes** — this repo |
| cybercussion.com | yes | **yes** — verified live |
| daystra | yes | **NO** |
| scobot-cybercussion-com | yes | **NO** |
| tender-cybercussion-com | yes | **NO** |

The three unpatched projects are **arc-tracked, not git** — apply via
`arc intent declare` → edit in the worktree → `complete` → `merge`, not a commit.

## Do NOT assume routers are identical across projects

`cybercussion.com`'s router has diverged: it has post-navigation focus management
(`_focusView`, `findHeadingDeep`) and a `.skip-nav` link that **axiom canonical and the other
apps do not have**. Check for a symbol before porting anything that references it.

If you ever add focus-on-navigation to an app, guard it on `navigationId > 1`. On the initial
load the browser already places focus at the document start and announces the page; moving
focus to the heading lands *past* a skip link, leaving "Skip to main content" reachable only
by Shift+Tab on every cold load, and re-reads the heading. Route changes still need it,
because there the browser does nothing at all. See cybercussion.com arc intent #39.

## Related

- `docs/patterns/stale-deploy-prevention.md` — the caching contract this router ships under.
- Fleet skill `axiom-framework` gotchas 15 (this bug) and 16 (never fetch a versioned asset
  during a Pages deploy's propagation window — it caches stale bytes under the new immutable
  URL for a year).
