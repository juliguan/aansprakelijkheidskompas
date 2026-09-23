// Demo mode: a rule-based analysis against a small, curated set of real
// sources. No API calls, no costs. Produces the same result shape as the live
// analysis so the frontend renders both identically.

import { BRONNEN } from './dataset.js';
import { THEMAS, SIGNALEN, CASUS_AANWIJZINGEN, AI_AANWIJZINGEN } from './regels.js';
import { controleLink, kwalificatieVoorScore } from '../bronnen.js';
import { bevatParmis, analyseerParmis } from '../easteregg.js';

const MAX_BRONNEN = 8;
const BASIS_ZONDER_THEMA = 30;

function normaliseer(tekst) {
  return tekst.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const wacht = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('afgebroken'));
    }, { once: true });
  });

export async function analyseerDemo(casus, { signal, meld }) {
  if (bevatParmis(casus)) return analyseerParmis(casus, { signal, meld, modus: 'demo' });
  const start = Date.now();
  const tekst = normaliseer(casus);
  const woorden = tekst.split(/\s+/).filter(Boolean).length;

  const themas = THEMAS.filter((t) => t.patroon.test(tekst)).sort((a, b) => b.basis - a.basis);
  const gevondenSignalen = SIGNALEN.filter((s) => s.patroon.test(tekst));
  const signalen = gevondenSignalen.filter((s) => !s.uitsluiten || !gevondenSignalen.some((g) => g.id === s.uitsluiten));

  // Short, staged progress so the demo feels like the live flow.
  await wacht(300, signal);
  for (const thema of themas.slice(0, 3)) {
    meld({ type: 'zoek', query: `demodataset: ${thema.label}` });
    await wacht(450, signal);
    const aantal = BRONNEN.filter((b) => b.themas.includes(thema.id)).length;
    meld({ type: 'gevonden', aantal, domeinen: ['gecontroleerde demodataset'] });
    await wacht(250, signal);
  }
  meld({ type: 'fase', fase: 'schrijven' });
  await wacht(400, signal);

  const meta = { model: 'demo (vaste regels, geen AI)', zoekopdrachten: 0, duur_ms: Date.now() - start, datum: vandaag() };

  if (themas.length === 0) {
    const lijktCasus = CASUS_AANWIJZINGEN.test(tekst);
    if (!lijktCasus) return geenOordeel('geen_casus', GEEN_CASUS_TEKST, meta);
    if (woorden < 40) return geenOordeel('te_vaag', TE_VAAG_TEKST, meta);
  }

  const score = berekenScore(themas, signalen);
  const bronnen = kiesBronnen(themas, signalen, tekst);

  return {
    modus: 'demo',
    status: 'ok',
    score,
    kwalificatie: kwalificatieVoorScore(score),
    samenvatting: maakSamenvatting(themas),
    onderbouwing: maakOnderbouwing(themas, signalen),
    toelichting_status: '',
    factoren: signalen.map(({ factor, richting, toelichting }) => ({ factor, richting, toelichting })),
    partijen: maakPartijen(themas, score),
    bronnen,
    onzekerheden: [
      ...themas.flatMap((t) => t.onzekerheden),
      'De demomodus kijkt alleen naar trefwoorden; nuances in je beschrijving kunnen gemist worden.',
    ],
    vervolgvragen: maakVervolgvragen(tekst),
    controle: { totaal: bronnen.length, teruggevonden: bronnen.length, niet_teruggevonden: 0 },
    meta,
  };
}

function berekenScore(themas, signalen) {
  const basis = themas.length ? themas[0].basis : BASIS_ZONDER_THEMA;
  // A second matching theme adds a little: more legal hooks, more routes to liability.
  const extraThema = themas.length > 1 ? 3 : 0;
  const som = signalen.reduce((acc, s) => acc + s.gewicht, 0);
  return Math.min(92, Math.max(5, basis + extraThema + som));
}

function kiesBronnen(themas, signalen, tekst) {
  const sleutels = [
    ...themas.map((t) => t.id),
    ...(signalen.some((s) => s.id === 'discriminatie') ? ['discriminatie'] : []),
    ...(signalen.some((s) => s.id === 'geen-uitleg' || s.id === 'geen-mens') ? ['transparantie'] : []),
    ...(signalen.some((s) => s.id === 'update') ? ['software'] : []),
    ...(AI_AANWIJZINGEN.test(tekst) ? ['algemeen-ai'] : []),
  ];

  // Rank by how early the matching key appears (primary theme first), then case law before legislation.
  const gescoord = BRONNEN.map((bron) => {
    const posities = bron.themas.map((t) => sleutels.indexOf(t)).filter((i) => i >= 0);
    return { bron, rang: posities.length ? Math.min(...posities) : Infinity };
  })
    .filter((x) => x.rang !== Infinity)
    .sort((a, b) => a.rang - b.rang || (a.bron.soort === 'uitspraak' ? -1 : 1) - (b.bron.soort === 'uitspraak' ? -1 : 1));

  const gekozen = gescoord.slice(0, MAX_BRONNEN - 1).map((x) => x.bron);
  // Always include the general basis for civil liability.
  const algemeen = BRONNEN.find((b) => b.id === 'bw-6-162');
  if (!gekozen.includes(algemeen)) gekozen.push(algemeen);

  return gekozen.map((b) => ({
    soort: b.soort,
    titel: b.titel,
    kenmerk: b.kenmerk,
    instantie: b.instantie,
    jaar: b.jaar,
    url: b.url,
    relevantie: b.kern,
    teruggevonden: true,
    herkomst: 'dataset',
    ecli_formaat_ongeldig: false,
    controle: controleLink(b),
  }));
}

