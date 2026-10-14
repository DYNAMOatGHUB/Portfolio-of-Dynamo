// In-browser model of the PDF Knowledge retrieval path: chunk -> BM25 + dense -> hybrid -> gate.
// chunkText() is a port of chunker.py; the dense side is a lightweight stand-in for BGE embeddings.

export type Page = { page: number; text: string };
export type Chunk = { id: number; page: number; text: string };
export type Hit = { chunk: Chunk; bm25: number; bm25n: number; dense: number; hybrid: number };

/** Port of chunker.py chunk_text: sentence-packed chunks with a word overlap; drops chunks under 5 words. */
export function chunkText(text: string, maxTokens = 150, overlap = 30): string[] {
  text = text.replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let cur: string[] = [];
  let len = 0;
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    const words = s.split(' ');
    if (words.length > maxTokens) {
      if (cur.length) { chunks.push(cur.join(' ')); cur = []; len = 0; }
      for (let i = 0; i < words.length; i += maxTokens - overlap) {
        const part = words.slice(i, i + maxTokens).join(' ').trim();
        if (part) chunks.push(part);
      }
    } else if (len + words.length > maxTokens) {
      if (cur.length) chunks.push(cur.join(' '));
      if (overlap > 0 && cur.length) {
        const ov = cur.join(' ').split(' ').slice(-overlap);
        cur = [...ov, s];
        len = ov.length + words.length;
      } else {
        cur = [s];
        len = words.length;
      }
    } else {
      cur.push(s);
      len += words.length;
    }
  }
  if (cur.length) chunks.push(cur.join(' '));
  return chunks.map((c) => c.trim()).filter((c) => c.split(' ').length >= 5);
}

export function chunkPages(pages: Page[], maxTokens: number, overlap: number): Chunk[] {
  let id = 0;
  return pages.flatMap((p) => chunkText(p.text, maxTokens, overlap).map((text) => ({ id: id++, page: p.page, text })));
}

// STOP_WORDS from rag_engine.py SimpleRAGEngine, plus a few question fillers.
export const STOP = new Set(
  ('what is the a an of in to for how why when where who which are was were be been being have has had do does did will would ' +
    'could should may might must shall can need this that these those it its and or but if then else so as by with from on at ' +
    'about into through during before after above below between under over out up down off i me my we our you your he she they ' +
    'much many happen happens get there any').split(' '),
);

const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, '').replace(/(.)\1$/, '$1') || w;
export const terms = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9₹%]+/g) ?? []).filter((w) => !STOP.has(w) && w.length > 1).map(stem);

// Concept groups play the role an embedding model would: words that mean the same thing land close together.
const GROUPS = [
  'laptop phone mobile device electronic gadget calculator smartwatch earphone bluetooth',
  'exam examination test hall invigilator answer paper',
  'late overdue delay due deadline',
  'fee fine charge penalty pay cost rupee ₹ amount',
  'book library borrow return loan issue librarian',
  'attendance present absent class lecture shortage',
  'hostel room warden dorm resident curfew gate night',
  'food mess canteen meal lunch dinner breakfast eat',
  'scholarship financial aid merit waiver',
  'time hour pm am open close timing schedule',
  'leave medical sick certificate',
  'bring carry allow permit prohibit',
].map((g, i) => ({ id: `#c${i}`, words: new Set(g.split(' ').map(stem)) }));

function concepts(ts: string[]) {
  const out: string[] = [];
  for (const t of ts) for (const g of GROUPS) if (g.words.has(t)) out.push(g.id);
  return out;
}

/** Share of query terms the chunk covers, either literally or through a word with the same meaning. */
function coverage(q: string[], doc: Set<string>) {
  let hit = 0;
  for (const t of q) if (doc.has(t) || concepts([t]).some((c) => doc.has(c))) hit++;
  return hit / Math.max(q.length, 1);
}

function trigrams(s: string) {
  const m = new Map<string, number>();
  for (const w of terms(s)) {
    const p = ` ${w} `;
    for (let i = 0; i < p.length - 2; i++) m.set(p.slice(i, i + 3), (m.get(p.slice(i, i + 3)) ?? 0) + 1);
  }
  return m;
}

function bag(xs: string[]) {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const w = b.get(k); if (w) dot += v * w; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Okapi BM25 over the chunk set. */
function bm25(query: string[], docs: string[][], k1 = 1.5, b = 0.75) {
  const N = docs.length;
  const avg = docs.reduce((a, d) => a + d.length, 0) / Math.max(N, 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  return docs.map((d) => {
    const tf = bag(d);
    let s = 0;
    for (const q of new Set(query)) {
      const f = tf.get(q);
      if (!f) continue;
      const n = df.get(q)!;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    return s;
  });
}

/**
 * Score every chunk. BM25 is squashed to 0..1 with s / (s + 3); the dense score is already 0..1.
 * The relevance gate (see PdfKnowledge) looks at the dense score of the top hit, like a cosine floor.
 */
export function search(query: string, chunks: Chunk[], alpha: number): Hit[] {
  const q = terms(query);
  if (!q.length || !chunks.length) return [];
  const docTerms = chunks.map((c) => terms(c.text));
  const bm = bm25(q, docTerms);
  const qc = bag([...q, ...concepts(q)]);
  const qt = trigrams(query);
  return chunks
    .map((chunk, i) => {
      const dc = [...docTerms[i], ...concepts(docTerms[i])];
      const dense = 0.6 * coverage(q, new Set(dc)) + 0.25 * cosine(qc, bag(dc)) + 0.15 * cosine(qt, trigrams(chunk.text));
      const bm25n = bm[i] / (bm[i] + 3);
      return { chunk, bm25: bm[i], bm25n, dense, hybrid: alpha * bm25n + (1 - alpha) * dense };
    })
    .sort((a, b) => b.hybrid - a.hybrid);
}

/** Extractive answer in the spirit of SimpleRAGEngine: best sentence across the top chunks, by keyword + concept overlap. */
export function extract(query: string, hits: Hit[]) {
  const q = terms(query);
  const qset = new Set([...q, ...concepts(q)]);
  let best = { text: '', page: 0, score: -1 };
  hits.forEach((h, rank) => {
    for (const s of h.chunk.text.split(/(?<=[.!?])\s+/)) {
      const st = terms(s);
      const sset = new Set([...st, ...concepts(st)]);
      let overlap = 0;
      for (const t of qset) if (sset.has(t)) overlap++;
      const score = overlap / Math.max(qset.size, 1) + h.hybrid * 0.5 - rank * 0.05;
      if (score > best.score) best = { text: s, page: h.chunk.page, score };
    }
  });
  return best;
}

export const REFUSAL = 'The document does not contain this information.';
