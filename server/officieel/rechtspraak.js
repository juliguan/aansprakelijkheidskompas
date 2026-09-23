// Access to Dutch case law via rechtspraak.nl.
//  - Search: the JSON search endpoint behind uitspraken.rechtspraak.nl (full-text
//    search with filters). It is not formally documented, so the response is
//    parsed defensively.
//  - Full text: the official open data API (data.rechtspraak.nl).

import { naarTekst, kortIn } from './tekst.js';

const ZOEK_URL = 'https://uitspraken.rechtspraak.nl/api/zoek';
const INHOUD_URL = 'https://data.rechtspraak.nl/uitspraken/content';
const ECLI_RE = /^ECLI:NL:[A-Z0-9]{1,7}:\d{4}:[A-Z0-9.]{1,25}$/;

// Keys used by the UI and the tool schema, mapped to the search API identifiers.
export const RECHTSGEBIEDEN = {
  civiel_recht: { label: 'Civiel recht (alles)', id: 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht' },
  verbintenissenrecht: { label: 'Verbintenissenrecht (o.a. onrechtmatige daad)', id: 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht_verbintenissenrecht' },
  arbeidsrecht: { label: 'Arbeidsrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht_arbeidsrecht' },
  personen_en_familierecht: { label: 'Personen- en familierecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#civielRecht_personenEnFamilierecht' },
  bestuursrecht: { label: 'Bestuursrecht (alles)', id: 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht' },
  socialezekerheidsrecht: { label: 'Socialezekerheidsrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_socialezekerheidsrecht' },
  belastingrecht: { label: 'Belastingrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_belastingrecht' },
  vreemdelingenrecht: { label: 'Vreemdelingenrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_vreemdelingenrecht' },
  omgevingsrecht: { label: 'Omgevingsrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht_omgevingsrecht' },
  strafrecht: { label: 'Strafrecht', id: 'http://psi.rechtspraak.nl/rechtsgebied#strafrecht' },
};

export const INSTANTIES = {
  hoge_raad: { label: 'Hoge Raad', id: 'Spirit.Npi.Ecli.Domain.TypeHr' },
  gerechtshof: { label: 'Gerechtshof', id: 'Spirit.Npi.Ecli.Domain.Gerechtshof' },
  rechtbank: { label: 'Rechtbank', id: 'Spirit.Npi.Ecli.Domain.Rechtbank' },
  raad_van_state: { label: 'Raad van State', id: 'Spirit.Npi.Ecli.Domain.TypeRvS' },
  centrale_raad_van_beroep: { label: 'Centrale Raad van Beroep', id: 'Spirit.Npi.Ecli.Domain.TypeCRvB' },
  college_van_beroep: { label: 'College van Beroep voor het bedrijfsleven', id: 'Spirit.Npi.Ecli.Domain.TypeCBb' },
};

export class BronFout extends Error {}

export function isEcli(tekst) {
  return ECLI_RE.test(String(tekst ?? '').trim().toUpperCase());
}

function jaarUitDatum(datum) {
  // Search API returns dd-mm-yyyy.
  const m = String(datum ?? '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * Full-text search in published Dutch case law.
 * Year filtering happens on the results (the API's date filter is undocumented),
 * so when a year range is set we fetch a larger page and filter it down.
 */
export async function zoekUitspraken({ zoektermen, rechtsgebied, instantie, vanafJaar, totJaar, aantal = 8 }, { signal } = {}) {
  const term = String(zoektermen ?? '').trim();
  if (!term) throw new BronFout('Geef zoektermen op.');
  const maxAantal = Math.min(Math.max(Number(aantal) || 8, 1), 15);
  const metJaarFilter = Boolean(vanafJaar || totJaar);

  const body = {
    StartRow: 0,
    PageSize: metJaarFilter ? 50 : maxAantal,
    ShouldReturnHighlights: false,
    ShouldCountFacets: false,
    SortOrder: 'Relevance',
    SearchTerms: [{ Term: term, Field: 'AlleVelden' }],
    Contentsoorten: [],
    Rechtsgebieden: RECHTSGEBIEDEN[rechtsgebied] ? [{ NodeType: 'Rechtsgebied', Identifier: RECHTSGEBIEDEN[rechtsgebied].id }] : [],
    Instanties: INSTANTIES[instantie] ? [{ NodeType: 'InstantieType', Identifier: INSTANTIES[instantie].id }] : [],
    DatumPublicatie: [],
    DatumUitspraak: [],
    Advanced: { PublicatieStatus: 'AlleenGepubliceerd' },
    CorrelationId: 'aansprakelijkheidskompas',
    Proceduresoorten: [],
  };

  const res = await fetch(ZOEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const ruw = await res.text();
  let data;
  try {
    data = JSON.parse(ruw);
  } catch {
    throw new BronFout(`De zoekdienst van rechtspraak.nl gaf geen bruikbaar antwoord (HTTP ${res.status}).`);
  }

  let resultaten = (Array.isArray(data.Results) ? data.Results : [])
    .map((r) => ({
      ecli: String(r.TitelEmphasis ?? '').trim(),
      titel: String(r.Titel ?? '').trim(),
      datum: r.Uitspraakdatum ?? null,
      rechtsgebieden: Array.isArray(r.Rechtsgebieden) ? r.Rechtsgebieden.join('; ') : '',
      soort: r.GerechtelijkProductType ?? null,
      fragment: kortIn(naarTekst(String(r.Tekstfragment ?? '')), 500),
      url: r.DeeplinkUrl || (r.TitelEmphasis ? `https://deeplink.rechtspraak.nl/uitspraak?id=${r.TitelEmphasis}` : null),
    }))
    .filter((r) => isEcli(r.ecli));

  if (metJaarFilter) {
    resultaten = resultaten.filter((r) => {
      const jaar = jaarUitDatum(r.datum);
      if (!jaar) return false;
      return (!vanafJaar || jaar >= vanafJaar) && (!totJaar || jaar <= totJaar);
    });
  }

  return {
    totaal_gevonden: typeof data.ResultCount === 'number' ? data.ResultCount : resultaten.length,
    resultaten: resultaten.slice(0, maxAantal),
  };
}

function eersteMatch(xml, re) {
  const m = xml.match(re);
  return m ? naarTekst(m[1]).trim() : null;
}

/** Fetch one ruling (or conclusion) with its summary and a readable excerpt. */
export async function haalUitspraak({ ecli }, { signal } = {}) {
  const id = String(ecli ?? '').trim().toUpperCase();
  if (!isEcli(id)) throw new BronFout(`"${ecli}" is geen geldig Nederlands ECLI-nummer.`);

  const res = await fetch(`${INHOUD_URL}?id=${encodeURIComponent(id)}`, { signal });
  if (res.status === 404) throw new BronFout(`Uitspraak ${id} bestaat niet of is niet gepubliceerd op rechtspraak.nl.`);
  if (!res.ok) throw new BronFout(`rechtspraak.nl gaf een fout (HTTP ${res.status}) voor ${id}.`);
  const xml = await res.text();
  if (!xml.includes('<open-rechtspraak')) throw new BronFout(`Uitspraak ${id} kon niet worden gelezen.`);

  const inhoud = xml.match(/<(uitspraak|conclusie)\b[^>]*>([\s\S]*?)<\/\1>/);
  const volledig = inhoud ? naarTekst(inhoud[2]) : '';
  // Keep the start (parties, facts) and the end (the decision itself).
  const tekst = volledig.length > 9000 ? `${volledig.slice(0, 6000)}\n\n[...]\n\n${volledig.slice(-3000)}` : volledig;

  return {
    ecli: id,
    instantie: eersteMatch(xml, /<dcterms:creator[^>]*>([\s\S]*?)<\/dcterms:creator>/),
    datum: eersteMatch(xml, /<dcterms:date[^>]*>([\s\S]*?)<\/dcterms:date>/),
    zaaknummer: eersteMatch(xml, /<psi:zaaknummer[^>]*>([\s\S]*?)<\/psi:zaaknummer>/),
    rechtsgebied: [...xml.matchAll(/<dcterms:subject[^>]*>([\s\S]*?)<\/dcterms:subject>/g)].map((m) => naarTekst(m[1]).trim()).join('; '),
    soort: inhoud ? inhoud[1] : null,
    inhoudsindicatie: eersteMatch(xml, /<inhoudsindicatie\b[^>]*>([\s\S]*?)<\/inhoudsindicatie>/),
    tekst: tekst || '(geen tekst beschikbaar)',
    url: `https://deeplink.rechtspraak.nl/uitspraak?id=${id}`,
  };
}
