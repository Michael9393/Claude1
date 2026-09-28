# Verificatie van de vragenbank

Elke vraag in `js/data/questions.js` heeft een `source`-veld dat zegt op welke regel hij gebaseerd is. Dit document beschrijft hoe de vragen gecontroleerd zijn en wat er daarbij is verbeterd.

## Werkwijze (herhaalbaar)

1. `node tests/validate.js`: automatische controle. Die kijkt naar unieke id's, een geldig antwoord, geen dubbele vragen of opties, een bron bij elke vraag, minstens 200 vragen en genoeg vragen voor een proefexamen.
2. `node tests/review.js > review.txt`: exporteert alle vragen met antwoord, foute opties, uitleg en bron, plus alle borden en voorrangssituaties.
3. Controleer elke regel in `review.txt` tegen de bron:
   - Is het goede antwoord juist?
   - Is elke foute optie echt fout, en niet "ook een beetje goed"?
   - Klopt de uitleg, zonder beweringen die de bron niet ondersteunt?
4. Pas fouten aan en herhaal vanaf stap 1, tot een ronde niets meer oplevert.

Vragen met bron *CBR-leerstof: veilig rijgedrag* gaan over verstandig rijgedrag (afstand, vermoeidheid, aquaplaning). Daar staat geen wetsartikel achter.

## Controle september 2026

De officiële wetteksten (wetten.overheid.nl) waren vanuit de ontwikkelomgeving niet direct te openen. Elke regel is daarom gecontroleerd via zoekresultaten van Nederlandse bronnen:

- Rijksoverheid
- CBR
- Rijkswaterstaat
- VVN
- ANWB
- teksten van het RVV 1990 op juridische sites
- theorie-oefensites, alleen als aanvulling

Controleer bij twijfel altijd de actuele wettekst.

### Ronde 0: feiten nagezocht (ruim 60 regels)

Nagezocht zijn onder andere:

- **Snelheid en voertuig:**
  - maximumsnelheden, ook met aanhanger
  - 100 km/h overdag op de snelweg
  - rijbewijs B (3500 kg, 750 kg, code 96)
  - kenteken voor aanhangers
  - APK-schema
  - profieldiepte
- **Alcohol en drugs:**
  - alcoholgrenzen, ook in µg/l adem
  - THC en combigebruik
- **Rijbewijs:**
  - beginnersregeling (5 of 7 jaar, 2 strafpunten)
  - theoriecertificaat
  - 2toDrive
- **Stilstaan en parkeren:**
  - de verboden van RVV art. 23 en 24
  - gele strepen
  - bushalte (12 m)
  - zebrapad (5 m)
- **Voorrang:**
  - afslaan (art. 18)
  - rechts inhalen (art. 11)
  - file (art. 13)
  - trams en onverharde wegen (art. 15)
  - bijzondere manoeuvres (art. 54)
  - blinden en zebrapad (art. 49)
  - lijnbus
  - colonne en uitvaartstoet
  - rotonde
  - rangorde van verkeerstekens (art. 63)
  - gebaren van verkeersregelaars (art. 82)
- **Snelweg:** matrixborden
- **Verlichting:**
  - mistlicht
  - tunnel
- **Overig:**
  - gevarendriehoek (art. 58)
  - kinderzitjes
  - telefoon (art. 61a)
  - doorrijden na ongeval (WVW art. 7)
  - reactietijd en remweg

### Correcties

| Vraag | Probleem | Aanpassing |
|---|---|---|
| `n-driehoek` | "buiten de autosnelweg" suggereerde een uitzondering die niet in de regel staat | Regel is: ongeveer 30 m (RVV art. 58) |
| `k-driehoek-verplicht` (nieuw) | – | Meenemen is niet verplicht, plaatsen soms wel |
| `i-bus` | "voor laten gaan" | Juist: de bus *gelegenheid geven* weg te rijden (snelheid minderen, zo nodig stoppen) |
| `k-telefoon` | Beweerde dat vasthouden bij een rood licht ook verboden is; daarover verschillen de bronnen | Bewering verwijderd |
| `k-dimlicht` | Tunnels ontbraken | Dimlicht ook verplicht in tunnels |
| `k-mistlicht-voor` (nieuw) | Veel sites noemen "200 m", maar dat staat niet in de regel | Regel is: zicht ernstig beperkt door mist, sneeuw of regen |
| `n-2todrive` | Onduidelijk welk examen | Het praktijkexamen vanaf 17 jaar |
| `k-gordel` | Te absoluut | "als er een gordel is" |
| `k-fietspad-stilstaan` | Verkeerde grondslag (art. 23) | Auto's mogen helemaal niet op het fietspad (art. 10) |
| `k-fietsstrook-stilstaan` (nieuw) | – | Stilstaan op een fietsstrook is verboden (art. 23) |
| `n-beginner-punten` | Gevolg onjuist beschreven | Rijbewijs inleveren, dan een CBR-onderzoek; zak je, dan is het ongeldig |
| `i-tankstation` | Kapotte antwoordoptie | Optie herschreven |
| `k-colonne-voorrangsweg` | Verwarrende uitleg | Een colonne heeft zelf geen voorrang |
| `i-file` | Bewering over alarmlichten bij file was onvoldoende onderbouwd | Verwijderd |
| `k-mistachter-regen` | Onderbouwde natuurkundige uitleg ontbrak | Vereenvoudigd |
| Bord *inhaalverbod* | Uitzondering ontbrak | Fietsers en bromfietsers mag je wel inhalen |
| Voorrang | Regel art. 18 lid 2 ontbrak | Nieuwe situatie `v-linksaf-rechtsaf`: linksaf laat de rechtsaf slaande tegenligger voorgaan |

### Rondes

1. **Ronde 1:** alle 200 vragen (vraag, antwoord, foute opties), de 28 borden en de voorrangssituaties. Dit leverde 7 correcties op, plus vraag 200.
2. **Ronde 2:** alle uitlegteksten, plus opnieuw alles wat in ronde 1 veranderde. Dit leverde 1 correctie op.
3. **Ronde 3:** alleen de wijzigingen uit ronde 2 en de nieuwe items. Geen bevindingen, dus de controle is afgerond.

## Bekende beperkingen

- Regels veranderen. Denk aan de maximumsnelheid op de snelweg: sinds 2025 mag je op een paar trajecten overdag weer 130 km/h. Controleer dit voor je examen.
- De borden zijn vereenvoudigde tekeningen.
- Gevaarherkenning zit niet in de app.
