# Design: Exam-ready loop, Part 3

- **Status:** proposal (1 October 2026), for review by the main session.
- **Spec:** [exam-ready-loop.md](exam-ready-loop.md), AC-17 … AC-34 and AC-35.
- **Builds on:** [Part 1 design](exam-ready-loop-part1-design.md) (date control, month prompts), [Part 2 design](exam-ready-loop-part2-design.md) (weak-topic session, `.tabel .num`).
- **Screens touched:** start page only (`views.start`): the Vandaag card is rebuilt, a new readiness card is added. The date card keeps its markup. AC-17, AC-18, AC-20, AC-21, AC-33 and AC-34 are plan/exam logic without UI of their own; they only change the numbers shown here.

## 1. Order of the start page

```
1. Intro card (existing): h1, belofte, Examendatum control, countdown/month line, month prompt
2. Vandaag card (rebuilt): target line, plan detail, buttons          <- primary action
3. Readiness card (NEW): "Klaar voor het examen?"
4. Tegels (existing)
5. Noot (existing)
```

Vandaag stays the one primary action; readiness sits right under it because its buttons are the "what next" once today is done. Tegels move down one place. At 360×740 the Vandaag start button stays above the fold (header ~130, intro card ~300, Vandaag card top ~446, button ends ~650 in the longest case without warning; with the AC-19 warning ~700).

## 2. Vandaag card

### Wireframe, planned date, mock due, nothing done yet (360px)

```
+--------------------------------------+
| Vandaag                              |  <h2 id="vandaag-kop" tabindex="-1">
| Vandaag: 15 vragen (± 10 min) +      |  p.doel (NEW class), semibold
| proefexamen (30 min, zorg dat je     |
| niet gestoord wordt)                 |
| 5 fouten · 4 kaarten · 6 nieuwe      |  p.klein, plan detail
| vragen (vooral voorrang)             |
| Je haalt niet alle nieuwe vragen     |  p.klein, only AC-19
| vóór je examen; overweeg een latere  |
| datum.                               |
| [ Start (15 vragen) ]                |  .knop.groot  data-act="vandaag"
| [ Proefexamen ]                      |  a.knop.secundair href="#/examen"
+--------------------------------------+
```

### Wireframe, target met

```
+--------------------------------------+
| Vandaag                              |
| Doel van vandaag gehaald · 32 gedaan |  p.doel
| Morgen staat er weer een nieuw plan  |  p.klein
| klaar.                               |
| [ Nog een ronde ]                    |  .knop.secundair  data-act="vandaag"
+--------------------------------------+
```

### Target line (p.doel)

Built as `[Welkom terug. ]Vandaag: N vragen (± X min)[ + proefexamen (30 min, zorg dat je niet gestoord wordt)][ · n gedaan]`.

| Case | Text |
|---|---|
| No mock due, nothing done | `Vandaag: 30 vragen (± 15 min)` |
| Mock due (AC-24, target halved) | `Vandaag: 15 vragen (± 10 min) + proefexamen (30 min, zorg dat je niet gestoord wordt)` |
| Some done (AC-27) | `Vandaag: 30 vragen (± 15 min) · 12 gedaan` |
| Questions done, mock still due | `Vandaag: 15 vragen (± 10 min) + proefexamen (30 min, zorg dat je niet gestoord wordt) · 15 gedaan` |
| Questions and mock done (or no mock due) | `Doel van vandaag gehaald · 32 gedaan` |
| Back after a gap (AC-22), nothing done today | `Welkom terug. Vandaag: 30 vragen (± 15 min)` |
| Target 0 (empty bank / nothing due), no mock | `Vandaag staat er niets klaar. Doe een proefexamen of kom morgen terug.` (existing text, kept) |

- `N` = `today.target`, fixed for the day (AC-28); it does not shrink as mistakes get resolved. Only a date change recalculates it.
- `X` = N × 30 s rounded up to 5 min; minimum `± 5 min` when N ≥ 1. The `±` sign is read by screen readers as "plus min"; acceptable, and the spec wording uses it.
- `n gedaan` = `today.practised`. Shown only when n ≥ 1. "gedaan" can exceed N (extra rounds); still shown.
- "Gehaald" = practised ≥ target **and** (no mock due **or** a mock was saved today).
- "Welkom terug." when the last activity (newest `history`/`seen` day) is before yesterday, and practised = 0. Backlog counts (35 fouten, 40 kaarten) are never shown, also not in the detail line (it shows the capped plan numbers).

