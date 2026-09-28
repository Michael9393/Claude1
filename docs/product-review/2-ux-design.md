# Theorie B: UX/UI review

Method: served locally, drove it with Playwright at 390x844 and 1280x800 in light and dark mode, and clicked through flashcards, both sign modes, a voorrang scenario, getallen, the exam and the foutenlogboek. Screenshots are in `review/shots/`.

Overall: the design is calm and consistent, with a clear card and tile system and a coherent orange accent. Dark mode is mostly well tokenised. The weak spots are the mobile layout, contrast in dark mode, and accessibility for anything that isn't a text button.

## High

1. **Mobile nav hides 2 of the 7 destinations.** The nav is 615px wide in a 358px container (`css/style.css:55`), and there is no scroll affordance. "Proefexamen" and "Fouten" are offscreen, and the active item isn't scrolled into view: on #/getallen the "Ge..." tab is cut off (`getallen-m-light.png`, `fouten-m-light.png`). Links are 35px tall, below the 44px touch target. The sticky header is 83px. Fix: use a bottom tab bar with 4-5 items (Start, Oefenen, Examen, Fouten), or at least call `scrollIntoView` on `.actief` and add an edge fade.
2. **Flashcards table overflows on mobile.** The document is 455px wide at 390px, and the "Start" buttons are clipped at the right edge (`kaarten-m-light.png`, `js/app.js:304-309`). The main CTA of the page is half-hidden. Fix: make each deck a stacked card or tile with the button on its own line, or hide the "Nieuw"/"Beheerst" columns under 520px.
3. **Dark-mode success/fail buttons are unreadable.** White text on `--good` #51cf82 is 1.98:1 and on `--bad` #ff7b7b is 2.51:1 (`style.css:28-30,85-86`; `flow-fc2-dark.png`). These are the core "Wist ik / Wist ik niet" buttons. Fix: add separate `--good-strong`/`--bad-strong` fill tokens for dark mode, or use dark text on them.
4. **"Betekenis -> bord" can't be used with a screen reader and leaks answers.** The choice buttons contain only an SVG with `role="img"` and no name (`js/data/signs.js:10`, `app.js:106`). The accessible names come out as "", "", "P", "". The SVG `<text>` gives away number and letter signs, while the rest are blank. The same applies to the gallery and question signs: no `aria-label`/`<title>`. Fix: pass `aria-label` = sign name in the gallery and in bord->betekenis mode. In reverse mode, use neutral labels ("Bord 1-4") plus `aria-hidden` on the text.
5. **Voorrang is effectively mouse/tap-only and gives weak feedback.** Vehicles are focusable (`js/intersection.js:83`), but they are only labelled "Voertuig A", with no type or direction. A blind user can't solve it. After a wrong answer the crossing isn't annotated: you get only "Juist antwoord: B -> A" (`flow-vr4-dark.png`). "Opnieuw kiezen" stays visible and enabled after answering but does nothing (`app.js:98,149`). Fix: use labels like "A: auto van onder, gaat rechtdoor". After checking, show the correct order badges in green next to the user's picks, and hide "Opnieuw kiezen".

## Medium

6. **No live feedback for assistive tech.** `.feedback` has no `aria-live`/`role="status"` (`app.js:112`). Focus jumps to "Volgende" without announcing "Goed/Fout". The nav has no `aria-current="page"` (`app.js:563`). There is no `<h1>` (the logo is a link, and pages start at h2). `document.title` never changes per route.
7. **The accent fails AA for text.** White on #e8590c is 3.58:1 (every primary button, `style.css:7,79`), and so are orange links on white. The light progress track #dde3ea on white is 1.29:1, so it is almost invisible at 0% (`flow-fc1-light.png`). Darken the accent to about #c2410c (>=4.5:1).
8. **Exam flow has traps.**
   - "Stoppen" sits 12px below "Volgende" and has the same visual weight (`flow-ex2-light.png`), and it uses a native `confirm()`.
   - Clicking any nav tab mid-exam throws the exam away silently, with no guard.
   - A number question with an empty or invalid input just re-focuses the field, with no message (`app.js:196`).
   Fix: move Stop into the header as a text link, add a hashchange guard, and show inline "Vul een getal in".
9. **Number answers get no field-level feedback.** The input only turns disabled, with no red or green state (`flow-num2-light.png`). Colour the border like `.keuze.juist/.onjuist`.
10. **Redundant or weak copy and hierarchy.**
    - Sign sessions show "Wat betekent dit bord?" as both the h2 and the prompt (`flow-bord2-light.png`, `app.js:373` vs `:92`).
    - The flashcard deck title is just "Alles".
    - Start tiles lead with "0 te herhalen" even when 228 are new (`start-m-light.png`). Show the most actionable number, or a "Begin hier" CTA for new users.
    - The "·" status for unattempted scenarios reads like a list bullet (`voorrang-m-light.png`).

## Low

11. **Date input.** It has no helper text ("Wanneer is je examen?") and no clear or reset option. Its placeholder follows the browser locale.
12. **Flashcards have no keyboard shortcuts** (Space = show, 1/2 = wist ik niet/wel). There is also no "reveal" animation or card metaphor. It reads as a plain form, not a card.
13. **Foutenlogboek.** "Alle voortgang wissen" is a destructive action styled the same as neutral secondary buttons (`flow-fouten-dark.png`). Make it red text. At mobile width the "× fout · open" counts are hidden (`style.css:184`), so the bars have no numbers. The empty state is good copy but has no CTA ("Start een oefening").
14. **Scenario list** is one long column of 15 look-alike buttons on mobile. Grouping by type (gelijkwaardig, haaientanden, tram) would help.
15. **Intersection contrast.** Rails #2b2b2b on road #5b6068 are 2.24:1, and the tram rails are hard to see.
16. **Microcopy.** The Dutch copy is natural and friendly overall ("Mooi!", "Spiekbriefje"). Minor points:
    - The nav says "Getallen" but the page title says "Getallen stampen".
    - "Gezakt" in red with no encouragement or next step.
    - "Nog een ronde" after a single 1/1 scenario is odd.

## What works

- The consistent card system and restrained palette.
- Clear red and green option states on multiple choice, with the explanation shown right after the answer.
- The honest CBR disclaimer.
- `lang="nl"`.
- Visible default focus rings on buttons and links (`flow-focus-light.png`).
- The exam mirrors the real structure well.
