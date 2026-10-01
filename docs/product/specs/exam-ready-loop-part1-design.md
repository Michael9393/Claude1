# Design: Exam-ready loop, Part 1

- **Status:** proposal (30 September 2026), for review by the main session.
- **Spec:** [exam-ready-loop.md](exam-ready-loop.md), AC-1 … AC-9 and AC-35.
- **Screens touched:** start page (intro card), mock-exam result screen. Everything else in Part 1 (history, `seen`, `exams[].topics`) is invisible.

## 1. Start page: exam date

### Choice of control

The spec asks for three options plus a month list or a date field. Three radio buttons with 44px touch targets would add about 130px to the intro card and push the "Vandaag" card below the fold on 360×740. So the proposal uses **two native controls on one row**:

1. a `<select>` for the kind of date (the three options, exact AC-7 labels);
2. next to it, only when needed, the month `<select>` or the `<input type="date">`.

Height: one control row (44px) plus one status line, the same as today's date field plus countdown. The AC-9 prompt adds one short line only in the 3 weeks before the month.

### Wireframes (360px, card inner width about 298px)

Not planned (default, also for broken or missing data):

```
+--------------------------------------+
| Oefenen voor je theorie-examen       |
| auto (B)                             |
| Gratis, zonder account ...           |
|                                      |
| Examendatum                          |
| [ Nog niet gepland          v ]      |
| Weet je ongeveer wanneer? Kies dan   |
| een maand.                           |
+--------------------------------------+
+== Vandaag ===========================+
```

Month, more than 21 days before the 1st (30 September, month november 2026):

```
| Examendatum                          |
| [ Maand (schatting) v ] [nov 2026 v] |   <- wraps under each other below ~330px
| Examen in november (schatting) ·     |
| plan rekent met 1 november           |
```

Month, from 21 days before the 1st (11 to 31 October):

```
| Examendatum                          |
| [ Maand (schatting) v ] [nov 2026 v] |
| Examen in november (schatting) ·     |
| plan rekent met 1 november           |
| Al geboekt? _Vul je examendatum in_  |   <- underlined part is a button
| voor een beter plan.                 |
```

Month, the month has started (1 to 30 November; text by the designer, see conflicts):

```
| [ Maand (schatting) v ] [nov 2026 v] |
| Examen in november (schatting) · het |
| kan nu elke dag zijn                 |
| Heb je al een datum? _Vul die in_    |
| voor een beter plan.                 |
```

Month has ended (1 December onwards):

```
| [ Maand (schatting) v ] [nov 2026 (voorbij) v] |
| November is voorbij. Kies een nieuwe |
| maand of een precieze datum.         |
```

Precise date, future / today / past:

```
| [ Precieze datum v ] [ 20-11-2026 ]  |
| Nog 51 dagen tot je examen.          |      (existing text)
| Vandaag is je examen. Succes!        |      (existing text, bold)
| Je examen was op 20 november. Heb je |
| een nieuwe datum? Vul die hier in.   |
```

Precise date chosen, field still empty:

```
| [ Precieze datum v ] [ dd-mm-jjjj ]  |
| Kies de dag van je examen.           |
| (with a saved month:) Kies de dag van|
| je examen. Tot dan rekent het plan   |
| met november.                        |
```

### Exact Dutch texts

| Where | Text |
|---|---|
| Label above the row | `Examendatum` |
| Kind select options | `Nog niet gepland` · `Maand (schatting)` · `Precieze datum` |
| Month options | `september 2026`, `oktober 2026`, … `augustus 2027` (current month + next 11, lowercase as in Dutch) |
| Month option for an ended month | `november 2026 (voorbij)` (only shown while it is the saved value) |
| Accessible name month select | `Maand van je examen` (`aria-label`) |
| Accessible name date field | `Dag van je examen` (`aria-label`) |
| Status, not planned | `Weet je ongeveer wanneer? Kies dan een maand.` |
| Status, month in the future (AC-8) | `Examen in november (schatting) · plan rekent met 1 november` |
| Prompt, 21 days before the 1st (AC-9) | `Al geboekt? Vul je examendatum in voor een beter plan.` — "Vul je examendatum in" is the button |
| Status, month has started | `Examen in november (schatting) · het kan nu elke dag zijn` |
| Prompt, month has started (AC-26 text) | `Heb je al een datum? Vul die in voor een beter plan.` — "Vul die in" is the button |
| Status, month ended (AC-8) | `November is voorbij. Kies een nieuwe maand of een precieze datum.` |
| Status, precise date > 1 day | `Nog <strong>51</strong> dagen tot je examen.` (existing) |
| Status, precise date tomorrow | `Nog <strong>1</strong> dag tot je examen.` (existing) |
| Status, precise date today | `<strong>Vandaag is je examen. Succes!</strong>` (existing) |
| Status, precise date past (AC-8) | `Je examen was op 20 november. Heb je een nieuwe datum? Vul die hier in.` (replaces "Je examendatum is voorbij.") |
| Status, precise chosen, no date yet | `Kies de dag van je examen.` + with a saved month ` Tot dan rekent het plan met november.` |
| Status, typed date in the past | `Die dag is al voorbij. Kies een dag vanaf vandaag.` (not saved) |

