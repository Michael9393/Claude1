---
name: check
description: Runs every project check (lint, format, typecheck, tests, build) and summarizes what failed. Use before committing, before handing work back, or when asked whether the project is green.
---

# /check

Run each step below from the repo root, in order. **Keep going after a failure** so that one run reports everything.

1. `npm run lint`
2. `npm run format:check`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

If `node_modules` is missing, run `npm ci` first.

Finish with a summary table:

| Step | Result  |
| ---- | ------- |
| lint | ✅ / ❌ |
| ...  |         |

For each failing step, show the first error with its `file:line` and give a one-line likely cause.

Don't fix anything unless the user asked you to. The exception is a `format:check` failure: `npm run format` fixes it safely, so offer that.
