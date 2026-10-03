# Spec: Hazard perception (gevaarherkenning) with still scenes

- **Status:** draft (3 October 2026)
- **Priority:** Must
- **Related:** backlog #7. Touches [exam-ready-loop](exam-ready-loop.md) (AC-6 and AC-32 honesty notes, readiness, plan). Overlaps #22 (untimed mode, out) and #21 (photo questions, out). Content rules: `docs/verificatie.md`.

> **Format warning, read first.** The repo's own exam check (`docs/verificatie.md`, "Examenvorm") says that since 7 April 2025 **the old hazard-perception part with photos is gone**. Hazard perception now sits inside the 50 questions as **short video clips** that test "waarnemen en voorspellen". How a clip question is asked and marked is **not known** from our sources. "Remmen / gas loslaten / niets" with a time limit is the *old* format. So this feature trains the skill (spot the hazard, choose a reaction fast) but **does not copy the current exam question**. See open question Q1 before approving.

> **Build order (if approved):** Part A = engine, store, 12 scenes (AC-1 … AC-20). Part B = the other 18 scenes and their content check (AC-21 … AC-23a). Part A is useful on its own; Part B is mostly drawing and checking.

## Summary

The app has no hazard perception at all; the readiness block and the mock-exam result say so. This adds a separate practice screen "Gevaar": a round of 10 still driver's-view SVG scenes, each shown with your speed. You tap **Remmen**, **Gas los** or **Niets** before a short timer runs out, then see the right answer, which hazard it was, why, and the source. It trains looking at the right things quickly. Results are kept apart from the mock exam, the daily plan and readiness (recommended; see Q4).

## User stories

- As a first-time candidate, I want to practise spotting hazards in traffic scenes under time pressure, so that I react fast and correctly on the exam and on the road.
- As a candidate, I want to see after each scene what the hazard was and why the answer is right, so that I learn what to look for, not just which button to press.
- As a candidate who studies on a phone, I want a round to take about 2 minutes and work at 320px wide, so that I can fit it in between other practice.
- As a candidate, I want the app to stay honest that still drawings are not the exam's video clips, so that I do not overrate my readiness.

## Acceptance criteria

*T* = time limit per scene (constant `GEVAAR.limit`; examples use **T = 8 s**, see Q2). *N* = scenes per round (`GEVAAR.round` = 10). Answer values: `'remmen' | 'gas' | 'niets'`.

**Part A: practice screen and round**

- **AC-1:** Given the menu, then there is an item "Gevaar" linking to `#/gevaar`, page title "Gevaarherkenning · Theorie Oefenen B". The page explains the three answers in one line each (text in Q3) and has a button "Start ronde (10)".
- **AC-2:** Given a bank of 30 scenes, when a round starts, then it holds 10 different scenes chosen by `U.hazardPick(hazard, bank, 10)`: first never answered, then those whose last answer was wrong or late, then the rest by oldest last answer. Within a group the order is random. Given a bank smaller than N, the round holds every scene once.
- **AC-3:** Given a scene, then it shows "Scène 3 van 10", the SVG scene, the speed (e.g. "50 km/h") inside or right under the scene, a countdown, and three buttons in the fixed order Remmen, Gas los, Niets (not shuffled).
- **AC-4:** Given a scene is rendered, then the timer starts in the same frame the SVG and buttons are in the DOM; the reaction time is `tap time − start time`, measured with `Date.now()` (or `performance.now()`), not by counting ticks.
- **AC-5:** Given scene `g-zebra-1` with answer `remmen`, when the user taps Remmen after 2 140 ms, then it is graded right; the feedback says "Goed", "Je reageerde na 2,1 s", names the hazard, shows the explanation and "Bron: …", and a button "Volgende". The next scene's timer only starts after "Volgende".
- **AC-6:** Given the same scene, when the user taps Gas los, then it is graded wrong and the feedback shows "Fout. Het goede antwoord is: Remmen" plus hazard, explanation and source.
- **AC-7:** Given no tap, when T has passed, then the buttons are disabled and the feedback says "Te laat. Het goede antwoord is: Remmen" (plus hazard, explanation, source); it is stored as `a: null, ok: false`. A tap whose timestamp is ≤ T counts even if the timeout callback runs late (throttled timer); a tap at > T is "Te laat".
- **AC-8:** Given a scene, when the user taps twice quickly (or two buttons), then only the first tap counts; all three buttons are disabled after it.
- **AC-9:** Given a finished round, then the summary shows "8 van 10 goed", "1 te laat" (only if > 0), the average reaction time of the right answers ("gemiddeld 2,4 s"), the wrong/late scenes with their right answer, and buttons "Nog een ronde" and "Terug". The round is saved (see Data).
- **AC-10:** Given the user leaves `#/gevaar` mid-round (menu, back), then no confirmation is asked; answers already given stay saved, the unfinished round is not saved in `rounds`, and the timer is cleared (no callback fires on another page).

