// Builds a single self-contained demo page (no server, no API) that can be
// shared as a link or hosted anywhere static:
//   npm run bouw:standalone  ->  standalone/aansprakelijkheidskompas.html
//
// The modules are concatenated in dependency order with their import/export
// lines stripped. That only works because the code keeps imports on one line
// and top-level names unique across these files; `node --check` below guards it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const ENGINE = ['server/bronnen.js', 'server/demo/dataset.js', 'server/demo/regels.js', 'server/easteregg.js', 'server/demo/demo.js'];
const UI = ['public/voorbeelden.js', 'public/dial.js', 'public/app.js'];

function zonderModules(bron, bestand) {
  return `// ── ${bestand} ──\n` + bron
    .split('\n')
    .filter((regel) => !/^import\s.+;\s*$/.test(regel))
    .map((regel) => regel.replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/, ''))
    .join('\n');
}

const bundel = [
  ...ENGINE.map((b) => zonderModules(lees(b), b)),
  'globalThis.KOMPAS_LOKAAL = { analyseerDemo };',
  ...UI.map((b) => zonderModules(lees(b), b)),
].join('\n\n');

if (/^\s*(import|export)\s/m.test(bundel)) {
  throw new Error('De bundel bevat nog een import of export; houd imports op één regel.');
}

const html = lees('public/index.html');
const kop = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const lichaam = html
  .match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/\s*<script type="module" src="app\.js"><\/script>\s*/, '\n');

const titel = kop.match(/<title>[\s\S]*?<\/title>/)[0];
const fonts = [...kop.matchAll(/<link [^>]*fonts\.(googleapis|gstatic)[^>]*>/g)].map((m) => m[0]).join('\n');

const uitvoer = `${titel}
${fonts}
<style>
${lees('public/styles.css')}
</style>
${lichaam.trim()}
<script type="module">
${bundel}
</script>
`;

const doelmap = path.join(root, 'standalone');
fs.mkdirSync(doelmap, { recursive: true });
const doel = path.join(doelmap, 'aansprakelijkheidskompas.html');
fs.writeFileSync(doel, uitvoer);

// Syntax check of the bundled script.
const controle = path.join(doelmap, '.bundel-controle.mjs');
fs.writeFileSync(controle, bundel);
try {
  execFileSync(process.execPath, ['--check', controle], { stdio: 'inherit' });
} finally {
  fs.rmSync(controle);
}

console.log(`Klaar: ${path.relative(root, doel)} (${Math.round(uitvoer.length / 1024)} kB)`);