### Plan detail line (p.klein)

Reuses today's `parts` text, now with the capped plan: `5 fouten · 4 kaarten · 6 nieuwe vragen (vooral voorrang)`. Singular `1 fout`, `1 kaart`, `1 nieuwe vraag`. Items not yet in the plan are omitted. Hidden when the target is met.

### Mode lines (p.klein, under the detail line, at most one)

| Situation | Text |
|---|---|
| Not planned (no date, past date, ended month) | `Nog geen examendatum: 10 nieuwe vragen per dag.` |
| Month maintenance (AC-26) | `Je examen kan nu elke dag zijn. Daarom geen nieuwe vragen meer: alleen herhalen, en om de 2 dagen een proefexamen.` |
| D = 1 (AC-25) | `Morgen is je examen. Vandaag alleen je open fouten, geen nieuwe vragen en geen proefexamen.` |
| D = 0 (AC-25) | `Vandaag is je examen. Wil je nog iets doen? Herhaal dan alleen een paar fouten.` |
| D = 1 or 0 and 0 open mistakes (target 0) | Target line replaced by: `Geen open fouten meer. Rust goed uit en succes!` No buttons. |
| Shortfall (AC-19), planned modes only | `Je haalt niet alle nieuwe vragen vóór je examen; overweeg een latere datum.` |

The shortfall line can appear together with a mode line only in month mode before the 1st (plan counts to the 1st); then show both, shortfall last. Per the "Decided" section the app does not *suggest* a new date beyond this verbatim AC-19 sentence; no button, no link.

The maintenance prompt "Heb je al een datum? Vul die in voor een beter plan." already exists in the intro card (Part 1, `.datum-hint`, button opens the date field and focuses it). It is **not** repeated in the Vandaag card: one prompt, one place, and it sits directly above.

### Buttons

| State | Primary (`.knop.groot`, `data-act="vandaag"`) | Secondary |
|---|---|---|
| Questions left, nothing done | `Start (15 vragen)` | if mock due: `Proefexamen` (`a.knop.secundair`, `#/examen`) |
| Questions left, some done | `Ga verder (18 vragen)` (remaining = target − gedaan, min 1) | as above |
| Questions done, mock due | `Doe het proefexamen` (`a.knop.groot`, `#/examen`) | `Nog een ronde` (`.knop.secundair`, `data-act="vandaag"`) |
| Nulmeting due (no exam ever) | as rows above | label `Proefexamen (nulmeting)`; the line under the buttons: `Een eerste proefexamen laat zien waar je nu staat.` (p.klein) |
| Target met | none | `Nog een ronde` (`.knop.secundair`) |

- The nulmeting label lives on the button and the explanation line, not in the target line, so the AC-24 string stays verbatim in every case.
- A rolled-over mock (AC-23, due yesterday, not done) looks exactly like a normal due mock: no "te laat" text.
- The mock goes to `#/examen` (the intro page with the "30 minuten, niet stoppen" explanation) rather than starting at once; the user may be on a bus.
- Questions first, mock second: the mock needs a quiet half hour, the questions do not.

### Date change while on the page (AC-28)

When the exam date control changes, only the Vandaag card re-renders (separate render function); the date control and readiness card are not touched, so focus stays in the select or date input. No extra live region: the countdown line is already `role="status"`; a second announcement would double up. `gedaan` stays.

## 3. Readiness card

### Wireframe, "Bijna", 320px (inner width ~258px)

