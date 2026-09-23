# Testscenario's

Gebruik deze scenario's om de tool na elke wijziging (aan de prompt, het model of de frontend) te controleren. De drie hoofdscenario's zijn in de interface te laden met de knoppen "Voorbeeld laden".

**Demomodus:** `npm run check` controleert de scenario's automatisch. Verwachte scores:

| Scenario | Score |
|---|---|
| Sollicitatie | ongeveer 73 |
| Fraude-algoritme | ongeveer 76 |
| Zelfrijdende auto | ongeveer 67 |
| Winkeldiefstal | ongeveer 82 |
| Hondenbeet | ongeveer 75 |
| Aangereden fietser | ongeveer 60 |

Bij de randgevallen controleert het script alleen de status. De rest van dit document gaat over het handmatig testen van de **live modus**.

Scores zijn **richtwaarden**. Een taalmodel geeft niet elke keer exact hetzelfde antwoord, dus kijk vooral of de redenering klopt en of de bronnen echt bestaan. Controleer bij elke run minimaal twee bronnen handmatig via de links "Controleer op rechtspraak.nl" of "Zoek op EUR-Lex".

---

## 1. AI-sollicitatieafwijzing zonder menselijke controle

**Knop:** *Sollicitatie-AI*

> In maart 2026 solliciteerde ik bij een grote Nederlandse logistieke werkgever naar een functie als planner. De werkgever gebruikt een AI-systeem van een externe leverancier dat cv's en een opgenomen video-interview automatisch analyseert en een score geeft. Binnen tien minuten na het insturen kreeg ik een automatische afwijzing. [...] Ik ben 58 jaar en heb een licht accent [...]

**Verwacht:**
- Status `ok`, score ongeveer **55 tot 80**.
- Factoren: volledig geautomatiseerd besluit zonder menselijke tussenkomst, geen uitleg, mogelijke leeftijds- of afkomstdiscriminatie, bewijslast.
- Wetgeving: AVG art. 22 (geautomatiseerde besluitvorming), AI-verordening (werving en selectie staat in bijlage III als hoog risico; let op de toepassingsdatum), gelijkebehandelingswetgeving (WGBL, AWGB).
- Rechtspraak: waarschijnlijk HvJEU-uitspraak(en) over geautomatiseerde besluitvorming en scoring (bijvoorbeeld de SCHUFA-zaak), eventueel oordelen van het College voor de Rechten van de Mens.
- Partijen: werkgever (gebruiksverantwoordelijke) waarschijnlijk; leverancier (aanbieder) mogelijk.

## 2. Overheidsalgoritme voor fraudedetectie

**Knop:** *Fraude-algoritme gemeente*

> Een Nederlandse gemeente gebruikt sinds 2023 een risicoscoremodel om bijstandsuitkeringen op fraude te controleren [...] woonwijk, gezinssamenstelling, taalvaardigheid [...] drie maanden geen uitkering [...]

**Verwacht:**
- Status `ok`, score ongeveer **70 tot 90**.
- Factoren: gebruik van mogelijk discriminerende kenmerken, geen transparantie, stopzetting zonder deugdelijke grondslag, concrete financiele schade.
- Rechtspraak: de SyRI-uitspraak van de Rechtbank Den Haag (2020; controleer of het ECLI klopt), en waarschijnlijk verwijzingen naar de toeslagenaffaire.
- Wetgeving: art. 8 EVRM, AVG, Awb (zorgvuldigheids- en motiveringsbeginsel), onrechtmatige overheidsdaad (art. 6:162 BW); AI-verordening (toegang tot essentiele overheidsdiensten).
- Partijen: gemeente (bestuursorgaan) waarschijnlijk; adviesbureau mogelijk tot onwaarschijnlijk.

## 3. Zelfrijdende auto na een software-update

**Knop:** *Zelfrijdende auto na update*

> Een automobilist rijdt op de snelweg in een personenauto met een geavanceerd rijhulpsysteem [...] Twee dagen na een automatische software-update [...] remt de auto bij 110 km/u plotseling hard voor een schaduw [...] augustus 2026 in Nederland.

**Verwacht:**
- Status `ok`, score ongeveer **55 tot 80** (de gewonde achterligger heeft vrijwel zeker ergens een grondslag; de vraag is vooral bij wie).
- Factoren: productgebrek door een update, meerdere vergelijkbare meldingen, rol van de bestuurder (toezichtplicht bij een rijhulpsysteem), het vermoeden dat de achterligger te dicht achter de voorligger reed.
- Wetgeving: productaansprakelijkheid art. 6:185 e.v. BW; de herziene Productaansprakelijkheidsrichtlijn (EU) 2024/2853 (software en updates). Het model moet opmerken dat die richtlijn in augustus 2026 nog niet van toepassing was. Verder WAM en de aansprakelijkheid van de bestuurder of verzekeraar.
- Partijen: fabrikant mogelijk tot waarschijnlijk; bestuurder van de voorste auto mogelijk; achterligger (eigen schuld) mogelijk.

---

## Randgevallen

| Invoer | Verwachte toestand |
|---|---|
| `ik ben niks aan het doen` | Status `geen_casus`: grijze wijzer, melding "Dit lijkt geen casus", suggesties wat je kunt beschrijven. Er wordt niet gezocht. |
| `ik heb 10 croissantjes gestolen bij de appie en ze hebben me gepakt` | Status `ok`, in beide modi: de dader is aansprakelijk; de winkel mag de schade plus redelijke kosten vragen (vaste vergoeding €242 sinds 14 september 2026), en diefstal is daarnaast strafbaar. |
| `een algoritme deed iets fout` | Status `te_vaag`, of `ok` met een voorzichtige score en veel vervolgvragen. |
| Leeg veld | De browser toont direct "Beschrijf eerst wat er is gebeurd". Er wordt geen verzoek verstuurd. |
| Geen of een ongeldige API-sleutel in `.env` | Foutkaart "API-sleutel ontbreekt" of "API-sleutel geweigerd", zonder knop "Opnieuw proberen". |
| Server gestopt tijdens een analyse | Foutkaart "Verbinding onderbroken" of "Server niet bereikbaar". De casus blijft in het invoerveld staan. |
| Tijdens een analyse op *Annuleren* klikken | De wijzer gaat terug naar grijs met "Analyse geannuleerd". De serverlog toont dat het verzoek is afgebroken. |
| Internet uit op de server | Foutkaart "Geen verbinding met Claude". |
