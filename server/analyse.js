import Anthropic from '@anthropic-ai/sdk';
import { SYSTEEMPROMPT, HERSTELPROMPT, maakGebruikersbericht } from './prompt.js';
import { haalJsonUitTekst, valideerAntwoord } from './schema.js';
import { Zoekbewijs, verrijkBronnen, kwalificatieVoorScore } from './bronnen.js';
import { TOOLS, voerToolUit } from './officieel/tools.js';

const MODEL = 'claude-sonnet-5';
// Web search is secondary (EU law, regulators); Dutch law comes from the official tools.
const MAX_WEBZOEKOPDRACHTEN = 3;
const WEB_DOMEINEN = [
  'eur-lex.europa.eu', 'curia.europa.eu', 'rechtspraak.nl', 'overheid.nl', 'raadvanstate.nl',
  'mensenrechten.nl', 'autoriteitpersoonsgegevens.nl', 'hudoc.echr.coe.int', 'rijksoverheid.nl',
];
// Model turns per analysis (each tool round or pause_turn resume is one turn).
const MAX_BEURTEN = 12;

export class AnalyseFout extends Error {
  constructor(code, message, detail) {
    super(message);
    this.code = code;
    this.detail = detail;
  }
}

let client;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Runs one analysis. `meld(event)` receives progress events for the UI:
 *   { type: 'fase', fase: 'overwegen' | 'schrijven' }
 *   { type: 'zoek', query }
 *   { type: 'gevonden', aantal, domeinen }
 *   { type: 'lees', tekst }
 *   { type: 'zoekfout', code, bericht? }
 * `filters` ({ rechtsgebied, instantie, vanafJaar }) come from the user and are
 * enforced on every rechtspraak.nl search.
 */
export async function analyseerCasus(casus, { signal, meld, filters = {} }) {
  const start = Date.now();
  const datum = new Date().toISOString().slice(0, 10);
  const bewijs = new Zoekbewijs();
  const messages = [{ role: 'user', content: maakGebruikersbericht(casus, datum, filters) }];
  const tools = [
    ...TOOLS,
    { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_WEBZOEKOPDRACHTEN, allowed_domains: WEB_DOMEINEN },
  ];
  let zoekopdrachten = 0;
  let final;

  for (let beurt = 0; beurt < MAX_BEURTEN; beurt++) {
    const laatsteBeurt = beurt === MAX_BEURTEN - 1;
    const stream = getClient().messages.stream(
      {
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        // Each research turn resends the conversation; caching the prefix keeps that cheap.
        cache_control: { type: 'ephemeral' },
        system: SYSTEEMPROMPT,
        tools,
        // On the last turn, force a written answer instead of more research.
        ...(laatsteBeurt ? { tool_choice: { type: 'none' } } : {}),
        messages,
      },
      { signal },
    );

    // Per content-block index: the block type and, for tool calls, the streamed input.
    const blokken = new Map();
    let schrijvenGemeld = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const blok = event.content_block;
        blokken.set(event.index, { type: blok.type, name: blok.name, json: '' });

        if (blok.type === 'thinking') meld({ type: 'fase', fase: 'overwegen' });
        if (blok.type === 'text' && !schrijvenGemeld) {
          schrijvenGemeld = true;
          meld({ type: 'fase', fase: 'schrijven' });
        }
        if (blok.type === 'web_search_tool_result') meldZoekresultaat(blok, meld);
      } else if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
        const b = blokken.get(event.index);
        if (b) b.json += event.delta.partial_json;
      } else if (event.type === 'content_block_stop') {
        const b = blokken.get(event.index);
        if (b?.type === 'server_tool_use' && b.name === 'web_search') {
          zoekopdrachten++;
          const query = veiligParse(b.json)?.query;
          if (query) meld({ type: 'zoek', query });
        }
      }
    }

    final = await stream.finalMessage();
    verzamelBewijs(final.content, bewijs);

    if (final.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: final.content });
      continue;
    }

    if (final.stop_reason === 'tool_use') {
      const aanroepen = final.content.filter((b) => b.type === 'tool_use');
      messages.push({ role: 'assistant', content: final.content });
      // All results go back in one user message, as the API expects.
      const resultaten = await Promise.all(
        aanroepen.map(async (aanroep) => {
          zoekopdrachten++;
          const { inhoud, isFout } = await voerToolUit(aanroep.name, aanroep.input, { filters, bewijs, meld, signal });
          return {
            type: 'tool_result',
            tool_use_id: aanroep.id,
            content: typeof inhoud === 'string' ? inhoud : JSON.stringify(inhoud),
            ...(isFout ? { is_error: true } : {}),
          };
        }),
      );
      messages.push({ role: 'user', content: resultaten });
      continue;
    }
    break;
  }

  if (final.stop_reason === 'refusal') {
    throw new AnalyseFout('geweigerd', 'Het model heeft deze casus niet in behandeling genomen.');
  }
  if (final.stop_reason === 'pause_turn' || final.stop_reason === 'tool_use') {
    throw new AnalyseFout('onvolledig', 'Het onderzoek werd niet binnen de beschikbare stappen afgerond.');
  }

  const antwoordTekst = tekstNaLaatsteToolblok(final.content);
  const antwoord = await leesAntwoord(antwoordTekst, signal);

  return bouwResultaat(antwoord, bewijs, {
    model: final.model ?? MODEL,
    zoekopdrachten,
    duur_ms: Date.now() - start,
    datum,
  });
}

