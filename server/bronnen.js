// Server-side checks on the sources the model cites. These do not prove a
// source is correct; they flag whether it actually appeared in the web search
// results of this request, which catches the most common kind of fabrication.

const ECLI_RE = /^ECLI:[A-Z]{2}:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$/;

export function normaliseerUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const pad = decodeURIComponent(u.pathname).replace(/\/+$/, '');
    return `${u.hostname.replace(/^www\./, '')}${pad}${decodeURIComponent(u.search)}`.toLowerCase();
  } catch {
    return null;
  }
}

function veiligeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

// Collects everything the searches actually returned, across all turns:
// web search results plus what came from rechtspraak.nl and wetten.overheid.nl.
export class Zoekbewijs {
  constructor() {
    this.urls = new Set();
    this.fragmenten = [];
    this.officieleUitspraken = new Map(); // ECLI -> 'gevonden' | 'gelezen'
    this.wetsartikelen = []; // { regeling, bwb_id, artikel, url, aliassen }
  }

  voegOfficieleUitspraakToe(ecli, niveau) {
    const k = String(ecli).toUpperCase();
    if (this.officieleUitspraken.get(k) !== 'gelezen') this.officieleUitspraken.set(k, niveau);
    this.fragmenten.push(k);
  }

  voegWetsartikelToe(artikel) {
    this.wetsartikelen.push(artikel);
    const genormaliseerd = normaliseerUrl(artikel.url);
    if (genormaliseerd) this.urls.add(genormaliseerd);
  }

  // Did the model cite an article that was actually retrieved? Matches on the
  // exact URL, or on the article number plus the name of the regulation.
  wetsartikelOpgehaald(bron, url) {
    const genormaliseerd = url && normaliseerUrl(url);
    const kenmerk = `${bron.kenmerk ?? ''} ${bron.titel ?? ''} ${bron.instantie ?? ''}`.toLowerCase();
    return this.wetsartikelen.some((a) => {
      if (genormaliseerd && normaliseerUrl(a.url) === genormaliseerd) return true;
      const boek = a.regeling.match(/^Burgerlijk Wetboek Boek (\d)$/)?.[1];
      const nr = a.artikel.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (boek) return new RegExp(`\\b${boek}\\s*:\\s*${nr}\\b`).test(kenmerk) && /\bbw\b|burgerlijk wetboek/.test(kenmerk);
      const naamGenoemd = [a.regeling.toLowerCase(), ...(a.aliassen ?? [])].some((n) =>
        new RegExp(`(^|[^a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(kenmerk),
      );
      return naamGenoemd && new RegExp(`(^|[^\\d:])${nr}(?![\\d:])`).test(kenmerk);
    });
  }

  voegResultaatToe({ url, title }) {
    const genormaliseerd = url && normaliseerUrl(url);
    if (genormaliseerd) this.urls.add(genormaliseerd);
    this.fragmenten.push(title ?? '', url ? safeDecode(url) : '');
  }

  voegCitaatToe({ url, title, cited_text }) {
    this.voegResultaatToe({ url, title });
    if (cited_text) this.fragmenten.push(cited_text);
  }

  // One uppercase string without whitespace, for identifier lookups.
  get hooiberg() {
    return this.fragmenten.join('\n').toUpperCase().replace(/\s+/g, '');
  }
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Identifiers we can look for in the search evidence: a full ECLI, EU case
// numbers (C-634/21) and act numbers (2024/2853, 85/374).
function sleutelsVoorKenmerk(kenmerk) {
  if (!kenmerk) return [];
  const k = kenmerk.toUpperCase().replace(/\s+/g, '');
  if (k.startsWith('ECLI:')) return [k];
  const sleutels = [
    ...k.matchAll(/[CT]-\d{1,4}\/\d{2}/g),
    ...k.matchAll(/\b\d{2,4}\/\d{1,5}\b/g),
  ].map((m) => m[0]);
  return [...new Set(sleutels)];
}

export function controleLink(bron) {
  const k = bron.kenmerk?.toUpperCase().replace(/\s+/g, '');
  if (k?.startsWith('ECLI:NL:')) {
    return { label: 'Controleer op rechtspraak.nl', url: `https://deeplink.rechtspraak.nl/uitspraak?id=${encodeURIComponent(k)}` };
  }
  if (k?.startsWith('ECLI:EU:')) {
    return { label: 'Controleer op EUR-Lex', url: `https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=ecli:${encodeURIComponent(k)}` };
  }
  if (bron.kenmerk && /(EU|EEG|EG)|[CT]-\d+\/\d{2}|\d{2,4}\/\d{1,5}/i.test(bron.kenmerk)) {
    return {
      label: 'Zoek op EUR-Lex',
      url: `https://eur-lex.europa.eu/search.html?scope=EURLEX&type=quick&lang=nl&text=${encodeURIComponent(bron.kenmerk)}`,
    };
  }
  return null;
}

export function verrijkBronnen(bronnen, bewijs) {
  const hooiberg = bewijs.hooiberg;
  return bronnen.map((bron) => {
    const url = veiligeUrl(bron.url);
    const urlGevonden = url ? bewijs.urls.has(normaliseerUrl(url)) : false;
    const sleutels = sleutelsVoorKenmerk(bron.kenmerk);
    const kenmerkGevonden = sleutels.length > 0 && sleutels.some((s) => hooiberg.includes(s));
    const isEcli = bron.kenmerk?.toUpperCase().startsWith('ECLI');
    const ecli = isEcli ? bron.kenmerk.toUpperCase().replace(/\s+/g, '') : null;

    // Strongest evidence first: read in full > found on rechtspraak.nl > law
    // text retrieved > merely present in web search results.
    let verificatie = null;
    if (ecli && bewijs.officieleUitspraken.has(ecli)) verificatie = bewijs.officieleUitspraken.get(ecli);
    else if (bron.soort === 'wetgeving' && bewijs.wetsartikelOpgehaald(bron, url)) verificatie = 'wettekst';
    else if (urlGevonden || kenmerkGevonden) verificatie = 'zoekresultaat';

    return {
      ...bron,
      url,
      teruggevonden: verificatie !== null,
      verificatie,
      ecli_formaat_ongeldig: isEcli ? !ECLI_RE.test(bron.kenmerk.toUpperCase().replace(/\s+/g, '')) : false,
      controle: controleLink(bron),
    };
  });
}

export function kwalificatieVoorScore(score) {
  if (score === null || score === undefined) return null;
  if (score <= 20) return 'Geen of zeer zwakke aansprakelijkheidsbasis';
  if (score <= 40) return 'Zwakke aanwijzing voor aansprakelijkheid';
  if (score <= 60) return 'Gemengd beeld: uitkomst onzeker';
  if (score <= 80) return 'Duidelijke aanwijzing voor aansprakelijkheid';
  return 'Sterke aanwijzing voor aansprakelijkheid';
}
