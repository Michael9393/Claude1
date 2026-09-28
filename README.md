# Claude1

## Theorie B: oefenapp voor het CBR theorie-examen (auto)

A study app for the Dutch car (B) theory exam, in Dutch. Plain HTML/CSS/JS: no build step, no server, works offline. Progress is saved in the browser (`localStorage`).

### Open it

- Open `index.html` in a browser, or
- serve the folder (`npx http-server .`), or
- enable GitHub Pages for the repo to use it on your phone.

### Wat zit erin

| Onderdeel | Wat je doet |
|---|---|
| **Flashcards** | Borden, getallen en vragen met herhaling op afstand (Leitner: na 1, 2, 4, 8, 16 dagen). |
| **Borden** | Bord → betekenis en betekenis → bord, plus een overzicht van alle borden. |
| **Voorrang** | Kruispunten van bovenaf: tik de verkeersdeelnemers in de juiste volgorde aan. |
| **Getallen** | Invulvragen over snelheden, promilles, afstanden, massa's, met spiekbriefje. |
| **Proefexamen** | 12 kennis + 28 inzicht, slagingsgrens 10 en 25, nakijken aan het eind. |
| **Foutenlogboek** | Elke fout uit elke oefening, per onderwerp, met "oefen mijn fouten". Een fout is opgelost na twee keer achter elkaar goed. |

Gevaarherkenning (hazard perception) zit er nog niet in.

### Content

All questions are written for this app from the Dutch traffic rules (RVV 1990); they are **not** official CBR questions. Signs are simplified SVG drawings. Check doubtful rules against the CBR or your theory book.

- `js/data/questions.js`: 200 knowledge, insight and number questions, each with a `source`
- `js/data/signs.js`: 28 road signs
- `js/data/voorrang.js`: 15 right-of-way scenarios

Every question was checked against its source and corrected where needed; see [docs/verificatie.md](docs/verificatie.md) for the method, the fixes and the known limitations.

After editing, repeat the check:

```sh
node tests/validate.js           # automatic checks (sources, duplicates, count, answers)
node tests/review.js > review.txt   # readable list for a manual review round
```