```
+------------------------------------+
| Klaar voor het examen?             |  <h2 id="klaar-kop">
| Bijna: nog 1 proefexamen met 46 of |  p.klaar-status (NEW), 1.1rem bold
| meer goed                          |
| ---------------------------------- |
| Proefexamens        Nog niet       |  li.eis > h3 + span.status
| Minstens 3 proefexamens, de        |  p.klein (eis text, verbatim)
| laatste 3 allemaal 46 of meer goed |
| 2 van 3 gedaan, laagste 47         |  p (numbers)
| [ Doe een proefexamen ]            |  a.knop.secundair href="#/examen"
| ---------------------------------- |
| Onderwerpen         Gehaald        |
| Elk onderwerp 90% of meer goed     |
| over de laatste 20 antwoorden      |
| Alle 13 onderwerpen 90% of meer    |
| > Alle onderwerpen (13)            |  <details>, closed
| ---------------------------------- |
| Oude fouten         Gehaald        |
| Geen open fouten ouder dan 2 dagen |
| Geen fouten van vóór 29 september  |
| ---------------------------------- |
| Gevaarherkenning en vragen met     |  p.noot (verbatim AC-32)
| foto's meet deze app niet. Oefen   |
| die met je theorieboek en de       |
| filmpjes die erbij horen.          |
| Je kent veel van deze vragen al;   |  p.noot
| het echte examen heeft andere      |
| vragen.                            |
| 187 van 243 vragen minstens 1×     |  p.noot
| gezien                             |
+------------------------------------+
```

### Wireframe, eis 2 not met (topic rows)

```
| Onderwerpen         Nog niet       |
| Elk onderwerp 90% of meer goed     |
| over de laatste 20 antwoorden      |
| 9 van 13 onderwerpen gehaald       |
| Voorrang                           |  li.onderwerp-rij (NEW): name bold
| nog geen antwoorden                |  .klein
| [ Oefen Voorrang ]                 |  .knop.klein.secundair
| Snelheid                           |
| 85% (17/20)                        |
| [ Oefen Snelheid ]                 |
| Verlichting                        |
| 88% (15/17), nog te weinig         |
| antwoorden (17/20)                 |
| [ Oefen Verlichting ]              |
| > Alle onderwerpen (13)            |  <details>, closed
```

- Rows are stacked (name / numbers / button), not a table: no sideways scroll at 320px and room for the long AC-30 text. Each row has `border-top: 1px solid var(--line)`.
- Outside `<details>`: the **3 lowest** unmet topics, with buttons. Inside `<details>` "Alle onderwerpen (13)": every topic in the same order and format (unmet ones with button, met ones with `Gehaald` status and no button). The 3 visible ones are repeated inside; that keeps the list complete and simple.
- When eis 2 is met: summary `Alle 13 onderwerpen 90% of meer`, and the `<details>` only.
- Order "lowest first": topics with no answers first, then by percentage ascending, ties fewer answers first, then display name (`localeCompare(…, 'nl')`). Met topics sort after unmet ones.
- Percentage: `Math.floor(ok / n × 100)` so a topic never shows "90%" while it is below 90%.
- Topics with no items left in the bank are skipped (AC-34); "13" is the count of topics that still have items.

### Status headline (p.klaar-status)

| Situation | Text |
|---|---|
| No history entries and no exams | `Nog geen gegevens` + p: `Maak eerst vragen bij Vandaag. Dan zie je hier hoe ver je bent.` + `button.link-knop.in-tekst` `Naar Vandaag` |
| All 3 met | `Klaar volgens deze app` |
| Only eis 1 unmet | `Bijna: nog 1 proefexamen met 46 of meer goed` / `Bijna: nog 2 proefexamens met 46 of meer goed` |
| Only eis 2 unmet | `Bijna: nog 1 onderwerp (Voorrang)` / `Bijna: nog 3 onderwerpen` |
| Only eis 3 unmet | `Bijna: nog 1 oude fout` / `Bijna: nog 3 oude fouten` |
| 2 or 3 unmet | `Nog niet` |

"Nog n proefexamens" = 3 minus the number of most recent exams in a row with 46 or more (max 3). So 2 good exams → "nog 1"; last 3 = 47, 45, 48 → "nog 2". The spec example "Bijna: nog 1 proefexamen" is the prefix of the first text; tests should match that prefix.

"Naar Vandaag" moves focus to the Vandaag `<h2 tabindex="-1">` and scrolls it into view (it is a same-page jump; a `#vandaag` href would clash with the hash router). In the no-data state the eisen still render with their numbers, but without per-eis buttons; the honesty lines show as always (AC-32).

### Eisen (ol.eisen, NEW)

Each `li.eis`: `<h3>` short name + `span.status` word, `p.klein` with the eis text verbatim from AC-29, `p` with numbers, then button(s) if unmet.

