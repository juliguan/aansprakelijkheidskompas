import { toonScore, toonGeenScore } from './dial.js';
import { VOORBEELDEN } from './voorbeelden.js';
import { tekenPixelDuo } from './pixels.js';

const form = document.getElementById('casus-form');
const invoer = document.getElementById('casus');
const teller = document.getElementById('teller');
const veldfout = document.getElementById('veldfout');
const knopAnalyse = document.getElementById('knop-analyse');
const knopAnnuleer = document.getElementById('knop-annuleer');
const voortgang = document.getElementById('voortgang');
const voortgangLijst = document.getElementById('voortgang-lijst');
const verstreken = document.getElementById('verstreken');
const voortgangKop = document.getElementById('voortgang-kop');
const voortgangUitleg = document.getElementById('voortgang-uitleg');
const samenvatting = document.getElementById('samenvatting');
const uitkomst = document.getElementById('uitkomst');
const voorbeeldenBalk = document.getElementById('voorbeelden');

let lopend = null; // { controller, klok }

// In the standalone build (scripts/bouw-standalone.js) the demo engine is bundled
// into the page and exposed here; then no server is involved at all.
const LOKALE_ENGINE = globalThis.KOMPAS_LOKAAL ?? null;

// ── Mode (demo / live) as configured on the server ──

const MODUS_TEKST = {
  demo: {
    badge: ['Demomodus', 'geen API, geen kosten'],
    voet: 'demomodus: vaste regels en een gecontroleerde dataset, geen AI',
    uitleg: 'Demomodus: de casus wordt vergeleken met een vaste, gecontroleerde dataset. Dit duurt een paar seconden.',
    intro: 'In de demomodus gebeurt dat met vaste regels en een gecontroleerde dataset, zonder AI. Hij kent AI-zaken en veelvoorkomende alledaagse zaken, zoals diefstal, verkeersongevallen, hondenbeten en kapotte aankopen.',
  },
  api: {
    badge: ['Live modus', 'Claude + web search'],
    voet: 'live modus: analyses via de Claude API (claude-sonnet-5) met web search',
    uitleg: 'Het model zoekt live naar rechtspraak en wetgeving. Dat duurt meestal 20 tot 60 seconden.',
    intro: 'In de live modus zoekt een AI-model (Claude) daarvoor op internet.',
  },
};

async function laadModus() {
  try {
    let modus = 'demo';
    if (!LOKALE_ENGINE) {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      ({ modus } = await res.json());
    }
    const t = MODUS_TEKST[modus];
    if (!t) return;
    const badge = document.getElementById('modus');
    badge.replaceChildren(t.badge[0], el('small', {}, `· ${t.badge[1]}`));
    badge.className = `modus modus--${modus}`;
    badge.hidden = false;
    document.getElementById('voet-modus').textContent = t.voet;
    document.getElementById('intro-modus').textContent = t.intro;
    voortgangUitleg.textContent = t.uitleg;
  } catch {
    // Server unreachable: the badge simply stays hidden; submitting shows a proper error.
  }
}
laadModus();

// ── Small DOM helper: text is always set via textContent, never innerHTML ──

function el(tag, attrs = {}, ...kinderen) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kind of kinderen.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    node.append(kind instanceof Node ? kind : String(kind));
  }
  return node;
}

function alineas(tekst) {
  return tekst
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => el('p', {}, a));
}

// ── Form ──

for (const v of VOORBEELDEN) {
  voorbeeldenBalk.append(
    el('button', {
      type: 'button',
      class: 'voorbeeld-knop',
      onclick: () => {
        invoer.value = v.tekst;
        werkTellerBij();
        invoer.focus();
      },
    }, v.label),
  );
}

function werkTellerBij() {
  teller.textContent = String(invoer.value.length);
  veldfout.hidden = true;
}
invoer.addEventListener('input', werkTellerBij);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const casus = invoer.value.trim();
  if (!casus) {
    veldfout.textContent = 'Beschrijf eerst wat er is gebeurd.';
    veldfout.hidden = false;
    invoer.focus();
    return;
  }
  start(casus);
});

invoer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.requestSubmit();
});

knopAnnuleer.addEventListener('click', () => lopend?.controller.abort());

// ── Busy state ──

