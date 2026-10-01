# Design: Exam-ready loop, Part 2

- **Status:** proposal (1 October 2026), for review by the main session.
- **Spec:** [exam-ready-loop.md](exam-ready-loop.md), AC-10 … AC-16 and AC-35.
- **Builds on:** [Part 1 design](exam-ready-loop-part1-design.md) (honesty note under the pass line, focus on the result `<h1>`).
- **Screens touched:** mock-exam result (`runExam` → `results()`), Foutenlogboek (`views.fouten`), session summary (`runSession` → `summary()`) for "Fouten oefenen" and the new "Zwakke onderwerpen" session. AC-14 and AC-15 are already true in `store.recordAnswer` (streak 1 stays open on the same day; a wrong answer sets `streak` 0 and `okDay` null) and have no UI of their own. AC-16 means no change in Vandaag.

## 1. Mock-exam result

### Order of the page

Above the fold on 360×740 the user should see: did I pass, how many points, better or worse than last time, where did I lose points, and what do I do now. The full per-topic table and the Nakijken list come after that.

Three cards instead of one (today everything sits in one card):

1. **Uitslag** card: `<h1>`, score, change line (new), pass line, honesty note, time line, weak-topic summary line (new), action row with "Oefen zwakke onderwerpen" (new) and a short hint.
2. **Per onderwerp** card (new): the table of AC-10.
3. **Nakijken** card: the existing list, then the bottom action row.

Separate cards make the long page easier to scan and give each block its own heading. The `<h2>Nakijken</h2>` and the `.nakijk` list keep their markup; only the wrapper changes.

### Wireframe, gezakt with a previous exam (360px, card inner width about 298px)

```
+--------------------------------------+  header + menu (2 rows), ~130px
+--------------------------------------+
| Uitslag: Gezakt                      |  <h1 tabindex="-1">, gets focus
| 43 / 50 goed                         |  .score (existing)
| +3 sinds vorige: 40 / 50             |  NEW change line
| Je had er 44 nodig, dus nog 1 meer.  |  pass line (existing)
| Kijk je fouten na en probeer het nog |
| eens.                                |
| Gevaarherkenning en vragen met       |  .noot (Part 1)
| foto's zitten niet in dit            |
| proefexamen. Een voldoende hier is   |
| dus geen garantie voor het echte     |
| examen.                              |
| Tijd: ongeveer 24 van de 30 minuten. |  .klein (existing)
| Je fouten zaten vooral bij           |  NEW weak-topic line
| Verkeersborden, Voorrang en Snelheid.|
| [ Oefen zwakke onderwerpen (12) ]    |  .knop (primary), ~y 640
| Kijk eerst je fouten na (hieronder). |  .klein hint
| Deze uitslag kun je later niet meer  |
| openen.                              |
+--------------------------------------+  ---- fold at 740 ----
+--------------------------------------+
| Per onderwerp                        |  <h2>
| Onderwerp               Goed    Fout |  .tabel.onderwerpen, th muted
| Verkeersborden        5 van 7      2 |
| Voorrang              4 van 6      2 |
| Snelheid              3 van 4      1 |
| Alcohol, drugs en     3 van 4      1 |  long name wraps, numbers stay
| medicijnen                           |  on the first line (vertical-align: top)
| Andere weggebruikers  5 van 5      0 |
| …                                    |
+--------------------------------------+
+--------------------------------------+
| Nakijken                             |  <h2> (existing list)
| 1. …                                 |
| …                                    |
| [ Oefen zwakke onderwerpen (12) ]    |  repeated, primary
| [ Naar foutenlogboek ] [ Nieuw       |  .knop.secundair both
|   proefexamen ]                      |
+--------------------------------------+
```

Height check at 360×740 (estimates with the current fonts): header ~130, card top ~28, h1 38, score 50, change line 32, pass line 3 lines 88, honesty note 4 lines 100, time 38, weak line 2 lines 64, button 56 → the primary button ends at about 700px. The hint and the table start just below the fold. On a pass (pass line one line) everything moves up about 50px and the table heading shows.

### Change line (AC-11)