function meldZoekresultaat(blok, meld) {
  if (Array.isArray(blok.content)) {
    const domeinen = [...new Set(blok.content.map((r) => hostnaam(r.url)).filter(Boolean))].slice(0, 4);
    meld({ type: 'gevonden', aantal: blok.content.length, domeinen });
  } else if (blok.content?.error_code) {
    meld({ type: 'zoekfout', code: blok.content.error_code });
  }
}

function verzamelBewijs(content, bewijs) {
  for (const blok of content) {
    if (blok.type === 'web_search_tool_result' && Array.isArray(blok.content)) {
      for (const r of blok.content) if (r.type === 'web_search_result') bewijs.voegResultaatToe(r);
    }
    if (blok.type === 'text' && Array.isArray(blok.citations)) {
      for (const c of blok.citations) bewijs.voegCitaatToe(c);
    }
  }
}

// Citations split the answer into many text blocks; the JSON lives in the
// text after the last search activity.
function tekstNaLaatsteToolblok(content) {
  let laatsteTool = -1;
  content.forEach((b, i) => {
    if (b.type !== 'text' && b.type !== 'thinking' && b.type !== 'redacted_thinking') laatsteTool = i;
  });
  const tekst = content
    .slice(laatsteTool + 1)
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  // Fall back to all text if the model put the JSON before a late tool call.
  return tekst.includes('{') ? tekst : content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function leesAntwoord(tekst, signal) {
  try {
    return valideerAntwoord(haalJsonUitTekst(tekst));
  } catch (eersteFout) {
    // One repair attempt: ask the model to reformat what it already wrote.
    try {
      const herstel = await getClient().messages.create(
        {
          model: MODEL,
          max_tokens: 8000,
          system: HERSTELPROMPT,
          messages: [
            {
              role: 'user',
              content: `Foutmelding: ${eersteFout.message}\n\nOorspronkelijke uitvoer:\n\n${tekst || '(leeg)'}`,
            },
          ],
        },
        { signal },
      );
      const herstelTekst = herstel.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return valideerAntwoord(haalJsonUitTekst(herstelTekst));
    } catch (tweedeFout) {
      if (tweedeFout instanceof Anthropic.APIError) throw tweedeFout;
      throw new AnalyseFout(
        'ongeldig_antwoord',
        'Het antwoord van het model kon niet worden verwerkt.',
        `${eersteFout.message} | herstel: ${tweedeFout.message}`,
      );
    }
  }
}

function bouwResultaat(antwoord, bewijs, meta) {
  const heeftOordeel = antwoord.status === 'ok';
  const bronnen = heeftOordeel ? verrijkBronnen(antwoord.bronnen, bewijs) : [];
  const teruggevonden = bronnen.filter((b) => b.teruggevonden).length;

  // A verdict without any source is shown, but flagged as such.
  const status = heeftOordeel && bronnen.length === 0 ? 'geen_bronnen' : antwoord.status;
  const score = heeftOordeel ? antwoord.score : null;

  return {
    modus: 'api',
    status,
    score,
    kwalificatie: kwalificatieVoorScore(score),
    samenvatting: antwoord.samenvatting,
    onderbouwing: antwoord.onderbouwing,
    toelichting_status: antwoord.toelichting_status,
    factoren: heeftOordeel ? antwoord.factoren : [],
    partijen: heeftOordeel ? antwoord.partijen : [],
    bronnen,
    onzekerheden: antwoord.onzekerheden,
    vervolgvragen: antwoord.vervolgvragen,
    controle: {
      totaal: bronnen.length,
      teruggevonden,
      niet_teruggevonden: bronnen.length - teruggevonden,
      officieel: bronnen.filter((b) => ['gelezen', 'gevonden', 'wettekst'].includes(b.verificatie)).length,
    },
    meta,
  };
}

function veiligParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function hostnaam(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
