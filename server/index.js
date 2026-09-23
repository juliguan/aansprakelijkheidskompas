import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { analyseerCasus, AnalyseFout } from './analyse.js';
import { analyseerDemo } from './demo/demo.js';
import { bevatParmis, analyseerParmis } from './easteregg.js';
import { RECHTSGEBIEDEN, INSTANTIES } from './officieel/rechtspraak.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MAX_TEKENS = 6000;
// Live research reads several rulings, so allow more time than a single call.
const TIMEOUT_MS = 240_000;
const HUIDIG_JAAR = new Date().getFullYear();

// Only accept filter values we know; anything else is silently dropped.
function leesFilters(ruw) {
  const f = ruw && typeof ruw === 'object' ? ruw : {};
  const jaar = Number.parseInt(f.vanafJaar, 10);
  return {
    rechtsgebied: RECHTSGEBIEDEN[f.rechtsgebied] ? f.rechtsgebied : undefined,
    instantie: INSTANTIES[f.instantie] ? f.instantie : undefined,
    vanafJaar: jaar >= 1950 && jaar <= HUIDIG_JAAR ? jaar : undefined,
  };
}

// "demo" (default, no API calls) or "api" (live analysis with Claude).
// A --modus=... flag (used by `npm run demo` / `npm run live`) wins over MODUS in .env.
const MODUS = bepaalModus();

function bepaalModus() {
  const vlag = process.argv.find((a) => a.startsWith('--modus='))?.split('=')[1];
  const waarde = (vlag ?? process.env.MODUS ?? 'demo').trim().toLowerCase();
  if (waarde === 'api' || waarde === 'live') return 'api';
  if (waarde !== 'demo') console.warn(`Onbekende modus "${waarde}", de server start in demomodus.`);
  return 'demo';
}

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(here, '..', 'public')));

app.get('/api/status', (_req, res) => {
  const opties = (lijst) => Object.entries(lijst).map(([waarde, { label }]) => ({ waarde, label }));
  res.json({
    modus: MODUS,
    sleutelAanwezig: Boolean(process.env.ANTHROPIC_API_KEY),
    filters: { rechtsgebieden: opties(RECHTSGEBIEDEN), instanties: opties(INSTANTIES) },
  });
});

// The response is a Server-Sent Events stream so the UI can show the searches
// as they happen. Events: fase, zoek, gevonden, zoekfout, resultaat, fout.
app.post('/api/analyse', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const stuur = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const stopMetFout = (fout) => {
    stuur('fout', fout);
    res.end();
  };

  const casus = typeof req.body?.casus === 'string' ? req.body.casus.trim() : '';
  if (!casus) {
    return stopMetFout({ code: 'leeg', titel: 'Geen casus ingevuld', bericht: 'Beschrijf eerst wat er is gebeurd.' });
  }
  if (casus.length > MAX_TEKENS) {
    return stopMetFout({
      code: 'te_lang',
      titel: 'Casus is te lang',
      bericht: `Houd de beschrijving onder de ${MAX_TEKENS} tekens.`,
    });
  }
  if (MODUS === 'api' && !process.env.ANTHROPIC_API_KEY && !bevatParmis(casus)) {
    return stopMetFout({
      code: 'config',
      titel: 'API-sleutel ontbreekt',
      bericht: 'De server draait in live modus maar heeft geen ANTHROPIC_API_KEY. Zet de sleutel in .env en herstart, of start in demomodus met "npm run demo" (zie README).',
    });
  }

  const controller = new AbortController();
  let timeout = false;
  const timer = setTimeout(() => {
    timeout = true;
    controller.abort();
  }, TIMEOUT_MS);
  // Stop the (paid) model call if the browser goes away or cancels.
  res.on('close', () => controller.abort());

  stuur('fase', { type: 'fase', fase: 'start' });
  try {
    const analyseer = bevatParmis(casus) ? analyseerParmis : MODUS === 'api' ? analyseerCasus : analyseerDemo;
    const resultaat = await analyseer(casus, {
      signal: controller.signal,
      meld: (event) => stuur(event.type, event),
      modus: MODUS,
      filters: leesFilters(req.body?.filters),
    });
    stuur('resultaat', resultaat);
  } catch (err) {
    if (controller.signal.aborted && !timeout) {
      console.log('[analyse] afgebroken: de browser heeft de verbinding gesloten');
    } else if (!res.writableEnded) {
      const fout = vertaalFout(err, timeout);
      console.error(`[analyse] ${fout.code}:`, err?.detail ?? err?.message ?? err);
      stuur('fout', fout);
    }
  } finally {
    clearTimeout(timer);
    res.end();
  }
});

function vertaalFout(err, timeout) {
  if (timeout) {
    return {
      code: 'timeout',
      titel: 'Het onderzoek duurde te lang',
      bericht: 'Er kwam binnen vier minuten geen antwoord. Probeer het opnieuw, eventueel met een kortere of preciezere casus.',
    };
  }
  if (err instanceof AnalyseFout) {
    const titels = {
      geweigerd: 'Casus niet in behandeling genomen',
      onvolledig: 'Onderzoek niet afgerond',
      ongeldig_antwoord: 'Antwoord kon niet worden verwerkt',
    };
    return { code: err.code, titel: titels[err.code] ?? 'Er ging iets mis', bericht: `${err.message} Probeer het opnieuw.` };
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return {
      code: 'sleutel',
      titel: 'API-sleutel geweigerd',
      bericht: 'De Claude API accepteert de ingestelde sleutel niet. Controleer ANTHROPIC_API_KEY in .env en herstart de server.',
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      code: 'limiet',
      titel: 'Even te veel verzoeken',
      bericht: 'De limiet van je API-account is tijdelijk bereikt. Wacht een minuut en probeer het opnieuw.',
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return {
      code: 'verbinding',
      titel: 'Geen verbinding met Claude',
      bericht: 'De server kon de Claude API niet bereiken. Controleer de internetverbinding en probeer het opnieuw.',
    };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return {
      code: 'verzoek',
      titel: 'Verzoek niet geaccepteerd',
      bericht: 'De Claude API wees het verzoek af. Controleer of je account toegang heeft tot web search en het model claude-sonnet-5; details staan in de serverlog.',
    };
  }
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) {
    return {
      code: 'overbelast',
      titel: 'Claude is tijdelijk niet beschikbaar',
      bericht: 'De dienst is overbelast of heeft een storing. Probeer het over een paar minuten opnieuw.',
    };
  }
  return {
    code: 'onbekend',
    titel: 'Er ging iets mis',
    bericht: 'Er trad een onverwachte fout op. Probeer het opnieuw; details staan in de serverlog.',
  };
}

app.listen(PORT, () => {
  console.log(`Aansprakelijkheidskompas draait op http://localhost:${PORT}`);
  if (MODUS === 'demo') {
    console.log('Modus: DEMO (vaste regels en een gecontroleerde dataset; geen API-aanroepen, geen kosten).');
  } else {
    console.log('Modus: LIVE (Claude API met web search; elke analyse kost API-tegoed).');
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Let op: ANTHROPIC_API_KEY ontbreekt. Zet de sleutel in .env, of start met "npm run demo".');
    }
  }
});