**Part A: background, phone lock, accessibility, small screens**

- **AC-11:** Given the timer is running, when the page becomes hidden (`visibilitychange` to hidden: tab switch, phone lock, app switch), then the timer stops, nothing is stored, and the scene is replaced by "Gepauzeerd" with a button "Verder". When the user taps "Verder", the same scene is shown again with the full T. Hidden while feedback or the summary is showing: nothing changes.
- **AC-12:** Given `prefers-reduced-motion: reduce`, then the countdown has no animation (no shrinking bar or transition); it shows whole seconds as text ("8", "7", …). Without that setting the designer may animate a bar. Scenes never move or flash in either case.
- **AC-13:** Given dark mode, then the scene uses colour tokens from `css/style.css` (as `intersection.js` does) and stays readable: key objects (road users, lights, signs) have at least 3:1 contrast against their surroundings, text at least 4.5:1, in light and dark mode. The scene token pairs are named in the design proposal (e.g. `--scene-road` vs `--scene-person`) and their contrast is checked by a test in both modes.
- **AC-14:** Given a screen reader, then each scene SVG has `role="img"` and an `aria-label` from the scene's `describe` text (what is visible, including speed, without naming the answer). The countdown is not a live region; the only announcement is the feedback (existing `role="status"` pattern), including "Te laat". The timer stays on (no untimed mode, see Out).
- **AC-15:** Given a 320 × 568 viewport, then the scene, the speed, the countdown and all three buttons are visible without scrolling, nothing scrolls sideways, and each button is at least 44 px high. Landscape at 568 × 320 may scroll but must not lose the timer state. Feedback (explanation and source) may scroll below the scene: focus then moves to the feedback, and after "Volgende" the view scrolls back to the top of the next scene.

**Part A: data and integration**

- **AC-16:** Given an answer, then one entry `{ id, a, ok, ms, day }` is appended to `hazard.history` (newest last, max 100); given a finished round, `{ day, ok, total, late }` is appended to `hazard.rounds` (max 50). Hazard answers do **not** touch `history`, `seen`, `mistakes`, `answeredDay`, `practisedDay`, `today` or `stats`.
- **AC-17:** Given the start page, then a tile "Gevaarherkenning" shows "Nog niet gedaan" or the last round ("Laatste: 8/10"). Hazard scenes are not in the Vandaag plan, not in *U* (the "x van 243 vragen" count stays as is), not in the mock exam, and not in readiness eisen 1–3 (assumes Q4 = A).
- **AC-18:** Given the readiness block (exam-ready-loop AC-32) and the mock-exam notes (AC-6 and the Proefexamen intro), then the hazard wording changes to: "Gevaarherkenning oefen je hier alleen met stilstaande tekeningen; het echte examen gebruikt korte filmpjes. Remmen / gas los / niets is een oude vraagvorm. Vragen met foto's meet deze app niet." (Wording follows the chosen question type, Q7.) The page-bottom note on Start is updated to match. Smoke tests that check the old text are updated.
- **AC-19:** Given old saved data without `hazard`, or a broken `hazard` (see Data), when the app loads, then `clean()` returns a valid `hazard` and every screen renders; Gevaar shows "Nog niet gedaan". Entries for scene ids no longer in the bank are kept but ignored by `hazardPick` and the summary.
- **AC-20:** Given the new files `js/hazard.js` and `js/data/gevaar.js`, then they are loaded in `index.html` (data before `store.js`, renderer after `intersection.js`), listed in the `sw.js` cache, `CACHE` is bumped, and the page works offline after one online visit.

**Part B: content**

