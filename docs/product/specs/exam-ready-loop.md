# Spec: Exam-ready loop

- **Status:** approved (30 September 2026). Part 1 in progress.
- **Priority:** Must
- **Related:** backlog #3, #4, #5, #6 (combined here); #9 rides along (AC-6); overlaps #18 (store hardening, only for the fields this spec reads). Vision: [success measures](../vision.md#success-measures). Backlog #1–#2 (exam format, content fixes) are `done`, so "trust the content first" is satisfied.

> **Split (this spec is over 2 pages).** Build and approve in three parts, in this order, so that data collection starts now (history cannot be rebuilt afterwards):
> **Part 1** — record answer history, honesty note, three-way exam date (AC-1 … AC-9).
> **Part 2** — result screen per topic, same-day practice of mistakes (AC-10 … AC-16).
> **Part 3** — plan, daily target, readiness (AC-17 … AC-34). AC-35 applies to every part.

## Summary

The user is a first-timer who studies on a phone next to a theory book, with the exam "somewhere in November" (no date booked, 30 September 2026). Today the app cannot say *where* points are lost, hides a mistake for the rest of the day once it is answered right, plans the same ~15–25 questions every day whatever the deadline, and gives no "am I ready?" signal. This feature closes the loop: mock exam → weak topics → practise them (also today) → a plan sized to the days left → an honest readiness check.

## User stories

- As a first-time candidate, I want to see my mock-exam score per topic, so that I know where I lose points.
- As a candidate who just made mistakes, I want to practise them again today, so that I fix them while they are fresh, without the app pretending they are learned.
- As a candidate whose exam is "somewhere in November", I want to give a month or no date at all, and change it later, so that the plan still works before I book.
- As a candidate with a deadline, I want each day's plan to fit the days left and my time, so that I cover everything without falling behind after a missed day.
- As a candidate, I want a readiness check that says what it does not measure, so that I do not sit the exam on false confidence.

## Acceptance criteria

*D* = calendar days from today to the planning date. *U* = items never seen, from the whole bank including voorrang scenarios (243 items today). "Topic" = `item.topic`.

**Part 1: answer history (starts collecting now)**

