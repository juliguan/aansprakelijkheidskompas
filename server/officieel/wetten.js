// Current Dutch legislation via wetten.overheid.nl (Basiswettenbestand).
// The latest consolidated XML of a regulation is found through its manifest,
// then the requested article is cut out of it.

import { BronFout } from './rechtspraak.js';
import { naarTekst, kortIn } from './tekst.js';

const REPO = 'https://repository.officiele-overheidspublicaties.nl/bwb';
const SRU = 'https://zoekservice.overheid.nl/sru/Search';
const CACHE_MS = 12 * 60 * 60 * 1000;

// Verified identifiers (checked against the SRU service). Keys are lowercase aliases.
const REGELINGEN = [
  { id: 'BWBR0002656', titel: 'Burgerlijk Wetboek Boek 1', aliassen: ['bw1', 'bw 1', 'burgerlijk wetboek boek 1'] },
  { id: 'BWBR0003045', titel: 'Burgerlijk Wetboek Boek 2', aliassen: ['bw2', 'bw 2', 'burgerlijk wetboek boek 2'] },
  { id: 'BWBR0005291', titel: 'Burgerlijk Wetboek Boek 3', aliassen: ['bw3', 'bw 3', 'burgerlijk wetboek boek 3'] },
  { id: 'BWBR0002761', titel: 'Burgerlijk Wetboek Boek 4', aliassen: ['bw4', 'bw 4', 'burgerlijk wetboek boek 4'] },
  { id: 'BWBR0005288', titel: 'Burgerlijk Wetboek Boek 5', aliassen: ['bw5', 'bw 5', 'burgerlijk wetboek boek 5'] },
  { id: 'BWBR0005289', titel: 'Burgerlijk Wetboek Boek 6', aliassen: ['bw6', 'bw 6', 'burgerlijk wetboek boek 6'] },
  { id: 'BWBR0005290', titel: 'Burgerlijk Wetboek Boek 7', aliassen: ['bw7', 'bw 7', 'burgerlijk wetboek boek 7'] },
  { id: 'BWBR0001854', titel: 'Wetboek van Strafrecht', aliassen: ['sr', 'wvsr', 'wetboek van strafrecht'] },
  { id: 'BWBR0001903', titel: 'Wetboek van Strafvordering', aliassen: ['sv', 'wvsv', 'wetboek van strafvordering'] },
  { id: 'BWBR0001827', titel: 'Wetboek van Burgerlijke Rechtsvordering', aliassen: ['rv', 'wetboek van burgerlijke rechtsvordering'] },
  { id: 'BWBR0005537', titel: 'Algemene wet bestuursrecht', aliassen: ['awb', 'algemene wet bestuursrecht'] },
  { id: 'BWBR0001840', titel: 'Grondwet', aliassen: ['gw', 'grondwet'] },
  { id: 'BWBR0006622', titel: 'Wegenverkeerswet 1994', aliassen: ['wvw', 'wvw 1994', 'wegenverkeerswet', 'wegenverkeerswet 1994'] },
  { id: 'BWBR0002415', titel: 'Wet aansprakelijkheidsverzekering motorrijtuigen', aliassen: ['wam', 'wet aansprakelijkheidsverzekering motorrijtuigen'] },
  { id: 'BWBR0006502', titel: 'Algemene wet gelijke behandeling', aliassen: ['awgb', 'algemene wet gelijke behandeling'] },
  { id: 'BWBR0016185', titel: 'Wet gelijke behandeling op grond van leeftijd bij de arbeid', aliassen: ['wgbl', 'wet gelijke behandeling op grond van leeftijd bij de arbeid'] },
  { id: 'BWBR0014915', titel: 'Wet gelijke behandeling op grond van handicap of chronische ziekte', aliassen: ['wgbh/cz', 'wgbhcz', 'wet gelijke behandeling op grond van handicap of chronische ziekte'] },
  { id: 'BWBR0040940', titel: 'Uitvoeringswet Algemene verordening gegevensbescherming', aliassen: ['uavg', 'uitvoeringswet avg', 'uitvoeringswet algemene verordening gegevensbescherming'] },
  { id: 'BWBR0015703', titel: 'Participatiewet', aliassen: ['participatiewet', 'pw', 'wet werk en bijstand', 'wwb'] },
  { id: 'BWBR0010346', titel: 'Arbeidsomstandighedenwet', aliassen: ['arbowet', 'arbeidsomstandighedenwet'] },
  { id: 'BWBR0002979', titel: 'Wet schadefonds geweldsmisdrijven', aliassen: ['wet schadefonds geweldsmisdrijven'] },
];

const OP_ALIAS = new Map(REGELINGEN.flatMap((r) => r.aliassen.map((a) => [a, r])));

export function aliassenVoor(id) {
  return REGELINGEN.find((r) => r.id === id)?.aliassen ?? [];
}
const cache = new Map(); // id -> { tijd, xml, versie, titel }

