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

// Collects everything the web search actually returned, across all turns.
export class Zoekbewijs {
  constructor() {
    this.urls = new Set();
    this.fragmenten = [];
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

    return {
      ...bron,
      url,
      teruggevonden: urlGevonden || kenmerkGevonden,
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
