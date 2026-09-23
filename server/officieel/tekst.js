// Small helpers to turn the XML of rechtspraak.nl and wetten.overheid.nl into
// readable plain text. No XML dependency: the structures are simple enough.

const ENTITEITEN = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeer(tekst) {
  return tekst.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (heel, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : heel;
    }
    return ENTITEITEN[code.toLowerCase()] ?? heel;
  });
}

export function naarTekst(xml) {
  return decodeer(
    xml
      .replace(/<meta-data>[\s\S]*?<\/meta-data>/g, '')
      .replace(/<\/(para|al|lid|title|li|lidnr|kop)>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function kortIn(tekst, max) {
  return tekst.length > max ? `${tekst.slice(0, max - 1).trimEnd()}…` : tekst;
}
