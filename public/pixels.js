// Pixel-art portraits for the easter egg. Each sprite is a grid of palette
// keys ('.' is transparent), rendered as crisp SVG rects.

const PIXEL_NS = 'http://www.w3.org/2000/svg';
const PIXEL = 6;

const PARMIS = {
  naam: 'Parmis',
  palet: {
    K: '#2a1d17', H: '#2b1b14', h: '#4a3226', S: '#e6c7a0', R: '#eba194',
    E: '#1f140f', M: '#9c4a3c', D: '#b8456a', d: '#933556',
  },
  rijen: [
    '.....KKKKKK.....',
    '...KKHHHHHHKK...',
    '..KHHHHHHHHHHK..',
    '.KHHHhHHHHHHHHK.',
    '.KHHSSSSSSSSHHK.',
    '.KHSSSSSSSSSSHK.',
    '.KHSSESSSSESSHK.',
    '.KHSSESSSSESSHK.',
    '.KHSRSSSSSSRSHK.',
    '.KHHSSSMMSSSHHK.',
    '.KHHSSSSSSSSHHK.',
    '.KHHKKSSSSKKHHK.',
    '.KHHKDDDDDDKHHK.',
    '.KHKDDDDDDDDKHK.',
    '..KSDDDDDDDDSK..',
    '..KSKDDDDDDKSK..',
    '...KKDDDDDDKK...',
    '...KDDDDDDDDK...',
    '..KDDdDDDDdDDK..',
    '..KKKKKKKKKKKK..',
    '....KSK..KSK....',
    '....KKK..KKK....',
  ],
};

const JULIAN = {
  naam: 'Rechter Julian',
  palet: {
    K: '#2a1d17', H: '#7a4a24', h: '#a06a38', S: '#f5d6c0', F: '#cf8a62',
    E: '#3f7fd9', M: '#b8574a', T: '#1f1f27', t: '#3a3a46', B: '#ffffff',
    N: '#3a3a44', G: '#8a5a2e',
  },
  rijen: [
    '....KKKKKKKK......',
    '...KhHhHHhHhK.....',
    '..KHhHHhHHhHHK....',
    '.KHHhHHHhHHHhHK...',
    '.KHhSSSSSSSShHK...',
    '.KHSSSSSSSSSSHK...',
    '.KHSSESSSSESSHK...',
    '.KHSSESSSSESSHK...',
    '.KSSFSFSSFSFSSK...',
    '.KSSSSSMMSSSSSK...',
    '..KSSSSSSSSSSK....',
    '...KKKSSSSKKK.GGGG',
    '..KTTTBBBBTTTKGGGG',
    '.KTTTTTBBTTTTTKG..',
    '.KTtTTTBBTTTtTKG..',
    '.KSKTTTTTTTTKSKG..',
    '..KKTTTTTTTTKK....',
    '...KTTTTTTTTK.....',
    '...KTtTTTTtTK.....',
    '...KKKKKKKKKK.....',
    '....KNK..KNK......',
    '....KKK..KKK......',
  ],
};

const HART_SPRITE = {
  palet: { R: '#d6365c', r: '#f07d97' },
  rijen: [
    '.RR.RR.',
    'RrRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ],
};

function tekenSprite({ palet, rijen }, schaal = PIXEL) {
  const breedte = Math.max(...rijen.map((r) => r.length));
  const svg = document.createElementNS(PIXEL_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${breedte} ${rijen.length}`);
  svg.setAttribute('width', String(breedte * schaal));
  svg.setAttribute('height', String(rijen.length * schaal));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  rijen.forEach((rij, y) => {
    [...rij].forEach((sleutel, x) => {
      const kleur = palet[sleutel];
      if (!kleur) return;
      const rect = document.createElementNS(PIXEL_NS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', '1');
      rect.setAttribute('fill', kleur);
      svg.append(rect);
    });
  });
  return svg;
}

function figuur(persoon) {
  const wrap = document.createElement('div');
  wrap.className = 'pixel-duo__persoon';
  const naam = document.createElement('span');
  naam.className = 'pixel-duo__naam';
  naam.textContent = persoon.naam;
  wrap.append(naam, tekenSprite(persoon));
  return wrap;
}

export function tekenPixelDuo() {
  const podium = document.createElement('div');
  podium.className = 'pixel-duo';
  podium.setAttribute('role', 'img');
  podium.setAttribute('aria-label', 'Pixelpoppetjes van Parmis en rechter Julian met een hartje ertussen');
  const hart = document.createElement('div');
  hart.className = 'pixel-duo__hart';
  hart.append(tekenSprite(HART_SPRITE, 5));
  podium.append(figuur(PARMIS), hart, figuur(JULIAN));
  return podium;
}
