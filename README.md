# Claude1

## Theorie B: oefenapp voor het CBR theorie-examen (auto)

A study app for the Dutch car (B) theory exam, in Dutch. Plain HTML/CSS/JS: no build step, no account. Progress is saved in the browser (`localStorage`). When served over http(s) it can be installed on a phone and works offline (service worker in `sw.js`).

### Open it

- Open `index.html` in a browser, or
- serve the folder (`npx http-server .`), or
- enable GitHub Pages for the repo to use it on your phone (then "Add to home screen").

After changing any file, bump `CACHE` in `sw.js` so installed copies pick up the new version.

### Wat zit erin

| Onderdeel | Wat je doet |
|---|---|
| **Vandaag** | Eén knop op de startpagina: open fouten, kaarten die aan de beurt zijn en een paar nieuwe vragen uit je zwakste onderwerp. |
| **Flashcards** | Borden, getallen en vragen met herhaling op afstand (Leitner: na 1, 2, 4, 8, 16 kalenderdagen). |
| **Borden** | Bord → betekenis en betekenis → bord, plus een overzicht van alle borden. |
| **Voorrang** | Kruispunten van bovenaf: tik de verkeersdeelnemers in de juiste volgorde aan. |
| **Getallen** | Invulvragen over snelheden, promilles, afstanden, massa's, met spiekbriefje. |
| **Proefexamen** | Zoals het CBR-examen sinds 7 april 2025: 50 vragen door elkaar, 30 minuten, 44 goed om te slagen. Nakijken aan het eind. |
| **Foutenlogboek** | Elke fout uit elke oefening en elk proefexamen, per onderwerp. Een fout is opgelost als je de vraag goed hebt op twee verschillende dagen. |

Gevaarherkenning (de filmpjes in het echte examen) en vragen met foto's zitten er nog niet in. Zie [docs/product-review](docs/product-review/README.md) voor de review en de plannen.

### Content

All questions are written for this app from the Dutch traffic rules (RVV 1990); they are **not** official CBR questions. Signs are simplified SVG drawings. Check doubtful rules against the CBR or your theory book.

- `js/data/questions.js`: 200 knowledge, insight and number questions, each with a `source`
- `js/data/signs.js`: 28 road signs
- `js/data/voorrang.js`: 15 right-of-way scenarios

Every question was checked against the consolidated law texts (RVV 1990, Wegenverkeerswet 1994, Reglement rijbewijzen and others) and corrected where needed; see [docs/verificatie.md](docs/verificatie.md) for the method, the fixes and the known limitations.

After editing, repeat the check:

```sh
node tests/validate.js           # automatic checks (sources, duplicates, count, answers)
node tests/logic.js              # behaviour tests: number input, flashcard schedule, mistake log, saved data
NODE_PATH=$(npm root -g) node tests/smoke.js   # browser smoke test (needs Playwright)
node tests/review.js > review.txt   # readable list for a manual review round
```