Placed directly under the big score, before the pass line, plain `<p>` (normal text colour, no class). It compares with the newest exam saved **before** this one (`exams[exams.length - 2]` after `addExam`), timed-out exams included.

| Case | Text |
|---|---|
| Better | `+3 sinds vorige: 40 / 50` |
| Worse | `-2 sinds vorige: 45 / 50` |
| Same | `Zelfde score als vorige: 43 / 50` |
| First exam ever | no line |
| Previous exam is the old format (no `total`, only `kennis` / `inzicht`) | no line |
| Previous exam has a different `total` than this one | no line (a difference between a 40- and a 50-question exam means nothing) |
| Previous exam dropped by `clean()` (broken data, AC-35) | compare with the newest valid one, or no line |

- The score itself is not repeated (the AC example starts with "43/50, "; see Conflicts 1).
- Use the ASCII hyphen-minus for the negative sign, so it is easy to find in tests; screen readers read "-2" as "min 2".
- No colour and no arrow: the sign and the words carry the meaning, and a drop after a harder exam is not a "failure" worth a red line.
- Number format "40 / 50" with spaces, the same as `examScore()` and the big score.

### Weak-topic line and button (AC-12)

Shown only when at least one topic has a wrong answer (open questions at time-up count as wrong, as in AC-5; see Conflicts 2).

"The weak topics" are the first 3 rows of the AC-10 sort among rows with fout > 0. The line names exactly the topics the session will use, so the button is never a black box.

| Wrong topics | Line |
|---|---|
| 1 | `Je fouten zaten bij Voorrang.` |
| 2 | `Je fouten zaten bij Voorrang en Snelheid.` |
| 3 | `Je fouten zaten bij Verkeersborden, Voorrang en Snelheid.` |
| 4 or more | `Je fouten zaten vooral bij Verkeersborden, Voorrang en Snelheid.` |

Topic names as in `RB.topics` (capital first letter, they are names in this line just as in the table).

Button: `Oefen zwakke onderwerpen (12)`, where 12 is the length of the session list (at most 15), computed when the result renders. Class `.knop` (primary), `data-act="zwak"`. If the list would be empty (cannot happen when fout > 0, but defensively), no button and no line.

Hint under the top button, `.klein`: `Kijk eerst je fouten na (hieronder). Deze uitslag kun je later niet meer openen.` Reopening old results is out of scope, so the user must know that leaving loses the Nakijken list.

Bottom action row (after Nakijken):

| Wrong > 0 | Wrong = 0 |
|---|---|
| `Oefen zwakke onderwerpen (12)` `.knop` · `Naar foutenlogboek` `.knop.secundair` · `Nieuw proefexamen` `.knop.secundair` | `Nieuw proefexamen` `.knop` · `Naar foutenlogboek` `.knop.secundair` |

- "Nieuw proefexamen" becomes secondary when there are mistakes: right after a mock, practising the weak topics is the better next step. With 0 wrong it stays the primary action.
- The weak button appears twice (top and bottom) because Nakijken can be 10+ items with crossing drawings. Both have the same text and `data-act="zwak"`; the existing `data-act="opnieuw"` stays on "Nieuw proefexamen".
- The top card has no "Nieuw proefexamen" button: one clear action above the fold.

### Per-topic table (AC-10)

```html
<section class="kaart">
  <h2 id="per-onderwerp">Per onderwerp</h2>
  <table class="tabel onderwerpen" aria-labelledby="per-onderwerp">
    <thead><tr><th scope="col">Onderwerp</th><th scope="col" class="num">Goed</th><th scope="col" class="num">Fout</th></tr></thead>
    <tbody><tr><td>Verkeersborden</td><td class="num">5 van 7</td><td class="num"><strong>2</strong></td></tr> …</tbody>
  </table>
  <!-- only on time-up: -->
  <p class="klein">Vragen die je niet op tijd hebt beantwoord, tellen hier als fout.</p>
</section>
```

(Markup sketch for structure only; the developer writes the real code.)

