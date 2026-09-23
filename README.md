# Aansprakelijkheidskompas

Een educatieve tool die een **eerste inschatting** geeft van waar de aansprakelijkheid waarschijnlijk ligt bij schade door AI-systemen en algoritmen, naar Nederlands en Europees recht. Je beschrijft een casus of een denkbeeldig scenario. De tool toont het resultaat als een draaischijf van 0 tot 100, met een volledige onderbouwing, de betrokken partijen en bronvermelding.

De tool heeft twee modi:

| | **Demomodus** (standaard) | **Live modus** |
|---|---|---|
| Hoe | Vaste trefwoordregels en een gecontroleerde dataset van echte uitspraken en wetgeving | Claude (`claude-sonnet-5`) doorzoekt de officiële databases van **rechtspraak.nl** en **wetten.overheid.nl**, leest de relevantste uitspraken en gebruikt web search alleen voor Europees recht |
| Kosten | Gratis, geen API-sleutel nodig | API-tegoed, ongeveer €0,20 tot €0,50 per analyse |
| Snelheid | Een paar seconden | 30 tot 90 seconden |
| Casussen | AI-thema's en veelvoorkomende alledaagse zaken die de regels kennen | Elke casus, met uitleg op maat en echte Nederlandse vergelijkbare zaken |
| Zoekfilters | – | Rechtsgebied, instantie (Hoge Raad, hof, rechtbank, Raad van State, CRvB, CBb) en periode |
| Bronnen | Handmatig gecontroleerd, altijd echt | Per bron zichtbaar of hij rechtstreeks uit rechtspraak.nl of wetten.overheid.nl komt |

