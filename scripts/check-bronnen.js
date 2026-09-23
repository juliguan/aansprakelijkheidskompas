// Checks the official source connections (rechtspraak.nl, wetten.overheid.nl).
// Usage: npm run check:bronnen   (no API key needed, no costs; needs internet)

import { zoekUitspraken, haalUitspraak } from '../server/officieel/rechtspraak.js';
import { haalWetsartikel } from '../server/officieel/wetten.js';

let fouten = 0;
async function test(naam, fn, controle) {
  try {
    const r = await fn();
    const ok = controle(r);
    if (!ok) fouten++;
    console.log(`${ok ? 'OK  ' : 'FOUT'} ${naam}`);
    return r;
  } catch (e) {
    fouten++;
    console.log(`FOUT ${naam}: ${e.message}`);
  }
}

const zoek = await test('zoeken: winkeldiefstal schadevergoeding', () => zoekUitspraken({ zoektermen: 'winkeldiefstal forfaitaire schadevergoeding', aantal: 5 }), (r) => r.resultaten.length > 0);
zoek?.resultaten.slice(0, 3).forEach((r) => console.log(`       ${r.ecli}  ${r.datum}  ${r.fragment.slice(0, 80)}`));

await test('zoeken met filter: Hoge Raad', () => zoekUitspraken({ zoektermen: 'aansprakelijkheid', instantie: 'hoge_raad', aantal: 3 }), (r) => r.resultaten.every((x) => x.ecli.startsWith('ECLI:NL:HR') || x.ecli.startsWith('ECLI:NL:PHR')));
await test('zoeken met filter: strafrecht vanaf 2024', () => zoekUitspraken({ zoektermen: 'algoritme', rechtsgebied: 'strafrecht', vanafJaar: 2024, aantal: 3 }), (r) => r.resultaten.every((x) => Number(x.datum.slice(-4)) >= 2024));

const u = await test('uitspraak ophalen: SyRI', () => haalUitspraak({ ecli: 'ECLI:NL:RBDHA:2020:865' }), (r) => r.instantie?.includes('Den Haag') && r.tekst.length > 1000);
if (u) console.log(`       ${u.datum} | ${u.inhoudsindicatie?.slice(0, 100)}…`);
await test('ongeldig ECLI geweigerd', () => haalUitspraak({ ecli: 'ECLI:NL:XX:2024' }).then(() => 'geen fout', (e) => e.message), (r) => r !== 'geen fout');

for (const [regeling, artikel, verwacht] of [
  ['BW', '6:162', /onrechtmatige daad/],
  ['BW6', '6:179', /dier/],
  ['BW7', '658', /werkgever/],
  ['Awb', '3:2', /kennis/],
  ['Sr', '310', /wegneemt/],
  ['WVW', '185', /motorrijtuig/],
  ['WAM', '2', /verzeker/],
]) {
  const r = await test(`wetsartikel ${regeling} ${artikel}`, () => haalWetsartikel({ regeling, artikel }), (r) => verwacht.test(r.tekst));
  if (r) console.log(`       ${r.regeling} art. ${r.artikel} (${r.geldende_versie_vanaf}): ${r.tekst.slice(0, 90).replace(/\n/g, ' ')}…\n       ${r.url}`);
}

console.log(fouten ? `\n${fouten} controle(s) mislukt.` : '\nAlle bronkoppelingen werken.');
process.exit(fouten ? 1 : 0);
