// Keyword rules for demo mode. Patterns run against lowercased text with
// accents stripped, so write them without diacritics.

export const THEMAS = [
  {
    id: 'werk',
    label: 'werving, selectie en werk',
    patroon: /sollicit|vacature|werving|recruit|\bcv\b|cv's|kandida|werkgever|werknemer|\bbaan\b|ontslag|personeel|video-?interview|assessment/,
    basis: 45,
    samenvatting: 'Bij een geautomatiseerde beslissing over werk of sollicitaties spelen vooral de AVG (geautomatiseerde besluitvorming), gelijkebehandelingswetgeving en, voor nieuwe systemen, de AI-verordening een rol.',
    uitleg: 'Werving en selectie met AI geldt onder de AI-verordening als hoog-risicotoepassing (bijlage III). Los daarvan verbiedt art. 22 AVG besluiten die uitsluitend geautomatiseerd tot stand komen en iemand aanmerkelijk treffen, en verbieden de AWGB en de WGBL onderscheid naar onder meer afkomst en leeftijd, ook als dat indirect via een algoritme gebeurt. Het HvJ EU oordeelde in de SCHUFA-zaak dat ook het maken van een doorslaggevende score onder art. 22 AVG kan vallen.',
    partijen: [
      { partij: 'Werkgever', rol: 'gebruiksverantwoordelijke', grondslag: 'art. 22 AVG; AWGB en WGBL; art. 6:162 BW', sterk: true },
      { partij: 'Leverancier van het AI-systeem', rol: 'aanbieder', grondslag: 'AI-verordening (aanbiedersplichten); art. 6:162 BW', sterk: false },
    ],
    onzekerheden: [
      'Of er echt geen mens bij de beslissing betrokken was, of alleen formeel.',
      'Of het onderscheid naar leeftijd of afkomst aantoonbaar is; bij een vermoeden verschuift de bewijslast wel naar de werkgever.',
    ],
  },
  {
    id: 'overheid',
    label: 'overheid en publieke besluiten',
    patroon: /gemeente|overheid|belastingdienst|toeslag|uitkering|bijstand|\buwv\b|\bduo\b|\bsvb\b|ministerie|bestuursorgaan|politie|provincie|waterschap|\bind\b|huisbezoek/,
    basis: 55,
    samenvatting: 'Een overheid die algoritmen inzet voor besluiten over burgers moet voldoen aan strenge eisen van zorgvuldigheid, transparantie en non-discriminatie; de rechter heeft dat meermaals gehandhaafd.',
    uitleg: 'Een bestuursorgaan moet besluiten zorgvuldig voorbereiden en deugdelijk motiveren (Awb), en bij een geautomatiseerd model de keuzes en gegevens inzichtelijk maken (Raad van State, AERIUS). In de SyRI-zaak oordeelde de rechtbank Den Haag dat een ondoorzichtig fraudesysteem in strijd was met art. 8 EVRM, en de toeslagenaffaire liet zien hoe harde terugvorderingen onevenredig kunnen uitpakken. Een onrechtmatig besluit kan leiden tot aansprakelijkheid voor onrechtmatige overheidsdaad. Maar niet elk algoritme is onrechtmatig: bij een voorselectie met menselijke beoordeling en zonder discriminerende criteria kan het gebruik rechtmatig zijn (OB Negatief, 2026).',
    partijen: [
      { partij: 'Overheidsorgaan', rol: 'bestuursorgaan / gebruiksverantwoordelijke', grondslag: 'onrechtmatige overheidsdaad (art. 6:162 BW); Awb; art. 8 en 14 EVRM; AVG', sterk: true },
      { partij: 'Ontwikkelaar of adviesbureau', rol: 'ontwikkelaar in opdracht', grondslag: 'contractuele verhouding met de overheid; zelden rechtstreeks tegenover de burger', sterk: false, zwak: true },
    ],
    onzekerheden: [
      'Of er een wettelijke grondslag was voor het gebruik van het model en de gebruikte gegevens.',
      'Of een mens de uitkomst van het model werkelijk beoordeelde voordat er gevolgen aan werden verbonden.',
    ],
  },
  {
    id: 'voertuig',
    label: 'voertuigen en rijhulpsystemen',
    patroon: /\bauto\b|auto's|personenauto|voertuig|rijhulp|rijsysteem|zelfrijd|autonoom|autopilot|tesla|snelweg|aanrijding|botsing|remt\b|remde|remming|achterligger|bestuurder/,
    basis: 50,
    samenvatting: 'Bij een ongeluk met een (deels) zelfrijdende auto is er bijna altijd een aansprakelijke partij voor de benadeelde, maar de verdeling tussen bestuurder, verzekeraar en fabrikant is lastig.',
    uitleg: 'De persoon achter het stuur blijft volgens de rechtspraak de bestuurder, ook met Autopilot aan (Rechtbank Midden-Nederland, 2018), en elke auto is verplicht verzekerd (WAM), zodat de benadeelde de verzekeraar kan aanspreken. Art. 185 WVW beschermt voetgangers en fietsers, maar geldt niet tussen twee motorrijtuigen; dan beslist art. 6:162 BW. Ligt de oorzaak in de software, dan kan de fabrikant via productaansprakelijkheid (art. 6:185 e.v. BW) worden aangesproken, bijvoorbeeld door de verzekeraar in regres.',
    partijen: [
      { partij: 'Bestuurder en diens WAM-verzekeraar', rol: 'bestuurder', grondslag: 'art. 6:162 BW; WAM (directe actie tegen verzekeraar)', sterk: true },
      { partij: 'Fabrikant van de auto of software', rol: 'producent', grondslag: 'productaansprakelijkheid (art. 6:185 e.v. BW)', sterk: false },
    ],
    onzekerheden: [
      'Of de bestuurder redelijkerwijs had kunnen en moeten ingrijpen.',
      'Of het gebrek in de software aantoonbaar is (bijvoorbeeld uit de gegevens van de auto of meldingen van andere rijders).',
      'Of de achterligger voldoende afstand hield (eigen schuld).',
    ],
  },
  {
    id: 'product',
    label: 'producten, software en updates',
    patroon: /update|software|firmware|\bproduct|fabrikant|apparaat|defect|gebrek|storing|\bbug\b|slimme? (thermostaat|camera|deurbel|speaker)/,
    basis: 45,
    samenvatting: 'Schade door een gebrekkig product valt onder de risicoaansprakelijkheid van de producent; of losse software een product is, wordt pas met de herziene richtlijn duidelijk geregeld.',
    uitleg: 'De producent is zonder schuld aansprakelijk voor schade door een gebrek in zijn product (art. 6:185 e.v. BW). Het HvJ EU verlichtte de bewijspositie van benadeelden: een gebrek mag worden aangenomen op basis van ernstige en overeenstemmende aanwijzingen (Sanofi Pasteur) of als het in dezelfde productieserie is vastgesteld (Boston Scientific). De herziene Productaansprakelijkheidsrichtlijn (EU) 2024/2853 noemt software en updates uitdrukkelijk, maar geldt pas voor producten die na 9 december 2026 in de handel komen.',
    partijen: [
      { partij: 'Producent van het product of de software', rol: 'producent', grondslag: 'art. 6:185 e.v. BW; Richtlijn 85/374/EEG', sterk: false },
    ],
    onzekerheden: [
      'Of de software onder de huidige productaansprakelijkheidsregels als "product" geldt.',
      'Wanneer het product in de handel is gebracht: dat bepaalt welke richtlijn van toepassing is.',
    ],
  },
  {
    id: 'scoring',
    label: 'kredietscores, verzekeringen en profielen',
    patroon: /krediet|lening|hypotheek|kredietwaardig|verzeker|premie|\bbkr\b|incasso|telefoonabonnement|creditscore|risicoscore|scoremodel/,
    basis: 45,
    samenvatting: 'Wie door een automatisch berekende score wordt afgewezen, heeft volgens het HvJ EU sterke rechten op uitleg en bescherming tegen uitsluitend geautomatiseerde besluiten.',
    uitleg: 'Volgens het HvJ EU kan al het maken van een doorslaggevende score een geautomatiseerd besluit zijn in de zin van art. 22 AVG (SCHUFA, 2023), en moet de betrokkene een begrijpelijke uitleg krijgen over hoe de score tot stand kwam (Dun & Bradstreet Austria, 2025). Kredietbeoordeling is bovendien een hoog-risicotoepassing onder de AI-verordening. Schade door een schending van de AVG kan op grond van art. 82 AVG worden vergoed.',
    partijen: [
      { partij: 'Bedrijf dat de score gebruikte voor de beslissing', rol: 'verwerkingsverantwoordelijke / gebruiksverantwoordelijke', grondslag: 'art. 22 en 82 AVG; art. 6:162 BW', sterk: true },
      { partij: 'Bureau dat de score berekende', rol: 'verwerkingsverantwoordelijke (scoring)', grondslag: 'art. 15 lid 1 sub h, 22 en 82 AVG', sterk: false },
    ],
    onzekerheden: [
      'Of de score doorslaggevend was voor de beslissing, of maar een van meerdere factoren.',
    ],
  },
  {
    id: 'platformwerk',
    label: 'platformwerk en accountblokkades',
    patroon: /\buber\b|deliveroo|thuisbezorgd|\bola\b|platform|bezorger|ritten|account (is )?(geblokkeerd|gedeactiveerd|verwijderd)|deactiv/,
    basis: 45,
    samenvatting: 'Platformwerkers die door een algoritme worden geblokkeerd of beoordeeld, hebben volgens het Gerechtshof Amsterdam recht op informatie over die geautomatiseerde besluiten.',
    uitleg: 'In zaken tegen Uber en Ola oordeelde het Gerechtshof Amsterdam (2023) over de rechten van chauffeurs op inzage en uitleg bij geautomatiseerde deactivatie, fraudescores en ritverdeling (art. 15 en 22 AVG). Een uitsluitend geautomatiseerde blokkade met ingrijpende gevolgen is in beginsel niet toegestaan zonder passende waarborgen, zoals menselijke tussenkomst.',
    partijen: [
      { partij: 'Platformbedrijf', rol: 'verwerkingsverantwoordelijke / opdrachtgever', grondslag: 'art. 15, 22 en 82 AVG; art. 6:162 BW; eventueel arbeidsrecht', sterk: true },
    ],
    onzekerheden: ['Of de werkende als werknemer of als zelfstandige wordt gezien; dat bepaalt welke extra bescherming geldt.'],
  },
  {
    id: 'gezicht',
    label: 'gezichtsherkenning en biometrie',
    patroon: /gezichtsherkenning|gezichtsdetectie|biometri|proctor|webcam|camera(beelden)?|vingerafdruk/,
    basis: 45,
    samenvatting: 'Gezichtsherkenning die bij bepaalde groepen slechter werkt, kan leiden tot (indirecte) discriminatie; het College voor de Rechten van de Mens nam zo\'n vermoeden al eens aan.',
    uitleg: 'In de Proctorio-zaak aanvaardde het College voor de Rechten van de Mens voor het eerst een vermoeden van algoritmische discriminatie, waardoor de universiteit moest bewijzen dat de software niet discrimineerde (oordelen 2022-146 en 2023-111). Biometrische systemen vallen onder strenge regels van de AVG en deels onder verboden of hoog-risicocategorieen van de AI-verordening.',
    partijen: [
      { partij: 'Organisatie die de software inzet', rol: 'gebruiksverantwoordelijke', grondslag: 'AWGB; AVG; art. 6:162 BW', sterk: true },
      { partij: 'Leverancier van de software', rol: 'aanbieder', grondslag: 'AI-verordening; art. 6:162 BW', sterk: false },
    ],
    onzekerheden: ['Of het verschil in werking van de software voor verschillende groepen aantoonbaar is.'],
  },
  {
    id: 'medisch',
    label: 'zorg en medische AI',
    patroon: /\bzorg\b|zorgverzekeraar|\barts\b|ziekenhuis|diagnose|medisch|patient|behandeling|huisarts/,
    basis: 40,
    samenvatting: 'Bij medische AI ligt de verantwoordelijkheid in de eerste plaats bij de zorgverlener, met daarnaast mogelijk productaansprakelijkheid van de fabrikant.',
    uitleg: 'Een zorgverlener blijft verantwoordelijk voor goede zorg, ook als een AI-systeem adviseert. Is het systeem zelf gebrekkig, dan kan de fabrikant via productaansprakelijkheid worden aangesproken; het HvJ EU verlichtte de bewijslast bij medische producten (Boston Scientific, Sanofi Pasteur).',
    partijen: [
      { partij: 'Zorgaanbieder', rol: 'hulpverlener / gebruiksverantwoordelijke', grondslag: 'goed hulpverlenerschap; art. 6:162 BW', sterk: true },
      { partij: 'Fabrikant van het medische hulpmiddel of de software', rol: 'producent', grondslag: 'art. 6:185 e.v. BW', sterk: false },
    ],
    onzekerheden: ['Of de zorgverlener het advies van het systeem kritisch had moeten beoordelen.'],
  },
  {
    id: 'privacy',
    label: 'privacy en persoonsgegevens',
    patroon: /datalek|persoonsgegevens|privacy|\bavg\b|gegevens (gedeeld|gelekt|verkocht)|zonder toestemming/,
    basis: 40,
    samenvatting: 'Bij een schending van de AVG kan ook immateriele schade worden vergoed, zonder ernstdrempel, maar er moet wel echte schade zijn.',
    uitleg: 'Art. 82 AVG geeft recht op vergoeding van materiele en immateriele schade door een AVG-schending. Het HvJ EU oordeelde dat er geen ernstdrempel geldt, maar dat de enkele schending niet genoeg is (Österreichische Post, 2023).',
    partijen: [
      { partij: 'Verwerkingsverantwoordelijke', rol: 'verwerkingsverantwoordelijke', grondslag: 'art. 82 AVG', sterk: true },
    ],
    onzekerheden: ['Welke concrete schade is ontstaan; zonder schade geen vergoeding.'],
  },
];

