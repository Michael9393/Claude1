# Spec: CBR-style answer options (afleiders)

- **Status:** draft
- **Priority:** Must (raised 3 Oct 2026, after #7 was dropped)
- **Related:** backlog #8. Readiness and mock scores: [exam-ready-loop](exam-ready-loop.md) (AC-29, AC-34). Content rules: `docs/verificatie.md` (werkwijze, "Examenvorm"). Near-duplicates (#20), signs (#11) and voorrang crossings (#10) are separate items.

## Summary

The wrong options in `js/data/questions.js` are too easy to spot, so mock scores and the readiness signal ("Klaar volgens deze app") overstate how ready the user is. This item rewrites the multiple-choice questions in CBR style: 2–3 options that are all plausible, similar in length, and with no wording that gives the answer away. Where a different format fits the question better, it becomes a ja/nee or an invul (number) question. The work lands in **four topic batches**. Each batch is checked against the law text and logged, so it can ship on its own. New checks in `tests/validate.js` keep the batches honest. No changes to the UI or to stored data.

### Audit of the current bank (3 Oct 2026, counted by hand; the "longest" row rechecked by script)

The 200 questions are 43 `num` and 157 `mc` (85 kennis, 72 inzicht). Signs and voorrang crossings have no stored options: sign options are generated from the same sign group, and crossings are answered by tapping, so they are out of scope.

| Weakness | Count | Examples |
|---|---|---|
| Option count | 50 with 2 options, 61 with 3, 46 with 4 | |
| Correct answer is the **strictly longest** option | **90 of 157 (57%)** (counted by script, 3 Oct 2026). Chance level with this option mix is about 36%. Another 5 are ties | `k-parkeren-def`, `k-driehoek-wanneer`, `i-2sec-meten` |
| Correct answer **≥ 1.5× as long** as the longest wrong option | about 49 (about 41 if it must also be ≥ 15 characters longer) | `k-snelweg-avond` (about 3×), `i-aquaplaning` (about 4×) |
| "Toeteren" as a wrong option | 10 | `i-blinde`, `i-rollator`, `i-kinderen`, `k-zebrapad` |
| Other absurd wrong options nobody would pick | about 18 more questions | "dubbel innemen" (`k-medicijn`), "Je ogen even dichtdoen" (`i-zon`), "luchtweerstand" (`i-achter-vrachtauto`), "Harder rijden om sneller thuis te zijn" (`i-moe`), "Als je wilt bedanken" (`k-alarm`) |
| "altijd"/"nooit" **only in wrong options** | 16 | `k-oranje` ("Altijd doorrijden", "Altijd vol in de remmen"), `k-aanhanger-kenteken`, `i-voorsorteerder` |
| Ja/nee-style questions | 8 are exactly `['Ja','Nee']` (Nee is correct in 6). About 17 more pair a qualified "Ja, als …" with a bare "Nee" or similar | `k-stil-kruispunt` ("Ja, als het kort is" / "Nee") |
| Correct answer stored at index 0 | 145 of 157 (the other 12 are ja/nee with Nee correct) | Hidden at runtime by `buildChoices()` shuffling, except for exact `['Ja','Nee']` |

MC questions per topic: voorrang 28, snelweg 18, gedrag 16, parkeren 15, weggebruikers 15, verkeerslichten 12, inhalen 11, verlichting 9, afstand 9, alcohol 7, snelheid 6, rijbewijs 6, borden 5.

## User stories

- As a first-time candidate, I want wrong options that reflect real mistakes, so that I have to know the rule and can't just spot the silly options.
- As a candidate who trusts the readiness block, I want my mock score to reflect CBR-level difficulty, so that "46/50" means I'm actually ready.
- As a candidate, I want ja/nee and number questions in the same form as the exam, so that the exam format holds no surprises.
- As the owner with no human expert, I want every rewritten question checked against the law and logged, so that a "harder" option is never accidentally correct.

## Acceptance criteria

Rewritten questions get the marker `style: 'cbr'`. The strict checks apply only to marked questions, so `/check` stays green between batches. "Wrong option" means every option except `options[answer]`.

**Format**

- **AC-1:** Given a marked `mc` question, then it has 2 or 3 options (see Q1 if 4 should be allowed).
- **AC-2:** Given a marked question with 2 options, then either both options are bare (`['Ja','Nee']`) or neither is a bare "Ja"/"Nee". For example `['Ja, als het kort is','Nee']` fails.
- **AC-3:** Given a marked ja/nee question, then its options are exactly `['Ja','Nee']`, so `buildChoices()` keeps them in that fixed order. Any qualifier goes in the question text. All other options stay shuffled, as they are today.
- **AC-4:** Given 10 or more marked ja/nee questions, then "Ja" is correct in 35–65% of them. Today Nee is correct in 6 of 8.
- **AC-5:** Given a question that asks for a single number (for example `k-erf` "15 km/h", `i-matrix-70`, `i-bord-60`), when it is rewritten, then it becomes `type: 'num'` with a `unit` and **keeps its id**, unless an `n-` question already asks the same thing. In that case the mc version gets a different angle or is removed (see Q3). The validator's existing pool-size rules still pass (≥ 200 questions, ≥ 44 kennis, ≥ 44 inzicht).

**No giveaways (automated, in `tests/validate.js`)**

- **AC-6:** Given a marked `mc` question, then the correct option has at most `1.3 ×` the characters of the longest wrong option, **or** is at most 15 characters longer. For example `'Groter maken'` (12) against `'Gelijk houden'` (13) passes, but `k-parkeren-def` today (about 110 against 31) fails.
- **AC-7:** Given 20 or more marked `mc` questions with 3 options, then the correct option is strictly the longest in at most 45% of them, **and** strictly the shortest in at most 45% (so the giveaway doesn't just flip).
- **AC-7b:** Given 20 or more marked `mc` questions with 2 options (not `['Ja','Nee']`), then the correct option is strictly the longer one in 35–65% of them.
- **AC-7c:** Given each batch PR, then AC-4, AC-7 and AC-7b are also checked on that batch's marked questions alone when the batch has at least 8 questions of that kind, so a batch can't lean on earlier batches.
- **AC-8:** Given a marked question, then no option matches `/toeter/i`.
- **AC-9:** Given a marked question, when a wrong option contains `altijd` or `nooit` (as a whole word, any case) and the correct option doesn't, then validation fails, unless the id is in an `ALLOW_ABSOLUTE` list in `validate.js` with a one-line reason. For example `k-oranje` today fails.
- **AC-10:** Given **any** `mc` question, then no two options are equal after lowercasing, collapsing spaces and dropping trailing punctuation. This replaces the exact-match check.
- **AC-11:** When `node tests/validate.js` runs, then it prints one stats line: marked / total mc, option-count spread, "langste = juist" %, and ja/nee balance. For example `Afleiders: 38/157 herzien · langste=juist 41% · ja/nee: 5 ja, 6 nee`.

**Content and logging**

- **AC-12:** Given a marked question, then it has a non-empty `source`. This is the existing check, which still applies.
- **AC-13:** Given a marked question, then its id appears in `docs/verificatie.md` under a section headed `## Afleiders herschreven`. `validate.js` reads the file and fails on any marked id that is missing.
- **AC-14:** Given a batch, then its log table in `verificatie.md` has one row per question: id, what changed (options / type / question text), the article checked (for example "RVV 1990 art. 23 lid 1 onder c"), and, per wrong option, the exact phrase of that article (or of another cited article) that rules it out — not just "fout bevestigd". Wrong options are preferably another real rule (e.g. the limit for a different road type); made-up numbers or conditions are not allowed. Date-sensitive items (e.g. `k-snelweg-avond`, 100/130) are flagged "herkeur bij wetswijziging". "Veilig rijgedrag" questions have no article, so their row says "advies, geen wetsartikel" plus the reason each wrong option is unsafe.
- **AC-15:** Given a batch, then a second subagent, separate from the writer, runs werkwijze step 3 from `verificatie.md` (`node tests/review.js`) on the changed questions and fills a fixed log column `review` with `ok` or a finding, which `validate.js` checks is present and `ok` for every marked id. The review checklist covers: no wrong option is "ook een beetje goed"; no tell left in only the correct option (hedges like "alleen als", "tenzij", "mits"; a cue word repeated from the question; a grammar fit with the question that the wrong options lack); a shortened correct option is still true on its own (e.g. the `k-parkeren-def` definition); natural Dutch. Any finding is fixed before merge.
- **AC-16:** Given a rewritten question, then its correct answer says the same as before, unless the content check finds an error. Such an error gets its own row and is fixed as a content fix. The log row keeps the old correct-answer text, so a script can show the diff.
- **AC-16b:** Given a rewritten question, then its `explain` also says in one sentence why the most tempting wrong option is wrong, checked against the same article. (Plausible wrong options teach nothing if picking one gets no reason.)

**Batches and completion**

- **AC-17:** Batches land in this order. Each is one PR with `/check` green and `CACHE` bumped in `sw.js`:
  - **B1:** weggebruikers, afstand, gedrag (40 mc). This batch has most of the absurd options.
  - **B2:** voorrang, verkeerslichten (40). Highest exam weight, mostly 2-option.
  - **B3:** snelweg, inhalen, verlichting (38).
  - **B4:** parkeren, snelheid, alcohol, rijbewijs, borden (39).
- **AC-18:** Given all four batches are done, then every `mc` question is marked, the checks in AC-1 … AC-9 apply to all questions, the `style` marker is removed, and backlog #8 is `done`.

**Saved progress**

- **AC-19:** Given saved `history`, `seen`, `srs` and `mistakes` keyed by question id, when a batch ships, then they still apply to the same questions. Ids are never renamed. A question that changes type keeps its id.
- **AC-20:** Given an open mistake whose `given` text no longer matches any option (for example "Toeteren"), when the Foutenlogboek opens, then it still shows "laatste antwoord: Toeteren", escaped, without errors. The mistake resolves normally on two correct days.
- **AC-21:** Given mock exams saved before a batch, then they are handled as decided in Q4 (logic test: readiness with two pre-batch mocks and one post-batch mock gives the decided result).

## Edge cases

- **Too long a question:** if balancing lengths would need a long correct option, shorten the correct option and move the nuance to `explain`. Don't pad the wrong options.
- **A wrong option is also correct under the law** (for example "Bij file" for the vluchtstrook, which can be correct when it is an open spitsstrook): the content check (AC-15) catches it, and the option is replaced or the question text is narrowed.
- **A two-party "wie gaat voor?" question** (`k-tram`: "De tram" / "Jij, want …"): it may stay 2 options if neither is a bare Ja/Nee (AC-2). Otherwise rephrase it as ja/nee ("Mag jij als eerste oversteken?").
- **A question where the correct answer itself says "altijd"/"nooit"** (`i-erf-kind`): allowed. AC-9 only flags absolutes that appear in the wrong options alone.
- **A removed question** (AC-5): `known()` already hides its mistakes. Its old `history` entries drop out of the last 20 on their own. Pool sizes must still pass.
- **Offline or stale cache:** without a `CACHE` bump the old bank stays on the phone. AC-17 requires the bump.
- **First-time use, old or broken saved data:** nothing new is stored, so there is nothing new for `clean()` to handle.
- **Scores drop after a batch:** expected, and it's the point. The owner should know before reading readiness (see Q4).

## UI notes

No screen changes. Options keep the current shuffling, and exact `['Ja','Nee']` keeps its fixed order. The designer step can be skipped.

## Data

```js
// Question bank only (js/data/questions.js); nothing new in localStorage.
{ id: 'k-oranje', part: 'kennis', topic: 'verkeerslichten', type: 'mc', style: 'cbr', // marker, removed after B4
  source: S.rvv63, q: '…', options: ['…', '…', '…'], answer: 0, explain: '…' }
// store.js clean(): no change. history/seen/srs/mistakes stay keyed by id; mistakes.given stays a free string.
```

## Scope

- **In:** rewriting options (and where needed question text or type) of the 157 mc questions in 4 batches; the validate checks AC-1 … AC-13; a law check and log per batch; the stats line.
- **Out:** signs and their generated options (#11); voorrang crossings (#10); removing near-duplicates (#20) beyond AC-5; hotspot and slepen questions (#21); new questions; UI changes; changes to readiness logic.

## Open questions

- [ ] **Q1. Option count.** A) at most 3 (CBR style, as in the backlog). B) allow 4 where a fourth option is just as plausible. **Recommend A.**
- [ ] **Q2. How much at once?** A) all 4 batches, about 1 per week. B) only B1 and B2 before the exam, the rest after. C) one big PR. **Recommend A, with B as the fallback if the exam date comes closer than 3 weeks.**
- [ ] **Q3. Number questions in mc form that duplicate an `n-` question** (`k-bebouwde-kom-einde` = `n-buiten`; `i-remweg` ≈ `n-remweg-3x`). A) turn them into invul anyway, accepting the duplicate. B) keep them as mc with plausible numbers. C) remove them if the pool sizes allow. **Recommend B.** Removal belongs to #20.
- [ ] **Q4. Old mock scores in readiness.** A) keep them; the last-3 rule replaces them on its own. B) count only mocks taken after the last batch. C) show a one-line note on the result screen ("vragen zijn op <datum> moeilijker gemaakt"). **Recommend A.** It's simplest, and three new mocks happen within about a week.
- [ ] **Q5. The length rule in AC-6.** A) 1.3× or 15 characters. B) stricter: 1.2× or 10 characters. **Recommend A.** It lets a short "Jij" sit next to "De fietser" without forcing padding.
- [ ] **Q6. Do rewritten questions come back for practice?** Today a question you "know" on its easy version stays on a long `srs` interval, so the harder version may only turn up by chance in a mock. A) nothing changes (as drafted); B) when a batch ships, its rewritten ids become due today (small `store.js` change, adds a stored batch version); C) a "Herziene vragen" block in the Vandaag plan. **Recommend B.** Cheap, and it is the practice that actually raises your score.
- [ ] **Q7. Batch order.** A) by topic, as in AC-17 (B1 weggebruikers/afstand/gedrag first); B) by how much a question gives away, across topics: first the ~41 questions where the answer is ≥1.5× longer plus the "toeter"/absurd ones, then voorrang and inzicht, then the rest. **Recommend B**, with a hard rule: every batch merged at least 10 days before the exam date.
- [ ] **Q8. Show the change in the app?** Scores will drop (e.g. 47 → 42) and that looks like going backwards. A) no, only in the PR; B) one line next to readiness, e.g. "Vragen herzien: 2 van 4 delen (sinds 10 okt)". **Recommend B.**
- [ ] **Q9. Turning mc into number questions (AC-5).** A) do it in the batches; B) postpone, keep them as mc for now. **Recommend B**: it adds parsing and duplicate risk late in your study period, and the exam already has number questions.