Month names in status lines have no year: the list covers 12 months, so a month name is never ambiguous. The status line uses the month in lowercase, except at the start of a sentence ("November is voorbij.").

The past-date text is deliberately neutral: the user may simply have done the exam. No red, no warning colour.

### Behaviour and data

- The kind select shows what is saved: `examDate` set → "Precieze datum"; else a valid `examMonth` → "Maand (schatting)"; else "Nog niet gepland". A broken `examMonth` or impossible `examDate` (dropped by `clean()`) therefore shows "Nog niet gepland" (AC-35).
- **→ Nog niet gepland:** saves `examDate = null`, `examMonth = null`. The second control disappears.
- **→ Maand (schatting):** saves at once, so the user does not end up in a half state. Preselected month: the month of the saved `examDate` if that is in the list, otherwise **next month** (on 30 September: oktober 2026). Saves `examMonth`, `examDate = null`. Changing the month select saves the new month.
- **→ Precieze datum:** shows an empty date field; nothing is saved until a valid date is entered. The kind "Precieze datum" is kept in a view variable so a re-render does not throw it away; it is forgotten when the user leaves the start page. Until then the saved month (if any) stays in force, which the status line says.
- **Date field:** `min` = today. A complete date from today onwards saves `examDate` (and clears `examMonth`). An empty field (user clears it) saves `examDate = null` and falls back to the saved month or "Nog niet gepland". A date before today is not saved; the status line shows the "Die dag is al voorbij" text.
- **Prompt buttons** ("Vul je examendatum in", "Vul die in", and "Vul die hier in" is plain text, no button needed because the field is right there): switch the kind to "Precieze datum" and move focus to the date field.
- **Ended month:** the select keeps the saved month as an extra first option "november 2026 (voorbij)" so the control is truthful. Choosing any other month replaces it. The plan (Part 3) treats this as not planned.
- The prompt window is from 21 days before the 1st of the month up to the last day before the 1st (AC-9: shown on 11 October, not on 10 October). From the 1st the "month has started" texts take over.

### Keyboard and focus

- Tab order: menu → kind select → month select or date field → prompt button (if shown) → "Start" in Vandaag.
- **Focus must survive the change.** Today `views.start()` re-renders all of `main` on change, which drops focus to `<body>`. Chrome also fires `change` on every arrow key in a closed `<select>`, and on every digit while typing the year in a date field (0002, 0020, 0202, 2026). Two rules:
  1. After saving, update only the date block (status line, second control), not the whole page; or, if the view is re-rendered, put focus back on the control that fired, with the same value.
  2. Never replace the date field while the user types in it. Update only the status line on its `change`.
- After choosing "Maand (schatting)" or "Precieze datum" in the kind select, focus **stays** on the kind select (moving it would break arrow-key browsing). The new control is next in the tab order.
- After a prompt button, focus goes to the date field.

### Screen reader

- `<label for>` "Examendatum" on the kind select: reads "Examendatum, Nog niet gepland, keuzelijst".
- Status line: `<p class="aftellen" role="status">`, kept in the DOM across updates (only its content changes), so the new countdown is announced once, politely.
- The prompt button is a real `<button>` inside the sentence, so it reads "Vul je examendatum in, knop".

### Classes

Reuse:

- `.kaart.intro`, `.datum` (wrapper), `.aftellen` (status line), `.klein` (prompt line), `.link-knop` (prompt button).

Add (no new tokens):

- `.datum` becomes a block wrapper (`<div>`, no longer the `<label>`). Its `label` sits on its own line at normal text size (not `.klein`, it must stay easy to read): `display: block; font-weight: 600; margin-bottom: 4px`.
- `.datum-rij`: `display: flex; flex-wrap: wrap; gap: 8px;` so the two controls sit side by side at ~340px and up, and stack below.
- Extend the existing `.datum input` rule to `.datum select` and give both `min-height: 44px` (touch target) and `max-width: 100%`.
- `.link-knop` inside running text: add a modifier `.link-knop.in-tekst` with `padding: 0; font-size: inherit; color: var(--accent);` so the button sits inline in the sentence and uses the link colour. Its touch height is the line height; acceptable because the date field is also reachable directly.

### Responsive

- **320px** (card inner width about 258px): the two controls stack; each is at most 100% wide. "Maand (schatting)" fits (about 170px with arrow). Status line wraps to 2 lines, prompt to 2 lines.
- **360px** (about 298px): stack as well in most fonts; that is fine, the row is still 2 × 44px + gap.
- **≥ 400px:** both controls on one row.
- Desktop: unchanged card width (`main` max 760px).