async function zoekRegelingOpTitel(naam, signal) {
  const query = `overheidbwb.titel all "${naam.replace(/"/g, '')}"`;
  const res = await fetch(`${SRU}?x-connection=BWB&operation=searchRetrieve&version=1.2&maximumRecords=5&query=${encodeURIComponent(query)}`, { signal });
  const xml = await res.text();
  const treffers = [...xml.matchAll(/<dcterms:identifier>(BWB[RV]\d+)<\/dcterms:identifier>\s*<dcterms:title>([^<]+)</g)].map((m) => ({ id: m[1], titel: m[2] }));
  // Prefer an exact title match, otherwise the first hit.
  return treffers.find((t) => t.titel.toLowerCase() === naam.toLowerCase()) ?? treffers[0] ?? null;
}

/**
 * Resolves a regulation name and article number. Handles the BW convention
 * "6:162" (book 6, article 162); for the Awb "3:2" is itself the article number.
 */
async function bepaalRegeling(regeling, artikel, signal) {
  const naam = String(regeling ?? '').trim();
  let nr = String(artikel ?? '').trim().replace(/^(art\.?|artikel)\s*/i, '');
  const sleutel = naam.toLowerCase().replace(/\s+/g, ' ');

  if (/^bwb[rv]\d+$/i.test(naam)) return { regeling: { id: naam.toUpperCase(), titel: null }, nr };

  // "BW" without a book: take the book from the article number.
  if (sleutel === 'bw' || sleutel === 'burgerlijk wetboek') {
    const m = nr.match(/^(\d+)\s*:\s*(.+)$/);
    if (!m) throw new BronFout('Geef bij het Burgerlijk Wetboek het boek op, bijvoorbeeld artikel "6:162".');
    const r = OP_ALIAS.get(`bw${m[1]}`);
    if (!r) throw new BronFout(`Boek ${m[1]} van het Burgerlijk Wetboek wordt niet ondersteund.`);
    return { regeling: r, nr: m[2].trim() };
  }

  let r = OP_ALIAS.get(sleutel);
  if (r && /^burgerlijk wetboek boek \d$/.test(r.titel.toLowerCase())) {
    const boek = r.titel.slice(-1);
    nr = nr.replace(new RegExp(`^${boek}\\s*:\\s*`), '');
  }
  if (!r) {
    const gevonden = await zoekRegelingOpTitel(naam, signal);
    if (!gevonden) throw new BronFout(`Geen regeling gevonden met de naam "${naam}".`);
    r = gevonden;
  }
  return { regeling: r, nr };
}

async function laadRegeling(id, signal) {
  const bewaard = cache.get(id);
  if (bewaard && Date.now() - bewaard.tijd < CACHE_MS) return bewaard;

  const manifestRes = await fetch(`${REPO}/${id}/manifest.xml`, { signal });
  if (!manifestRes.ok) throw new BronFout(`Regeling ${id} niet gevonden op wetten.overheid.nl.`);
  const manifest = await manifestRes.text();
  const laatste = manifest.match(/_latestItem="([^"]+)"/)?.[1];
  if (!laatste) throw new BronFout(`Geen actuele versie gevonden van ${id}.`);

  const xmlRes = await fetch(`${REPO}/${id}/${laatste}`, { signal });
  if (!xmlRes.ok) throw new BronFout(`De tekst van ${id} kon niet worden opgehaald.`);
  const xml = await xmlRes.text();
  const versie = laatste.split('/')[0]; // e.g. "2026-07-16_0"
  const titel = naarTekst(xml.match(/<citeertitel[^>]*>([\s\S]*?)<\/citeertitel>/)?.[1] ?? '') || null;

  const item = { tijd: Date.now(), xml, versie, titel };
  cache.set(id, item);
  return item;
}

/** Returns the current text of one article. */
export async function haalWetsartikel({ regeling, artikel }, { signal } = {}) {
  if (!regeling || !artikel) throw new BronFout('Geef zowel de regeling als het artikelnummer op.');
  const { regeling: r, nr } = await bepaalRegeling(regeling, artikel, signal);
  const { xml, versie, titel } = await laadRegeling(r.id, signal);

  const doel = nr.toLowerCase().replace(/\s+/g, '');
  const artikelen = [...xml.matchAll(/<artikel\b([^>]*)>([\s\S]*?)<\/artikel>/g)];
  const passend = artikelen.filter((a) => {
    const kopNr = a[2].match(/<kop>[\s\S]*?<nr[^>]*>([\s\S]*?)<\/nr>/)?.[1];
    return kopNr && naarTekst(kopNr).toLowerCase().replace(/\s+/g, '') === doel;
  });
  const gekozen = passend.find((a) => !/status="vervallen"/.test(a[1])) ?? passend[0];
  if (!gekozen) throw new BronFout(`Artikel ${nr} niet gevonden in ${r.titel ?? titel ?? r.id}.`);

  const pad = gekozen[1].match(/bwb-ng-variabel-deel="([^"]+)"/)?.[1] ?? '';
  const [datum, volgnr] = versie.split('_');
  const regelingTitel = r.titel ?? titel ?? r.id;

  return {
    regeling: regelingTitel,
    bwb_id: r.id,
    artikel: nr,
    vervallen: /status="vervallen"/.test(gekozen[1]),
    geldende_versie_vanaf: datum,
    tekst: kortIn(naarTekst(gekozen[2]).replace(/^Artikel\s+\S+\s*/, ''), 5000),
    url: `https://wetten.overheid.nl/${r.id}/${datum}/${volgnr ?? '0'}${pad}`,
  };
}
