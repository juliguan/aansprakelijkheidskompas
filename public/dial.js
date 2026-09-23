// Thermostat-style dial. Score 0 points left (-90deg), 100 points right (+90deg).

const CX = 200;
const CY = 208;
const SVG_NS = 'http://www.w3.org/2000/svg';
const DUUR_MS = 750; // keep in sync with the CSS transition on .schijf__wijzer

const schijf = document.getElementById('schijf');
const svgTitel = document.getElementById('schijf-label');
const wijzer = document.getElementById('wijzer');
const getal = document.getElementById('score-getal');
const kwalificatie = document.getElementById('kwalificatie');

const verminderdeBeweging = window.matchMedia('(prefers-reduced-motion: reduce)');
let telFrame = null;
let huidigGetal = 0;

function punt(score, straal) {
  const hoek = Math.PI - (score / 100) * Math.PI;
  return [CX + straal * Math.cos(hoek), CY - straal * Math.sin(hoek)];
}

function tekenStreepjes() {
  const groep = document.getElementById('streepjes');
  for (let v = 0; v <= 100; v += 5) {
    const groot = v % 25 === 0;
    const [x1, y1] = punt(v, 142);
    const [x2, y2] = punt(v, groot ? 128 : 134);
    const lijn = document.createElementNS(SVG_NS, 'line');
    lijn.setAttribute('x1', x1.toFixed(1));
    lijn.setAttribute('y1', y1.toFixed(1));
    lijn.setAttribute('x2', x2.toFixed(1));
    lijn.setAttribute('y2', y2.toFixed(1));
    lijn.setAttribute('class', groot ? 'groot' : 'klein');
    groep.append(lijn);
    if (groot) {
      const [tx, ty] = punt(v, 112);
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('x', tx.toFixed(1));
      label.setAttribute('y', ty.toFixed(1));
      label.textContent = String(v);
      groep.append(label);
    }
  }
}

function kleurVoorScore(score) {
  if (score <= 20) return 'var(--schaal-groen)';
  if (score <= 40) return 'var(--schaal-geel)';
  if (score <= 60) return 'var(--schaal-oranje)';
  return 'var(--schaal-rood)';
}

function draai(score) {
  wijzer.style.transform = `rotate(${(score - 50) * 1.8}deg)`;
}

// Count the number up in step with the needle swing.
function telNaar(doel) {
  cancelAnimationFrame(telFrame);
  if (verminderdeBeweging.matches) {
    getal.textContent = String(doel);
    huidigGetal = doel;
    return;
  }
  const van = huidigGetal;
  const start = performance.now();
  const stap = (nu) => {
    const t = Math.min(1, (nu - start) / DUUR_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    huidigGetal = Math.round(van + (doel - van) * eased);
    getal.textContent = String(huidigGetal);
    if (t < 1) telFrame = requestAnimationFrame(stap);
  };
  telFrame = requestAnimationFrame(stap);
}

export function toonScore(score, tekst) {
  schijf.dataset.toestand = 'resultaat';
  draai(score);
  telNaar(score);
  kwalificatie.textContent = tekst;
  kwalificatie.style.setProperty('--kwalificatie-kleur', kleurVoorScore(score));
  svgTitel.textContent = `Aansprakelijkheidsmeter: ${score} van 100, ${tekst.toLowerCase()}`;
}

// No verdict (empty, busy, or too vague): the needle rests at zero, greyed out.
// The reset is instant so the only motion is the swing to a new result.
export function toonGeenScore(toestand, tekst) {
  cancelAnimationFrame(telFrame);
  schijf.dataset.toestand = toestand;
  wijzer.style.transition = 'none';
  draai(0);
  wijzer.getBoundingClientRect();
  wijzer.style.transition = '';
  huidigGetal = 0;
  getal.textContent = '–';
  kwalificatie.textContent = tekst;
  kwalificatie.style.removeProperty('--kwalificatie-kleur');
  svgTitel.textContent = `Aansprakelijkheidsmeter: ${tekst.toLowerCase()}`;
}

tekenStreepjes();
