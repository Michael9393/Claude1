# Product team review (28 September 2026)

Five reviewers looked at the app independently, each from a different angle. Three of them (UX, learner, engineering) ran the app in Chromium at phone and desktop sizes. This page combines their findings; the full reviews are linked below.

| # | Role | Focus | Full review |
|---|---|---|---|
| 1 | Product manager | Positioning, competitors, feature gaps, roadmap | [1-product-manager.md](1-product-manager.md) |
| 2 | UX/UI designer | Layout, dark mode, accessibility, microcopy | [2-ux-design.md](2-ux-design.md) |
| 3 | Learner persona ("Sanne", 17, exam in 3 weeks) | First session plus a day-3 return, on a phone | [3-learner-persona.md](3-learner-persona.md) |
| 4 | Engineering / QA lead | Bugs, edge cases, data, offline, tests | [4-engineering-qa.md](4-engineering-qa.md) |
| 5 | Content & learning expert | Match with the real exam, coverage, question quality, learning design | [5-content-learning.md](5-content-learning.md) |

Screenshots that the reviews mention were taken during the review and are not in the repo.

## Verdict

The app is strong on the basics: the questions are sourced from the law, the voorrang exercise is fun, and it is free, has no ads and needs no account. But **the mock exam uses a CBR format that no longer exists**, and several mobile and data bugs get in the way of daily use. As one reviewer put it: *"Free and handy for signs and voorrang, but no photos or timer, so use it alongside something else."*

## Findings several reviewers agreed on

1. **The mock exam format is out of date (blocker; PM, content, learner).** Since 7 April 2025 the CBR theory exam B is one mixed block of **50 questions in 30 minutes, with 44 needed to pass**, and hazard perception is built in as animations. The app still runs 12 kennis (10 to pass) + 28 inzicht (25 to pass), has no timer, and describes gevaarherkenning as a separate 25/13 part (`js/app.js:423-431`). The text "Net als het echte examen" is wrong, and so a "Geslaagd" result says little about readiness. *Source note: cbr.nl was blocked from the review environment, so the format comes from several secondary sources that agree (see review 5). Check it on cbr.nl before changing the app.*
2. **The question pool is too small for repeated exams (PM, content, learner).** Every exam draws 10 of only 15 voorrang scenarios and 18 of 72 inzicht questions. By the third exam learners recognise the drawings instead of working out the answer. The scenario titles in the list give the answer away (for example "Van rechts gaat voor").
3. **You can pass by picking the longest answer (content, learner).** The correct answer is the longest option in about 61% of multiple-choice questions. Many wrong options are jokes nobody would pick (for example "Toeteren" appears in 10 questions).
4. **The mobile layout is broken (UX, learner).** The top menu hides "Proefexamen" and "Fouten" off-screen, with no sign that it scrolls. The Flashcards table makes the page scroll sideways, and its Start buttons are cut off.
5. **Progress and mistakes are counted in a way that feels wrong (content, learner, engineering).**
   - A flashcard answered with "wist ik niet" is logged as a mistake, so being honest makes the mistake count go up.
   - One round of "Oefen mijn fouten" can never resolve a mistake, because each item appears only once and needs two correct answers in a row. After 22 of 23 correct, 18 of 20 mistakes were still open.
   - "Beheerst" can be reached in about 3 days.
   - There is no "am I ready?" signal, and nothing tells the learner what to do today.
6. **It is not a real offline app yet (PM, engineering).** There is no manifest, service worker or icon, so a hosted copy needs the network and can't be installed on a phone. Progress lives only in localStorage, and there is no export or import.

## Confirmed bugs

| Severity | Bug | Where |
|---|---|---|
| High | The "Stoppen" button in the exam does nothing, because it sets `#/examen` while the page is already on it, so the page never reloads | `js/app.js:461` |
| High | "3.500" or "3 500" is read as 3.5 or 3, so correct answers to the kg questions are marked wrong. Junk like "3500abc" is accepted | `js/app.js:22` (`parseNum`) |
| High | In dark mode the white text on the "Wist ik" / "Wist ik niet" buttons is barely readable (contrast 1.98:1 and 2.51:1) | `css/style.css:28-30,85-86` |
| High | Sign images have no accessible names. In "betekenis → bord" mode a screen reader hears empty buttons | `js/data/signs.js:10` |
| Med | Browser Back or any menu tap loses a running exam without warning | router, `js/app.js:560-574` |
| Med | Flashcard due dates are exact to the millisecond instead of by calendar day, so reviews can come a day late | `js/store.js:61` |
| Med | Broken or old saved data (for example `"stats": null`) leaves pages blank; there is no version field or check | `js/store.js:13-24` |
| Med | Two open tabs overwrite each other's progress | `js/store.js` |
| Low-Med | Stored XSS: the saved exam date and scores go into `innerHTML` unescaped | `js/app.js:258,266,435` |
| Low | The start screen counts mistakes for questions that no longer exist; opening `#/__proto__` throws an error; focus is lost in the voorrang exercise | see review 4 |