- **AC-1:** Given a checked answer in any session (Vandaag, Borden, Getallen, Voorrang, Fouten oefenen, weak-topic practice, mock exam), when recorded, then `{ id, ok, day }` is appended to `history[topic]`; only the newest 20 per topic are kept (entry 21 drops the oldest).
- **AC-2:** Given `k-alarm` already has a history entry today, when it is answered again today in any session, then no entry is added (first answer per question per day counts).
- **AC-3:** Given a flashcard self-grade ("wist ik" / "wist ik niet"), then `history` is unchanged, but `seen` is updated.
- **AC-4:** Given any answer or self-grade on item X, then `seen[X]` becomes today's day. Mock questions left open when time runs out are not marked seen and get no history entry.
- **AC-5:** Given a finished mock exam, then it is saved with `topics: { voorrang: [4, 6], … }` (`[goed, gevraagd]`); open questions at time-up count as wrong here, so the rows add up to the score.
- **AC-6:** Given any mock-exam result, then next to the pass line it says that hazard perception and photo questions are not in this mock exam, so a pass here is not a guarantee (#9).

**Part 1: exam date**

- **AC-7:** Given the start page, then the exam date offers "Nog niet gepland", "Maand (schatting)" with a `<select>` of the current month plus the next 11, and "Precieze datum". Default for new and existing users without a date: "Nog niet gepland".
- **AC-8:** Given "Maand: november 2026" on 30 September 2026, then the start page says "Examen in november (schatting) · plan rekent met 1 november". Given a precise date, the existing countdown shows. Given a precise date in the past, or a month that has ended, then the start page says so and asks for a new one; the plan treats it as "Nog niet gepland".
- **AC-9:** Given "Maand: november 2026", then from 11 October 2026 (21 days before the 1st) the start page shows "Al geboekt? Vul je examendatum in voor een beter plan."; on 10 October it does not.

**Part 2: result screen**

- **AC-10:** Given a finished mock exam, then the result lists every topic in the exam as "goed / gevraagd", sorted by most wrong first; ties: more asked first, then topic name. E.g. Borden 5/7, Voorrang 4/6, Kennis 18/19 in that order.
- **AC-11:** Given a previous exam, then one line shows the total change ("43/50, +3 sinds vorige: 40/50"); there is no per-topic "vorige" column. Given no previous exam, no change line.
- **AC-12:** Given wrong answers in 5 topics, when the user taps "Oefen zwakke onderwerpen", then a session starts of at most 15 questions from the 3 topics with most wrong: first their open mistakes (including those just made), then other questions from those topics not answered correctly in this exam. Given 0 wrong, no button.

**Part 2: same-day practice of mistakes**

- **AC-13:** Given 4 open mistakes of which 1 was answered right today, when the user opens Foutenlogboek, then "Oefen mijn fouten (4)" includes all 4; that one is labelled "Vandaag al goed. Morgen nog 1× goed, dan is hij weg."
- **AC-14:** Given mistake X answered right once today, when answered right again today, then it stays open (`streak` 1, `okDay` today); when answered right on a later calendar day, it is resolved.
- **AC-15:** Given mistake X answered right earlier today, when answered wrong again, then `streak` is 0 and `okDay` null.
- **AC-16:** Given open mistakes answered right today, then the Vandaag plan still leaves them out.

**Part 3: plan**

New per day = min(20, ⌈U / max(1, D − R)⌉) with reserve R = min(14, floor(D/2)). Caps: open mistakes 10 (not planned or D ≥ 15) or 20 (D ≤ 14 or maintenance); due cards 10. Mock exam every 7 days (not planned or D ≥ 43), 4 (D 15–42), 2 (D 2–14 or maintenance). Not planned: 10 new per day. Time: 30 s per question, rounded up to 5 min; mock 30 min.

- **AC-17:** Given D = 15 and U = 120, then 15 new (R = 7, ⌈120/8⌉). Next day, D = 14 and U = 105: 15 new (R = 7, ⌈105/7⌉) — no jump. Given D = 35, U = 200: 10 new (R = 14, ⌈200/21⌉).
- **AC-18:** Given D = 4 and U = 10, then 5 new (R = 2, ⌈10/2⌉).
- **AC-19:** Given D = 15 and U = 200, then 20 new (cap, not 25) and the start page says "Je haalt niet alle nieuwe vragen vóór je examen; overweeg een latere datum." The shortfall is not added to later days beyond the formula.
- **AC-20:** Given unseen voorrang scenarios, then they count in U and appear in the plan as normal voorrang questions, not flashcards.
- **AC-21:** Given open mistakes A (streak 1, right yesterday), B (wrong 20 Sep), C (wrong 25 Sep), then the plan orders A, B, C (streak 1 from an earlier day first, then oldest `last` first), up to the cap.
- **AC-22:** Given last activity 26 September, today 30 September, D = 35, U = 200, 35 open mistakes and 40 due cards, then the plan holds 10 new + 10 mistakes + 10 due (caps hold) and the target line starts "Welkom terug." without showing the backlog counts.
- **AC-23:** Given no mock exam ever, then one is due today, labelled "Proefexamen (nulmeting)". Given cadence 4 and last mock on 27 September, it is not due on 30 September and due on 1 October; if not done, it is still due on 2 October with the same wording (one mock, no reminder text).
- **AC-24:** Given a mock is due and the plan totals 30 questions, then the question target is 15 (halved, rounded up; filled in plan order) and the line reads "Vandaag: 15 vragen (± 10 min) + proefexamen (30 min, zorg dat je niet gestoord wordt)". Without a mock, 30 questions show as "± 15 min".
- **AC-25:** Given a precise date tomorrow (D = 1) and 14 open mistakes, then the plan is those 14 mistakes only: no new, no due cards, no mock. Given D = 0, up to 10 open mistakes, no mock.
- **AC-26:** Given "Maand: november 2026" and today 2 November 2026, then maintenance mode: no new questions, open mistakes (cap 20) and due cards (cap 10), mock every 2 days, and "Heb je al een datum? Vul die in voor een beter plan."
- **AC-27:** Given the start page, then the line shows "… · 12 gedaan". "Gedaan" = checked answers outside a mock exam, first answer per question per day (AC-2), from any session. When questions and any due mock are done, it says "Doel van vandaag gehaald" and "Nog een ronde" stays available.
- **AC-28:** Given the target was fixed at 30 this morning, when mistakes get resolved, then it stays 30 until the next day. When the user changes the exam date, the target and mock rhythm are recalculated at once; answers already given today still count.

**Part 3: readiness (start page only)**

- **AC-29:** Given the start page, then a readiness block shows three eisen, each with status and numbers: (1) "Minstens 3 proefexamens, de laatste 3 allemaal 46 of meer goed" (e.g. "2 van 3 gedaan, laagste 45"); (2) "Elk onderwerp 90% of meer goed over de laatste 20 antwoorden" (topics below, lowest first); (3) "Geen open fouten ouder dan 2 dagen" (e.g. on 30 September: "3 fouten van vóór 28 september").
- **AC-30:** Given a topic with 17 entries of which 15 ok, then it shows "88% (15/17), nog te weinig antwoorden (17/20)" and does not meet eis 2; with 0 entries, "nog geen antwoorden" (not 0%).
- **AC-31:** Given every unmet eis, then it has a button: "Doe een proefexamen", "Oefen <onderwerp>" (per topic), "Oefen oude fouten". Status: all met "Klaar volgens deze app"; one unmet "Bijna: <what is missing>" (e.g. "Bijna: nog 1 proefexamen"); else "Nog niet". No answers and no mocks: "Nog geen gegevens" with a link to Vandaag.
- **AC-32:** Given any status, including "Klaar", then the block states "Gevaarherkenning en vragen met foto's meet deze app niet. Oefen die met je theorieboek en de filmpjes die erbij horen.", "Je kent veel van deze vragen al; het echte examen heeft andere vragen." and "x van 243 vragen minstens 1× gezien".
- **AC-33:** Given a new mock exam, then within the existing format rules it prefers items never seen, then those with the oldest `seen` day.
- **AC-34:** Given a topic whose questions were all removed from the bank, then readiness and the result screen ignore it.

**All parts**

- **AC-35:** Given old or broken saved data (see Data), when the app loads, then every screen in this spec renders without errors and shows "–" or "nog geen" where data is missing.

## Edge cases

- **First use:** no exams, history or date → nulmeting due, "not planned" plan, readiness "Nog geen gegevens".
- **Old data:** history and `seen` start empty; voorrang scenarios answered before this feature count as unseen once. Exams without `topics` count for eis 1 (score is enough). Mistakes without `last` sort as oldest.
- **Too long:** history 20 per topic; exams 50 (existing); month list 12 months.
- **Duplicate:** same question twice a day → AC-2. Two tabs → existing `storage` sync.
- **Missed days:** AC-22; a missed mock rolls over once (AC-23).
- **Day boundary:** all day logic uses the local calendar day (`U.dayKey`), also across DST.
- **Offline / errors:** all local; storage full or blocked → progress kept in memory (existing `save()`), no error shown.

## UI notes

Start page: date choice, target line with minutes, readiness block with action buttons. Mock result: topic list, total change, weak-topic button, honesty note. Foutenlogboek: same-day label. Mobile-first at 320px; the topic list must not scroll sideways. The designer decides layout.

## Data

```js
// localStorage 'rijbewijs-b-v1', VERSION 2 -> 3. Existing fields unchanged unless noted.
{
  version: 3,
  examDate: '2026-11-20' | null,          // precise date (existing); wins over examMonth
  examMonth: '2026-11' | null,            // new (Part 1)
  history: { voorrang: [{ id: 'v-3', ok: true, day: '2026-09-30' }] },  // new (Part 1), max 20 per topic
  seen: { 'v-3': '2026-09-30' },          // new (Part 1): last day each item was answered or self-graded
  exams: [{ date: 1790000000000, score: 43, total: 50, passed: false, timeUp: false,
            topics: { voorrang: [4, 6] } }],        // topics new (Part 1), optional
  mistakes: { 'k-alarm': { last: 1790000000000, streak: 1, okDay: '2026-09-29', … } },  // existing; `last` used for ordering
  today: { day: '2026-09-30', target: 30, mock: true, practised: 12 }   // new (Part 3)
}
```

`clean()` must:
- `examMonth`: keep only `/^\d{4}-(0[1-9]|1[0-2])$/`. `examDate`: also reject impossible dates like `2026-02-31` (#18).
- `history`: object; skip `__proto__`/`constructor`/`prototype` keys; entries need string `id`, boolean `ok`, valid `day`; drop bad entries; keep the last 20.
- `seen`: object with the same key guard; values must be a valid day; drop others.
- `exams`: finite `date`, integers 0 ≤ `score` ≤ `total` ≤ 50; `topics` optional, each value `[goed, gevraagd]` integers with 0 ≤ goed ≤ gevraagd; drop a bad `topics` but keep the exam.
- `mistakes[id].last`: finite number or dropped.
- `today`: valid `day`, non-negative integers `target`, `practised`, boolean `mock`; otherwise null (recomputed).
- Version 2 migrates by adding the new fields empty; no data is lost.

## Scope

- **In:** history and `seen` recording; per-topic result with total change and weak-topic practice; honesty notes (#9 and readiness); same-day mistake practice; three-way exam date with month maintenance mode; continuous capped plan with minutes; mock rhythm with nulmeting and rollover; readiness with action buttons; `clean()` for fields this spec reads.
- **Out:** a "Nog een ronde met alleen de foute" button on the Fouten summary (Foutenlogboek already covers it); per-topic change since last mock; reopening older results; charts; theory-book chapter hints; hazard perception and photo questions (#7, #21); reminders (#31); export/import (#17); retake mode (#25); other #18 hardening; changing flashcard intervals.

## Decided

- Month-only date: the plan counts to the 1st of the month; from the 1st while that month is current, maintenance mode (AC-26).
- Theory-book chapters: out of scope.
- **Eis 1:** the last 3 mock exams all 46 or more (not "3 in 7 days"). No higher margin than 46.
- **Timed-out mock:** counts toward readiness, open questions as wrong.
- **Move the date:** the app does **not** suggest moving the exam date.
- **Workload:** about 15 minutes a day (up to 30 questions, max 20 new) plus a 30-minute mock every few days.
- **Build order:** Part 1 first, then Part 2, then Part 3.

## Open questions

All answered by the user on 30 September 2026 (see Decided).