function zetBezig(bezig) {
  knopAnalyse.disabled = bezig;
  knopAnalyse.textContent = bezig ? 'Bezig met onderzoek…' : 'Analyseer casus';
  knopAnnuleer.hidden = !bezig;
  invoer.readOnly = bezig;
  voorbeeldenBalk.querySelectorAll('button').forEach((b) => (b.disabled = bezig));
  // The log stays visible afterwards so the user can see what was searched.
  if (bezig) voortgang.hidden = false;
  voortgangKop.textContent = bezig ? 'Onderzoek loopt' : 'Onderzoekslog';
  voortgangUitleg.hidden = !bezig;
  if (!bezig) voortgangLijst.querySelectorAll('li.is-actief').forEach((li) => li.classList.remove('is-actief'));
}

function stap(inhoud, soort = 'actief') {
  voortgangLijst.querySelectorAll('li.is-actief').forEach((li) => li.classList.remove('is-actief'));
  const li = el('li', { class: soort === 'actief' ? 'is-actief' : soort === 'waarschuwing' ? 'is-waarschuwing' : '' }, inhoud);
  voortgangLijst.append(li);
}

const FASE_TEKST = {
  start: 'Casus ontvangen; juridische factoren in kaart brengen',
  overwegen: 'Casus en zoekresultaten afwegen',
  schrijven: 'Onderbouwing en bronvermelding uitwerken',
};

function verwerkVoortgang(type, data) {
  if (type === 'fase') {
    const tekst = FASE_TEKST[data.fase];
    // Avoid repeating the same phase line back-to-back.
    if (tekst && voortgangLijst.lastElementChild?.dataset.fase !== data.fase) {
      stap(tekst);
      voortgangLijst.lastElementChild.dataset.fase = data.fase;
    }
  } else if (type === 'zoek') {
    stap(['Zoekt: ', el('span', { class: 'zoekterm' }, data.query)]);
  } else if (type === 'gevonden') {
    const domeinen = data.domeinen?.length ? el('span', { class: 'klein' }, ` (${data.domeinen.join(', ')})`) : null;
    stap([`${data.aantal} ${data.aantal === 1 ? 'resultaat' : 'resultaten'} gevonden`, domeinen], 'klaar');
  } else if (type === 'zoekfout') {
    const reden = data.code === 'max_uses_exceeded' ? 'maximum aantal zoekopdrachten bereikt' : 'een zoekopdracht mislukte';
    stap(`Let op: ${reden}; het onderzoek gaat verder met wat er is gevonden`, 'waarschuwing');
  }
}

// ── Request ──

async function start(casus) {
  lopend?.controller.abort();
  const controller = new AbortController();
  const begin = Date.now();
  const klok = setInterval(() => {
    verstreken.textContent = `${Math.round((Date.now() - begin) / 1000)} s`;
  }, 1000);
  lopend = { controller, klok };

  voortgangLijst.replaceChildren();
  verstreken.textContent = '0 s';
  uitkomst.hidden = true;
  uitkomst.replaceChildren();
  samenvatting.textContent = '';
  toonGeenScore('bezig', 'Onderzoek loopt…');
  zetBezig(true);

  if (LOKALE_ENGINE) {
    try {
      verwerkVoortgang('fase', { fase: 'start' });
      const resultaat = await LOKALE_ENGINE.analyseerDemo(casus, {
        signal: controller.signal,
        meld: (e) => verwerkVoortgang(e.type, e),
      });
      toonResultaat(resultaat);
    } catch (err) {
      if (controller.signal.aborted) toonGeenScore('leeg', 'Analyse geannuleerd');
      else toonFout({ code: 'lokaal', titel: 'Er ging iets mis', bericht: 'De analyse kon niet worden uitgevoerd. Probeer het opnieuw.' });
    } finally {
      clearInterval(klok);
      if (lopend?.controller === controller) lopend = null;
      zetBezig(false);
    }
    return;
  }

  let afgerond = false;
  try {
    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ casus }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    for await (const { event, data } of leesSse(res.body)) {
      if (event === 'resultaat') {
        afgerond = true;
        toonResultaat(data);
      } else if (event === 'fout') {
        afgerond = true;
        toonFout(data);
      } else {
        verwerkVoortgang(event, data);
      }
    }
    if (!afgerond) {
      toonFout({
        code: 'onderbroken',
        titel: 'Verbinding onderbroken',
        bericht: 'De verbinding met de server werd verbroken voordat er een resultaat was. Probeer het opnieuw.',
      });
    }
  } catch (err) {
    if (controller.signal.aborted) {
      toonGeenScore('leeg', 'Analyse geannuleerd');
    } else {
      toonFout({
        code: 'server',
        titel: 'Server niet bereikbaar',
        bericht: 'De lokale server reageert niet. Controleer of hij draait (npm start) en probeer het opnieuw.',
      });
    }
  } finally {
    clearInterval(klok);
    if (lopend?.controller === controller) lopend = null;
    zetBezig(false);
  }
}