## Content corrections to check

- `k-alarm`: the cited article does not support "heel langzaam rijdt".
- `i-licht-bord`: the explanation overgeneralises art. 64, as if a green light overrides any sign.
- `n-seconden`: says "moet" for what is only advice.

## Status

All seven "Now" items below are done (28 September 2026), plus the three content corrections, the low-severity bugs and most medium UX issues:

- **Exam:** 50 mixed questions, a 30-minute timer and 44 to pass. Unanswered questions count as wrong. Voorrang is limited to 6 per exam, and results in the old format still show in the history.
- **Bugs:** "Stoppen" works; number input handles 3.500 and 3 500 and says when input is invalid; flashcard due dates count in calendar days.
- **Mobile menu:** it wraps onto two rows. The Flashcards table is now a list.
- **Dark mode and contrast:** darker accent colour and readable green/red buttons.
- **Accessibility:**
  - Signs have labels; in a quiz the label is neutral, so it doesn't give the answer away.
  - Vehicles are described (type, where from, where to).
  - Feedback is announced to screen readers.
  - `aria-current` in the menu and a page title per route.
- **Mistakes:** a flashcard "wist ik niet" no longer counts as a mistake. A mistake is resolved after correct answers on two different days.
- **Voorrang:**
  - Scenario titles are hidden until solved.
  - The correct order is drawn on the crossing after answering, and in the exam review.
  - "Opnieuw kiezen" is disabled after answering.
- **Exam guard:** the app asks before leaving a running exam, whether through the menu, Back or closing the tab.
- **"Vandaag":** a button on the start page, a short value proposition, and the legal source shown under each explanation.
- **Saved data:** version field, type checks and escaping. A Content-Security-Policy is added, and progress from another tab is picked up.
- **Installable and offline:** manifest, icons and a network-first service worker.
- **Tests:** behaviour tests in `tests/logic.js`. `tests/validate.js` now requires a pool at least twice the size of one exam.

Not yet done: everything under Next and Later. See [round 2](round-2/README.md) for a second, independent review of the fixed app.

## Recommended roadmap

**Now (each small, S):**
1. Rebuild the mock exam as 50 mixed questions with a 30-minute timer and 44 to pass. Update the exam page text and the README, and add the exam format to `docs/verificatie.md`.
2. Fix the two high-severity bugs (Stoppen, number parsing), dark-mode contrast and the sign labels.
3. Fix the mobile menu (wrap it or use a bottom bar) and the Flashcards table overflow.
4. Stop logging flashcard "wist ik niet" as a mistake. Space out mistake resolution, for example the second correct answer must come on another day.
5. Remove answers from the voorrang scenario titles. Ask before leaving a running exam.
6. Add a "Vandaag" button on the start screen (due cards + open mistakes + one weak topic) and a short value proposition.
7. Harden saved data (version field, type checks, escaping) and make the app installable (manifest, service worker, icons).

**Next (medium, M):**
- A readiness score based on the last 3 timed mock exams, accuracy per topic, and open mistakes. Show honestly that hazard perception is not covered.
- Rewrite wrong answer options around real misconceptions and even out answer lengths.
- Grow the pool: 40 or more voorrang scenarios, about 120 signs plus road markings, and more inzicht questions.
- Progress export and import, streaks.
- Behaviour tests with `node:test` for parsing, scheduling, mistakes and scoring, plus a Playwright smoke test in CI.

**Later (large, L):**
- Hazard perception scenes. Start with still images ("remmen / gas los / niets") built on `js/intersection.js`.
- Hotspot and drag questions, and pictures from the driver's view.
- Static SEO pages for signs and numbers, and a mode for driving schools.

## What works well

- Every answer is backed by a source in the law. No competitor offers this, and it should be the app's main selling point.
- The voorrang exercise, where you tap vehicles on a drawn crossing, is fun and teaches well.
- The signs quiz, the "spiekbriefje" and the per-topic mistake log are useful.
- There is feedback with an explanation right after each answer, and the design is consistent.
- The disclaimer that it is not official CBR material is honest.
- No console errors on valid routes, correct answer shuffling, fast rendering, and `lang="nl"`.
