# Product review, round 2 (28 September 2026)

After the fixes from [round 1](../README.md), a new team reviewed the app. None of them had seen the first review. Four of them ran the app in Chromium; the market analyst worked from web research.

| # | Role | Focus | Full review |
|---|---|---|---|
| 1 | Driving instructor | Correct content, would I recommend it to my students | [1-driving-instructor.md](1-driving-instructor.md) |
| 2 | Accessibility specialist | WCAG 2.2 AA audit: keyboard, screen reader, contrast, timer | [2-accessibility.md](2-accessibility.md) |
| 3 | Learner persona "Ahmed" (24, Dutch as a second language, retaking in 10 days) | Three simulated evenings on a 360px phone | [3-learner-ahmed.md](3-learner-ahmed.md) |
| 4 | Security & privacy | XSS, service worker, shared GitHub Pages origin, GDPR | [4-security-privacy.md](4-security-privacy.md) |
| 5 | Competitor analyst | Market, positioning, growth without a budget | [5-market.md](5-market.md) |

## Verdict

The basics are now solid:
- The instructor checked every number and found no errors.
- No XSS was found, and the CSP blocks inline code.
- Ahmed went from 38/50 to 43/50 in three evenings and found the 30-minute timer and the pass mark of 44 realistic.

But the app covers only about a third of what the exam tests. There is no hazard perception, no photo questions, only 28 signs and only 15 crossings. It does nothing yet for two groups the reviewers named: learners short on time and instructors. The honest pitch is still **"the free second tool next to your theory book"**. The market analyst sees that as a real niche: careful learners, people retaking the exam, schools, and people learning Dutch.

## Fixed during this round

- **The service worker deleted other sites' caches (Medium, a regression from round 1).** On `username.github.io` all repos share one origin, and `sw.js` wiped every cache it didn't own. It now only touches caches that start with `theorie-b-`. It looks only in its own cache when offline, fetches fresh files on install, and waits for cache writes to finish. Tested: another site's cache survives an update, and the app works offline.

## What to do next

### Findings from several reviewers

1. **Give the exam date a job (Ahmed, instructor).** Today it's only a countdown. It should drive the daily plan: bigger sessions and a mock exam every other day as the exam gets close. The start page should also ask "Is this a retake?".
2. **The "two different days" rule is too strict when cramming (Ahmed).** After one evening, 13 of 19 mistakes were locked until the next day. This rule was added in round 1. Better: allow practising the same day, but only resolve a mistake on a second day.
3. **Result screen (Ahmed, instructor).** Show a score per topic and the change since the last mock exam.
4. **Hazard perception, photo questions, more signs and crossings (instructor, market).** These are still the biggest gap. The market analyst ranks hazard perception as the number 1 product bet.
5. **Wrong options are too easy (instructor; also in round 1).** Rewrite them in CBR style, with 2–3 plausible options.

### Accessibility (WCAG 2.2 AA)

| Severity | Issue | Fix |
|---|---|---|
| High | 2.2.1: the 30-minute exam can't be extended or turned off, and there's no spoken warning | Choose 30 min / extended / no time limit before the start; announce at 5 and 1 minutes |
| High | 2.4.3 / 4.1.3: after every new screen focus is on `<body>`, and new questions aren't announced | Focus the `<h1>` (with `tabindex="-1"`) after each render |
| Med | 2.1.1 / 2.1.4: flashcard shortcuts catch Enter on the menu links, and 1/2 can't be turned off | Only react when focus is inside the card |
| Med | 1.4.11: vehicle focus ring is 1.22:1 on the road; input borders are 1.29:1 | White or thick focus ring; darker border |
| Med | 1.4.3: in dark mode the order number badges are 2.34:1 | Dark text on the orange badge |
| Med | 1.4.10: the spiekbriefje scrolls sideways at 320px | Let the units wrap |
| Low | Green #1f8a4c is 4.38:1; five buttons are all called "Start"; answers marked only by colour; number field missing `aria-invalid` | See review 2 |

### Security and privacy

- **Low: `__proto__` keys get past `clean()` in `store.js`.** Use `Object.create(null)` or skip that key.
- **Low: exam results in storage aren't checked.** For example, `passed: "false"` shows as "Geslaagd". Check the types, and cap the list at 50 on load.
- **Low: localStorage is shared with all your other GitHub Pages sites.** Use your own domain, or document it.
- **Offline deep links:** a deep path loads a broken page, and there is no network timeout.
- **Clickjacking:** only the wipe-everything action is sensitive, and it's behind `confirm()`.
- **Privacy:** there are no third parties, and a consent banner is not needed. Add a short privacy note: data stays on the device, no tracking, and how to delete it.

### Content to check (instructor)

These points come from the instructor. **Check each one against the law text before changing anything.** At least one of them looks doubtful:

- `k-blinden` / `i-blinde`: a white cane with red rings means someone who is deafblind; a blind person uses a plain white cane.
- `n-zebra-stilstaan`: the RVV says "op en binnen 5 m vóór" the crossing, not "binnen 5 m van".
- Sign *inhaalverbod*: according to the instructor you may not overtake bromfietsen. *To check:* as far as we know, the RVV (bijlage I, F1) makes an exception for overtaking two-wheeled motor vehicles, so the current text may be right.
- Sign *autoweg*: "harder dan 50" instead of "minstens 50".
- `k-inrit`: art. 18 instead of art. 54?
- `i-rotonde-oprijden`: giving a direction signal is a rule (art. 17), not advice.

### Language (Ahmed)

The language is mostly fine at B1 level, but some words and sentences are hard, for example "kinderbeveiligingsmiddel", "voor zover ze daarmee in strijd zijn" and "voeren" (for lights). Ideas:
- a plain-language pass
- tap a word to see what it means
- hide the "Bron" line behind a button
- show the correct answer in the list of open mistakes

### Instructors

Right now an instructor can't do anything with the app. They would recommend it with:
- a student code or progress export
- topics they can set as homework
- an overview of where the group is weak

### Market and growth (market analyst)

- **Competitors:** they charge €40–50, have 1,500+ questions and hazard-perception videos. This app can't compete on volume.
- **Unique points:**
  - every answer cites the law
  - no account, no ads, works offline
  - real learning design
- **Positioning:** *"Oefenen met bewijs: bij elk antwoord het wetsartikel."*
- **Growth without a budget:**
  - static SEO pages per rule, built from the existing data
  - posters and homework links for driving schools
  - MBO schools
  - NT2 and newcomer organisations
  - Reddit expat groups
  - TikTok clips of the crossings
- **Staying free:** grants (VVN, SIDN Fonds, municipalities), pay-what-you-want after passing, or a one-off €5–9 for extras. No ads and no data sales.
- **Top 5 bets:**
  1. hazard perception
  2. a 600+ question bank
  3. SEO pages
  4. English and B1 mode
  5. teacher links and a readiness indicator

*Note: competitor sites were blocked from the review environment. Prices come from search results and are approximate.*

## Proposed order

1. **Quick fixes (S):**
   - accessibility High and Medium items
   - the `__proto__` and exam-result checks in `store.js`
   - the same-day mistake practice
   - a score per topic and the change since last time on the result screen
   - a privacy note
   - the content points, after checking them
2. **Retake mode and exam-date plan (M).** Ahmed's biggest wish.
3. **Distractor rewrite and more crossings and signs (M/L).**
4. **Hazard perception with still images (L)**, then photo questions.
5. **Growth:** SEO pages and an instructor link (M).