- **AC-21:** Given `node tests/validate.js`, then every scene has a unique id starting `g-`, `answer` in the three values, a non-empty `hazard`, `describe`, `explain` and `source`, a `speed` integer 5–130, and a scene definition the renderer accepts; and each answer value covers at least 25% of the bank (so always tapping one button cannot score above ~50%).
- **AC-22:** Given the full bank, then it holds 30 scenes (Part A ships 12, at least 3 per answer value), across at least these situations: bebouwde kom, buitenweg, kruispunt, voetgangersoversteekplaats, school/spelende kinderen, fietsers, bus bij halte, voorligger remt, uitrit/inrit, geparkeerde auto's, slecht zicht.
- **AC-23a:** Given the round summary, when a scene was answered wrong or too late, then the owner can open that scene again (picture, right answer and explanation), not just read the right answer.
- **AC-23:** Given any scene, then its answer and explanation were checked by a content subagent against the cited source and noted in a new section "Gevaarherkenning" in `docs/verificatie.md`, Only scenes whose answer follows directly from a cited rule (e.g. RVV 1990 art. 49: a pedestrian on the zebra means stop) ship. A scene whose answer is a judgement call ("gas los" vs "remmen") without such a rule is dropped, not resolved; where a scene leans on CBR or book material rather than law, its source says so.

## Edge cases

- **First use:** no `hazard` data → tile "Nog niet gedaan"; first round = 10 never-answered scenes.
- **Empty / too small bank:** bank < 10 → round of all scenes (AC-2); bank 0 → Gevaar shows "Nog geen scènes" and no start button (should not ship, but must not crash).
- **Too long:** history 100, rounds 50, oldest dropped. Very slow phone: start time is taken after render, so a slow render does not eat into T.
- **Duplicate:** a scene never appears twice in one round; the same scene on several days is fine. Two tabs: existing `storage` sync reloads state; a round running in the other tab is not affected.
- **Timeout vs tap race:** decided by timestamps (AC-7); double tap (AC-8).
- **Background / lock / incoming call:** AC-11. Rotation mid-scene: no restart, timer keeps running.
- **Midnight during a round:** each answer uses the day it was given; the round's `day` is the day it finished.
- **Offline:** everything is local (AC-20). Storage full or blocked: existing `save()` keeps progress in memory, no error shown.
- **Old or broken data:** AC-19. Changed answer key after a content fix: old `ok` values stay as recorded; `hazardPick` treats a past wrong answer as wrong (it may come back sooner, harmless).

## UI notes

New route `#/gevaar` with three states: intro (answer definitions, start button, last 5 rounds as "8/10"), scene (counter, scene, speed, countdown, three buttons, feedback), summary. Start page gets a tile. Scenes: driver's view through the windscreen, built from reusable parts in `js/hazard.js` (road shapes, parked cars, car ahead with or without brake lights, pedestrian, child, ball, cyclist, bus, traffic light, a few signs reused from `signs.js`, dashboard edge with speed). No photos. The designer decides layout, timer style and the scene look; the content author composes scenes from the parts.

## Data

```js
// localStorage 'rijbewijs-b-v1', VERSION 3 -> 4. Existing fields unchanged.
{
  version: 4,
  hazard: {
    history: [{ id: 'g-zebra-1', a: 'remmen' | 'gas' | 'niets' | null, ok: true, ms: 2140, day: '2026-10-03' }], // max 100
    rounds:  [{ day: '2026-10-03', ok: 8, total: 10, late: 1 }]                                                 // max 50
  }
}

// js/data/gevaar.js (not stored)
RB.gevaar = [{ id: 'g-zebra-1', answer: 'remmen', speed: 50, scene: { road: 'stad', parts: [/* … */] },
  hazard: 'Voetganger stapt op de zebra', describe: 'Je rijdt 50 km/h in de bebouwde kom. …',
  explain: '…', source: 'RVV 1990 art. 49 …' }];
```

`clean()` must:
- `hazard`: plain object, else `{ history: [], rounds: [] }`.
- `history` entries: string `id` passing `safeKey`; `a` one of the three values or `null`; boolean `ok`; `ok` must be `false` when `a` is `null`; integer `ms` with 0 ≤ ms ≤ 60 000; valid `day` (`U.isDay`). Drop bad entries, keep the last 100.
- `rounds` entries: valid `day`; integers with 1 ≤ `total` ≤ 30, 0 ≤ `ok` ≤ `total`, 0 ≤ `late` ≤ `total − ok`. Drop bad entries, keep the last 50.
- Version 3 migrates by adding the empty `hazard`; nothing else changes.

Pure, Node-testable functions in `js/util.js`: `hazardPick(hazard, bank, n, rand)` (AC-2; `rand` injectable for tests), `hazardGrade(scene, a, ms, limit)` → `{ ok, late }` (AC-5–7), `hazardSummary(round)` → counts and average ms (AC-9). Store methods: `recordHazard(entry)`, `addHazardRound(round)`.

