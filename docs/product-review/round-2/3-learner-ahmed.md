# Ahmed: three evenings with "Theorie B"

*Ahmed, 24, B1 Dutch, works shifts, scored 39/50 on the first try, retake in 10 days. Android phone, 360x740. Evenings: Mon 28 Sep 21:40, Tue 29 Sep 22:15, Thu 1 Oct 21:50 (skipped Wednesday because of a late shift).*

## What happened
- **Evening 1:** I set my exam date (8 Oct). The app said "Nog 10 dagen". Vandaag gave me 15 new questions and I got 11/15. Then I did a proefexamen: **38/50, gezakt**, in about 25 minutes.
- **Evening 2:** Vandaag had 25 questions (10 fouten, 10 kaarten, 5 new) and I got 22/25. After that the foutenlogboek had 19 open fouten, but I could only practise 6 because "13 fouten had je vandaag al goed". I got 4/6 on those.
- **Evening 3:** Second proefexamen: **43/50, gezakt, "nog 1 meer"**. It took about 29 of the 30 minutes and the clock turned red at 3:39.

## Language
Most questions are short and use "je", and I like that. The problems are the long words and the formal words from the law. These made me stop and read again:
- "gehandicaptenvoertuig", "kinderbeveiligingsmiddel, zoals een kinderzitje of zittingverhoger", "toegestane maximummassa", "uitgeademde lucht", "onverharde weg".
- "Na hoeveel **veroordelingen** voor een ernstige verkeersovertreding (**van de beginnerslijst**) als beginnend bestuurder moet je je rijbewijs inleveren?" I read this three times.
- "Wanneer mag je mistlicht aan de voorkant **voeren**?" I know *voeren* as feeding a cat.
- "Verkeerstekens gaan voor de verkeersregels, **voor zover ze daarmee in strijd zijn**." I don't understand this.
- "Uit een uitrit wegrijden en achteruitrijden zijn **bijzondere manoeuvres**." Bijzonder means special? Special how?
- The "Bron" lines are not for me: "Natuurkunde/CBR-leerstof: reactietijd ca. 1 s, remweg groeit met het kwadraat van de snelheid" and "RVV 1990 art. 54". The start page promises this ("op welke regel uit de wet") as if it is a good thing. For me it is noise at 22:00.

The explanations are usually one or two clear sentences, and that is good. I had no way to look up a word. I copied "gelijkwaardig kruispunt" into Google Translate.

## Did it understand I am retaking and short on time?
Only half. The countdown ("Nog 9 dagen", "Nog 7 dagen") is nice. But nothing changed after I set the date. Before the date and after the date, Vandaag was the same "15 nieuwe vragen, ongeveer 8 minuten". On evenings 2 and 3 it was exactly the same text. Nobody asked me "did you already do the exam once?" or "what did you score?". It never told me "with 7 days left, do a proefexamen every other day" or "you are 1 point away, focus on X". The foutenlogboek rule, "opgelost als je hem op twee verschillende dagen goed hebt", is smart. But I have 7 days, 19 open fouten and only 6 I could practise on Tuesday. I wanted to do more, and the app said "morgen".

## Timer and 44/50
Yes, this felt real. 50 questions, 30:00 counting down, and no feedback until the end. It was the same stress as at the CBR. When the clock went red at 3:39 with 4 questions left, my heart went fast. That is good training. The result screen is honest: "Je had er 44 nodig, dus nog 1 meer." But it does not tell me **which topic** cost me the points. I had to read 7 wrong answers and guess the pattern myself. The note that the real exam also has gevaarherkenning filmpjes and photo questions worries me. Is my 43 here really a 43?

## What helped
- One big orange button, **Start**, so I didn't have to think about what to do.
- In practice mode I see right/wrong immediately, with the correct answer in bold and a short reason.
- The Nakijken list after the exam: my answer in red, the correct one in green.
- The voorrang crossings: tapping A-B-C and then seeing the numbers is clear and fast.
- Getallen accepts "0,5" with a comma. Last time I lost points on numbers.
- No account, no ads, and it works on my old phone.

## What frustrated me
- The **open fouten list shows my wrong answer** ("laatste antwoord: Doorrijden…") but **not the right one**. At night I just want to scroll and read the correct answers.
- The foutenlogboek page is extremely long on my phone. The red "Alle voortgang wissen" button is at the bottom, right where my thumb goes after scrolling.
- The date field showed "mm/dd/yyyy" (American order), and I was confused about whether 10/08 is August.
- On the first exam question, one answer already had an orange border before I tapped anything. I thought I had picked it by accident.
- The menu has 7 items on two rows and uses a lot of space on my small screen. I only use Start, Proefexamen and Fouten.
- In Nakijken the number answers have no unit ("Jouw antwoord: 135" vs "Juist: 90 km/h").
- There is no trend line of 38 then 43 on the result. I had to remember it myself.

## Do I feel more ready?
A bit, yes. 38 to 43 in three evenings is real progress, and I now know my weak spots (signs, the tractor on the zandweg, overtaking in a file). But the app didn't tell me I am ready or what to do in the last week. I still feel alone with the plan.

## What would make me open it every evening
A "herexamen" mode: I type my exam date and last score, and it gives me a 10-minute plan per evening (for example Mon fouten + borden, Tue proefexamen), with a line like "gisteren 43, vandaag doel 45". Let me practise all my fouten when I want to, not "morgen". Tap a hard word to see simple Dutch or English. A small reminder at 21:30, after my shift.

---

## Observer notes (top friction points and fixes)
1. **The exam date is only decorative.** `todayPlan()` ignores `examDate`, and the text and size are identical on every day. *Fix:* when days ≤ 14, grow the plan, schedule proefexamens (for example every 2nd day), and add a "retaking? last score" onboarding question that seeds weak topics.
2. **Fouten lock-out conflicts with cramming.** On evening 2, 13 of 19 open fouten were blocked ("komen morgen terug"). *Fix:* keep the two-day rule for "opgelost", but still let learners re-drill same-day ones (a separate "nog eens" button).
3. **The result screen gives no diagnosis.** *Fix:* add a per-topic score on the uitslag, show the delta to the previous exam (38→43), and link "oefen deze 3 onderwerpen".
4. **Language load.** Legal/compound vocabulary and RVV/"kwadraat" source lines. *Fix:* a B1 plain-language pass on the ~30 longest prompts, a tap-to-define glossary (gelijkwaardig, voorsorteren, voeren, bijzondere manoeuvre, onverhard), and collapse "Bron" behind a toggle.
5. **The open fouten list shows the wrong answer and not the correct one.** *Fix:* show "juist: …" (plus the explanation on tap) and move the reset to a settings area behind a double confirm.
6. **Small UI issues:** stray highlight on an exam choice before any tap (sticky hover/focus on touch), the locale-dependent date input format, missing units on numeric answers in Nakijken, and the two-row nav eating about 270px of a 740px screen during the exam (hide the nav during the proefexamen).
7. **Realism caveat:** without hazard/photo items, a 43/50 here can over-promise. Say that explicitly on the result screen next to the pass line.
