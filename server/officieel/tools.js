// Tools Claude can call in live mode to consult the official Dutch sources.
// The user's search filters are enforced here, whatever the model asks for.

import { zoekUitspraken, haalUitspraak, BronFout, RECHTSGEBIEDEN, INSTANTIES } from './rechtspraak.js';
import { haalWetsartikel, aliassenVoor } from './wetten.js';

export const TOOLS = [
  {
    name: 'zoek_uitspraken',
    description:
      'Doorzoekt alle gepubliceerde Nederlandse rechtspraak op rechtspraak.nl (officiele bron). Geeft per uitspraak het ECLI, de instantie, datum, rechtsgebied en een korte samenvatting. Gebruik korte juridische zoektermen (2-5 woorden) en probeer varianten als de eerste zoekopdracht weinig oplevert.',
    input_schema: {
      type: 'object',
      properties: {
        zoektermen: { type: 'string', description: 'Zoektermen, bijvoorbeeld "winkeldiefstal forfaitaire schadevergoeding".' },
        rechtsgebied: { type: 'string', enum: Object.keys(RECHTSGEBIEDEN), description: 'Optioneel rechtsgebied.' },
        instantie: { type: 'string', enum: Object.keys(INSTANTIES), description: 'Optionele instantie.' },
        vanaf_jaar: { type: 'integer', description: 'Optioneel: alleen uitspraken vanaf dit jaar.' },
        aantal: { type: 'integer', description: 'Aantal resultaten (1-15, standaard 8).' },
      },
      required: ['zoektermen'],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: 'haal_uitspraak',
    description:
      'Haalt de officiele tekst van een Nederlandse uitspraak op via de open data van rechtspraak.nl: instantie, datum, zaaknummer, inhoudsindicatie en de tekst (begin en slot). Gebruik dit om te controleren wat een uitspraak echt zegt voordat je hem gebruikt.',
    input_schema: {
      type: 'object',
      properties: { ecli: { type: 'string', description: 'Het ECLI-nummer, bijvoorbeeld "ECLI:NL:HR:2017:32".' } },
      required: ['ecli'],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
  {
    name: 'haal_wetsartikel',
    description:
      'Haalt de actuele tekst van een Nederlands wetsartikel op van wetten.overheid.nl, met de officiele link. Voorbeelden: regeling "BW" + artikel "6:162"; regeling "Awb" + artikel "3:2"; regeling "Sr" + artikel "310"; regeling "WVW" + artikel "185"; ook volledige wetsnamen werken.',
    input_schema: {
      type: 'object',
      properties: {
        regeling: { type: 'string', description: 'Afkorting of naam van de wet, bijvoorbeeld "BW", "BW7", "Awb", "Sr", "WVW", "WAM", "AWGB".' },
        artikel: { type: 'string', description: 'Artikelnummer, bijvoorbeeld "6:162", "658" of "3:2".' },
      },
      required: ['regeling', 'artikel'],
      additionalProperties: false,
    },
    eager_input_streaming: true,
  },
];

const tekst = (v) => (typeof v === 'string' ? v.trim() : '');
const geheel = (v) => (Number.isInteger(v) ? v : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : undefined);

function filterLabel(invoer) {
  const delen = [
    invoer.rechtsgebied && RECHTSGEBIEDEN[invoer.rechtsgebied]?.label,
    invoer.instantie && INSTANTIES[invoer.instantie]?.label,
    invoer.vanafJaar && `vanaf ${invoer.vanafJaar}`,
  ].filter(Boolean);
  return delen.length ? ` (${delen.join(', ')})` : '';
}

/**
 * Executes one tool call. Returns { inhoud, isFout }.
 * `filters` are the user's filters; `bewijs` collects what was retrieved.
 */
export async function voerToolUit(naam, input, { filters = {}, bewijs, meld, signal }) {
  try {
    if (naam === 'zoek_uitspraken') {
      const invoer = {
        zoektermen: tekst(input?.zoektermen),
        // User filters win over what the model chose.
        rechtsgebied: filters.rechtsgebied || tekst(input?.rechtsgebied) || undefined,
        instantie: filters.instantie || tekst(input?.instantie) || undefined,
        vanafJaar: filters.vanafJaar || geheel(input?.vanaf_jaar),
        aantal: geheel(input?.aantal),
      };
      meld({ type: 'zoek', query: `rechtspraak.nl: ${invoer.zoektermen}${filterLabel(invoer)}` });
      const r = await zoekUitspraken(invoer, { signal });
      for (const u of r.resultaten) bewijs.voegOfficieleUitspraakToe(u.ecli, 'gevonden');
      meld({ type: 'gevonden', aantal: r.resultaten.length, domeinen: ['rechtspraak.nl'] });
      return { inhoud: r };
    }

    if (naam === 'haal_uitspraak') {
      const ecli = tekst(input?.ecli);
      meld({ type: 'lees', tekst: `Leest uitspraak ${ecli}` });
      const r = await haalUitspraak({ ecli }, { signal });
      bewijs.voegOfficieleUitspraakToe(r.ecli, 'gelezen');
      return { inhoud: r };
    }

    if (naam === 'haal_wetsartikel') {
      const regeling = tekst(input?.regeling);
      const artikel = tekst(input?.artikel);
      meld({ type: 'lees', tekst: `Leest artikel ${artikel} ${regeling} op wetten.overheid.nl` });
      const r = await haalWetsartikel({ regeling, artikel }, { signal });
      bewijs.voegWetsartikelToe({ ...r, aliassen: aliassenVoor(r.bwb_id) });
      return { inhoud: r };
    }

    return { inhoud: `Onbekende tool: ${naam}`, isFout: true };
  } catch (err) {
    if (signal?.aborted) throw err;
    const bericht = err instanceof BronFout ? err.message : `De bron is tijdelijk niet bereikbaar (${err.message}).`;
    meld({ type: 'zoekfout', code: 'bron', bericht });
    return { inhoud: bericht, isFout: true };
  }
}