## Scope

- **In:** route `#/gevaar`, rounds of 10 timed still scenes, per-scene feedback with hazard, explanation and source, pause on background, reduced-motion and dark-mode support, `hazard` store field with `clean()`, start-page tile, updated honesty notes, 30 checked scenes (12 in Part A), validate checks, service-worker cache.
- **Out:** video or animated scenes; photos; copying the current exam's clip questions (format unknown, Q1); tap-the-hazard or "what happens next" questions (possible follow-up); untimed or extended-time mode (#22); hazard scenes in the mock exam, Vandaag plan or readiness (unless Q4 says otherwise); hazard mistakes in Foutenlogboek; spaced repetition of scenes beyond the pick order; speed-based scoring (faster = more points).

## Open questions

- [ ] **Q1. Does this format still fit the exam?** Our sources say the photo-based "remmen / gas los / niets" part was dropped in April 2025 and replaced by video clips inside the 50 questions; how those are asked is unknown. Options: **A)** build remmen / gas los / niets anyway, as a skill drill, with the honest note of AC-18; **B)** first check how hazard questions look in your theory book or its online practice exams, then pick the question style; **C)** drop #7 and spend the time on #8/#10/#11. *Recommendation: B, then A unless the book shows a clearly different style.* It costs you five minutes and avoids building the wrong thing.
- [ ] **Q2. Time limit per scene.** We could not source the old CBR limit (cbr.nl is blocked). Options: **A)** 8 s; **B)** 5 s (harder); **C)** 10 s (learning-friendly). *Recommendation: A, and adjust after a week of use.*
- [ ] **Q3. Meaning of the three answers.** Proposed text (own wording, to be checked against your theory book): "Remmen: er is direct gevaar, je moet nu remmen." "Gas los: er kan gevaar ontstaan, je gaat alvast langzamer rijden." "Niets: er is geen reden om je snelheid te veranderen." Options: **A)** use this; **B)** use the wording from your book. *Recommendation: B if your book has it, else A.*
- [ ] **Q4. Hazard results and readiness.** Options: **A)** fully separate (own screen and tile only); **B)** add a 4th readiness eis, e.g. "laatste 3 rondes allemaal 9/10 of meer"; **C)** also put one hazard round in the Vandaag plan every few days. *Recommendation: A.* 30 scenes are learned by heart quickly, so a score on them says little about the real clips; a readiness eis would give false confidence.
- [ ] **Q5. Feedback timing.** Options: **A)** feedback after every scene (learn as you go); **B)** only at the end of the round (more exam-like). *Recommendation: A.*
- [ ] **Q6. Bank size.** Options: **A)** 30 scenes (12 in Part A, 18 in Part B); **B)** 20 scenes; **C)** 50 scenes. *Recommendation: A.* That fits 4–8 weeks next to daily study; each scene needs drawing, a source and a content check.
- [ ] **Q7. Question type (only if Q1 = A).** The current exam has hotspot and multiple-choice questions, closer to "Waar zit het gevaar?" (tap) or "Wat gebeurt er waarschijnlijk?" than to three buttons. Options: **A)** remmen / gas los / niets, as drafted; **B)** tap-the-hazard; **C)** "what happens next" as multiple choice (fits the existing renderer). *Recommendation: C* (closest to "waarnemen en voorspellen", least new code).
- [ ] **Q8. Graded timer.** On a still drawing the timer mostly measures how fast you read the picture. Options: **A)** graded timer as drafted (AC-4, 7, 11, 12); **B)** soft "te langzaam" hint, never marked wrong, no average reaction time; **C)** no timer. *Recommendation: B* (also removes most of the timer accessibility risk).
- [ ] **Q9. Scope cut.** Options: **A)** as drafted (VERSION 3→4, history 100, rounds 50, start-page tile, "laatste 5 rondes", reaction time); **B)** minimal: route, rounds, feedback and one `hazard.last` map `{id: ok}`, no tile. *Recommendation: B*; with 30 scenes it is a tool for a week or two, after which the scenes are known by heart.

> **Advocate's verdict (3 Oct 2026):** given the format change and 4–8 weeks left, #8 (distractors), #10 (crossings) and #11 (signs) probably add more per hour. Recommended order: Q1 = B (check your book's clip questions, 5 min); unless the book shows the three-button format, pick C and do #8 first.