| Eis | h3 | Numbers, examples | Button if unmet |
|---|---|---|---|
| 1 | `Proefexamens` | `0 van 3 gedaan` · `2 van 3 gedaan, laagste 45` · `Laatste 3: 47, 45, 48 (laagste 45)` (oldest first) · met: `Laatste 3: 47, 48, 49` | `Doe een proefexamen` (`a.knop.secundair`, `#/examen`) |
| 2 | `Onderwerpen` | `9 van 13 onderwerpen gehaald` + topic rows · met: `Alle 13 onderwerpen 90% of meer` | per topic `Oefen <onderwerp>` (`button.knop.klein.secundair`, `data-act="onderwerp"`, `data-topic`) |
| 3 | `Oude fouten` | `3 fouten van vóór 28 september` / `1 fout van vóór 28 september` · met with open recent ones: `Geen fouten van vóór 28 september` · no open mistakes: `Geen open fouten` | `Oefen oude fouten (3)` (`button.knop.secundair`, `data-act="oude-fouten"`) |

- Status word: `Gehaald` (`.status.goed`) or `Nog niet` (`.status`, muted). The word carries the meaning; colour is extra.
- The cut-off day is today − 2 (on 30 September: "vóór 28 september"), via `U.dayLabel` without weekday/year. Mistakes without `last` count as old (spec edge case).
- Eis 1 counts timed-out exams (Decided). Topic names in rows and buttons as in `RB.topics`, capital first.

### Honesty lines (AC-32, every status, including Klaar)

Three `p.noot` at the bottom of the card, verbatim:

1. `Gevaarherkenning en vragen met foto's meet deze app niet. Oefen die met je theorieboek en de filmpjes die erbij horen.`
2. `Je kent veel van deze vragen al; het echte examen heeft andere vragen.`
3. `187 van 243 vragen minstens 1× gezien` (both numbers computed; 243 = all items including voorrang scenarios).

The Part 2 open point 9 (44 vs 46): add one sentence to the eis-1 text line as `p.klein` under it: `Je hebt er 44 nodig om te slagen; 46 geeft wat marge.` Recommended, see Open questions.

### Actions from the readiness card

| Button | What happens |
|---|---|
| `Doe een proefexamen` | Navigate to `#/examen`. |
| `Oefen <onderwerp>` | Session titled `<Onderwerp>`, max 15: open mistakes of that topic (AC-21 order), then never-seen items, then oldest `seen`. Summary: `Nog een ronde` · `Naar start`. |
| `Oefen oude fouten (3)` | Session titled `Oude fouten` with the open mistakes from before the cut-off, oldest `last` first, all of them (no cap; the number is on the button). Summary note as "Fouten oefenen" (Part 2). |

Sessions focus their `<h1>` on the first question (existing `runSession`). Back on start ("Naar start"), the page renders at the top (existing).

## 4. Empty and broken data (AC-35)

| Situation | What shows |
|---|---|
| First use | Target `Vandaag: 5 vragen (± 5 min) + proefexamen (…)` (10 new, halved), button `Proefexamen (nulmeting)` + its line, mode line "Nog geen examendatum …"; readiness `Nog geen gegevens`, eis 1 `0 van 3 gedaan`, eis 2 `0 van 13 onderwerpen gehaald` (all rows `nog geen antwoorden`), eis 3 `Geen open fouten`, `0 van 243 vragen minstens 1× gezien`. |
| `today` null or invalid | Recomputed on load; `gedaan` treated as 0 (no line). |
| Exam with broken score | Dropped by `clean()`; eis 1 counts the rest. |
| Number that cannot be computed | Show `–` in its place (e.g. `laagste –`), never `NaN` or `undefined`. |
| Storage blocked | Nothing extra; state lives in memory. |

## 5. Accessibility