> **Dit is geen juridisch advies.** De tool is bedoeld om te leren, te verkennen en het gesprek te starten, niet om beslissingen op te baseren. Lees de sectie [Beperkingen](#beperkingen).

## Waarom

Wie schade lijdt door een algoritme (een automatische afwijzing, een onterechte fraudeverdenking, een auto die verkeerd remt), weet vaak niet waar te beginnen. Het juridische kader verandert bovendien snel: de AI-verordening, de herziene Productaansprakelijkheidsrichtlijn, de AVG en een groeiende hoeveelheid rechtspraak. Deze tool maakt dat kader verkenbaar. De live modus zoekt per casus actief naar actuele bronnen en laat zien hoe betrouwbaar elke bron is.

## Snel starten

Je hebt **Node.js 20 of nieuwer** nodig ([nodejs.org](https://nodejs.org), of op Windows `winget install OpenJS.NodeJS.LTS`).

```bash
git clone https://github.com/juliguan/aansprakelijkheidskompas.git
cd aansprakelijkheidskompas
npm install
npm run demo
```

Open <http://localhost:3000>. Rechtsboven staat in welke modus de tool draait.

> **Windows PowerShell:** krijg je de fout *"running scripts is disabled on this system"*, gebruik dan `npm.cmd` in plaats van `npm` (bijvoorbeeld `npm.cmd run demo`).

## Wisselen tussen demo en live

Er zijn twee manieren:

**1. Per keer, met een commando**

```bash
npm run demo    # demomodus: geen API, geen kosten
npm run live    # live modus: Claude + web search
```

**2. Vast instellen in `.env`**

Kopieer `.env.example` naar `.env` (in PowerShell: `Copy-Item .env.example .env`) en zet één regel op de gewenste modus:

```
MODUS=demo     # of: MODUS=api
```

Start daarna met `npm start`. Een commando (`npm run demo` of `npm run live`) gaat altijd voor de instelling in `.env`. Staat er niets ingesteld, dan start de tool in **demomodus**, zodat er nooit per ongeluk kosten worden gemaakt.

### Live modus instellen

1. Maak een API-sleutel aan in de [Claude Console](https://console.anthropic.com) onder *Settings → API Keys*. Je ziet de volledige sleutel maar één keer.
2. Zet hem in `.env`, zonder aanhalingstekens:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Zorg dat er tegoed op je API-account staat en dat web search aan staat voor je organisatie.
4. Start met `npm run live`.

**Over kosten:** de API staat los van een Claude Pro- of Max-abonnement en wordt apart afgerekend met vooraf gekocht tegoed. Is het tegoed op, dan stoppen de analyses met een foutmelding. Zet in de Console onder *Settings → Billing* **auto-reload uit** als je niet automatisch wilt bijbetalen, en stel eventueel een maandlimiet in onder *Settings → Limits*.

`.env` staat in `.gitignore`: je sleutel komt nooit in de browser of op GitHub terecht.

## Hoe het werkt

### Demomodus

1. De tekst wordt vergeleken met **thema's** en **signalen**. De AI-thema's zijn werving en selectie, overheid, zelfrijdende auto's, producten en software, kredietscores, platformwerk, gezichtsherkenning, zorg en privacy. De alledaagse thema's zijn (winkel)diefstal, verkeersongevallen, dieren, kinderen, buren, ongevallen op het werk, kapotte aankopen en vallen of struikelen. De signalen zijn (geen menselijke controle, geen uitleg, aanwijzingen voor discriminatie, concrete schade, een probleem na een update, enzovoort). Zie [`server/demo/regels.js`](server/demo/regels.js).
2. De score is de basisscore van het belangrijkste thema plus of min het gewicht van de gevonden signalen.
3. De bronnen komen uit [`server/demo/dataset.js`](server/demo/dataset.js): een handmatig gecontroleerde verzameling Nederlandse en Europese uitspraken (onder andere SyRI, de toeslagenaffaire, Uber/Ola, SCHUFA, Dun & Bradstreet, IZA/Vrerink en kantonrechteruitspraken over de vaste vergoeding bij winkeldiefstal) en de belangrijkste wetgeving. Elk ECLI-nummer is gecontroleerd via de open data van rechtspraak.nl of EUR-Lex.
4. Beschrijft de tekst geen casus, of herkent de demo geen thema, dan geeft hij geen score maar aanvulvragen.

### Live modus

1. De server stuurt de casus naar `claude-sonnet-5`. Het model krijgt drie eigen hulpmiddelen die de server uitvoert op officiële bronnen:
   - **`zoek_uitspraken`**: zoekt in alle gepubliceerde Nederlandse uitspraken op rechtspraak.nl, met filters op rechtsgebied, instantie en jaar.
   - **`haal_uitspraak`**: haalt de officiële tekst van een uitspraak op via de [open data van rechtspraak.nl](https://www.rechtspraak.nl/Uitspraken/paginas/open-data.aspx), zodat het model leest wat de rechter echt besliste.
   - **`haal_wetsartikel`**: haalt de actuele tekst van een wetsartikel op uit het Basiswettenbestand (wetten.overheid.nl), inclusief een directe link.

   Daarnaast mag het model maximaal 3 keer web search gebruiken, beperkt tot officiële domeinen (EUR-Lex, Curia, overheid.nl, toezichthouders), vooral voor Europees recht.
2. **De zoekfilters van de gebruiker worden door de server afgedwongen**: ook als het model zelf iets anders vraagt, zoekt de server alleen binnen het gekozen rechtsgebied, de gekozen instantie en de gekozen periode.
3. Tijdens het onderzoek zie je live welke zoekopdrachten er worden gedaan en welke uitspraken en artikelen het model leest.
4. De server **controleert elke genoemde bron** en geeft een label:
   - *Gelezen via rechtspraak.nl*: de volledige tekst is opgehaald en gelezen.
   - *Gevonden op rechtspraak.nl*: de uitspraak stond in de officiële zoekresultaten.
   - *Wettekst van wetten.overheid.nl*: het artikel is opgehaald.
   - *Teruggevonden in zoekresultaten*: alleen gezien via web search.
   - *Niet teruggevonden* (rood): nergens in het onderzoek aangetroffen.

   Een verzonnen ECLI-nummer valt zo meteen op: rechtspraak.nl kent het niet.
5. Het model beslist zelf of de invoer een casus is. Onzin krijgt geen score; een korte maar zinnige casus wel.

> De zoekfunctie gebruikt het zoek-endpoint achter uitspraken.rechtspraak.nl. Dat is niet officieel gedocumenteerd en kan dus veranderen. `npm run check:bronnen` test in een paar seconden (gratis) of alle koppelingen nog werken.

### De score

De score geeft aan hoe sterk de juridische basis is om ten minste één partij aansprakelijk te houden, gezien vanuit de benadeelde. Het is geen kans op winst in een rechtszaak.

| Score | Kwalificatie |
|---|---|
| 0-20 | Geen of zeer zwakke aansprakelijkheidsbasis |
| 21-40 | Zwakke aanwijzing |
| 41-60 | Gemengd beeld: uitkomst onzeker |
| 61-80 | Duidelijke aanwijzing |
| 81-100 | Sterke aanwijzing |

## Testen

```bash
npm run check
```

Dit draait de testscenario's (drie AI-casussen, drie alledaagse casussen en de randgevallen) door de demomodus en controleert status en score. Er is geen API-sleutel voor nodig.

```bash
npm run check:bronnen
```

Dit test de koppelingen met rechtspraak.nl en wetten.overheid.nl: zoeken met filters, een uitspraak ophalen, een verzonnen ECLI weigeren en zeven wetsartikelen ophalen. Er is een internetverbinding voor nodig, maar geen API-sleutel. Hoe je de live modus zelf test, staat in [testscenarios.md](testscenarios.md).

## Demo als losse pagina

```bash
npm run bouw:standalone
```

Dit maakt `standalone/aansprakelijkheidskompas.html`: de volledige demomodus in één HTML-bestand, zonder server of API. Je kunt het bestand delen of op elke statische host zetten (bijvoorbeeld GitHub Pages). De live modus zit er bewust niet in, want die heeft een server met een geheime API-sleutel nodig.

## Projectstructuur

```
server/
  index.js          Express-server: modus kiezen, POST /api/analyse (Server-Sent Events), GET /api/status
  analyse.js        live modus: onderzoekslus met Claude, tools en web search; herstelpoging bij ongeldige JSON
  prompt.js         systeemprompt en JSON-contract voor de live modus
  schema.js         validatie van het modelantwoord (zod)
  bronnen.js        bronnen controleren tegen wat er echt is opgehaald, controlelinks, kwalificatie per score
  officieel/
    rechtspraak.js  zoeken in en ophalen van uitspraken op rechtspraak.nl
    wetten.js       actuele wetsartikelen van wetten.overheid.nl
    tools.js        de tools voor Claude, inclusief het afdwingen van de zoekfilters
    tekst.js        XML naar leesbare tekst
  demo/
    demo.js         demomodus: regelgebaseerde analyse in hetzelfde uitvoerformaat
    regels.js       thema's, signalen en gewichten
    dataset.js      gecontroleerde uitspraken en wetgeving
public/
  index.html, styles.css
  dial.js           draaischijf (SVG)
  app.js            formulier, stream lezen, resultaat en foutmeldingen tonen
  voorbeelden.js    de drie testscenario's
scripts/
  check-demo.js     automatische controle van de demomodus
  bouw-standalone.js  bouwt de demo als één losse HTML-pagina
testscenarios.md    scenario's en verwachte uitkomsten
```

### De dataset uitbreiden

Voeg een item toe aan [`server/demo/dataset.js`](server/demo/dataset.js) met één of meer `themas` uit [`regels.js`](server/demo/regels.js). **Controleer het ECLI-nummer eerst**, bijvoorbeeld via `https://data.rechtspraak.nl/uitspraken/content?id=<ECLI>&return=META`. Draai daarna `npm run check`.

### Antwoordformaat van `/api/analyse`

Beide modi geven hetzelfde formaat terug. Tijdens het onderzoek stuurt het endpoint de gebeurtenissen `fase`, `zoek`, `gevonden` en `zoekfout`, en tot slot precies één `resultaat` of `fout`:

```jsonc
{
  "modus": "demo",                // demo | api
  "status": "ok",                 // ok | geen_bronnen | te_vaag | geen_casus
  "score": 72,                    // 0-100, null als er geen oordeel is
  "kwalificatie": "Duidelijke aanwijzing voor aansprakelijkheid",
  "samenvatting": "...",
  "onderbouwing": "...",
  "toelichting_status": "",
  "factoren":  [{ "factor", "richting": "verhogend|verlagend|neutraal", "toelichting" }],
  "partijen":  [{ "partij", "rol", "grondslag", "inschatting": "waarschijnlijk|mogelijk|onwaarschijnlijk", "toelichting" }],
  "bronnen":   [{ "soort", "titel", "kenmerk", "instantie", "jaar", "url", "relevantie",
                  "teruggevonden", "herkomst", "ecli_formaat_ongeldig", "controle": { "label", "url" } }],
  "onzekerheden": ["..."],
  "vervolgvragen": ["..."],
  "controle": { "totaal": 5, "teruggevonden": 4, "niet_teruggevonden": 1 },
  "meta": { "model": "...", "zoekopdrachten": 4, "duur_ms": 38000, "datum": "2026-09-23" }
}
```

## Foutafhandeling

| Situatie | Wat je ziet |
|---|---|
| Leeg invoerveld | Een melding onder het invoerveld; er wordt niets verstuurd |
| Geen casus of te vaag | Grijze wijzer zonder score, uitleg en aanvulvragen |
| Geen bronnen gevonden (live) | Wel een score, met een waarschuwing dat die alleen op algemene beginselen rust |
| Live modus zonder API-sleutel, of een ongeldige sleutel | Foutkaart met instructies |
| Tegoed op, rate limit, overbelasting, geen verbinding | Foutkaart met "Opnieuw proberen" |
| Duurt langer dan 3 minuten | Foutkaart "Het onderzoek duurde te lang" |
| Ongeldig JSON-antwoord van het model | Eén automatische herstelpoging, daarna een foutkaart |
| Server niet bereikbaar | Foutkaart; je casus blijft in het invoerveld staan |

## Beperkingen

**Beide modi**

- **De score is een grove indicatie**, geen kans op winst. Bewijsproblemen, verjaring, procesrisico's en kosten worden nauwelijks meegewogen.
- **Het recht verandert.** De AI-verordening wordt gefaseerd van kracht en de herziene Productaansprakelijkheidsrichtlijn moet uiterlijk 9 december 2026 zijn omgezet.
- **Privacy.** Vul geen namen, BSN's of andere herleidbare gegevens in. In de live modus gaat de tekst naar de Anthropic API en worden er zoekopdrachten over gedaan.
- **Alleen lokaal gebruik.** De server heeft geen authenticatie en geen rate limiting. Zet hem niet zo op internet: in de live modus kan dan iedereen analyses op jouw kosten draaien.

**Demomodus**

- Werkt met trefwoorden, niet met begrip. Ontkenningen, nuances en ongebruikelijke formuleringen worden gemist.
- De dataset is klein en bewust beperkt tot bronnen die met zekerheid kloppen. De bronnen bestaan echt, maar of ze op jouw casus van toepassing zijn, is grof ingeschat.

**Live modus: AI-jurisprudentieonderzoek vereist altijd verificatie**

- **Verwijzingen kunnen nog steeds fout zijn.** Doordat het model in de officiële databases zoekt, is een verzonnen ECLI-nummer zo goed als uitgesloten. Maar het model kan een echte uitspraak nog steeds **verkeerd samenvatten** of toepassen op een casus waar hij niet echt bij past. Een label als "Gelezen via rechtspraak.nl" betekent dat de bron bestaat en is gelezen, niet dat de uitleg klopt.
- **Rode labels.** Een bron zonder groen label is nergens in het onderzoek aangetroffen. Die kan best kloppen (bijvoorbeeld een bekend artikel dat het model uit eigen kennis noemt), maar controleer hem extra goed.
- **Verifieer elke bron** op [rechtspraak.nl](https://uitspraken.rechtspraak.nl), [wetten.overheid.nl](https://wetten.overheid.nl) of [EUR-Lex](https://eur-lex.europa.eu) voordat je hem gebruikt.
- **Zoekbereik.** Alleen gepubliceerde uitspraken; rechtspraak.nl publiceert maar een deel van alle uitspraken. Betaalde databanken en literatuur ontbreken. De periodefilter wordt toegepast op de beste 50 resultaten per zoekopdracht.

Hulp nodig bij een echte zaak? Neem contact op met het [Juridisch Loket](https://www.juridischloket.nl) of een advocaat.

## Licentie

[MIT](LICENSE)