// Signals that move the score. Weights are deliberately modest: the demo
// only gives a rough indication.
export const SIGNALEN = [
  {
    id: 'geen-mens',
    factor: 'Geen menselijke controle op de beslissing',
    richting: 'verhogend',
    gewicht: 10,
    patroon: /geen mens|zonder (menselijke|een mens|tussenkomst)|volledig geautomatiseerd|automatisch(e)? (afwijzing|besluit|beslissing|geblokkeerd)|nooit door een (mens|recruiter|medewerker)|niemand (heeft|keek)|algoritme (de beslissing|beslist|besliste)|kijkt (dus )?geen mens/,
    toelichting: 'Een besluit dat uitsluitend geautomatiseerd tot stand komt en iemand aanmerkelijk treft, is in beginsel verboden (art. 22 AVG) en vraagt onder de AI-verordening om menselijk toezicht.',
  },
  {
    id: 'mens-wel',
    factor: 'Er was menselijke beoordeling',
    richting: 'verlagend',
    gewicht: -10,
    patroon: /(een )?(mens|medewerker|recruiter|ambtenaar) (nam|neemt|heeft) (de )?(uiteindelijke )?(beslissing|besluit)|handmatig (gecontroleerd|beoordeeld)|menselijke (controle|beoordeling) (was|vond)/,
    uitsluiten: 'geen-mens',
    toelichting: 'Als een mens de uitkomst werkelijk beoordeelde, is het besluit niet uitsluitend geautomatiseerd en weegt het gebruik van het algoritme minder zwaar.',
  },
  {
    id: 'geen-uitleg',
    factor: 'Geen uitleg of transparantie',
    richting: 'verhogend',
    gewicht: 6,
    patroon: /geen uitleg|niet (uitgelegd|gemotiveerd)|wist (niet|niets)|geen (reden|motivering)|onduidelijk waarom|zwarte doos|black box|alleen te horen|om uitleg gevraagd/,
    toelichting: 'Wie door een algoritmisch besluit wordt geraakt, heeft recht op begrijpelijke informatie over de logica erachter (art. 15 en 22 AVG; Dun & Bradstreet Austria). Een bestuursorgaan moet zijn besluiten bovendien deugdelijk motiveren.',
  },
  {
    id: 'discriminatie',
    factor: 'Aanwijzingen voor discriminatie',
    richting: 'verhogend',
    gewicht: 8,
    patroon: /discrimin|huidskleur|afkomst|accent|\bleeftijd|\b[4-7]\d jaar\b|nationaliteit|etnic|taalvaardigheid|woonwijk|postcode|migratieachtergrond|geslacht|zwanger|handicap/,
    toelichting: 'Kenmerken als leeftijd, afkomst, taal of woonwijk kunnen (indirect) tot verboden onderscheid leiden. Bij een onderbouwd vermoeden moet de gebruiker van het systeem aantonen dat er niet is gediscrimineerd.',
  },
  {
    id: 'schade',
    factor: 'Concrete schade',
    richting: 'verhogend',
    gewicht: 4,
    patroon: /schuld(en)?\b|schade|gewond|letsel|inkomen|misgelopen|stopgezet|ontslagen|afgewezen|kosten|verlies|boete|terugvordering/,
    toelichting: 'Voor aansprakelijkheid moet er schade zijn. Concrete financiele schade of letsel maakt een vordering sterker.',
  },
  {
    id: 'patroon',
    factor: 'Meer gedupeerden of een terugkerend probleem',
    richting: 'verhogend',
    gewicht: 5,
    patroon: /meer (rijders|mensen|gebruikers|klanten|chauffeurs|burgers)|anderen ook|structureel|meldingen|vaker gebeurd|hele groep/,
    toelichting: 'Als meer mensen hetzelfde probleem ervaren, is een systematisch gebrek of een structureel onrechtmatige werkwijze beter aannemelijk te maken.',
  },
  {
    id: 'update',
    factor: 'Probleem na een software-update',
    richting: 'verhogend',
    gewicht: 5,
    patroon: /na (een|de) (automatische )?(software-?)?update|over-the-air|firmware-?update/,
    toelichting: 'Als het probleem begon na een update van de fabrikant, wijst dat eerder op een gebrek in de software dan op een fout van de gebruiker.',
  },
  {
    id: 'eigen-handelen',
    factor: 'Eigen handelen van de benadeelde of gebruiker',
    richting: 'neutraal',
    gewicht: 0,
    patroon: /greep niet in|niet ingegrepen|eigen schuld|te dicht|afgeleid|telefoon|te hard/,
    toelichting: 'Dit kan de aansprakelijkheid tussen partijen verschuiven of de vergoeding verminderen (eigen schuld, art. 6:101 BW), maar neemt de grondslag niet weg.',
  },
  {
    id: 'toestemming',
    factor: 'Voorgelicht of toestemming gegeven',
    richting: 'verlagend',
    gewicht: -5,
    patroon: /toestemming gegeven|akkoord gegaan|voorwaarden (geaccepteerd|geaccordeerd)|was (vooraf )?geinformeerd|wist dat er een algoritme/,
    toelichting: 'Als de betrokkene vooraf goed is geinformeerd of uitdrukkelijk heeft ingestemd, kan dat bepaalde verwerkingen rechtvaardigen.',
  },
  {
    id: 'hersteld',
    factor: 'Schade (deels) hersteld',
    richting: 'verlagend',
    gewicht: -4,
    patroon: /hersteld|terugbetaald|gecompenseerd|vergoed gekregen|alsnog toegekend/,
    toelichting: 'Als de fout al is rechtgezet of vergoed, blijft er minder schade over om te verhalen.',
  },
  {
    id: 'geen-schade',
    factor: 'Geen schade beschreven',
    richting: 'verlagend',
    gewicht: -15,
    patroon: /geen schade|geen nadeel|niets aan de hand|geen gevolgen/,
    toelichting: 'Zonder schade is er geen aansprakelijkheid, ook als er iets misging.',
  },
];

// Words that suggest the text is about an incident at all. Used to tell
// "geen casus" apart from "te vaag".
export const CASUS_AANWIJZINGEN =
  /schade|aansprakelijk|benadeeld|afgewezen|ongeluk|ongeval|letsel|gewond|fout|onterecht|geblokkeerd|ontslagen|stopgezet|boete|discrimin|algoritme|\bai\b|kunstmatige|systeem|stelen|diefstal|gestolen|kapot|vernield|oplichting|klacht|rechter|claim/;

export const AI_AANWIJZINGEN = /algoritme|\bai\b|kunstmatige intelligentie|model|software|systeem|automatisch|geautomatiseerd|score|app\b|chatbot|autopilot|rijhulp|zelfrijd/;