- Headings: page h1 (intro), h2 `Vandaag`, h2 `Klaar voor het examen?`, h3 per eis. Topic names in rows are `<strong>`, not headings (13 extra headings would clutter the outline).
- Readiness `<section class="kaart klaar" aria-labelledby="klaar-kop">`; the eisen are an `<ol>` so a screen reader says "lijst, 3 items".
- Status never by colour alone: headline is text; each eis has the words `Gehaald` / `Nog niet`; topic rows have numbers and, when met, `Gehaald`.
- Button names are complete on their own: `Oefen Voorrang`, `Oefen oude fouten (3)`, `Doe een proefexamen`. No "Oefen" alone.
- Focus order follows the DOM: date controls → Vandaag buttons → eis 1 button → topic buttons → details summary → eis 3 button → tegels. No focus moves on page load. After a date change focus stays on the control.
- No `aria-live` on the target line or readiness (they only change on re-render or date change; see 2).
- `<details><summary>` is natively keyboard-operable; summary text `Alle onderwerpen (13)`.
- Touch targets: `.knop.klein` gets `min-height: 44px` inside `.onderwerp-rij` (new rule).
- Contrast, existing tokens only: `--text` on `--card`; `--muted` on `--card` about 5.4:1 light / 6.5:1 dark (`.klein`, `.noot`, `.status`); `--good` on `--card` about 5.4:1 light / about 8:1 dark (`.status.goed`); `.knop.secundair` `--text` on `--bg`; primary `--accent-text` on `--accent` 5.2:1.

## 6. Classes and tokens

No new tokens. Reuse: `.kaart`, `.vandaag`, `.knop`, `.knop.groot`, `.knop.klein`, `.knop.secundair`, `.link-knop.in-tekst`, `.rij`, `.klein`, `.noot`, `.status`, `.status.goed`, `details summary`.

New (plain CSS, mobile-first):

- `.doel { font-weight: 600; }` (and keep `.vandaag p { margin: 0 }`; add `.vandaag p + p { margin-top: 6px; }`).
- `.klaar-status { font-size: 1.1rem; font-weight: 700; margin: 0 0 8px; }`
- `.eisen { list-style: none; padding: 0; margin: 0; }` `.eis { border-top: 1px solid var(--line); padding: 10px 0; }` `.eis h3 { margin: 0; display: flex; justify-content: space-between; gap: 8px; }` `.eis p { margin: 2px 0; }`
- `.onderwerp-rij { list-style: none; border-top: 1px solid var(--line); padding: 8px 0; overflow-wrap: anywhere; }` `.onderwerp-rij .knop { margin-top: 6px; min-height: 44px; }` (inside `ul.onderwerpen-lijst`, padding 0)
- `.klaar .noot { margin: 6px 0 0; }`

## 7. Responsive

- **320px:** everything stacks; the AC-24 target line wraps to 4 lines; buttons each take a row through `.rij` wrapping. Eis h3 and status word share a line ("Proefexamens  Nog niet"); if they do not fit, flex wraps the status under it.
- **360–520px:** as wireframes. Vandaag buttons sit side by side when they fit.
- **≥ 520px / desktop:** `main` max 760px; topic rows could become two columns, but keep one column (scanning lowest-first top to bottom matters more than height).

## 8. Open questions (with recommended default)

1. **"Bijna" with many topics.** If only eis 2 is unmet with 13 topics open, the headline says "Bijna: nog 13 onderwerpen", which oversells. *Default:* "Bijna" for eis 2 only when at most 3 topics are unmet; otherwise "Nog niet".
2. **"Welkom terug." threshold.** *Default:* last activity before yesterday (at least one full day missed).
3. **"Oefen <onderwerp>" content** is not defined in the spec. *Default:* as in section 3 (mistakes, then unseen, then oldest seen; max 15).
4. **44 vs 46 sentence** under eis 1 (Part 2 open point 9). *Default:* add `Je hebt er 44 nodig om te slagen; 46 geeft wat marge.`
5. **Old exams with `total` other than 50** for eis 1. *Default:* count only exams with `total` 50; the others are skipped silently.
6. **Duplicate honesty text.** The page-bottom `.noot` also mentions gevaarherkenning. *Default:* keep both for now (different context); trim in a later content pass.

### Decided (1 October 2026)

1. **User:** literal spec. Any single unmet eis gives "Bijna: …", also when eis 2 has many topics open (e.g. "Bijna: nog 13 onderwerpen").
2. **User:** default. "Welkom terug." when the last activity was before yesterday and nothing is done today.
3. **User:** default. Max 15: open mistakes of that topic, then never seen, then oldest `seen`.
4. **User:** default. Show "Je hebt er 44 nodig om te slagen; 46 geeft wat marge." under eis 1.
5. **PM:** default. Only exams with `total` 50 count for eis 1.
6. **PM:** default. Keep both texts for now.
