# Sanne (17) tries "Theorie B": first session and day 3

## First session

**Start screen.** It's clean and I understood it straight away. I set my exam date and it said "Nog 21 dagen", which I liked. Then I didn't know where to begin. There are six tiles that all look equally important, and nothing tells me what to do *today*. The menu at the top is also cut off after "Voorrang | G…". It took me a while to realise I could swipe it to find Proefexamen and Fouten.

**Flashcards.** On my phone the table with the stacks is wider than the screen. The whole page zooms out a bit, and the "Start" buttons sit at the far right edge. The cards themselves are nice. Question, "Toon antwoord", then "Wist ik / Wist ik niet", and each card is short enough to do on the bus. But I'm grading myself, so I could just lie. And the "Alles" stack starts with things like "onderbroken gele streep" and "reactietijd". It's random, not organised by topic.

**Borden.** This was my favourite part. The feedback is instant and clear: green for the right answer, red for mine, and one sentence explaining it. I mixed up "Voorrangsweg" and "Einde voorrangsweg" (of course), and also "Doodlopende weg". Doing it the other way round (betekenis → bord) is a good extra. But there are only 28 signs, and I know the real list is much longer.

**Voorrang.** Tapping the cars in order is actually fun, and much better than reading a text. In "Linksaf met verkeer van rechts" I tapped A→B→C and got it wrong. The explanation ("C heeft niemand van rechts…") made sense. The problem is that the list of scenarios gives the answer away in the titles ("Van rechts gaat voor", "Jij komt van rechts"). And after about three rounds I'd seen all 15.

**Getallen.** Typing numbers is harder than multiple choice, and I got 4 out of 10. Some felt useless for me, like "Hoeveel jaar moet een 2toDrive-coach zijn rijbewijs hebben?" and "72 km/h, hoeveel meter per seconde?" The "Spiekbriefje" is great, though. I'd screenshot that.

**Proefexamen.** I *failed*: kennis 11/12, inzicht 23/28 with 25 needed. That was actually useful to know. The review lists exactly what I got wrong, with the reason. Two things bothered me. First, there's no timer, and I've heard that on the real exam you only get a few seconds per question. Second, it's almost all text. On theorie.nl every question has a photo from the driver's seat, and that's what the real exam looks like. In the review, the voorrang mistakes only say "Linksaf van rechts — jouw antwoord A → B, juist B → A" without the picture. Without the drawing I can't tell which car was A anymore.

**Foutenlogboek.** I liked seeing my mistakes grouped by topic (Borden and Voorrang had the most). I practised 6 of them.

## Day 3

The start screen said "12 te herhalen" and "20 open fouten". Seeing 20 open mistakes felt heavy. I did "Oefen mijn fouten" and got **22/23 right (96%)**. Then I went back and still had **18 open fouten**. That was demotivating, because I'd just answered almost everything correctly. Only later did I read that you need to get each one right twice in a row. It also counts flashcards I marked "wist ik niet" as mistakes ("laatste antwoord: (flashcard: wist ik niet)"), which feels a bit like being punished for being honest.

Then I did a second proefexamen and **passed** (11/12, 26/28). But I recognised a lot of questions from day 1: "laagstaande zon", "zuinig rijden", and the same crossings. So I don't know if I passed because I'm better or because I'd seen them before.

## Would I trust it?

Mostly yes. The explanations sound correct and specific (for example 0,2 promille for beginners, and 100 km/h during the day on the snelweg). The note at the bottom says it's not official CBR material and has no gevaarherkenning. I appreciated the honesty, but it also told me I can't *only* use this. One thing I noticed in the multiple-choice questions: the right answer is very often the longest, most careful one. In "gele ruit met witte rand", the answer "Je rijdt op een voorrangsweg" was a full sentence and the others were short. After a while I was guessing on that alone.

## Would I feel ready?

No. I'd feel ready for signs, numbers and basic right-of-way. I wouldn't feel ready for the real exam, which is photos, time pressure and gevaarherkenning.

## Would I come back tomorrow?

Maybe, for the flashcards and to try to get the fouten counter down. The short sessions fit my bus rides. But nothing pulls me back: no streak, no daily goal, no "vandaag: 10 minuten". If the open fouten keep going up, I'd probably quit around day 4–5 and go back to theorie.nl for the photo questions.

## What I'd tell a friend

"It's free and handy for learning signs and voorrang, and the proefexamen shows your mistakes clearly. But it's not like the real exam: no photos, no timer. Use it next to something else."

---

## Observer notes (top friction points)

1. **Mobile overflow.** On the Flashcards page, at 390px width, the table pushes the page to about 455px. The page zooms out and the Start buttons sit at the edge. Playwright couldn't tap `[data-deck=alles]` by coordinates. The top nav is also cut off with no swipe hint, so Proefexamen and Fouten are hidden.
2. **No "what to do today".** The start screen doesn't tie a daily plan to the exam countdown.
3. **Fouten don't clear.** The "2 correct in a row" rule means one practice round barely reduces the count (22/23 correct left 18 of 20 open). The summary should show progress, for example "5 opgelost, 18 nog 1× goed nodig".
4. **Self-graded flashcard misses** go into the foutenlogboek.
5. **The proefexamen doesn't feel like the real exam:** no per-question timer, text-only instead of photos, and a small pool that repeats quickly (15 voorrang scenarios, 10 of them in every exam).
6. **Voorrang mistakes in the review have no diagram**, so "A → B" means nothing afterwards. The scenario titles in the list also give away the answer.
7. **Answer-length tell.** In 73 of the 107 multiple-choice questions that have 3 or more options, the correct option is the longest (or tied for longest). It's easy to game.
8. **Some Getallen items are low-value trivia** (the 2toDrive coach's years, m/s conversion). They weigh on the score and on motivation.
