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

## Controle na productreview (30 september 2026)

Een reviewer plaatste zes kanttekeningen bij de inhoud. Elk punt is nagezocht in de wettekst. wetten.overheid.nl, cbr.nl en officielebekendmakingen.nl waren vanuit de ontwikkelomgeving opnieuw geblokkeerd. Gebruikt zijn:

- RVV 1990, toestand 1 juli 2026, uit de CC0-kopie [Apolloccrypt/wetgeving-nl](https://github.com/Apolloccrypt/wetgeving-nl) (artikelen).
- **Bijlage I (borden)** uit [statengeneraal/laws-markdown](https://github.com/statengeneraal/laws-markdown) (`AMvB/reglement/verkeersregels/en/verkeerstekens/1990/(rvv/1990)/BWBR0004825/README.md`). Dat is een oudere geconsolideerde BWB-tekst. De omschrijving van F1 is dezelfde als in de *Uitvoeringsvoorschriften BABW inzake verkeerstekens* (BWBR0009104, toestand 1 oktober 2023, in de CC0-kopie) en in de bordenlijst van het NDW.

| Vraag of bord | Wat de reviewer zei | Wat de wet zegt | Aanpassing |
|---|---|---|---|
| `k-blinden`, `i-blinde` | Een witte stok met rode ringen betekent doofblind; een blinde heeft een gewone witte stok | Art. 49 lid 1: "Bestuurders moeten **blinden, voorzien van een witte stok met één of meer rode ringen**, en overigens alle personen die zich moeilijk voortbewegen, voor laten gaan." De geleidehond staat niet in de wet | De wettekst geeft de app gelijk. Dat rode ringen in de praktijk doofblind aanduiden, staat niet in de wet en is hier niet nagezocht. Uitleg volgt nu de wettekst; de geleidehond staat er niet meer als wettelijke regel in. `i-blinde` (gewone witte stok) legt uit waarom je ook dan wacht |
| `n-zebra-stilstaan` | "op en binnen 5 m **vóór**" de oversteekplaats, niet "binnen 5 m van" | Art. 23 lid 1 onder c: niet stilstaan "**op een oversteekplaats of binnen een afstand van vijf meter daarvan**". Dat geldt aan beide kanten, niet alleen ervoor | Geen: de app klopt |
| Bord *inhaalverbod* (F1) | Een bromfiets is een motorvoertuig, dus "bromfietsers mag je wel inhalen" is fout | Bijlage I, F1: "Verbod voor motorvoertuigen om elkaar onderling in te halen". Art. 1: *motorvoertuigen* zijn "alle gemotoriseerde voertuigen **behalve bromfietsen**, fietsen met trapondersteuning en gehandicaptenvoertuigen". Een uitzondering voor tweewielige motorvoertuigen staat niet in F1; een motor inhalen mag dus niet | Geen: de app klopt |
| Bord *autoweg* (G3) | "harder dan 50" in plaats van "minstens 50" | Bijlage I, G3: alleen "Autoweg". Art. 42 lid 2: motorvoertuig "waarmee met een snelheid van **ten minste 50 km per uur** mag en kan worden gereden" | Geen voor G3. Wel gevonden: bord *autosnelweg* (G1) en `n-snelweg-min` zeiden "harder dan 60". Art. 42 lid 1 zegt **ten minste 60**. Beide aangepast |
| `k-inrit` | Leerlingen leren dit als art. 18 | Art. 54 noemt letterlijk "van een weg een inrit oprijden" als bijzondere manoeuvre: "moeten het overige verkeer voor laten gaan". Art. 18 gaat over afslaan en verkeer "op dezelfde weg"; een inrit is geen weg of kruispunt | Geen: art. 54 is de regel die hier geldt |
| `i-rotonde-oprijden` | Richting aangeven bij het oprijden is een wettelijke regel, geen advies | Art. 17 lid 2: "Bestuurders moeten alvorens af te slaan een teken met hun richtingaanwijzer of met hun arm geven." Het verlaten van de rotonde is afslaan. Voor het **oprijden** noemen art. 17, 47, 48 en 55 geen plicht | Deels: bron was ten onrechte *veilig rijgedrag*, nu art. 17. Uitleg zegt nu wat de wet regelt (verlaten) en wat niet (oprijden). Antwoord blijft |

Getest met `node tests/validate.js` en `node tests/logic.js`.

## Controle tegen de wettekst (28 september 2026)

Alle vragen zijn opnieuw gecontroleerd, nu tegen de **geconsolideerde wetteksten zelf** in plaats van zoekresultaten. wetten.overheid.nl was vanuit de ontwikkelomgeving geblokkeerd. Daarom is de CC0-kopie van het Basis Wetten Bestand gebruikt uit [github.com/Apolloccrypt/wetgeving-nl](https://github.com/Apolloccrypt/wetgeving-nl). Die kopie is opgehaald van wetten.overheid.nl.

| Regeling | Versie (toestand) |
|---|---|
| Reglement verkeersregels en verkeerstekens 1990 (RVV 1990, BWBR0004825) | 1 juli 2026 |
| Wegenverkeerswet 1994 (art. 7, 8, 36-37, 123b, 130-131) | september 2026 |
| Reglement rijbewijzen (art. 25a, 49b, 67d, 104a, categorie B) | 1 januari 2026 |
| Besluit voertuigen (APK, art. 8 en 16) | juli 2026 |
| Besluit alcohol, drugs en geneesmiddelen in het verkeer (art. 3) | recent |
| Regeling maatregelen rijvaardigheid en geschiktheid 2011 (art. 1, 5) | 1 april 2023 (nieuwste in de kopie) |
| Wet aansprakelijkheidsverzekering motorrijtuigen (art. 2) | recent |
| Regeling voertuigen (profieldiepte 1,6 mm) | recent |

### Fouten gevonden in de wettekst

| Vraag | Wat er stond | Wat de wet zegt | Aanpassing |
|---|---|---|---|
| `k-erf`, `i-erf-kind`, bord *erf* | "stapvoets" | Art. 45 RVV: **niet sneller dan 15 km/h** | Antwoord en uitleg nu 15 km/h |
| `i-bushalte`, `n-bushalte` | Iemand afzetten binnen 12 m van een bushaltebord mag niet | Art. 23 lid 2 RVV: het verbod geldt **niet voor direct in- en uitstappen** | Juiste antwoord omgedraaid; uitzondering in de uitleg |
| `n-beginner-2todrive`, `n-beginner-jaren`, `k-beginner-def` | 2toDrive: 7 jaar beginnend bestuurder | Art. 8 lid 3 WVW: rijbewijs B vóór je 18e = **5 jaar**. 7 jaar alleen via een AM- of T-rijbewijs van vóór je 18e. Dezelfde definitie geldt voor de strafpunten | Antwoord 7 → 5; uitleg aangepast |
| `k-matrix-snelheid`, `i-matrix-70` | Matrixbord gaat voor het vaste bord | Art. 63b lid 2 RVV: bij twee limieten **geldt de laagste** | Uitleg aangepast (antwoord 70 blijft goed) |
| `k-driehoek-verplicht`, `k-driehoek-wanneer` | Driehoek plaatsen "als alarmlichten niet genoeg zijn" | Art. 58 lid 3 RVV: niet verplicht **als je alarmlichten voert** | Antwoord en uitleg aangepast |
| `k-tunnel`, `k-dimlicht` | Dimlicht verplicht in tunnels | Art. 32 RVV noemt alleen nacht en ernstig belemmerd zicht. **Geen tunnelregel** in de wet | Tunnelbewering verwijderd; `k-tunnel` vervangen door `k-grootlicht-wanneer` (art. 32 lid 2) |
| `k-file-rechts`, `i-file-rechts` | "Van strook wisselen om rechts in te halen mag niet" | Art. 13 RVV: files mogen rechts worden ingehaald. De extra bewering staat niet in de wet | Verwijderd |
| `n-rijbewijs-geldig` | 10 jaar | Art. 25a Reglement rijbewijzen: 10 jaar **bij afgifte onder 65 jaar** | Vraag verduidelijkt |
| `n-2todrive` | Praktijkexamen vanaf 17 | Reglement rijbewijzen: rijbewijs B vanaf 17 met begeleiderspas. Een examenleeftijd staat niet in de gecontroleerde tekst | Vraag gaat nu over het rijbewijs |
| `n-beginner-punten` | "strafpunten" | Regeling maatregelen art. 5 onder n: na **2 veroordelingen** voor feiten van de beginnerslijst volgt een vordering tot inlevering | Vraagtekst sluit aan op de wet |
| `k-rangorde` | Lichten gaan boven borden | Art. 64: lichten gaan boven borden **die de voorrang regelen**; art. 84: aanwijzingen gaan boven alles | Uitleg preciezer |
| Bord *autoweg* | "snelle motorvoertuigen" | Art. 42 lid 2 RVV: minimaal **50 km/h** kunnen en mogen | Betekenis aangepast |

Alle andere regels bleken in de wettekst te kloppen, onder andere:

- snelheden en de aanhanger (art. 20-22)
- alcoholgrenzen (WVW art. 8)
- THC 3,0 en bij combigebruik 1,0 µg/l
- stilstaan en parkeren (art. 23-25)
- afslaan (art. 18)
- inhalen (art. 11-12)
- voorrang, tram en onverharde weg (art. 15)
- colonne en uitvaartstoet (art. 16)
- zebrapad en blinden (art. 49)
- voorrangsvoertuigen (art. 50)
- bus (art. 56)
- bijzondere manoeuvres (art. 54)
- gordel, kinderzitje en airbag (art. 59)
- helm (art. 60)
- telefoon (art. 61a)
- geel licht (art. 68)
- overweglichten (art. 71)
- rood kruis en groene pijl (art. 73)
- doorgetrokken streep (art. 76)
- haaientanden (art. 80)
- autosnelweg (art. 42-43)
- doorrijden na ongeval (WVW art. 7)
- WA-verzekering
- rijbewijs B, 750 kg, code 96
- APK-termijnen
- theoriecertificaat van 1,5 jaar

Elke vraag verwijst nu naar het juiste artikel.

### Niet in de wettekst te controleren

- **Bijlage I (borden) en bijlage II (gebaren van verkeersregelaars)** zitten niet in de tekstkopie. (Op 30 september 2026 zijn F1, G1 en G3 wel nagekeken in een andere kopie; zie hierboven.) De betekenis van de borden en de armgebaren is daarom niet artikel voor artikel gecontroleerd. Waar een artikel de regel geeft (erf, autosnelweg, autoweg, parkeren, haaientanden) is dat wel gebeurd.
- **Een erf verlaten als "uitrit"** (`k-erf-verlaten`). Art. 54 noemt het erf niet letterlijk. Dat het verlaten van een erf onder "uit een uitrit de weg oprijden" valt, is de gangbare uitleg (CBR, theorie.nl).
- **Richting aangeven bij het oprijden van een rotonde.** Art. 17 verplicht een teken bij afslaan; dat oprijden geen afslaan is, is de uitleg van VVN.
- **100 km/h overdag op de snelweg.** De wet zegt 130 (art. 21). De 100 volgt uit verkeersbesluiten per traject, dus uit de borden.
- **Adviesvragen** (bron *CBR-leerstof: veilig rijgedrag*) hebben geen wetsartikel.

## Eerdere controle (27 september 2026, via zoekresultaten)

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

## Examenvorm (28 september 2026, nagekeken 30 september 2026)

Bij de productreview bleek dat het proefexamen nog de oude vorm had (12 kennis met 10 goed, 28 inzicht met 25 goed, gevaarherkenning apart). Sinds **7 april 2025** is het CBR theorie-examen B één geheel:

- 50 vragen door elkaar, in 30 minuten
- 44 goed om te slagen
- gevaarherkenning zit er als korte filmpjes tussen
- vraagvormen: ja/nee, meerkeuze, invullen, aanklikken in een foto en slepen

**Controle op 30 september 2026.** cbr.nl was opnieuw niet te openen (ook niet via een webarchief). Wel waren zoekresultaten te zien die alleen uit cbr.nl kwamen. Die bevestigen de vorm. Het zijn samenvattingen van de zoekmachine, geen letterlijk gelezen pagina's:

- [Vernieuwd theorie-examen B-rijbewijs vanaf 7 april](https://www.cbr.nl/nl/over-het-cbr/over/laatste-nieuws/nieuws/vernieuwd-theorie-examen-b-rijbewijs-vanaf-7-april): "het vernieuwde examen bestaat uit 50 vragen en [wordt] in één doorlopend geheel getoetst"; "De kandidaat is geslaagd wanneer binnen 30 minuten tijd minstens 44 vragen goed zijn beantwoord"; de filmpjes "toetsen onder andere elementen van gevaarherkenning, zoals waarnemen en voorspellen"; het oude onderdeel gevaarherkenning (met fototoets) vervalt; de zak-slaaggrens is "vergelijkbaar met die van het huidige examen".
- [Hoe gaat het theorie-examen auto?](https://www.cbr.nl/nl/rijbewijs-halen/auto/theorie-examen-auto/hoe-gaat-het-theorie-examen-auto) en [Waarom staan er testvragen in het theorie-examen?](https://www.cbr.nl/nl/veelgestelde-vragen/waarom-staan-er-testvragen-in-het-theorie-examen): naast de 50 vragen krijg je **2 testvragen die niet meetellen**, dus 52 vragen in totaal. Welke vragen dat zijn, zie je niet.
- [Wat voor vragen krijg je tijdens je theorie-examen auto?](https://www.cbr.nl/nl/rijbewijs-halen/auto/theorie-examen-auto/soort-vragen-tijdens-theorie): ja/nee, meerkeuze, invullen (getal), hotspot (aanklikken in een foto), sleepvragen (cijfers 1-2-3 of een vinkje naar de goede plek slepen).

Een filmpje telt voor zover bekend als gewone vraag mee in de 50; een aparte score voor gevaarherkenning is er niet meer. Hoe een filmpjesvraag precies wordt nagekeken, stond niet in de zoekresultaten. Of de 30 minuten ook voor de testvragen gelden, ook niet.

**Oordeel:** bevestigd door CBR-bronnen (via zoekresultaten), niet tegengesproken. `EXAM` in `js/app.js` blijft 50 / 30 minuten / 44. Het proefexamen volgt deze vorm, zonder filmpjes, foto's en testvragen.

Bij dezelfde review zijn drie vragen aangescherpt:

| Vraag | Probleem | Aanpassing |
|---|---|---|
| `k-alarm` | "heel langzaam rijdt" staat niet in het genoemde artikel | Antwoord gaat nu alleen over stilstaan door pech of een ongeval |
| `i-licht-bord` | Uitleg deed alsof lichten boven elk bord gaan | Lichten gaan boven borden **die de voorrang regelen** (art. 64); andere borden blijven gelden |
| `n-seconden` | "moet" voor iets dat een advies is | Vraag en uitleg spreken nu van een advies |

## Bekende beperkingen

- Regels veranderen. Denk aan de maximumsnelheid op de snelweg: sinds 2025 mag je op een paar trajecten overdag weer 130 km/h. Controleer dit voor je examen.
- De borden zijn vereenvoudigde tekeningen.
- Gevaarherkenning en vragen met foto's (aanklikken, slepen) zitten niet in de app.
