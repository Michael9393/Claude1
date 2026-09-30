# Backlog

Priority: **M**ust / **S**hould / **C**ould / **W**on't (MoSCoW).
Status: `idea` → `spec` → `approved` → `in progress` → `done`.

Priorities now reflect the user's answers of **30 September 2026** (see [vision.md](vision.md#decisions-from-the-user-30-september-2026)): a personal study tool for one first-time candidate who wants to pass the CBR theory exam B on the first try; no backend for now; GitHub Pages on a shared `username.github.io` origin; content checked by subagents/Codex; Dutch only; own use only. **Question 9 (MoSCoW) was not answered, so these priorities are the product strategist's proposal** and still need the user's approval.

Rule used: anything that raises the user's own chance of passing first time goes up; growth, instructor, monetisation and multi-user features go to Won't. Rows are in proposed build order. R1 / R2 = review round 1 / round 2 in `docs/product-review/`.

## Candidates

| # | Feature | Priority | Status | Spec | Why this priority |
| - | ------- | -------- | ------ | ---- | ----------------- |
| 1 | Verify the exam-format claim word for word against cbr.nl (R1, R2-instructor) | M | done | [verificatie](../verificatie.md) | Confirmed 30 Sep 2026 via search summaries of cbr.nl (50 questions, 30 min, 44 to pass; +2 unscored test questions). cbr.nl itself was blocked. | The mock exam and readiness signal are only as good as the format they copy; cheap. |
| 2 | Content fixes after checking against the law: `k-blinden`/`i-blinde`, `n-zebra-stilstaan`, `inhaalverbod`, `autoweg`, `k-inrit`, `i-rotonde-oprijden` (R2-instructor) | M | done | [verificatie](../verificatie.md) | Checked 30 Sep 2026: app right on 4 points, partly right on the rotonde (source fixed), and an extra error found and fixed ("harder dan 60" → "minstens 60"). | No human expert checks content; a wrong fact costs points on the real exam. |
| 3 | Result screen: score per topic, change since last mock exam, link to practise weak topics (R2-Ahmed, instructor) | M | spec | [exam-ready-loop](specs/exam-ready-loop.md) (part A) | Tells the user where the points are lost; basis for readiness. |
| 4 | Same-day practice of open mistakes; resolve only on a second day (R2-Ahmed) | M | spec | [exam-ready-loop](specs/exam-ready-loop.md) (part A) | Fixes a gap while it is fresh; still needs a second day to count as learned. |
| 5 | Exam-date plan for a first-timer: plan size and number of mock exams scale with days left; daily target line (R2-Ahmed, instructor) | M | spec | [exam-ready-loop](specs/exam-ready-loop.md) (part B) | Answers "what do I do today?" against a real deadline. |
| 6 | Readiness indicator from last 3 mock exams, topic accuracy and open mistakes; shows the success bars (≥46/50, topic mastery) (R1-PM, R2-market) | M | spec | [exam-ready-loop](specs/exam-ready-loop.md) (part B) | A first-timer has no earlier score; this is the "am I ready to book / sit it?" signal. |
| 7 | Hazard perception with still SVG scenes ("remmen / gas los / niets"), timed (R1, R2-instructor, R2-market bet 1) | M | idea | | Part of the real exam and not covered at all today; biggest content gap. Effort L. |
| 8 | Rewrite distractors in CBR style (2–3 plausible options, even lengths) (R1, R2-instructor) | S | idea | | Makes mock scores a truer predictor; easy options inflate readiness. |
| 9 | Result screen: say that hazard perception and photo questions are not covered, next to the pass line (R2-Ahmed) | S | spec | [exam-ready-loop](specs/exam-ready-loop.md) (AC-8) | Keeps the readiness signal honest; tiny. Can ride along with #3. |
| 10 | More voorrang scenarios (tram turning, fietspad, rotonde with fietsers, uitrit, voorrangsvoertuig; mark "jij"), target 40+ (R1, R2-instructor) | S | idea | | Voorrang is up to 6 exam questions; more variety, less memorising of pictures. |
| 11 | More signs to ~100+, including onderborden and zones, plus road markings (R1, R2-instructor) | S | idea | | Signs appear in many exam questions; current set is thin. |
| 12 | Open mistakes list shows the correct answer; move "Alle voortgang wissen" to a settings area (R2-Ahmed) | S | idea | | Faster review; prevents wiping own progress by accident. |
| 13 | Small UI: stray highlight on first exam option, units in Nakijken, hide nav during the exam, date input format (R2-Ahmed) | S | idea | | Small frictions in the exam flow the user uses most. |
| 14 | Exam timer: spoken/visible 5- and 1-minute warnings (R2-a11y 1, part) | S | idea | | Useful for any user practising time management under real exam conditions. |
| 15 | After each render and route change: move focus/scroll to the `<h1>` / question (R2-a11y 2) | S | idea | | On a phone the next question can start scrolled off-screen; a usability issue, not only screen-reader. |
| 16 | Accessibility Medium, phone-relevant part: dark badges, input borders, spiekbriefje reflow at 320px (R2-a11y 5–7) | S | idea | | Visible on the user's own phone, especially in dark mode. |
| 17 | Progress export and import (R1, R2-security) | S | idea | | Only copy of progress lives in one browser; Safari can clear site storage for sites not used for 7 days unless installed to the home screen ([WebKit](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)). |
| 18 | `store.js` hardening: skip `__proto__` keys, validate and cap `exams`, reject invalid `examDate` (R2-security 4, 5, 9) | S | idea | | Protects the user's own data; other apps on the shared `github.io` origin can read and write the same `localStorage`. Invalid `examDate` also breaks the plan (#5). |
| 19 | Service worker: `cache:'reload'` on install, network timeout, deep-path offline fallback (R2-security 8) | S | idea | | Stale cache after updates would hide content fixes (#2); offline study must work. Scope stays limited to this repo's path on the shared origin. |
| 20 | Remove near-duplicate questions (R2-instructor) | C | idea | | Duplicates waste practice time but do not teach anything wrong. |
| 21 | Photo / driver's-view illustration questions, hotspot and drag questions (R1, R2-instructor) | C | idea | | Covers exam question types, but effort is high and hazard perception (#7) matters more. |
| 22 | Accessibility: exam time choice (extended / none) (R2-a11y 1, part) | C | idea | | The user should practise at the real 30 minutes; an untimed mode is a nice-to-have for learning. |
| 23 | Accessibility Medium, keyboard part: flashcard keys only inside the card; vehicle focus ring (R2-a11y 3–4) | C | idea | | Keyboard-only issues; the user studies on a phone. |
| 24 | Accessibility Low: green contrast, unique button names, answer state not only by colour, `aria-invalid` on number input (R2-a11y 8–12) | C | idea | | Minor for a sighted phone user; cheap to batch with other UI work. |
| 25 | Retake mode: "is this a retake? last score?" onboarding that seeds weak topics (R2-Ahmed) | W | idea | | The user is a first-timer; readiness (#6) covers the same need. |
| 26 | Short privacy note: data stays on device, no tracking, GitHub Pages sees IP, how to delete (R2-security) | W | idea | | Own use only; the user already knows where the data is. |
| 27 | Static SEO pages per rule / sign / number, generated from the data (R1, R2-market) | W | idea | | Growth is a non-goal. |
| 28 | Instructor link: progress snapshot via code/QR or export file, and homework topic sets (R2-instructor, market) | W | idea | | No instructor in the loop. |
| 29 | B1 plain-language pass on the ~30 hardest prompts; tap-to-define glossary; "Bron" behind a toggle (R2-Ahmed, market) | W | idea | | Built for a B1 learner; the user reads Dutch fluently. |
| 30 | English mode (R2-market) | W | idea | | Dutch only (user, answer 7). |
| 31 | Evening reminder (R2-Ahmed) — needs push, likely a backend | W | idea | | Needs a backend, which is undecided; the daily plan covers the habit. |
| 32 | Class dashboard for schools/instructors with live sync — needs a backend (R2-market) | W | idea | | Multi-user and needs a backend. |
| 33 | Paid tier / donations link (R2-market) | W | idea | | Own use only, no money (user, answer 8). |

## Already shipped (round 1 fixes, 28 September 2026)

| Feature | Priority | Status | Spec |
| ------- | -------- | ------ | ---- |
| Mock exam in current CBR format: 50 mixed, 30-minute timer, 44 to pass, max 6 voorrang | M | done | |
| Fix "Stoppen" in the exam and number parsing (3.500 / 3 500, invalid input) | M | done | |
| Mobile menu wraps; Flashcards table becomes a list | M | done | |
| Dark-mode contrast and readable green/red buttons | M | done | |
| Accessibility round 1: sign labels (neutral in quiz), vehicle descriptions, live feedback, `aria-current`, page titles | M | done | |
| Flashcard "wist ik niet" no longer a mistake; mistake resolved on two different days; calendar-day due dates | M | done | |
| Voorrang: titles hidden until solved, correct order drawn afterwards, "Opnieuw kiezen" disabled | M | done | |
| Guard against leaving a running exam | M | done | |
| "Vandaag" plan on the start page, value proposition, legal source under each explanation | M | done | |
| Saved-data hardening: version field, type checks, escaping, CSP, cross-tab sync | M | done | |
| Installable and offline: manifest, icons, network-first service worker | M | done | |
| Behaviour tests (`tests/logic.js`) and pool-size check in `tests/validate.js` | S | done | |
| Content corrections `k-alarm`, `i-licht-bord`, `n-seconden` | M | done | |
| Service worker only deletes its own `theorie-b-` caches (round 2 fix) | M | done | |
