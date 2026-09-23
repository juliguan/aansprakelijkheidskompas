// A small easter egg. Mentioning "Parmis" anywhere in the case (any
// capitalisation) returns a special verdict. Works in every mode and never
// calls the API.

export function bevatParmis(tekst) {
  const genormaliseerd = tekst.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  // No word boundary on purpose, so nicknames like "parmisje" count too.
  return genormaliseerd.includes('parmis');
}

const wachtEven = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('afgebroken'));
    }, { once: true });
  });

const HART = '♥';

export async function analyseerParmis(_casus, { signal, meld, modus = 'demo' }) {
  const start = Date.now();
  meld({ type: 'zoek', query: 'Hof van het Hart: bijzondere zaken' });
  await wachtEven(600, signal);
  meld({ type: 'gevonden', aantal: 1, domeinen: ['geheim archief'] });
  await wachtEven(400, signal);
  meld({ type: 'fase', fase: 'schrijven' });
  await wachtEven(500, signal);

  return {
    modus,
    easteregg: true,
    status: 'ok',
    score: 100,
    kwalificatie: 'Volledig en onherroepelijk aansprakelijk',
    samenvatting: 'Parmis is volledig aansprakelijk voor een gestolen hart. Elk verweer is kansloos en hoger beroep is niet-ontvankelijk.',
    onderbouwing: [
      'Uit het dossier blijkt dat Parmis herhaaldelijk en zonder enige terughoudendheid heeft geglimlacht, gelachen en gewoon zichzelf is geweest. Het Hof acht bewezen dat daardoor een hart is ontvreemd, en dat dit hart niet meer terug te krijgen is.',
      'Van overmacht is geen sprake: de gevolgen waren volledig voorzienbaar. Een beroep op eigen schuld van de benadeelde wordt eveneens verworpen; de benadeelde had eenvoudigweg geen schijn van kans.',
      'Het Hof ziet af van een schadevergoeding in geld en legt in plaats daarvan een levenslange verplichting op tot het delen van snacks, slechte woordgrappen en goede gesprekken.',
    ].join('\n\n'),
    toelichting_status: '',
    factoren: [
      { factor: 'Glimlach', richting: 'verhogend', toelichting: 'Aantoonbaar, herhaaldelijk en met grote precisie ingezet.' },
      { factor: 'Lach die de hele kamer vult', richting: 'verhogend', toelichting: 'Ook op afstand waarneembaar. Bewijs ten overvloede.' },
      { factor: 'Gewoon zichzelf zijn', richting: 'verhogend', toelichting: 'Weegt volgens vaste rechtspraak het zwaarst.' },
      { factor: 'Verzachtende omstandigheden', richting: 'neutraal', toelichting: 'Niet gevonden. Het Hof heeft goed gezocht.' },
    ],
    partijen: [
      {
        partij: 'Parmis',
        rol: 'hartendief',
        grondslag: `art. ${HART} Burgerlijk Wetboek van het Hart`,
        inschatting: 'waarschijnlijk',
        toelichting: 'Hoofdelijk en voor altijd aansprakelijk.',
      },
    ],
    bronnen: [
      {
        soort: 'overig',
        titel: 'Hof van het Hart, de zaak Parmis',
        kenmerk: `HART:2026:${HART}`,
        instantie: 'Hof van het Hart',
        jaar: 2026,
        url: null,
        relevantie: 'Het enige precedent dat telt. Niet te vinden op rechtspraak.nl, wel in een specifiek hart.',
        teruggevonden: true,
        herkomst: 'easteregg',
        ecli_formaat_ongeldig: false,
        controle: null,
      },
    ],
    onzekerheden: ['Geen. Dit is de enige casus waarin deze tool voor 100% zeker is.'],
    vervolgvragen: [],
    controle: { totaal: 1, teruggevonden: 1, niet_teruggevonden: 0 },
    meta: { model: 'Hof van het Hart', zoekopdrachten: 1, duur_ms: Date.now() - start, datum: new Date().toISOString().slice(0, 10) },
  };
}
