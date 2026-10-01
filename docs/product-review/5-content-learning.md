# Content & Learning Design review: Theorie B

*Reviewer: Dutch driving-theory instructor / learning design. Scope: README, docs/verificatie.md, js/data/*, exam, flashcard and mistake logic in js/app.js and js/store.js.*

## 1. Exam fidelity: the proefexamen models an exam that no longer exists

Since **7 April 2025** the CBR B theory exam is **one block of 50 questions, 30 minutes (45 with extra time), pass at 44 correct (88%)**. There are no separate parts and no separate pass marks. The separate *gevaarherkenning* photo section is gone. Hazard perception now comes as **short animations** mixed in with the other questions. The question types are ja/nee, meerkeuze, invullen (on-screen keypad), **hotspot (aanklikken in het beeld)** and **slepen** (drag numbers or a checkmark onto the image). Sources: [CBR news](https://www.cbr.nl/nl/over-het-cbr/over/laatste-nieuws/nieuws/vernieuwd-theorie-examen-b-rijbewijs-vanaf-7-april), [Theorio](https://www.theorio.nl/blogs/vernieuwd-cbr-theorie-examen-2026), [nutheorie.nl](https://www.nutheorie.nl/blog/wat-te-verwachten-van-het-nieuwe-nederlandse-theorie-examen). cbr.nl was blocked here, so this comes from secondary sources that agree with each other.

What the app gets wrong (`EXAM` in app.js:423, README):
- **Format:** the app uses 12 kennis + 28 inzicht with pass marks 10 and 25. That is the old 65-question exam without its hazard section, so it matches neither the old exam nor the new one.
- **Pass mark:** the app's 35/40 is 87.5%, close to 88%. But passing is decided per part, not as one 44/50 threshold.
- **Time:** there is no time limit. `started` is only used to show the duration afterwards (app.js:481). Time pressure is a main reason candidates fail. With 36 s per question on average, the animation items get very little time.
- **No images at all:** 0 of the 200 questions have a picture. The real exam is almost entirely picture or animation based: you look at the scene through the driver's eyes. The only visual items are the 15 voorrang diagrams, and they use a tap-in-order format that the CBR does not have.
- **Hazard perception is absent**, and it is now spread across the whole exam instead of in a separate section.
- **Voorrang is over-sampled:** every exam draws 10 of only 15 scenarios (app.js:445). By the third exam students recognise diagrams instead of reasoning about them.

## 2. Coverage

Questions per topic, as kennis/inzicht (200 in total):

| Topic | K | I | | Topic | K | I |
|---|---|---|---|---|---|---|
| voorrang | 10 | 18 | | afstand | 6 | 9 |
| rijbewijs | 23 | 0 | | weggebruikers | 6 | 10 |
| snelweg | 10 | 9 | | inhalen | 6 | 5 |
| parkeren | 15 | 3 | | verkeerslichten | 7 | 5 |
| gedrag | 11 | 7 | | verlichting | 8 | 2 |
| snelheid | 12 | 1 | | alcohol | 9 | 3 |
| **borden** | **5** | **0** | | | | |

On top of these there are 28 signs and 15 voorrang scenarios.

**Over-weighted:** paperwork. There are 23 rijbewijs questions, for example 2toDrive coach age and coach years (`n-coach-leeftijd`, `n-coach-jaren`), four APK items and three code-96 items. The exam asks very little of this.

**Thin or missing:**
- **Signs:** 28 signs against roughly 200 in RVV bijlage I, plus 5 MC questions. Missing among others:
  - the C-series closures (C2 to C22)
  - F5/F6 (voorrang tegenliggers)
  - G11 to G13, bromfietspad and fietsstraat ("auto te gast")
  - the J-series warnings
  - zone signs (30-zone, blauwe zone, milieuzone)
  - onderborden
  - L-series information signs

  Borden is the single largest source of kennis questions on the CBR exam.
- **Wegmarkering:** only the doorgetrokken streep and yellow lines are covered. Missing: blokmarkering, verdrijvingsvlak, puntstuk, oversteek for fietsers, busbaan, and the wisselstrook and plusstrook.
- **Verkeersregelaar gestures:** 2 kennis and 2 inzicht questions, text only, with no picture.
- **Hazard and anticipation:** about 8 items (`i-bal`, `i-kinderen`, `i-dode-hoek`...), all as text.
- **Rijtaakondersteunende systemen:** ACC, lane assist and the like appear nowhere. They are in the current CBR toetstermen.
- **Milieu / zuinig rijden:** one question (`i-zuinig`).
- **Voertuigkennis:** only tyre depth. Missing: dashboard warning lights, tyre pressure, lights check and load.
- **Aanhanger:** only speeds and masses. Missing: load, mirrors, snaking.
- **Newer road users:** speed pedelec, LEV and e-step are all missing.
- **Weather:** covered reasonably well (fog, rain, ice, sun).

## 3. Question quality (about 40 items sampled)

**Correctness** is good after the verification rounds. Items to recheck:
- `k-alarm`: "of heel langzaam rijdt" as a valid use of alarm lights is not backed by the cited article (art. 28/58).
- `i-licht-bord`: the explanation says "Werkende verkeerslichten gaan boven verkeersborden". Art. 64 only covers **signs that regulate priority**. As written, it teaches that a green light overrides an inrijverbod.
- `n-seconden`: the stem says "moet", but the source says this is advice.

**Distractors** are the biggest quality problem:
- **The correct option is the longest in 95 of 157 MC items (61%).** Random would be about 30–40%. Test-wise students learn "pick the most careful, longest option" instead of the rule. Examples: `k-driehoek-verplicht`, `i-bushalte`, `i-pech-snelweg`, `i-invoegen`.
- **Joke distractors** nobody would pick:
  - "Het medicijn … dubbel innemen" (`k-medicijn`)
  - "Je ogen even dichtdoen" (`i-zon`)
  - "Dichterbij blijven, dat scheelt luchtweerstand" (`i-achter-vrachtauto`)
  - "Harder rijden om sneller thuis te zijn" (`i-moe`)
  - "Toeteren" in 10 items (`i-rollator`, `i-blinde`, `i-kinderen`, …)
- **Plausible distractors should follow the typical misconception.** `k-kind-voorin` ("onder 1,35 m altijd achterin") and `k-bebouwde-kom-begin` ("bij de eerste huizen") show the right approach, but they are the exception.
- **50 items have only two options.** Many are yes/no where the "safe" answer (Nee) is obviously right: `k-uitrit`, `k-stil-tunnel`, `k-overweg`.
- **Near-duplicates** add volume without adding learning:
  - `k-links-voorsorteerder`/`i-voorsorteerder`
  - `k-stopbord`/`i-stop-leeg`
  - `k-mistachter-regen`/`i-regen-mistachter`
  - `n-aanhanger`/`n-aanhanger-autoweg`

**Inzicht items are really kennis items.** Most "inzicht" questions describe the situation in words, for example `i-rechtsaf-fietser`. The real skill is reading a scene, spotting the tram, the shark teeth or the child behind the van, and that is never practised.

**Explanations:** about half teach the "why". Good examples are `i-brug`, `n-kruispunt`, `i-zebrapad-auto` and `k-grootlicht-achter`. The rest restate the rule, for example `k-stil-tunnel` ("Stilstaan in een tunnel is verboden."), `k-uitrit`, `k-doorgetrokken` and `k-bord-regel`. Add a one-line reason or a memory hook to each.

**Language** is fine for a 17-year-old: short sentences, and CBR terms like *toegestane maximummassa* and *bijzondere manoeuvre* are used consistently. A glossary tooltip for those terms would help.

## 4. Learning design

- **Leitner (1-2-4-8-16 days):** the intervals are fine for a 2–6 week study window. Weaknesses:
  - **Self-graded** "Wist ik/Wist ik niet" on MC questions shown *without options*. This overestimates mastery.
  - A failed card only returns in a later session, never again in the same one. There is no relearning step.
  - "Beheerst" means box ≥ 3, which can be reached within about 3 days.
- **Foutenlogboek:** "resolved after 2 correct in a row" has no spacing requirement. Two correct answers in the same "oefen mijn fouten" session clear an item, which measures short-term memory, not learning. Require the second correct answer to come at least a day later.
- **Feedback timing:** feedback is immediate in practice and delayed in exams, and that split is correct. The exam review lists only the wrong items. It should also group them by topic and link to targeted practice.
- **Interleaving:** only the "Alles" deck mixes topics. The exam date countdown exists but does not drive scheduling.
- **No readiness signal:** students cannot tell whether they are ready. Add a readiness score based on (a) the last three timed mock exams at 44/50 or better, (b) topic coverage and accuracy, especially borden and voorrang, and (c) the open-mistake count.

## What would most improve pass rates (in order)

1. Rebuild the proefexamen as **50 mixed questions, 30-minute timer, pass at 44**, with at least some hotspot and drag-style items.
2. Add **picture- and scene-based questions**: driver's-eye stills and short animated SVG scenes for hazard and insight. This is the biggest gap between the app and the real exam.
3. **Expand signs to about 120** and add markings. Generate sign MC distractors from confusable pairs, such as C2 vs C1 and E1 vs E2.
4. **Rewrite distractors** around real misconceptions, balance option length, and cut joke options and duplicates.
5. Add **spaced mistake resolution**, same-session relearning and a **readiness meter** tied to the exam date.
