# Theorie B: review by a driving instructor

**Who's writing:** a rijinstructeur who owns a small rijschool and prepares about 40 students a year for CBR theory exam B.
**What I did:** I used the app on phone and desktop. I tried every section, did Vandaag, did a full proefexamen (37/50, gezakt), and clicked through all 15 voorrang scenarios. I also read `questions.js`, `voorrang.js` and `signs.js` line by line.

## Verdict

The content is clean and honest, and I trust it more than most free apps. It avoids trick questions and cites its sources. But it covers only about a third of what the exam tests. It is a good **rules-drill add-on**. It is not yet something I would call "the app to pass with". Today I'd tell students "use it next to your theory book", not "use this".

## Correctness

The factual base is solid. I checked all the limits and figures and found no real errors: 50/80/100 km/h, 90 km/h with a trailer, 0.2/0.5 ‰ and 88/220 µg/l, 3 µg THC, 5 m from a crossing, 12 m at a bus stop, fog tail light below 50 m, APK 4/2/1 and 3/1, 3500/750/4250 kg, a 27-year-old coach, an 18-month certificate. Nuances are handled well: the 100 km/h daytime limit, the warning triangle not being mandatory to carry, handsfree calling, turning left vs. an oncoming right-turner (`i-links-rechts-tegen`), and colonnes on a voorrangsweg. Items to fix or check:

- **`k-blinden` / `i-blinde`:** "witte stok met rode ringen" means *doofblind*. A blind person uses a plain white cane. Remove the red rings.
- **`n-zebra-stilstaan`:** "binnen 5 m **van**" should be "op en binnen 5 m **vóór**" the crossing, as the RVV puts it. `i-zebra-afzetten` gets it right.
- **`inhaalverbod` sign:** the meaning says "bromfietsers mag je wel inhalen". A bromfiets is a motorvoertuig. The CBR wording is about *tweewielige motorvoertuigen*. Rephrase it the CBR way.
- **`autoweg` sign:** it says "minstens 50 km/h". The rule is *harder dan* 50, and `n-snelweg-min` does use "sneller dan" for the snelweg. Make them consistent.
- **`k-inrit`:** it cites art. 54 (bijzondere manoeuvre) for turning *into* an entrance. Students learn that as afslaan (art. 18). The answer is right but the reasoning teaches the wrong rule.
- **`i-rotonde-oprijden`:** the source is "veilig rijgedrag", but indicating direction is a legal rule (art. 17).
- **Exam format:** the app says "sinds 7 april 2025: 50 vragen, 44 goed, 30 min". Students will quote this to me. Make sure it matches cbr.nl word for word, including how gevaarherkenning is scored. If it's wrong, the "geslaagd" label misleads.
- **Style:** the phrasing is friendlier than the CBR's ("Wat doe je?" with one obviously absurd option such as "Toeteren", "Harder gaan rijden", "Je ogen even dichtdoen"). Real CBR inzicht questions have 2–3 *plausible* options, often "remmen / gas loslaten / niets". Too many giveaway distractors inflate scores. My automated run scored well above what the questions deserve.

## What my students struggle with, and whether the app trains it

| Topic | Coverage |
|---|---|
| **Voorrang** | Good start. There are 15 interactive crossings where you tap the order. The explanations are correct, e.g. `v-rechtsaf-van-rechts` ("rechtdoor gaat voor afslaand geldt alleen op dezelfde weg"), which is a classic mistake. But the set is too small and too tidy. Only one tram situation type (straight, from the left). No tram turning, no fietspad alongside the road with a turning car, no rotonde with fietsers (binnen/buiten bebouwde kom), no voorrangsvoertuig, no bus leaving a stop, no uitrit/erf. And "jij" is never marked: the CBR asks from *your* seat ("Mag ik voor?"). |
| **Borden** | Weak. There are 28 signs. The exam draws from well over 100: fietsstraat, zone 30/schoolzone, bus/tram lane, onderborden ("uitgezonderd"), F5/F6 (versmalling voorrang), tunnel, uitrit, bromfiets/snorfiets, blue parking zone. The drawings are fine for shape and colour. |
| **Inhalen** | Rules are covered (`k-links-voorsorteerder`, tram right, zebra). But there is nothing on judging distance and time, which is where students actually fail. |
| **Snelweg invoegen** | Covered only as a rule (`i-invoegen`). There's no speed-matching or ritsen scenario with a picture. |
| **Gevaarherkenning** | **Not present at all**, and the app says so. This is the part my students fail most. It is also the largest share of the real exam. |
| **Photo questions** | None. All inzicht questions are text-only. The real exam is almost entirely photo-based, and reading a photo (where are the haaientanden, is that a fietspad or fietsstrook?) *is* the skill. |

## Didactics

Strong points:
- The mistakes log needs you to get an answer right on two different days.
- The flashcards use spaced repetition.
- Every answer shows a source and an explanation.
- Numbers are drilled with Dutch decimal input.
- The Vandaag button is exactly right for 17-year-olds: one tap and ~8 minutes.

Weak points:
- The proefexamen results show every question in one long scroll. There is no per-topic breakdown, and I want "Voorrang 4/6, Borden 3/5".
- Every correct option is stored at index 0. Shuffling hides this in the app, but it signals the questions were written answer-first, which is where the giveaway distractors come from.
- There are near-duplicates (`n-aanhanger` / `n-aanhanger-autoweg`, `k-stopbord` / `i-stop-leeg`, `k-tram` / `v-tram-links`) that pad a small bank of about 230 items.

## Would I use it in lessons?

I'd use it for the voorrang crossings on a tablet between driving lessons. That works well. For coaching, nothing is there. Progress lives in localStorage on the student's phone. There's no student code, no way to show me progress, no export, no way to assign "doe deze week borden + rotondes", and no instructor view of class-wide weak topics. With 40 students a year I need at least a shareable progress summary.

## Top 5 changes that would make me recommend it

1. **Gevaarherkenning practice.** Even photo-based "remmen / gas los / niets" items with a timer would help. This is the biggest gap.
2. **Photo or illustration inzicht questions from the driver's seat**, plus more voorrang scenarios with trams turning, fietspaden, rotondes with fietsers, uitritten and voorrangsvoertuigen. Mark "jij".
3. **Expand borden to the full exam set (~100+)**, including onderborden and zones.
4. **Instructor link:** a student code or QR that exports a progress snapshot (score per topic, proefexamen history) I can open. Add assignable topic sets ("huiswerk").
5. **Rewrite distractors to CBR standard** (plausible options, CBR phrasing, fewer "toeteren"). Show a per-topic score after the proefexamen, and verify the exam-format claim against cbr.nl.
