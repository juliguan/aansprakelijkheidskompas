import { z } from 'zod';

// Lenient schema: the model's JSON is coerced into a predictable shape so the
// frontend never has to guard against missing fields. Only structural problems
// (no status, no score on an "ok" answer) count as invalid.

const tekst = z.preprocess((v) => (typeof v === 'string' ? v.trim() : ''), z.string());
const optioneleTekst = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  z.string().nullable(),
);
const tekstLijst = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []),
  z.array(z.string()),
);

function naarGetal(v) {
  const n = typeof v === 'number' ? v : Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

const Factor = z.object({
  factor: tekst.pipe(z.string().min(1)),
  richting: z.enum(['verhogend', 'verlagend', 'neutraal']).catch('neutraal'),
  toelichting: tekst,
});

const Partij = z.object({
  partij: tekst.pipe(z.string().min(1)),
  rol: tekst,
  grondslag: tekst,
  inschatting: z.enum(['waarschijnlijk', 'mogelijk', 'onwaarschijnlijk']).catch('mogelijk'),
  toelichting: tekst,
});

const Bron = z.object({
  soort: z.enum(['uitspraak', 'wetgeving', 'beleid', 'overig']).catch('overig'),
  titel: tekst.pipe(z.string().min(1)),
  kenmerk: optioneleTekst,
  instantie: optioneleTekst,
  jaar: z.any().transform(naarGetal),
  url: optioneleTekst,
  relevantie: tekst,
});

// Drop individual malformed entries instead of rejecting the whole answer.
const lijstVan = (schema) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.filter((item) => schema.safeParse(item).success) : []),
    z.array(schema),
  );

export const Antwoord = z
  .object({
    status: z.enum(['ok', 'te_vaag', 'geen_casus']),
    score: z.any().transform((v) => {
      const n = naarGetal(v);
      return n === null ? null : Math.min(100, Math.max(0, Math.round(n)));
    }),
    samenvatting: tekst,
    onderbouwing: tekst,
    toelichting_status: tekst,
    factoren: lijstVan(Factor),
    partijen: lijstVan(Partij),
    bronnen: lijstVan(Bron),
    onzekerheden: tekstLijst,
    vervolgvragen: tekstLijst,
  })
  .superRefine((a, ctx) => {
    if (a.status === 'ok' && a.score === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'status "ok" zonder geldige score' });
    }
    if (a.status === 'ok' && !a.samenvatting && !a.onderbouwing) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'status "ok" zonder samenvatting of onderbouwing' });
    }
  });

// Pull the JSON object out of the model's final text: prefer the last ```json
// fence, fall back to the outermost braces.
export function haalJsonUitTekst(tekstInvoer) {
  const fences = [...tekstInvoer.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const kandidaat = fences.length
    ? fences[fences.length - 1][1]
    : tekstInvoer.slice(tekstInvoer.indexOf('{'), tekstInvoer.lastIndexOf('}') + 1);
  if (!kandidaat || !kandidaat.trim()) throw new Error('geen JSON-object gevonden in het antwoord');
  return JSON.parse(kandidaat);
}

export function valideerAntwoord(ruw) {
  const resultaat = Antwoord.safeParse(ruw);
  if (!resultaat.success) {
    const melding = resultaat.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`antwoord voldoet niet aan het schema: ${melding}`);
  }
  return resultaat.data;
}