- Sort exactly as AC-10: most fout first; ties more gevraagd first; then topic name (display name, `localeCompare(…, 'nl')`).
- "Goed" shows `5 van 7` (goed van gevraagd). "van" instead of "/" because a Dutch screen reader reads "5 / 7" as "5 schuine streep 7"; "5 van 7" reads naturally and is B1. See Conflicts 3.
- "Fout" shows the number; bold (`<strong>`) when > 0, plain `0` otherwise. Bold is the non-colour signal; no red, no bars. The table then answers "where do I lose points" in the first rows.
- All topics in this exam are listed, also those with 0 fout (AC-10 "every topic"). Rows add up to the score (AC-5); no total row needed, the score is right above.
- Data comes from the `topics` just saved with this exam, not from the live answers, so the table and the saved exam always match.
- A topic key without a name in `RB.topics` shows the key (existing `topicName()` fallback). A topic that has no items any more (AC-34) cannot be in a just-finished exam.

### States

| State | What shows |
|---|---|
| First exam ever (nulmeting) | No change line. Everything else as normal. |
| Previous exam old format / other total / broken | No change line. |
| Gezakt, with wrong answers | Full layout as in the wireframe. |
| Geslaagd, with wrong answers | Same layout; pass line one line ("Je had er 44 nodig. Goed bezig!"). Weak line and button still show: there are still points to win. |
| All correct (50 / 50) | No weak line, no top button, no hint. Table shows all rows with `0` fout, sorted by gevraagd, then name. "Alles goed!" instead of Nakijken (existing). Bottom row: `Nieuw proefexamen` (primary) · `Naar foutenlogboek`. |
| Time up | Existing `.fout-tekst` line "De tijd was om. 7 vragen tellen als fout." replaces the time line. Table counts the open questions as fout, with the footnote. Weak line and button are based on the table, so open questions also make a topic "weak" and appear in the session (AC-12 "not answered correctly in this exam"). |
| Time up with 0 answered | Score 0 / 50, every row "0 van n", weak line names the 3 biggest topics. Nakijken shows "Alles goed!" today because `wrong` only counts answered questions; change that text when `answers.length < list.length` to: `Je hebt geen vragen fout beantwoord, maar niet alle vragen op tijd gedaan.` (only when there are no answered wrong ones). |
| Storage blocked | Nothing extra (spec); the result still renders from memory. |

### Keyboard and focus

- After the result renders: focus on the `<h1>` (existing). Reading order follows the DOM: score, change line, pass line, honesty note, time, weak line, button, hint, table, Nakijken, bottom row.
- Tab order: top "Oefen zwakke onderwerpen" → table has no focusable items → Nakijken has none → bottom buttons in visual order.
- After "Oefen zwakke onderwerpen": the session's first question renders. Today `runSession` does not move focus (the clicked button disappears and focus falls to `<body>`). Same for every session; proposed small fix for all sessions: give the session `<h1>` `tabindex="-1"` and focus it on the first question only. Not required for the ACs.

### Screen reader

- `<h1>` reads "Uitslag: Gezakt" (the status span is text, not only colour).
- The change line reads "plus 3 sinds vorige: 40 / 50" or "min 2 …".
- The table has `aria-labelledby` to its heading and `scope="col"` headers, so each cell reads as "Goed, 5 van 7" / "Fout, 2".
- The two weak buttons have the same name; that is fine because they do the same thing.

### Classes

Reuse: `.kaart`, `.score`, `.noot`, `.klein`, `.fout-tekst`, `.rij`, `.knop`, `.knop.secundair`, `.tabel`, `.nakijk`.

Add (no new tokens):

- `.tabel .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; width: 1%; }` — numbers stay on one line and the name column takes the rest, so long names wrap instead of scrolling sideways.
- `.onderwerpen td:first-child { overflow-wrap: anywhere; }` — safety for very narrow screens or large text settings.

### Responsive

- **320px** (inner width about 258px): number columns about 60px + 40px; name column about 150px. "Alcohol, drugs en medicijnen" and "Verkeerslichten en regelaars" wrap to 2 lines; no sideways scroll. Button text "Oefen zwakke onderwerpen (12)" fits on one line (about 250px at 16px semibold); if it does not, `.knop` wraps its text, which is acceptable.
- **360–520px:** names up to about 26 characters fit on one line.
- **≥ 520px / desktop:** same layout; `main` max 760px. The bottom row sits on one line.
- Large text (200% zoom): the table still fits because only the name column wraps.