// Minimal SSE parser over a fetch body (EventSource cannot POST).
async function* leesSse(body) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, '\n');
    let grens;
    while ((grens = buffer.indexOf('\n\n')) !== -1) {
      const blok = buffer.slice(0, grens);
      buffer = buffer.slice(grens + 2);
      let event = 'message';
      let data = '';
      for (const regel of blok.split('\n')) {
        if (regel.startsWith('event:')) event = regel.slice(6).trim();
        else if (regel.startsWith('data:')) data += regel.slice(5).trim();
      }
      if (!data) continue;
      try {
        yield { event, data: JSON.parse(data) };
      } catch {
        // Ignore a malformed frame rather than breaking the whole stream.
      }
    }
  }
}

// ── Rendering: result ──

const SOORT_LABEL = { uitspraak: 'Uitspraak', wetgeving: 'Wetgeving', beleid: 'Beleid / toezicht', overig: 'Overig' };

function toonResultaat(r) {
  if (r.status === 'te_vaag' || r.status === 'geen_casus') return toonGeenOordeel(r);

  toonScore(r.score, r.kwalificatie);
  samenvatting.textContent = r.samenvatting;

  const blad = el('article', { class: r.easteregg ? 'blad blad--hart' : 'blad' });

  if (r.easteregg) blad.append(tekenPixelDuo());
  blad.append(bronWaarschuwing(r));

  if (r.status === 'geen_bronnen') {
    blad.append(
      el('div', { class: 'melding' },
        el('strong', {}, 'Geen specifieke rechtspraak of wetgeving gevonden'),
        el('p', {}, 'Deze inschatting rust alleen op algemene juridische beginselen. Neem de score daarom met extra voorbehoud. Een preciezere beschrijving van de casus levert soms wel bruikbare bronnen op.'),
      ),
    );
  }

  if (r.onderbouwing) {
    blad.append(el('section', { class: 'onderbouwing' }, el('h3', {}, 'Onderbouwing'), alineas(r.onderbouwing)));
  }

  if (r.factoren.length) {
    blad.append(
      el('section', {},
        el('h3', {}, 'Juridisch relevante factoren'),
        el('ul', { class: 'factoren' },
          r.factoren.map((f) =>
            el('li', {},
              el('span', { class: `label label--${f.richting}` }, richtingTekst(f.richting)),
              el('span', { class: 'naam' }, f.factor),
              f.toelichting ? el('span', { class: 'toel' }, f.toelichting) : null,
            ),
          ),
        ),
      ),
    );
  }

  if (r.partijen.length) {
    blad.append(
      el('section', {},
        el('h3', {}, 'Betrokken partijen'),
        el('div', { class: 'tabel-wrap' },
          el('table', { class: 'partijen' },
            el('thead', {}, el('tr', {}, el('th', {}, 'Partij'), el('th', {}, 'Mogelijke grondslag'), el('th', {}, 'Aansprakelijk?'))),
            el('tbody', {},
              r.partijen.map((p) =>
                el('tr', {},
                  el('td', {}, el('strong', {}, p.partij), p.rol ? el('span', { class: 'klein' }, p.rol) : null),
                  el('td', {}, p.grondslag || '–', p.toelichting ? el('span', { class: 'klein' }, p.toelichting) : null),
                  el('td', {}, el('span', { class: `label label--${p.inschatting}` }, p.inschatting)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (r.bronnen.length) {
    blad.append(
      el('section', {},
        el('h3', {}, 'Bronnen', el('small', {}, r.easteregg
          ? 'uit het geheime archief'
          : r.modus === 'demo'
          ? `${r.controle.totaal} uit de gecontroleerde demodataset`
          : `${r.controle.teruggevonden} van ${r.controle.totaal} teruggevonden in de zoekresultaten`)),
        el('ul', { class: 'bronnen' }, r.bronnen.map(bronKaart)),
      ),
    );
  }

  if (r.onzekerheden.length) {
    blad.append(el('section', {}, el('h3', {}, 'Wat de inschatting kan doen omslaan'), el('ul', { class: 'lijst' }, r.onzekerheden.map((o) => el('li', {}, o)))));
  }

  if (r.vervolgvragen.length) {
    blad.append(el('section', {}, el('h3', {}, 'Om de inschatting preciezer te maken'), el('ul', { class: 'lijst' }, r.vervolgvragen.map((v) => el('li', {}, v)))));
  }

  blad.append(voetregel(r));
  toonUitkomst(blad);
}

function bronWaarschuwing(r) {
  if (r.easteregg) {
    return el('div', { class: 'melding melding--hart', role: 'note' },
      el('strong', {}, '♥ Je hebt de geheime zaak gevonden'),
      el('p', {}, 'Dit oordeel is geen juridisch advies, maar wel gemeend.'),
    );
  }
  if (r.modus === 'demo') {
    return el('div', { class: 'waarschuwing', role: 'note' },
      el('span', { class: 'waarschuwing__teken', 'aria-hidden': 'true' }, '!'),
      el('div', {},
        el('strong', {}, 'Demo-analyse: geen juridisch advies'),
        el('p', {}, 'Deze inschatting is gemaakt met vaste trefwoordregels, zonder AI en zonder live onderzoek. De uitspraken en wetten komen uit een kleine, handmatig gecontroleerde dataset en bestaan echt, maar of ze op jouw casus van toepassing zijn, is grof ingeschat. Lees de bronnen zelf voordat je erop vertrouwt.'),
      ),
    );
  }
  const { totaal, niet_teruggevonden: nietGevonden } = r.controle;
  let extra = '';
  if (totaal > 0 && nietGevonden > 0) {
    extra = ` ${nietGevonden} van de ${totaal} bronnen ${nietGevonden === 1 ? 'is' : 'zijn'} niet teruggevonden in de zoekresultaten van deze analyse; wees daar extra voorzichtig mee.`;
  } else if (totaal > 0) {
    extra = ' Alle genoemde bronnen kwamen voor in de zoekresultaten, maar dat zegt nog niets over de juiste uitleg ervan.';
  }
  return el('div', { class: 'waarschuwing', role: 'note' },
    el('span', { class: 'waarschuwing__teken', 'aria-hidden': 'true' }, '!'),
    el('div', {},
      el('strong', {}, 'Controleer dit resultaat voordat je erop vertrouwt'),
      el('p', {}, 'Deze inschatting is gegenereerd door een taalmodel en is geen juridisch advies. Taalmodellen kunnen uitspraken, ECLI-nummers en wetsartikelen verzinnen of verkeerd weergeven ("hallucineren"), ook als ze live op internet zoeken.' + extra),
    ),
  );
}

function bronKaart(b) {
  const labels = [
    el('span', { class: 'label label--soort' }, SOORT_LABEL[b.soort] ?? 'Overig'),
    b.herkomst === 'easteregg'
      ? el('span', { class: 'label label--hart' }, 'Geheime bron')
      : b.herkomst === 'dataset'
      ? el('span', { class: 'label label--ok', title: 'Deze bron staat in de handmatig gecontroleerde dataset van de demomodus.' }, 'Gecontroleerde dataset')
      : b.teruggevonden
      ? el('span', { class: 'label label--ok', title: 'De URL of het kenmerk kwam voor in de zoekresultaten van deze analyse.' }, 'Teruggevonden in zoekresultaten')
      : el('span', { class: 'label label--let-op', title: 'Deze bron kwam niet voor in de zoekresultaten. Mogelijk komt hij uit het geheugen van het model, of is hij verzonnen.' }, 'Niet teruggevonden: extra controleren'),
  ];
  const meta = [b.instantie, b.jaar].filter(Boolean).join(' · ');
  const links = [
    b.url ? el('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, 'Bron openen ↗') : null,
    b.controle ? el('a', { href: b.controle.url, target: '_blank', rel: 'noopener noreferrer' }, `${b.controle.label} ↗`) : null,
  ].filter(Boolean);

  return el('li', { class: `bron${b.teruggevonden ? '' : ' is-onbevestigd'}` },
    el('div', { class: 'bron__labels' }, labels),
    el('p', { class: 'bron__titel' }, b.titel),
    b.kenmerk ? el('div', { class: 'bron__kenmerk' }, b.kenmerk) : null,
    meta ? el('p', { class: 'bron__meta' }, meta) : null,
    b.relevantie ? el('p', { class: 'bron__relevantie' }, b.relevantie) : null,
    b.ecli_formaat_ongeldig ? el('p', { class: 'bron__waarschuwing' }, 'Dit ECLI-nummer heeft geen geldig formaat en is vrijwel zeker onjuist.') : null,
    links.length ? el('div', { class: 'bron__links' }, links) : null,
  );
}

function richtingTekst(r) {
  return { verhogend: '↑ verhogend', verlagend: '↓ verlagend', neutraal: '→ neutraal' }[r] ?? r;
}

function voetregel(r) {
  const m = r.meta ?? {};
  const seconden = m.duur_ms ? Math.round(m.duur_ms / 1000) : null;
  const delen = [
    m.datum && `Analyse van ${new Date(m.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    m.model && `model ${m.model}`,
    Number.isFinite(m.zoekopdrachten) && `${m.zoekopdrachten} ${m.zoekopdrachten === 1 ? 'zoekopdracht' : 'zoekopdrachten'}`,
    seconden && `${seconden} s`,
  ].filter(Boolean);
  return el('div', { class: 'blad__voet' },
    el('span', {}, delen.join(' · ')),
    el('button', { type: 'button', class: 'knop knop--stil', onclick: casusAanpassen }, 'Casus aanpassen'),
  );
}

// ── Rendering: no verdict (too vague / not a case) ──

function toonGeenOordeel(r) {
  const vaag = r.status === 'te_vaag';
  toonGeenScore('inactief', vaag ? 'Te weinig informatie voor een inschatting' : 'Geen casus herkend');

  const blad = el('article', { class: 'blad' },
    el('div', { class: 'melding' },
      el('strong', {}, vaag ? 'De casus is te vaag om te beoordelen' : 'Dit lijkt geen casus'),
      el('p', {}, r.toelichting_status || (vaag
        ? 'Er ontbreekt te veel informatie om iets zinnigs te zeggen over aansprakelijkheid.'
        : 'De tekst beschrijft geen situatie met schade of een aansprakelijkheidsvraag.')),
      el('p', {}, 'Tip: hoe gedetailleerder je de situatie beschrijft, hoe beter de inschatting wordt.'),
    ),
    r.vervolgvragen.length
      ? el('section', {}, el('h3', {}, 'Vul de casus bijvoorbeeld aan met'), el('ul', { class: 'lijst' }, r.vervolgvragen.map((v) => el('li', {}, v))))
      : null,
    el('div', { class: 'acties' }, el('button', { type: 'button', class: 'knop knop--primair', onclick: casusAanpassen }, 'Casus aanvullen')),
  );
  toonUitkomst(blad);
}

// ── Rendering: error ──

function toonFout(f) {
  toonGeenScore('inactief', 'Geen resultaat');
  const kanOpnieuw = !['config', 'sleutel', 'leeg', 'te_lang'].includes(f.code);
  const blad = el('article', { class: 'blad foutkaart', role: 'alert' },
    el('h3', {}, f.titel || 'Er ging iets mis'),
    el('p', {}, f.bericht || 'Probeer het opnieuw.'),
    el('p', {}, 'Je casus staat nog in het invoerveld, je bent niets kwijt.'),
    el('div', { class: 'acties' },
      kanOpnieuw ? el('button', { type: 'button', class: 'knop knop--primair', onclick: () => form.requestSubmit() }, 'Opnieuw proberen') : null,
      el('button', { type: 'button', class: 'knop knop--stil', onclick: casusAanpassen }, 'Casus aanpassen'),
    ),
  );
  toonUitkomst(blad);
}

function toonUitkomst(inhoud) {
  uitkomst.replaceChildren(inhoud);
  uitkomst.hidden = false;
}

function casusAanpassen() {
  invoer.focus();
  invoer.scrollIntoView({ block: 'center' });
}
