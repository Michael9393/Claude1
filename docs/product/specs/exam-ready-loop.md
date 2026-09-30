# Spec: Exam-ready loop

- **Status:** draft
- **Priority:** Must
- **Related:** backlog #3, #4, #5, #6 (combined here); #9 rides along (AC-8); overlaps #18 (store hardening, only for the fields this spec reads). Vision: [success measures](../vision.md#success-measures).

> **Proposed split (this spec is over 2 pages).** Build and approve in two increments, in this order:
> **Part A** — per-topic tracking, result screen, same-day mistakes (AC-1 … AC-13).
> **Part B** — exam-date plan, daily target, readiness (AC-14 … AC-27). Part B needs Part A's data.

## Summary

The user is a first-timer who studies on a phone next to a theory book, with the exam "somewhere in November" (no date booked, 30 September 2026). Today the app cannot say *where* points are lost (no per-topic data), hides a mistake for the rest of the day once it is answered right, plans the same ~15–25 questions every day whatever the deadline, and gives no "am I ready?" signal. This feature closes the loop: mock exam → see weak topics → practise them (also today) → a plan sized to the days left → an honest readiness check against the vision's bars.

## User stories

- As a first-time candidate, I want to see my mock-exam score per topic and how it changed since last time, so that I know where I lose points.
- As a candidate who just made mistakes, I want to practise them again today, so that I fix them while they are fresh, without the app pretending they are learned.
- As a candidate whose exam is "somewhere in November", I want to give a month or no date at all, and change it later, so that the plan still works before I book.
- As a candidate with a deadline, I want each day's plan and the mock-exam rhythm to fit the days left, so that I cover everything in time.
- As a candidate, I want a readiness check that says what it does not measure, so that I do not book or sit the exam on false confidence.

## Acceptance criteria

**Part A: per-topic tracking**

- **AC-1:** Given any answer in a practice session (Vandaag, Borden, Getallen, Voorrang, Fouten oefenen, weak-topic practice) or in a mock exam, when it is recorded, then `{ id, ok, day }` is appended to `history[topic]`, and only the newest 20 entries per topic are kept (entry 21 drops the oldest).
- **AC-2:** Given question `k-alarm` was already recorded today in its topic's history, when it is answered again today (any session), then no new history entry is added. (Only the first answer per question per day counts, so drilling a question you just saw cannot inflate accuracy.)
- **AC-3:** Given a flashcard self-grade ("wist ik" / "wist ik niet"), when recorded, then `history` is unchanged (self-grades are not checked answers).
- **AC-4:** Given a topic with 17 history entries of which 15 `ok`, when accuracy is shown, then it reads "88% (15/17)" and is flagged "nog te weinig antwoorden (17/20)"; with 0 entries it reads "nog geen antwoorden", not 0%.

**Part A: result screen after a mock exam**

