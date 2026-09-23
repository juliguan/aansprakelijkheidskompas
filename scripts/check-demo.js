// Runs the test scenarios through demo mode and checks the outcome ranges.
// Usage: npm run check   (no API key needed, no costs)

import { analyseerDemo } from '../server/demo/demo.js';
import { VOORBEELDEN } from '../public/voorbeelden.js';

const GEVALLEN = [
  { naam: VOORBEELDEN[0].label, casus: VOORBEELDEN[0].tekst, status: 'ok', min: 55, max: 85 },
  { naam: VOORBEELDEN[1].label, casus: VOORBEELDEN[1].tekst, status: 'ok', min: 65, max: 90 },
  { naam: VOORBEELDEN[2].label, casus: VOORBEELDEN[2].tekst, status: 'ok', min: 50, max: 80 },
  { naam: 'Geen casus', casus: 'ik ben niks aan het doen', status: 'geen_casus' },
  { naam: 'Te vaag', casus: 'ik ga stelen van de albert heijn', status: 'te_vaag' },
];

let fouten = 0;
for (const g of GEVALLEN) {
  const r = await analyseerDemo(g.casus, { meld: () => {} });
  const scoreOk = g.min === undefined || (r.score >= g.min && r.score <= g.max);
  const ok = r.status === g.status && scoreOk;
  if (!ok) fouten++;
  const score = r.score === null ? '–' : r.score;
  console.log(`${ok ? 'OK  ' : 'FOUT'} ${g.naam.padEnd(28)} status=${r.status.padEnd(10)} score=${String(score).padEnd(3)} bronnen=${r.bronnen.length}`);
  if (r.status === 'ok') {
    for (const b of r.bronnen) console.log(`       - ${b.kenmerk}`);
  }
}

console.log(fouten ? `\n${fouten} controle(s) mislukt.` : '\nAlle controles geslaagd.');
process.exit(fouten ? 1 : 0);