### Contrast

Only existing tokens: `--text` on `--card`, `--muted` on `--card` (about 5.4:1 light, 6.5:1 dark) for `th`, `.noot`, `.klein`. The bold fout numbers use `--text`. See Conflicts 6 for an existing `--good` problem.

## 2. Foutenlogboek (AC-13)

### What changes

| Today | New |
|---|---|
| Line "x fouten had je vandaag al goed. Die komen morgen terug." | Replaced by the line below (they no longer "come back tomorrow", you can practise them now). |
| "Oefen mijn fouten (n)": n = open mistakes **not** right today; disabled when all are right today | n = **all** open mistakes; disabled only when there are 0 open. Same number as in the intro sentence. |
| Per-topic "Oefen": only mistakes not right today; disabled when all are | All open mistakes of that topic; disabled only when that topic has 0 open. |
| Open fouten list: meta text ends with " · vandaag goed, morgen nog een keer" | Own line under the meta text: `Vandaag al goed. Morgen nog 1× goed, dan is hij weg.` |
| Session list: filters out mistakes right today | Keeps them (only drops resolved ones). |

### Wireframe (360px), 4 open, 1 right today

```
+--------------------------------------+
| Foutenlogboek                        |
| 4 open fouten. Een fout is opgelost  |
| als je die vraag daarna goed hebt op |
| twee verschillende dagen. Zo weet je |
| zeker dat je het onthoudt.           |
| 1 daarvan had je vandaag al goed. Die|  .klein, replaces the old line
| is pas weg als je hem morgen weer    |
| goed hebt.                           |
| [ Oefen mijn fouten (4) ]            |
+--------------------------------------+
| Per onderwerp                        |  (unchanged bars)
| Voorrang                    [Oefen]  |
| ████████░░░░                         |
| 3× fout · 2 open                     |
+--------------------------------------+
| Open fouten                          |
| • Wat betekent een alarmlicht …      |
|   2× fout · Voertuig · laatste       |  .klein (existing meta)
|   antwoord: 50 km/u                  |
|   Vandaag al goed. Morgen nog 1×     |  .klein, own line (NEW)
|   goed, dan is hij weg.              |
+--------------------------------------+
```

### Texts

| Where | Text |
|---|---|
| Summary line, 1 of several right today | `1 daarvan had je vandaag al goed. Die is pas weg als je hem morgen weer goed hebt.` |
| Summary line, n (> 1) of several | `3 daarvan had je vandaag al goed. Die zijn pas weg als je ze morgen weer goed hebt.` |
| Summary line, the only open one is right today | `Die had je vandaag al goed. Hij is pas weg als je hem morgen weer goed hebt.` |
| Summary line, all n (> 1) open ones are right today | `Die had je vandaag allemaal al goed. Ze zijn pas weg als je ze morgen weer goed hebt.` |
| Summary line, none right today | no line |
| Main button | `Oefen mijn fouten (4)` |
| Label per mistake right today (AC-13, exact) | `Vandaag al goed. Morgen nog 1× goed, dan is hij weg.` |

"Hij" for "de fout" is correct Dutch and matches the AC label.

### States

| State | What shows |
|---|---|
| No mistakes ever | Existing empty card ("Nog geen fouten. …"). |
| Mistakes, 0 open | Intro "0 open fouten. …", no summary line, button `Oefen mijn fouten (0)` disabled (existing behaviour). |
| Some open, none right today | As today without the old line. |
| Some right today | Summary line + labels; button counts all. |
| All open right today | Summary line "Die had je vandaag (allemaal) al goed …"; button enabled. |
| Broken mistake data (AC-35) | `clean()` handles fields; a mistake with `streak` but no valid `okDay` is not "right today", so no label. Missing `last` sorts as oldest (spec), so last in the newest-first list. |