function maakSamenvatting(themas) {
  if (!themas.length) {
    return 'De casus past niet in een van de AI-thema\'s die de demomodus kent. De inschatting rust daarom alleen op de algemene regels voor onrechtmatige daad (art. 6:162 BW).';
  }
  return themas[0].samenvatting;
}

function maakOnderbouwing(themas, signalen) {
  const delen = [];
  if (themas.length) {
    const labels = themas.map((t) => t.label);
    delen.push(`De demomodus herkent in deze casus de volgende thema's: ${labels.join(', ')}.`);
    for (const t of themas.slice(0, 3)) delen.push(t.uitleg);
  } else {
    delen.push('Er is geen specifiek AI-thema herkend. Algemeen geldt dat wie onrechtmatig handelt en daardoor schade veroorzaakt, die schade moet vergoeden (art. 6:162 BW): er moet sprake zijn van een onrechtmatige daad, toerekenbaarheid, schade en een causaal verband.');
  }

  const hoger = signalen.filter((s) => s.richting === 'verhogend').map((s) => s.factor.toLowerCase());
  const lager = signalen.filter((s) => s.richting === 'verlagend').map((s) => s.factor.toLowerCase());
  if (hoger.length || lager.length) {
    const zinnen = [];
    if (hoger.length) zinnen.push(`Verhogend werken: ${hoger.join('; ')}.`);
    if (lager.length) zinnen.push(`Verlagend werken: ${lager.join('; ')}.`);
    delen.push(zinnen.join(' '));
  }

  delen.push('Let op: dit is een demo-analyse. De score is berekend met vaste trefwoordregels en een kleine, handmatig gecontroleerde verzameling uitspraken en wetgeving. Er is geen AI gebruikt en er is niet live gezocht. De bronnen bestaan echt, maar of ze op jouw casus van toepassing zijn, is grof ingeschat. Gebruik de live modus voor een analyse op maat.');
  return delen.join('\n\n');
}

function maakPartijen(themas, score) {
  const gezien = new Set();
  const partijen = [];
  for (const t of themas) {
    for (const p of t.partijen) {
      if (gezien.has(p.partij)) continue;
      gezien.add(p.partij);
      const inschatting = p.zwak ? 'onwaarschijnlijk' : p.sterk && score >= 60 ? 'waarschijnlijk' : 'mogelijk';
      partijen.push({ partij: p.partij, rol: p.rol, grondslag: p.grondslag, inschatting, toelichting: '' });
    }
  }
  return partijen;
}

function maakVervolgvragen(tekst) {
  const vragen = [];
  if (!/\b(19|20)\d{2}\b/.test(tekst)) vragen.push('Wanneer gebeurde het? Dat bepaalt welke regels (bijvoorbeeld de AI-verordening of de nieuwe productaansprakelijkheidsregels) van toepassing waren.');
  if (!/\bmens|medewerker|handmatig|recruiter|ambtenaar/.test(tekst)) vragen.push('Keek er een mens mee bij de beslissing, en zo ja: kon die persoon de uitkomst echt veranderen?');
  if (!/schade|kosten|inkomen|letsel|gewond|schuld|verlies/.test(tekst)) vragen.push('Welke schade is er precies ontstaan (financieel, letsel, of immaterieel zoals stress of reputatieschade)?');
  if (!/leverancier|fabrikant|ontwikkel|aanbieder|bedrijf|gemeente|werkgever/.test(tekst)) vragen.push('Wie heeft het systeem gemaakt en wie gebruikte het?');
  return vragen;
}

const GEEN_CASUS_TEKST =
  'De tekst beschrijft geen situatie waarin iemand schade lijdt of waarin een aansprakelijkheidsvraag speelt, dus er valt niets te beoordelen.';
const TE_VAAG_TEKST =
  'De demomodus herkent geen van zijn AI-thema\'s in deze korte beschrijving. De demo werkt alleen met vaste trefwoorden; beschrijf de situatie uitgebreider, of gebruik de live modus, die ook andere soorten casussen kan beoordelen.';

function geenOordeel(status, toelichting, meta) {
  return {
    modus: 'demo',
    status,
    score: null,
    kwalificatie: null,
    samenvatting: '',
    onderbouwing: '',
    toelichting_status: toelichting,
    factoren: [],
    partijen: [],
    bronnen: [],
    onzekerheden: [],
    vervolgvragen: [
      'Wat is er gebeurd, en wie was erbij betrokken?',
      'Welk systeem, algoritme of welke software speelde een rol?',
      'Welke schade is er ontstaan?',
      'Wanneer gebeurde het?',
    ],
    controle: { totaal: 0, teruggevonden: 0, niet_teruggevonden: 0 },
    meta,
  };
}

function vandaag() {
  return new Date().toISOString().slice(0, 10);
}