- **AC-5:** Given a finished mock exam, when the result shows, then it lists every topic that was in the exam as "goed / gevraagd" (e.g. "Voorrang 4/6"), sorted lowest percentage first, and the exam is saved with `topics: { voorrang: [4, 6], … }`. Questions left open when time ran out count as wrong in this breakdown (so the rows add up to the score) but are not added to `history`.
- **AC-6:** Given a previous exam with `topics`, when the result shows, then it shows the total change ("43/50, +3 sinds vorige: 40/50") and, per topic, the previous "goed / gevraagd" next to the current one. Given the previous exam has no `topics` (saved before this feature), then only the total change shows and topic rows show "vorige: –". Given no previous exam, no change line shows.
- **AC-7:** Given the exam had wrong answers in 5 topics, when the user taps "Oefen zwakke onderwerpen", then a practice session starts of at most 15 questions from the 3 topics with the most wrong answers: first their open mistakes (including the ones just made), then questions from those topics not answered correctly in this exam. Given 0 wrong answers, the button is not shown.
- **AC-8:** Given any result screen, then next to the pass line it says that hazard perception and photo questions are not in this mock exam, so a pass here is not a guarantee (backlog #9).

**Part A: same-day practice of mistakes**

- **AC-9:** Given 4 open mistakes of which 1 was already answered right today, when the user opens Foutenlogboek, then "Oefen mijn fouten (4)" is enabled and includes all 4; the one answered right today is labelled "vandaag al goed, telt pas morgen".
- **AC-10:** Given mistake X was answered right once today, when it is answered right again today, then it stays open (`streak` 1, `okDay` today). When answered right on a later calendar day, then it is resolved. (Unchanged rule, now reachable the same day.)
- **AC-11:** Given mistake X was answered right earlier today, when it is answered wrong again today, then `streak` resets to 0 and `okDay` to null (as today).
- **AC-12:** Given a "Fouten oefenen" round ends with 2 wrong, when the user taps "Nog een ronde", then the next round holds only those 2; given 0 wrong, the summary says all are done for today and come back tomorrow.
- **AC-13:** Given open mistakes answered right today, when the Vandaag plan is built, then they are still left out (Vandaag stays the "counts toward resolving" list; same-day drilling lives in Foutenlogboek and on the result screen).

**Part B: exam date**

- **AC-14:** Given the start page, then the exam date offers three choices: "Nog niet gepland", "Maand (schatting)" with a month picker for the next 12 months, and "Precieze datum". The default for new and existing users without a date is "Nog niet gepland".
- **AC-15:** Given "Maand: november 2026" on 30 September 2026, then the plan uses 1 November 2026 as its planning date (32 days left) and the start page says "Examen in november (schatting) · plan rekent met 1 november". Given a precise date, that date is used and the existing countdown shows.
- **AC-16:** Given the user changes the date type or value (e.g. month → precise 20 November), when saved, then the countdown, today's target and the mock-exam rhythm are recalculated at once; answers already given today still count toward the new target.
- **AC-17:** Given the precise date has passed, then the start page says the date is past and asks to set a new one, and the plan behaves as "Nog niet gepland". Given today is the exam day, the plan offers only up to 10 open mistakes and no mock exam.

**Part B: plan and daily target**

With *D* = days from today to the planning date and *U* = flashcard-pool items never seen (228 today):

| Days left *D* | New questions per day | Open mistakes / due cards cap | Mock exam every |
| - | - | - | - |
| not planned | 10 | 10 / 10 | 7 days |
| 43 or more | max(5, ⌈U / (D − 14)⌉) | 10 / 10 | 7 days |
| 15–42 | max(5, ⌈U / (D − 14)⌉) | 10 / 10 | 4 days |
| 4–14 | ⌈U / max(1, D − 3)⌉ | 20 / 10 | 2 days |
| 1–3 | 0 | 20 / 10 | 1 day |

- **AC-18:** Given D = 35 and U = 200, then the plan has 10 new questions (⌈200/21⌉ = 10), up to 10 mistakes and 10 due cards (target up to 30), and a mock exam is due when the last one was 4 or more calendar days ago.
- **AC-19:** Given D = 5, U = 10, 14 open mistakes and 6 due cards, then the plan has 5 new, 14 mistakes and 6 due cards (target 25), and a mock exam every 2 days.
- **AC-20:** Given no mock exam yet, then the first one is due once at least half of the pool has been seen or D ≤ 21, whichever comes first.
- **AC-21:** Given the start page, then a target line shows e.g. "Doel vandaag: 30 vragen + proefexamen · 12 gedaan". Mock-exam answers do not count toward the question number. When both parts are done, the line says "Doel van vandaag gehaald" and "Nog een ronde" stays available.
- **AC-22:** Given the target was fixed at 30 this morning, when mistakes are resolved during the day, then the target stays 30 (fixed once per calendar day, recalculated only by AC-16 or at the next day).

**Part B: readiness**

- **AC-23:** Given the start page and the Proefexamen page, then a readiness block shows three bars with status and numbers: (1) "Proefexamens: elk ≥ 46/50 in de laatste 7 dagen, minstens 3" (e.g. "2 van 3 gedaan, laagste 45"); (2) "Elk onderwerp ≥ 90% over de laatste 20 antwoorden" (lists the topics below, lowest first, with AC-4 wording); (3) "Geen open fouten ouder dan 2 dagen" (e.g. "3 fouten van vóór 28 september").
- **AC-24:** Given all three bars met, then the status is "Klaar volgens deze app"; two met, "Bijna"; otherwise "Nog niet". Given no answers and no mock exams, then "Nog geen gegevens" with a link to Vandaag.
- **AC-25:** Given any readiness status, including "Klaar", then the block always states: "Gevaarherkenning en vragen met foto's meet deze app niet. Oefen die met je theorieboek."
- **AC-26:** Given a topic whose questions were all removed from the bank, then it is ignored by readiness and the result screen.
- **AC-27:** Given old or broken saved data (see Data), when the app loads, then every screen in this spec renders without errors and shows "–" or "nog geen" where data is missing.

## Edge cases

- **Empty / first use:** no exams, no history, no date → result screen has no change line; readiness "Nog geen gegevens"; plan uses the "not planned" row.
- **Old data:** exams without `topics` stay in the history table and count for readiness bar 1 (score is enough); history starts empty and cannot be rebuilt from the global `stats`.
- **Too long:** history capped at 20 per topic, exams at 50 (existing); month picker limited to 12 months ahead.
- **Duplicate:** same question twice in a day → AC-2. Two tabs → existing `storage` sync.
- **Day boundary:** all "day" logic uses the local calendar day (`U.dayKey`), also across DST.
- **Offline:** everything is local; no change.
- **Errors:** storage full or blocked → progress kept in memory for the session (existing `save()` behaviour); no error shown.

## UI notes

Screens: start page (date choice, target line, readiness block), mock-exam result (topic table, change, weak-topic button, honesty note), Foutenlogboek (same-day label and button), Proefexamen page (readiness block). Mobile-first at 320px; topic table must not scroll sideways. The designer decides layout.

## Data

```js
// localStorage 'rijbewijs-b-v1', VERSION 2 -> 3. Existing fields unchanged unless noted.
{
  version: 3,
  examDate: '2026-11-20' | null,     // precise date (existing)
  examMonth: '2026-11' | null,       // new; only used when examDate is null
  history: {                          // new; per topic, oldest first, max 20
    voorrang: [{ id: 'v-3', ok: true, day: '2026-09-30' }]
  },
  exams: [{ date: 1790000000000, score: 43, total: 50, passed: false, timeUp: false,
            topics: { voorrang: [4, 6], borden: [7, 7] } }],   // topics new, optional
  today: { day: '2026-09-30', target: 30, practised: 12 }       // new
}
```

`clean()` must:
- `examMonth`: keep only `/^\d{4}-(0[1-9]|1[0-2])$/`; if `examDate` is also set, keep both but `examDate` wins. `examDate`: also reject impossible dates like `2026-02-31` (#18).
- `history`: object; skip `__proto__`/`constructor` keys; each value an array of entries with string `id`, boolean `ok`, `day` matching `YYYY-MM-DD`; drop bad entries; keep the last 20.
- `exams`: keep entries with finite `date`, `score`, `total` (0 ≤ score ≤ total ≤ 50); `topics` optional, each value `[correct, asked]` integers with 0 ≤ correct ≤ asked; drop an invalid `topics` field but keep the exam.
- `today`: valid `day`, non-negative integer `target` and `practised`; otherwise reset to null (recomputed).
- Version 2 data migrates by adding the new fields empty; no data is lost.

## Scope

- **In:** per-topic history; per-topic result screen with change and weak-topic practice; honesty note (#9); same-day mistake practice in Foutenlogboek and from the result; three-way exam date (none / month / precise) and changing it; plan size and mock rhythm by days left; daily target line; readiness block; `clean()` for new fields and the fields read here.
- **Out:** reopening the result of an older exam; charts over time; hazard perception and photo questions (#7, #21); reminders (#31); export/import (#17); retake mode (#25); other `store.js` hardening in #18; changing flashcard intervals.

## Open questions

- [ ] **Bars:** keep 46/50 in the last 7 days, at least 3 mock exams in that week, 90% over the last 20 answers per topic, and no open mistakes older than 2 days? Or stricter/looser? (vision question 4)
- [ ] **Month-only date:** plan against the 1st of the month (safe, proposed) or the middle (e.g. 15 November, more days per phase)?
- [ ] **Plan numbers:** are the table values (new questions finished 14 days before the exam, target up to ~30 questions/day, mock every 4 days from D = 42, every 2 days from D = 14, daily in the last 3 days) a workload you can keep up on your phone?
- [ ] **Theory book:** should the plan also say "read chapter X" for weak topics? That needs the book's chapter list from you; out of scope unless you want it.
- [ ] **Split:** build as one increment, or Part A first and Part B after (proposed)?
