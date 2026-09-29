---
name: check
description: Runs every project check (question bank, logic tests, browser smoke test) and summarizes what failed. Use before committing, before handing work back, or when asked whether the project is green.
---

# /check

Run each step below from the repo root, in order. **Keep going after a failure** so that one run reports everything.

1. `node tests/validate.js`
2. `node tests/logic.js`
3. `NODE_PATH=$(npm root -g) node tests/smoke.js`

The smoke test needs Playwright. If it prints that Playwright is missing, report the step as skipped, not failed.

Also check by hand: if the diff touches a file the app loads (`index.html`, `css/`, `js/`, `icons/`, `manifest.webmanifest`), `CACHE` in `sw.js` must have changed too.

Finish with a summary table:

| Step     | Result  |
| -------- | ------- |
| validate | ✅ / ❌ |
| ...      |         |

For each failing step, show the first error with its `file:line` and give a one-line likely cause.

Don't fix anything unless the user asked you to.