Height budget at 360×740 (not planned vs today): +10px (44px control instead of ~34px). Month with prompt: about +90px. The "Vandaag" heading and first line stay above the fold; the Start button may sit just below in the prompt window. If that is too much, an optional trim: shorten the intro sentence (`.belofte`) to one line, "Gratis, zonder account en zonder reclame." The source line per question is shown in the questions anyway. Not required for Part 1.

### States

| State | What shows |
|---|---|
| First use / no date | Kind "Nog niet gepland", status "Weet je ongeveer wanneer? …" |
| Broken saved data (AC-35) | Same as first use |
| Month, > 21 days away | AC-8 status |
| Month, ≤ 21 days away | AC-8 status + AC-9 prompt |
| Month, in progress | "het kan nu elke dag zijn" + "Heb je al een datum? …" |
| Month ended | "November is voorbij. …", option marked "(voorbij)" |
| Precise, future / tomorrow / today | Existing countdown texts |
| Precise, past | "Je examen was op … Heb je een nieuwe datum? …" |
| Precise chosen, empty | "Kies de dag van je examen." (+ month fallback) |
| Invalid typed date | "Die dag is al voorbij. …", nothing saved |
| Storage blocked | No message (spec); value kept in memory |

## 2. Mock-exam result: honesty note (AC-6, #9)

### Wireframe (360px)

```
+--------------------------------------+
| Uitslag: Geslaagd                    |
| 47 / 50 goed                         |
| Je had er 46 nodig. Goed bezig!      |   <- pass line (existing)
| Gevaarherkenning en vragen met       |   <- NEW, .noot, directly under
| foto's zitten niet in dit            |
| proefexamen. Een voldoende hier is   |
| dus geen garantie voor het echte     |
| examen.                              |
| Tijd: ongeveer 21 van de 30 minuten. |
| Nakijken ...                         |
```

### Text

`Gevaarherkenning en vragen met foto's zitten niet in dit proefexamen. Een voldoende hier is dus geen garantie voor het echte examen.`

- Shown on **every** result: geslaagd, gezakt and time-up. For a fail the sentence still reads correctly, and it keeps the note in the same place every time.
- Same words ("Gevaarherkenning en vragen met foto's") as the readiness note of AC-32, so the user meets one term.
- Place: directly after the pass line `<p>`, before the time / time-up line. Class `.noot` (muted, .88rem). Contrast: `--muted` on `--card` is about 5.4:1 (light) and 6.5:1 (dark).
- Not in `.fout-tekst` or a coloured box: it is information, not a warning, and it must not compete with the score.

### Other places

- The Proefexamen intro card already has a similar note (`views.examen`). Align its wording with the new one so the two do not differ: `In het echte examen zitten ook gevaarherkenning en vragen met foto's. Die zitten niet in dit proefexamen, dus een voldoende hier is geen garantie.`
- The "Eerdere proefexamens" table and the start-page tile ("Laatste: geslaagd") get **no** extra note; the intro card sits right above the table, and the tile is too small.

### Focus

After the result renders, move focus to the `<h1>` (give it `tabindex="-1"`) instead of only `scrollTo(0, 0)`. A screen reader then reads "Uitslag: Geslaagd", and the score, pass line and honesty note follow in reading order.

## 3. Other visible effects of Part 1

- AC-1 … AC-5 have no UI. The Eerdere proefexamens table keeps working for exams with and without `topics` (AC-35).
- Nothing in Vandaag, Flashcards or Foutenlogboek changes in Part 1.

## Conflicts and open points

1. **Label mismatch:** the task brief says "Exacte datum"; AC-7 says "Precieze datum". This design uses the AC text.
2. **"plan rekent met 1 november" in Part 1:** the plan only starts using the date in Part 3. Between Part 1 and Part 3 the line promises something the plan does not do yet. Acceptable if Part 3 follows soon; otherwise show only "Examen in november (schatting)" until Part 3.
3. **No text for "month has started" in Part 1:** AC-8 covers a future month and an ended month; the days in the month itself are only in Part 3 (AC-26). Showing "plan rekent met 1 november" on 15 November would be wrong, so this design adds "het kan nu elke dag zijn" and uses AC-26's prompt already in Part 1. Needs a nod.
4. **Choosing the current month** (september on 30 September) goes straight to the "month has started" state. Allowed by AC-7 (current month is in the list); no special handling.
5. **Default month on switching to "Maand":** the spec does not say. Proposal: next month, or the month of the saved precise date.
6. **Radio buttons vs select:** AC-7 says "offers" three options without a control type. A select is chosen for height; if tests look for radios, the test must follow this design.
7. **Existing bug that this work will hit:** the start page re-renders on every date `change`, dropping focus and breaking typing in the date field (see Keyboard and focus). Must be fixed as part of AC-7, not later.
8. **Past precise date:** the existing text "Je examendatum is voorbij." does not "ask for a new one" (AC-8); replaced as above.
