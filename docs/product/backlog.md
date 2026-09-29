# Backlog

Priority: **M**ust / **S**hould / **C**ould / **W**on't (MoSCoW).
Status: `idea` → `spec` → `approved` → `in progress` → `done`.

Priorities for `idea` rows are the product strategist's proposal (29 September 2026) and still need the user's approval. R1 / R2 = review round 1 / round 2 in `docs/product-review/`.

## Candidates

| Feature | Priority | Status | Spec |
| ------- | -------- | ------ | ---- |
| Accessibility High: exam time choice (30 min / extended / none) and spoken 5- and 1-minute warnings (R2-a11y 1) | M | idea | |
| Accessibility High: move focus to the `<h1>` / question after each render and route change (R2-a11y 2) | M | idea | |
| Accessibility Medium: flashcard keys only inside the card; vehicle focus ring; dark badges; input borders; spiekbriefje reflow at 320px (R2-a11y 3–7) | M | idea | |
| Accessibility Low: green contrast, unique button names, answer state not only by colour, `aria-invalid` on number input (R2-a11y 8–12) | S | idea | |
| Same-day practice of open mistakes; resolve only on a second day (R2-Ahmed) | M | idea | |
| Result screen: score per topic, change since last mock exam, link to practise weak topics (R2-Ahmed, instructor) | M | idea | |
| Result screen: say that hazard perception and photo questions are not covered, next to the pass line (R2-Ahmed) | S | idea | |
| `store.js` hardening: skip `__proto__` keys, validate and cap `exams`, reject invalid `examDate` (R2-security 4, 5, 9) | M | idea | |
| Service worker: `cache:'reload'` on install, network timeout, deep-path offline fallback (R2-security 8) | C | idea | |
| Short privacy note: data stays on device, no tracking, GitHub Pages sees IP, how to delete (R2-security) | S | idea | |
| Content fixes after checking against the law: `k-blinden`/`i-blinde`, `n-zebra-stilstaan`, `inhaalverbod`, `autoweg`, `k-inrit`, `i-rotonde-oprijden` (R2-instructor) | M | idea | |
| Verify the exam-format claim word for word against cbr.nl (R1, R2-instructor) | M | idea | |
| Open mistakes list shows the correct answer; move "Alle voortgang wissen" to a settings area (R2-Ahmed) | S | idea | |
| Small UI: stray highlight on first exam option, units in Nakijken, hide nav during the exam, date input format (R2-Ahmed) | S | idea | |
| Retake mode: "is this a retake? last score?" onboarding that seeds weak topics (R2-Ahmed) | S | idea | |
| Exam-date plan: plan size and mock exams scale with days left; daily target line (R2-Ahmed, instructor) | S | idea | |
| Readiness indicator from last 3 mock exams, topic accuracy and open mistakes (R1-PM, R2-market) | S | idea | |
| Rewrite distractors in CBR style (2–3 plausible options, even lengths) (R1, R2-instructor) | S | idea | |
| More voorrang scenarios (tram turning, fietspad, rotonde with fietsers, uitrit, voorrangsvoertuig; mark "jij"), target 40+ (R1, R2-instructor) | S | idea | |
| More signs to ~100+, including onderborden and zones, plus road markings (R1, R2-instructor) | S | idea | |
| Remove near-duplicate questions (R2-instructor) | C | idea | |
| Hazard perception with still SVG scenes ("remmen / gas los / niets"), timed (R1, R2-instructor, R2-market bet 1) | S | idea | |
| Photo / driver's-view illustration questions, hotspot and drag questions (R1, R2-instructor) | C | idea | |
| Static SEO pages per rule / sign / number, generated from the data (R1, R2-market) | C | idea | |
| Instructor link: progress snapshot via code/QR or export file, and homework topic sets (no backend) (R2-instructor, market) | C | idea | |
| Progress export and import (R1, R2-security) | C | idea | |
| B1 plain-language pass on the ~30 hardest prompts; tap-to-define glossary; "Bron" behind a toggle (R2-Ahmed, market) | C | idea | |
| English mode (R2-market) | C | idea | |
| Evening reminder (R2-Ahmed) — needs push, likely a backend | W | idea | |
| Class dashboard for schools/instructors with live sync — needs a backend (R2-market) | W | idea | |
| Paid tier / donations link (R2-market) | W | idea | |

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
