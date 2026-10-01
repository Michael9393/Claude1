# CLAUDE.md

Notes for Claude Code when working in this repository.

## What this is

Theorie B: a Dutch study app for the CBR theory exam B (car). The UI text is in Dutch; code comments are in Dutch too. See `README.md` for features and `docs/verificatie.md` for how the question bank is checked against the law.

## Stack

- Plain HTML, CSS and JavaScript (ES5-style IIFEs on `window.RB`). No framework, no build step, no npm dependencies.
- Progress in `localStorage` (`js/store.js`). Offline and installable via `sw.js` and `manifest.webmanifest`.
- Tests: plain Node scripts in `tests/`. Browser checks use the globally installed Playwright (`NODE_PATH=$(npm root -g)`).

## Layout

- `index.html` loads the scripts in order: `js/util.js`, `js/data/*.js`, `js/store.js`, `js/intersection.js`, `js/app.js`.
- `js/util.js`: pure helpers without DOM (number parsing, dates), tested in `tests/logic.js`.
- `js/store.js`: all saved state; `clean()` validates whatever is in storage.
- `js/app.js`: views (one `views.<route>` per menu item), the question renderer, sessions, exam and router.
- `js/intersection.js`: SVG right-of-way crossings.
- `js/data/`: `questions.js` (every question has a `source`), `signs.js`, `voorrang.js`.
- `css/style.css`: design tokens as custom properties on `:root`, with a dark-mode override.
- `docs/product/`: vision, backlog and specs. `docs/product-review/`: review rounds. `docs/HANDOVER.md`: state of the work for a new session.

## Commands

- Serve: `python3 -m http.server 8000` (or open `index.html` directly).
- `node tests/validate.js`: question bank checks.
- `node tests/logic.js`: behaviour tests for util and store.
- `node tests/smoke.js`: browser smoke test of every route and the main flows (needs Playwright).
- `/check`: runs all three and summarizes.

Before committing, run `/check`. After changing any file the app loads, bump `CACHE` in `sw.js`.

## Conventions

- Match the surrounding code: `var`, function expressions, IIFEs, no modules, no dependencies.
- Always escape data that goes into `innerHTML` with `esc()`; cast stored numbers with `Number()`.
- Keep DOM-free logic in `js/util.js` or `js/store.js` so it can be tested with Node.
- Every question needs a `source`; content changes must be checked against the law text and noted in `docs/verificatie.md`.
- Colours as tokens in `css/style.css`, contrast at least 4.5:1 for text in light and dark mode. Mobile-first from 320px.

## Team workflow

The main session acts as **project manager and architect**. It breaks work into tasks, delegates each one to a subagent (`.claude/agents/`), and reviews what comes back. Nothing gets built without an approved spec.

**1. Discover (what to build)**

1. `product-strategist`: brainstorm options, pick an MVP, then update `docs/product/vision.md` and `docs/product/backlog.md`.
2. `/spec <feature>`: `requirements-analyst` drafts `docs/product/specs/<feature>.md`, and `user-advocate` critiques it.
3. The user answers the spec's open questions and approves it. Its status becomes `approved`.

**2. Build (how to build it)**

1. `ui-ux-designer`: design proposal for the screens in the spec.
2. `frontend-developer`: implements it against the acceptance criteria.
3. `test-engineer`: gives every acceptance criterion a test and covers the edge cases.
4. `ponytail`: trims dead code and duplication without changing behavior.
5. `code-reviewer`: read-only review; blockers go back to the developer.
6. `/check`: everything green, then commit and mark the backlog item `done`.

Skip steps that don't apply: a small bug fix doesn't need a designer.

### Tools

- `/check`: runs the data checks, logic tests and browser smoke test, then summarizes failures.
- `/spec <feature idea>`: drafts and critiques a spec.
