# Engineering / QA review: Theorie B

**Method:** I read all the JS, CSS and HTML, ran `node tests/validate.js` (OK: 28 signs, 200 questions, 15 scenarios) and drove the app with Playwright (Chromium) against `python3 -m http.server`. That covered every route, corrupt storage, a fake clock, a full exam with double-clicks, two tabs and number input. Every bug below was reproduced unless it is marked *speculative*.

## Confirmed bugs

| # | Sev | Bug | Where | Repro | Fix |
|---|---|---|---|---|---|
| 1 | **High** | **"Stoppen" in the exam does nothing.** It sets `location.hash = '#/examen'`, but the hash is already `#/examen`, so no `hashchange` fires. The exam carries on at "1 / 12". | app.js:461 | Proefexamen → Start → Stoppen → OK. You are still in the exam. | Call `route()` or `views.examen()` directly, as the fouten practice already does at app.js:541. |
| 2 | **High** | **Dutch thousands separator is marked wrong.** `parseFloat("3.500")` gives 3.5, and "3 500" gives 3. Affects n-massa, n-combinatie (3500) and n-code96 (4250). The wrong answer is logged as a mistake, with "3,5" as the given answer. | app.js:22-25 | Getallen → maximum mass → type `3.500`. Result: "Helaas, fout". | Remove spaces. Treat `.` followed by exactly 3 digits as a thousands separator. Match against `/^-?\d+([.,]\d+)?$/` after removing the unit. Add unit tests. |
| 3 | Med | **Leitner due times use exact milliseconds, not calendar days.** A card you knew at 21:00 has `due` = next day 21:00. At 19:00 the next day it is not due (0 due, confirmed with a fake clock). If someone studies at different times each day, intervals slip by a day. | store.js:61 | Fake clock: review deck at 21:00. Next day 19:00: "Te herhalen 0". | `due = startOfLocalDay(now) + interval*DAY`. |
| 4 | Med | **The exam is lost without warning on Back or nav clicks.** Only the Stoppen button asks for confirmation (and it is broken, see #1). Back, any nav link, or re-clicking "Proefexamen" silently throws away the answers. | app.js:560-574 | Start exam → answer one → browser Back. You land on start and the exam is gone. | Keep an `activeExam` flag. Show a `confirm()` in the router, add `beforeunload`, and optionally save progress to sessionStorage. |
| 5 | Med | **Two open tabs overwrite each other.** State is read once at load and the whole object is written back on each save (last write wins). | store.js:13-24 | Tab A logs a mistake, then tab B answers something. A's mistake is gone (confirmed). | Re-read before writing and merge, or listen to the `storage` event and reload the state. |
| 6 | Med | **A few bad fields in storage crash the app.** Loading does `Object.assign(empty(), parsed)` with no type checks. `{"stats":null}` makes start crash. `{"exams":null}` makes start and examen crash. `{"mistakes":null}` makes start and fouten crash. The page stays blank and nothing recovers it. The storage key has no schema version or migration. | store.js:14-20 | Set the key and reload. | Check each field's type and fall back to the default. Add a `version` field and a migration step. |
| 7 | Low-Med | **Stored XSS via localStorage.** `st.examDate` goes into an attribute without escaping (app.js:258). `e.kennis`/`e.inzicht` (app.js:435, 266) and `m.count` (533) also go in raw. Confirmed: the payload runs on start and examen. On GitHub Pages every repo of the user shares the `user.github.io` origin, so any other page there can write this key. | as listed | Put `examDate: '"><img src=x onerror=…>'` in storage. | Pass them through `esc()`, or coerce to Number / validate the date. Add a CSP meta tag. |
| 8 | Low | **Wrong count of open mistakes on start.** `openMistakes()` counts ids that no longer exist in the data, but the fouten view filters them out. Start showed "1 open fouten" while fouten said "Nog geen fouten". This will happen whenever a question id is renamed. | store.js:50, app.js:248 vs 502 | Add an unknown id to `mistakes`. | Filter on `RB.items`, or prune unknown ids when the app loads. |
| 9 | Low | **`#/__proto__` throws** `views[name] is not a function`. `#/constructor` passes the check and renders nothing. | app.js:562 | Open `#/__proto__`. | `Object.prototype.hasOwnProperty.call(views, name)`, or `Object.create(null)`. |
| 10 | Low | **Keyboard focus is lost after picking a vehicle**, because `innerHTML` rebuilds the SVG and focus ends up on `BODY`. Keyboard users have to tab back in after every pick. | app.js:137-138 | Tab to a vehicle and press Enter. | Restore focus to the same `data-id` after the redraw. |

**Also from the code:**
- **"Twee keer achter elkaar goed" logic.** It works (wrong, right, right → resolved, confirmed). But answers from every mode count toward it, including the flashcard self-report "Wist ik", so a mistake can be cleared without a real answer (store.js:42-46). A single "Oefen mijn fouten" round shows each item once, so it can never resolve anything on its own. That is a product decision, but the UI should say so.
- **Number input is too lenient.** "3500abc", "3,5e3" and "3500 kg" are all accepted. That is fine for units, but not for garbage input.
- A wrong flashcard is not shown again within the same session.
- *Speculative:* exam choices have no `aria-pressed`, and feedback has no `aria-live`.

**Checked and fine:**
- Shuffling is a correct Fisher-Yates. Correctness is fixed by the original index before the shuffle, and the Ja/Nee order is kept.
- Sign distractors fill in from other groups when a group is too small (the smallest group has 4).
- Double-clicking "Volgende" through a full 40-question exam gives exactly 40 answers and 1 exam record.
- No console errors on any valid route.
- Render time is under 1 ms. The total download is about 155 KB, uncompressed.

## Offline / PWA
There is no manifest, service worker, `theme-color` or icons (confirmed). The README says it "works offline", but that is only true for `file://`. A hosted copy does not load without a network, and you cannot install it to a phone home screen. **Quick win:** add a manifest, a cache-first service worker with about 10 static files and a versioned cache name, plus icons. That is about 40 lines.

## Structure and maintainability
- **Good:** no dependencies, a small readable IIFE per module, all data in one namespace (`RB`), `esc()` used for most data.
- **Weak:**
  - app.js (576 lines) mixes rendering, state and routing, and builds HTML by string concatenation, so escaping is easy to forget (see #7).
  - Views keep closure state that the router can't see, which causes #1 and #4.
  - The same 12/28 and 10/25 numbers are hard-coded next to `EXAM` (app.js:266, 435, 485-486).
  - `m.topic` is stored but never read.
  - Global stats count flashcard self-reports as answers.
- **Suggest:** move pure logic (`parseNum`, `buildChoices`, Leitner, mistake resolution, exam scoring) into a `logic.js` that can be tested without the DOM.

## Test coverage
`tests/validate.js` only checks data integrity (ids, fields, counts), and it does that well. There are **no behaviour tests**: nothing covers `parseNum`, the scheduler, mistake resolution, exam scoring and pass rules, storage loading and migration, or the router. Every bug above would have been caught by a small `node:test` suite loading store.js/app.js logic through `vm` with a fake `localStorage` and `Date`, plus one Playwright smoke test (all routes with no errors, one full exam, Stoppen). Add a CI workflow that runs both.

## Security
- There is no network I/O and no third-party code, so the attack surface is small.
- The only real issue is #7: data from storage goes into `innerHTML` unescaped.
- Sign SVGs are trusted data inserted raw. That is acceptable, but document it.
- Add a `Content-Security-Policy` meta tag: `default-src 'self'; style-src 'self' 'unsafe-inline'`. It blocks inline handlers such as `onerror`.

## Quick wins (under 1 hour each)
1. Fix Stoppen (#1): one line.
2. Make `parseNum` handle thousands separators and reject garbage (#2), with tests.
3. Due dates at day boundaries (#3).
4. Confirm on navigation during an exam, plus `beforeunload` (#4).
5. Type-safe storage loading with a version field (#6), and prune unknown mistake ids (#8).
6. `esc()`/Number on all values from storage, plus a CSP (#7).
7. `hasOwnProperty` in the router (#9).
8. Manifest and service worker.
9. Behaviour tests and CI.
