# PM review: Theorie B

## 1. The exam format is out of date (blocker)
The Proefexamen is built on the **old** CBR format: 12 kennis (pass 10) + 28 inzicht (pass 25), plus a table showing "Gevaarherkenning 25 / 13" (`js/app.js:423`, `:429-431`, `:266`; README table). The CBR replaced this on **7 April 2025**. The exam is now **50 questions in 30 minutes, taken as one continuous whole, with 44 correct needed**. It has no separate sections, and hazard perception is tested inside the exam through animations ([CBR news](https://www.cbr.nl/nl/over-het-cbr/over/laatste-nieuws/nieuws/vernieuwd-theorie-examen-b-rijbewijs-vanaf-7-april), [theorie.nl](https://www.theorie.nl/examenvoorbereiding/auto-theorie-examen-b/hoeveel-vragen-theorie-examen-auto)). The core promise of a mock exam, "net als het echte examen" (`app.js:428`), is therefore wrong. Every "Geslaagd" is a false readiness signal. `docs/verificatie.md` checked the traffic law carefully but never checked the exam specification. The format is a rule too, so it needs a source and a check date.

## 2. Target user and job-to-be-done
- **User:** a Dutch 16.5–20 year old (often doing 2toDrive), studying on a phone in short gaps, price-sensitive, a few weeks before a €50+ exam attempt.
- **Job:** "Make sure I pass first time, and tell me when I'm ready."
- **Start screen** (`app.js:256-269`): the only heading is "Oefenen voor je theorie-examen auto (B)", followed by a date picker and 6 tiles. Nothing says why this app: free, no ads, no account, offline, every answer backed by a legal source. The only differentiator is the verified sources, and it is buried in `verificatie.md`. The footer disclaimer leads with what the app *isn't*.
- There is no recommended next action. A first-time user sees "0 te herhalen / 228 nieuw" and has to guess where to start.

## 3. Competitive landscape
The market is crowded and mostly freemium:
- **CBR's own:** paid practice exams.
- **Commercial:** theorie.nl, iTheorie (about €79, 50 exams), ANWB (book plus online, 3D animations), Theoriebaas, haaltheorie.nl, and many free ad-funded sites and apps (theorieexamenoefenen.nl, kenjetheorie.nl).

Competitors offer photo and animation questions from the driver's point of view, 1,000–2,500 questions, dozens of exams, and a readiness score.

This app is **free, ad-free, private (no account), offline, and sourced to the article** (every question has a `source`). No competitor puts the legal source next to each answer, and that is a real trust wedge. On breadth and realism it loses badly:
- 200 text questions, 28 SVG signs, 15 crossings.
- No photos.
- No hotspot or drag question types.

**Positioning:** "de gratis, eerlijke aanvulling": the free, honest companion to a theory book or course, and the best way to drill numbers, signs and right of way. Don't pitch it as a full replacement.

## 4. Feature gaps
**Against the real exam (ranked):**
1. Wrong structure and pass mark (see section 1).
2. **Hazard perception.** It is now mixed into the scored 50 questions, so it can no longer be ignored as a separate section. Without it the app can't claim readiness. Building video or animation content is costly (L). A cheaper first step is static "rem / gas los / niets" scenes drawn with the existing top-down renderer (`js/intersection.js`), plus clear messaging.
3. **Time pressure.** The real exam is 30 minutes. `runExam` has no timer; it only reports minutes afterwards (`app.js:481`).
4. **Question types.** Only mc, num and voorrang; there is no hotspot or drag. Questions are text-only, while the CBR tests from a photo of the driver's point of view.
5. **Pool depth.** Each exam draws 18 of 72 inzicht MC questions and 10 of the 15 voorrang scenarios (`app.js:443-445`), so users memorise the pool after 3–4 exams and scores inflate.

**Against user expectations:**
- No readiness score: the start tile shows only the last exam (`app.js:266`).
- No per-topic mastery view: the foutenlogboek counts errors, not coverage.
- No streak or daily goal.
- The exam date (`store.js` `examDate`) is collected but not used. It doesn't drive a study plan.
- Stopping an exam discards it (`app.js:461`).

## 5. Onboarding, retention, readiness
- **Onboarding:** add a 3-step first run: set your exam date, take a 10-question intake, then get a recommended route. Promote "Vandaag" (due cards + open mistakes + one weak topic) as the main button.
- **Retention:** the Leitner SRS (`store.js:57-62`) and the mistakes-resolve loop (`store.js:43-44`) are good bones. They need a daily nudge, which is hard with no backend: use PWA install plus a visible streak and "X kaarten vandaag".
- **Readiness signal:** combine the last 3 mock exams at the 44/50 bar, topic coverage (share of items in box ≥3 per topic), and open mistakes. Show "Klaar voor het examen: 72%" along with the weakest topic. Be honest: cap it (for example "max 85% zonder gevaarherkenning").

## 6. Distribution
- **GitHub Pages works as is.** It is not installable: there is no `manifest.json`, service worker or icons. The "offline" claim only holds if the file is opened locally.
- **SEO:** a single hash-routed page (`#/borden`) exposes one indexable URL. The title "Theorie Oefenen B" is fine, but there are no Open Graph tags, no static landing text and no per-topic pages. The strongest SEO asset is the sourced sign and number content ("maximumsnelheid met aanhanger", "promillage beginner"): pre-render it as static pages.
- **Channels:** driving-school partnerships (a free drill tool they can recommend), TikTok and Reddit r/thenetherlands, and word of mouth among students.

## 7. Risks
- **Trust:** stale content is the biggest risk, as the outdated exam format shows. Law changes (130 km/h stretches, the THC limit) are handled by hand. Add a visible "laatst gecontroleerd: 28-09-2026" and a "meld fout" link (to a GitHub issue).
- **Legal:** the disclaimer is fine, and using original questions avoids CBR and ANWB copyright. Don't use CBR branding or logos. SVG signs are low risk.
- **Data loss:** progress lives only in localStorage. Clearing Safari data wipes weeks of SRS history. Offer export/import.
- **Scale:** there is no build and no i18n, which is fine for now. The 2,369-LOC vanilla code is maintainable.

## 8. Roadmap

| When | Item | Impact | Effort |
|---|---|---|---|
| **Now** | Rebuild the Proefexamen to the 2025 format: 50 questions, one score, 44 to pass, 30-minute timer; update README and start-screen copy | Critical | S |
| Now | Start screen: value prop (free, no ads, sourced), a "Vandaag" CTA, a clearer hazard-perception disclaimer | High | S |
| Now | PWA: manifest, icons, service worker for real offline use and install | High | S |
| Now | "Laatst gecontroleerd" date, report-a-mistake link, and exam format added to `verificatie.md` | High (trust) | S |
| **Next** | Readiness score, per-topic mastery bars, use the exam date for a daily target | High | M |
| Next | Grow the pool: inzicht to 200+, voorrang to 40+, signs to 80+; avoid repeats across exams | High | M/L |
| Next | Progress export/import (JSON or QR) | Medium | S |
| Next | Streaks and a daily goal | Medium | S |
| Next | Static SEO pages per topic (numbers, signs) with OG tags | Medium | M |
| **Later** | Hazard-perception-style scenes (animated top-down, then photo or video) | High | L |
| Later | Hotspot and drag question types; driver-POV illustrations | Medium | L |
| Later | Driving-school mode (a teacher sees progress), which needs a backend | Medium | L |