### Focus and screen reader

- No focus change on load (route does `scrollTo(0, 0)`; existing).
- The label is plain text inside the list item, read after the meta line. No `aria-live` needed.
- When a practice round ends and the user returns, the counts are fresh because the view re-renders.

## 3. Session summaries

### "Fouten oefenen" (from Foutenlogboek)

Title, list of wrong answers and buttons unchanged. Only the note changes, because a mistake can now be practised twice on one day and the second right answer does not count:

- Old: `Wat je nu goed had, komt morgen nog één keer terug. Is het dan weer goed, dan is de fout opgelost.`
- New: `Wat je vandaag goed had, komt morgen nog één keer terug. Is het dan weer goed, dan is de fout opgelost. Vandaag vaker oefenen mag, maar telt niet extra.`

"Nog een ronde" now rebuilds the list from all still-open mistakes in that selection, including the ones just answered right. That is what AC-13 asks; the note explains why they do not disappear. If the selection has no open mistakes left (all resolved earlier, rare), it returns to Foutenlogboek (existing).

### "Zwakke onderwerpen" (new, from the mock result)

- Session title: `Zwakke onderwerpen`. Summary heading: `Zwakke onderwerpen: klaar` (existing pattern "<title>: klaar").
- Score and list of wrong answers: existing `summary()`.
- Note (`.klein`): `Fouten die je nu goed had, komen morgen nog één keer terug. Is het dan weer goed, dan is de fout opgelost.`
- Buttons: `Nog een ronde` (`.knop`, rebuilds the list with the same 3 topics and the same rule; mistakes first) · `Naar start` (existing).
- The new questions in this session that are answered right do not end up anywhere visible; that is correct and needs no text.

### Vandaag (AC-16)

No change. Its existing note ("Wat je vandaag goed had, komt morgen terug.") stays true, because the plan still leaves those mistakes out.

## Conflicts and open points

1. **AC-11 example repeats the score.** "43/50, +3 sinds vorige: 40/50" sits right under the big "43 / 50 goed". This design drops the leading "43/50, " and uses spaces around "/" like the rest of the app: `+3 sinds vorige: 40 / 50`. Tests should match "sinds vorige", not the full AC string.
2. **"0 wrong" at time-up.** AC-12 says "Given 0 wrong, no button", and AC-5 counts open questions at time-up as wrong. This design follows AC-5: if every answered question is right but time ran out, the open questions make their topics weak and the button shows. Needs a nod.
3. **"5 van 7" instead of "5 / 7".** AC-10 writes "goed / gevraagd" as a data description; "5 / 7" reads badly with a Dutch screen reader. If the main session prefers literal "5 / 7" for consistency with the score, the layout works the same.
4. **The result page cannot be reopened** (out of scope), but the new button invites the user to leave it before reading Nakijken. Mitigated with the hint line and a repeated button at the bottom. A real fix would be reopening results (out of scope).
5. **Two primary actions after a mock.** "Nieuw proefexamen" becomes secondary when there are mistakes. Smoke tests that click `[data-act=opnieuw]` keep working; only the class changes.
6. **Existing contrast problem (not new, found while checking).** `--good` `#1f8a4c` on white is about 4.4:1, below 4.5:1 for normal text. It is used for `.goed-tekst` in Nakijken ("Juist: …", 16px semibold, not large text) and for white text on `.knop.goed`. Proposed: `--good: #1a7a43` in light mode (about 5.4:1 on white, about 4.7:1 on `--good-bg`). Dark mode is fine. Separate small fix.
7. **Nakijken vs table at time-up.** Nakijken lists only answered wrong questions; the table also counts open ones. Covered by the footnote under the table; listing the open questions in Nakijken is not in the spec.
8. **"Nog een ronde" in Fouten oefenen can loop** through the same mistakes all day. Allowed by AC-13 and the note says it does not count extra; a "only the wrong ones" round is out of scope.
9. **Pass mark.** The result says "Je had er 44 nodig" (CBR) while Part 3's readiness asks for 46. Not a Part 2 issue, but the readiness text should explain the gap so the two numbers do not look contradictory.
