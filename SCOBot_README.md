# SCOBot SCORM Integration Guide

This document explains how SCORM (Shareable Content Object Reference Model) is integrated into the Axiom e-learning player using [@cybercussion/scobot](https://www.npmjs.com/package/@cybercussion/scobot).

## What is SCORM?

SCORM is a set of technical standards for e-learning software that enables:
- **Tracking** - Record learner progress, scores, and completion status
- **Bookmarking** - Resume where the learner left off
- **Interoperability** - Content works across different Learning Management Systems (LMS)

### SCORM Versions
- **SCORM 1.2** - Legacy standard, simpler but limited
- **SCORM 2004** - Modern standard with sequencing and navigation rules

SCOBot supports both versions automatically.

## Project Setup

### Installation
```bash
npm install @cybercussion/scobot
```

### Import Map Configuration
In `index.html`:
```html
<script type="importmap">
{
  "imports": {
    "@scobot": "./node_modules/@cybercussion/scobot/dist/scobot.js"
  }
}
</script>
```

### Usage in Player
```javascript
import { SCOBot } from '@scobot';

const scorm = new SCOBot({
  debug: true,           // Enable console logging
  prefix: 'SCOBot',      // Log prefix for filtering
  use_standalone: true,  // Use mock API when no LMS present
  compression: true,     // Compress suspend_data
  exit_type: 'suspend'   // Default: suspend (vs 'finish')
});

// Initialize connection
const success = scorm.initialize();  // Returns 'true' or 'false' (strings!)
```

## Key Concepts

### Data Model Elements (SCORM 2004)

| Element | Purpose | Example |
|---------|---------|---------|
| `cmi.location` | Bookmark position | `"3"` (page index) |
| `cmi.suspend_data` | Custom state data | JSON string |
| `cmi.completion_status` | Course progress | `"completed"` or `"incomplete"` |
| `cmi.success_status` | Pass/fail result | `"passed"` or `"failed"` |
| `cmi.score.raw` | Numeric score | `"85"` |
| `cmi.score.scaled` | Normalized score | `"0.85"` (0-1) |
| `cmi.score.min` | Minimum possible | `"0"` |
| `cmi.score.max` | Maximum possible | `"100"` |

### Important: All Values Are Strings!
SCORM requires all values to be strings. Always convert:
```javascript
scorm.setvalue('cmi.score.raw', String(85));  // ✓ Correct
scorm.setvalue('cmi.score.raw', 85);          // ✗ May fail
```

## SCOBot API Methods

### Core Methods
```javascript
scorm.initialize()              // Start SCORM session
scorm.terminate()               // End session gracefully
scorm.finish()                  // Commit + terminate (exit)
scorm.commit()                  // Save data to LMS
scorm.isConnectionActive()      // Check if connected
```

### Data Access
```javascript
scorm.getvalue('cmi.location')           // Read value
scorm.setvalue('cmi.location', '5')      // Write value
```

### Interactions (Question Tracking)
```javascript
scorm.setInteraction({
  id: 'q1-web-basics',           // Unique question ID
  type: 'choice',                // choice, matching, fill-in, etc.
  learner_response: 'd',         // What learner answered
  result: 'correct',             // correct, incorrect, neutral
  weight: '1',                   // Scoring weight
  latency: 'PT30S',              // Time spent (ISO 8601 duration)
  timestamp: '2026-01-21T...'    // When answered (ISO 8601)
});
```

## Session Lifecycle

### 1. Initialize
```javascript
const scorm = new SCOBot(options);
scorm.initialize();
```

### 2. Restore Previous Session
```javascript
const suspendData = scorm.getvalue('cmi.suspend_data');
if (suspendData) {
  const state = JSON.parse(suspendData);
  // Restore position, progress, interactions
}
```

### 3. Track Progress
```javascript
// After each page/interaction
scorm.setvalue('cmi.location', String(currentPage));
scorm.setvalue('cmi.suspend_data', JSON.stringify({
  position: currentPage,
  progress: progressObject,
  interactions: interactionsArray
}));
scorm.commit();
```

### 4. Finalize Course
```javascript
scorm.setvalue('cmi.completion_status', 'completed');
scorm.setvalue('cmi.success_status', isPassing ? 'passed' : 'failed');
scorm.setvalue('cmi.score.raw', String(score));
scorm.setvalue('cmi.score.scaled', String(score / 100));
scorm.commit();
```

### 5. Exit
```javascript
scorm.finish();  // Commits and terminates
```

## Debug Mode

Enable debug logging to see all SCORM communications:

### Via URL Parameter
```
http://localhost:3000/player?debug
```

### Via Config
In `src/core/config.js`:
```javascript
DEBUG: true  // Automatically true on localhost
```

### Console Output
With debug enabled, you'll see:
```
SCOBot: initialize()
SCOBot: getvalue('cmi.suspend_data')
SCOBot: setvalue('cmi.location', '3')
SCOBot: commit()
```

## Standalone Mode

When no LMS is detected, SCOBot's `use_standalone: true` option enables a **Mock API** that:
- Stores data in `localStorage`
- Simulates LMS responses
- Allows full testing without an LMS

The mock API logs to console:
```
API_1484_11: Initialized
API_1484_11: SetValue cmi.location = 3
```

## File Structure

```
src/
├── core/
│   └── course-state.js      # SCORM sync/restore logic
├── features/
│   ├── player/
│   │   └── player.js        # SCOBot initialization
│   └── templates/
│       ├── template-base.js # recordInteraction(), markComplete()
│       └── template-*.js    # Individual question types
data/
└── scobot.json              # Course content definition
```

## Course Content Format

The `scobot.json` file defines course structure:

```json
{
  "meta": {
    "title": "Course Title",
    "passingScore": 80,
    "scormVersion": "2004"
  },
  "settings": {
    "requireAnswerToAdvance": true,
    "showFeedback": true
  },
  "pages": [
    {
      "id": "unique-id",
      "type": "choice",
      "question": "...",
      "choices": [...],
      "weight": 1
    }
  ]
}
```

## Supported Template Types

| Type | Description | Interaction Type |
|------|-------------|------------------|
| `title-page` | Intro/section headers | None (auto-complete) |
| `choice` | Multiple choice/select | `choice` |
| `match` | Drag-and-drop matching | `matching` |
| `wordpuzzle` | Fill-in-the-blank | `fill-in` |
| `scorecard` | Results summary | None (finalizes course) |

## Packaging for LMS

Use the included packaging tool:
```bash
node tools/scorm-package.js
```

This creates a SCORM-compliant ZIP with:
- `imsmanifest.xml` - Package manifest
- `adlcp_rootv1p2.xsd` - Schema files
- Course content files

## Troubleshooting

### "scorm.set is not a function"
Use `setvalue()` not `set()`:
```javascript
scorm.setvalue('cmi.location', '5');  // ✓
scorm.set('cmi.location', '5');       // ✗
```

### Data not persisting
1. Check `scorm.isConnectionActive()` returns true
2. Call `scorm.commit()` after setting values
3. Verify `use_standalone: true` for local testing

### Session not restoring
1. Check `cmi.suspend_data` is being saved
2. Verify JSON.parse doesn't throw on restore
3. Ensure restore runs BEFORE first render

### Score showing 0%
1. Interactions must have `result: 'correct'` or `'incorrect'`
2. Weight values are parsed with `parseFloat()`
3. Check interactions array is being restored

## Resources

- [SCOBot Documentation](https://github.com/cybercussion/SCOBot)
- [SCORM Overview](https://scorm.com/scorm-explained/)
- [SCORM 2004 Data Model](https://scorm.com/scorm-explained/technical-scorm/run-time/run-time-reference/)
- [ADL SCORM Resources](https://adlnet.gov/projects/scorm/)

## License

SCOBot is available under the MIT License.
