# Theorie B: WCAG 2.2 AA audit

This audit ran Chromium 1194 through Playwright 1.56, at 1280px and 320px wide, in light and dark mode, using the keyboard only. It also used ARIA snapshots, contrast ratios computed from the CSS tokens and `page.clock` to test the exam timer. Screenshots are in `review2/shots-a11y/`.

## High

**1. Proefexamen timer can't be adjusted.** WCAG 2.2.1 Timing Adjustable. The exam has a fixed 30-minute limit (`js/app.js:529,559`). There is no option to turn it off, extend it or be warned. When time runs out, `results(true)` replaces the question without warning. Focus drops to `<body>` and nothing is announced (verified by fast-forwarding the clock 30 minutes). At 5:00 left, the only signal is the colour change to `.bijna`. This is a practice tool, so the time limit isn't essential, and the CBR itself offers extended-time exams. *Fix:* add a choice before the start: "30 min (as in the real exam) / 45 min (extended) / no time limit". Add a polite live announcement at 5 min and 1 min. After time is up, move focus to the results `<h1>`, which needs `tabindex="-1"`.

**2. Focus is lost after every content swap.** WCAG 2.4.3 Focus Order and 4.1.3 Status Messages. `main.innerHTML` is replaced without moving focus, so `document.activeElement` becomes `BODY`. This happens after:
- starting "Vandaag", a flashcard deck, a borden quiz, a kruispunt or the exam
- every "Volgende" (runSession `app.js:249`, runExam `app.js:580`)
- "Wist ik" / "Wist ik niet" (`app.js:443`)
- time-up (`app.js:610`)

A screen reader gets no signal that a new question appeared, and that happens 50 times per exam. Nav route changes (`route()`, `app.js:701-716`) leave focus on the nav link, so the new page isn't announced either. *Fix:* after each render, focus the view's `<h1>`, or the question prompt, with `tabindex="-1"`. In `route()`, do the same after `views[name]()`.

## Medium

**3. Flashcards hijack Enter/Space anywhere on the page.** WCAG 2.1.1 Keyboard and 2.1.4 Character Key Shortcuts. The document-level `keydown` handler (`app.js:447-459`) calls `preventDefault()` on Enter/Space for any focused element except inputs. *Repro:* start a deck, Tab to the "Borden" nav link, press Enter. The card flips and navigation doesn't happen; a second Enter is needed. The single-key shortcuts `1`/`2` are also active page-wide and can't be turned off or remapped. *Fix:* ignore the event when `e.target.closest('a,button,summary,[tabindex]')` is not the card. Scope `1`/`2` to when focus is inside `.flashcard`, or offer a setting to turn shortcuts off.

**4. Kruispunt vehicle focus indicator is too faint.** WCAG 1.4.11 Non-text Contrast. `.voertuig` sets `outline:none` (`css/style.css:163`). Focus is shown only by a 3px `--accent` stroke (`:164`). That stroke measures 1.22:1 against the road in light mode (#c2410c on #5b6068) and 2.71:1 in dark mode. Screenshot: `voorrang-focus-light.png`. *Fix:* use a double ring, for example a 4px white stroke under a 2px `#000`/`--text` stroke. That gives at least 3:1 against both road and grass.

**5. Order badges fail contrast in dark mode.** WCAG 1.4.3 Contrast (Minimum). The number badges are white 12px bold text on `--accent` #ff8a4c, which measures 2.34:1 (`style.css:166`, `intersection.js:101-102`). Screenshot: `voorrang-pick-dark.png`. *Fix:* use `fill: var(--accent-text)` for `.badge` (7.6:1).

**6. Input boundaries are too faint.** WCAG 1.4.11. The number input (`style.css:141`) and the exam-date input (`:118`) use `--line` borders. These measure 1.29:1 against the card in light mode and 1.33:1 in dark. *Fix:* use `--muted` or a new `--field-border` of at least 3:1, e.g. #8a96a5 in light mode.

**7. Spiekbriefje table scrolls horizontally at 320px.** WCAG 1.4.10 Reflow. At 320px, `#/getallen` has `scrollWidth` 496. The cause is `.tabel .getal { white-space: nowrap }` (`style.css:191`) combined with units like "µg THC per liter bloed". Screenshot: `w320-getallen.png`. *Fix:* keep only the number non-breaking, e.g. `<span class="nw">0,5</span> promille`, or drop `nowrap` under 520px.

## Low

**8. Green text is just below 4.5:1 in light mode.** WCAG 1.4.3. `--good` #1f8a4c (`style.css:11`) measures 4.38:1 in two places:
- as text on white (`.status.goed` "Geslaagd"/✓ and `.goed-tekst`)
- as the background behind white text on the "Wist ik" button (16px/600, which isn't large text)

*Fix:* change it to #1a7f45 or darker (at least 4.9:1).

**9. Kruispunt road and grass are almost the same luminance in dark mode.** WCAG 1.4.11. Road #5b6068 against grass #3f6b34 measures 1.01:1 (`style.css:40`), so the road outline depends on hue alone. *Fix:* use a darker grass such as #24401e, or add a light road edge line.

**10. Several buttons have identical names.** WCAG 2.4.6 Headings and Labels. The flashcard page has five buttons all named "Start" (`app.js:393`). The foutenlogboek has several buttons named "Oefen" (`app.js:663`). *Fix:* add `aria-label="Start Verkeersborden"` and `aria-label="Oefen Voorrang"`, or use `aria-describedby` pointing to the row name.

**11. Answer state is shown only by colour.** WCAG 1.4.1 Use of Color and 4.1.2 Name, Role, Value. In practice mode, the chosen wrong option gets only a red border, and the correct one only a green border (`app.js:190-194`). The buttons become `[disabled]` with no state. In the exam, `aria-pressed` is only added after the first click (`app.js:185`), so the options aren't exposed as toggles until then. *Fix:* append visually-hidden text " (jouw antwoord, fout)" / " (juist)" to the options. Render `aria-pressed="false"` from the start in exam mode.

**12. Number-input error isn't linked to the field.** WCAG 3.3.1 Error Identification. The error does show in a `role="alert"` region and focus returns to the input, but the input has no `aria-invalid` and no `aria-describedby` pointing to `.invul-hint` (`app.js:118-119, 220-224`). *Fix:* set both attributes while the error is visible.

## Verified OK

- **Structure:** `lang="nl"`, banner/nav/main landmarks, one `h1` per view, `aria-current` on the active nav link, and `document.title` updates per route. The timer is exposed as `timer "Resterende tijd"`.
- **Kruispunt:** vehicles are named buttons, and focus stays on the vehicle after picking it. Quiz signs use neutral names, which the 1.1.1 test exception allows. Native `confirm()` dialogs work by keyboard and return focus.
- **Layout:** no reflow problems at 320px other than item 7. At 200% zoom the header un-sticks, and focus was never hidden under the sticky header (2.4.11). No target is smaller than 24×24 (2.5.8). There is no motion issue, as the only transitions are 0.2s.
- **Contrast:** body, muted, accent and dark-mode text pass. Disabled buttons (2.0:1) are exempt.
