import { Fragment, useMemo, useState } from 'react';
import ProductShell, { SectionHead } from '../components/ProductShell';
import { flagshipBySlug } from '../content';
import { Split } from '../lib/motion';
import { Page, REFUSAL, chunkPages, extract, search, terms } from '../lib/retrieval';
import { SAMPLE, SAMPLE_NAME, SUGGESTED } from './pdfSample';

function Highlight({ text, q }: { text: string; q: Set<string> }) {
  return (
    <>
      {text.split(/(\s+)/).map((w, i) => {
        const t = terms(w)[0];
        return t && q.has(t) ? <mark key={i}>{w}</mark> : <Fragment key={i}>{w}</Fragment>;
      })}
    </>
  );
}

const Bar = ({ v, label, strong }: { v: number; label: string; strong?: boolean }) => (
  <span className={`pk-bar ${strong ? 'strong' : ''}`}>
    <span className="mono muted">{label}</span>
    <span className="track"><i style={{ transform: `scaleX(${Math.min(v, 1)})` }} /></span>
    <span className="mono">{v.toFixed(2)}</span>
  </span>
);

function toPages(raw: string): Page[] {
  return raw.split(/\n\s*\n/).map((t, i) => ({ page: i + 1, text: t.trim() })).filter((p) => p.text);
}

function Lab() {
  const [query, setQuery] = useState(SUGGESTED[0]);
  const [alpha, setAlpha] = useState(0.5);
  const [gate, setGate] = useState(0.4);
  const [size, setSize] = useState(40);
  const [overlap, setOverlap] = useState(8);
  const [own, setOwn] = useState<string | null>(null);

  const pages = useMemo(() => (own === null ? SAMPLE : toPages(own)), [own]);
  const chunks = useMemo(() => chunkPages(pages, size, Math.min(overlap, size - 1)), [pages, size, overlap]);
  const hits = useMemo(() => search(query, chunks, alpha), [query, chunks, alpha]);
  const top = hits[0];
  const refused = !top || top.dense < gate;
  const answer = useMemo(() => (refused ? null : extract(query, hits.slice(0, 3))), [refused, query, hits]);
  const qset = useMemo(() => new Set(terms(query)), [query]);

  return (
    <div className="pk-grid">
      <div className="panel pk-controls">
        <div>
          <span className="mono muted" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span>{own === null ? SAMPLE_NAME : 'your-text.pdf'}</span>
            <span>{pages.length} pages / {chunks.length} chunks</span>
          </span>
          <div className="filters" style={{ margin: '0.8rem 0 0' }}>
            <button className="chip" aria-pressed={own === null} onClick={() => setOwn(null)}>Sample handbook</button>
            <button className="chip" aria-pressed={own !== null} onClick={() => setOwn(own ?? SAMPLE.map((p) => p.text).join('\n\n'))}>Paste your own</button>
          </div>
          {own !== null && (
            <textarea
              className="pk-text" value={own} onChange={(e) => setOwn(e.target.value)} rows={7}
              aria-label="Document text. Separate pages with a blank line." spellCheck={false}
            />
          )}
        </div>
        <label>
          <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Chunk size</span><span>{size} words</span></span>
          <input className="range" type="range" min={15} max={80} value={size} onChange={(e) => setSize(+e.target.value)} />
        </label>
        <label>
          <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Overlap</span><span>{overlap} words</span></span>
          <input className="range" type="range" min={0} max={20} value={overlap} onChange={(e) => setOverlap(+e.target.value)} />
        </label>
        <label>
          <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Meaning &larr; blend &rarr; keywords</span><span>&alpha; {alpha.toFixed(2)}</span></span>
          <input className="range" type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} />
        </label>
        <label>
          <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}><span>Relevance gate</span><span>dense &ge; {gate.toFixed(2)}</span></span>
          <input className="range" type="range" min={0.1} max={0.8} step={0.05} value={gate} onChange={(e) => setGate(+e.target.value)} />
        </label>
        <p className="mono muted" style={{ lineHeight: 1.6 }}>
          The chunker and BM25 are the real algorithms. The dense score is a small in-browser stand-in, using meaning groups and character trigrams, for the BGE embeddings the production app keeps in ChromaDB.
        </p>
      </div>

      <div className="pk-main">
        <label className="play-input">
          <span className="muted">ask &gt;</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} spellCheck={false} aria-label="Question" placeholder="ask the document anything" />
        </label>
        <div className="filters" style={{ margin: '0.8rem 0 1.4rem' }}>
          {SUGGESTED.map((s) => (
            <button key={s} className="chip" aria-pressed={query === s} onClick={() => setQuery(s)}>{s}</button>
          ))}
        </div>

        <div className={`pk-answer ${refused ? 'refused' : ''}`} aria-live="polite">
          <span className="mono">{refused ? 'Refused by the relevance gate' : `Answer / grounded in top ${Math.min(3, hits.length)} chunks`}</span>
          <p>{refused ? REFUSAL : answer!.text}</p>
          {!refused && <span className="mono pk-cite">cite p. {answer!.page}</span>}
          {refused && top && <span className="mono muted">best match p. {top.chunk.page}, dense {top.dense.toFixed(2)} &lt; {gate.toFixed(2)}</span>}
        </div>

        <ol className="pk-hits">
          {hits.slice(0, 5).map((h, i) => (
            <li key={h.chunk.id} className={i < 3 && !refused ? 'ctx' : ''}>
              <div className="mono pk-hit-head">
                <span>#{i + 1} / p. {h.chunk.page} / chunk {h.chunk.id}</span>
                <span className={i < 3 && !refused ? 'pk-tag' : 'muted'}>{i < 3 && !refused ? 'sent as context' : 'not used'}</span>
              </div>
              <p className="pk-chunk"><Highlight text={h.chunk.text} q={qset} /></p>
              <div className="pk-bars">
                <Bar v={h.bm25n} label="bm25" />
                <Bar v={h.dense} label="dense" />
                <Bar v={h.hybrid} label="hybrid" strong />
              </div>
            </li>
          ))}
          {!hits.length && <li className="mono muted">Type a question with at least one meaningful word.</li>}
        </ol>
      </div>
    </div>
  );
}

const PIPE = [
  { name: 'Parse', items: ['PyMuPDF text layer', 'Tesseract OCR fallback', 'per-page metadata'] },
  { name: 'Chunk', items: ['sentence-aware', '150 words', '30-word overlap', 'drop < 5 words'] },
  { name: 'Embed', items: ['BGE-small-en-v1.5', 'OpenVINO on CPU', 'idle models auto-unload'] },
  { name: 'Store', items: ['ChromaDB, persistent', 'page / source / hash'] },
  { name: 'Retrieve', items: ['BM25 keywords', 'cosine vectors', 'top 15, adaptive cut'] },
  { name: 'Answer', items: ['top 3 chunks', 'grounded prompt', 'refuse if absent'] },
];

const API = [
  ['POST', '/upload_pdf', 'Parse, chunk, embed and index a PDF'],
  ['POST', '/search/semantic', 'Hybrid search plus grounded answer'],
  ['GET', '/search/semantic/stream', 'Same search, streamed over SSE'],
  ['GET', '/documents', 'List indexed PDFs'],
  ['DELETE', '/documents/{filename}', 'Drop a PDF from the index'],
  ['GET', '/engine', 'Model and device status'],
];

const FEATURES = [
  ['Scans are not a dead end', 'If a page has no text layer, it goes through Tesseract before chunking, so photographed notes and old scans are searchable too.'],
  ['Two kinds of match', 'BM25 catches exact codes, names and numbers that embeddings blur; vectors catch "laptop" when the PDF says "electronic devices".'],
  ['Adaptive cut-off', 'Results further than 3x the best match distance (never tighter than 1.5) are dropped before re-ranking, so weak tails never reach the prompt.'],
  ['Says when it does not know', 'The prompt tells the model to answer only from the supplied pages, and to say the document does not contain it otherwise.'],
  ['Runs on a CPU', 'BGE through OpenVINO is quick enough on an ordinary Intel laptop, and idle models are unloaded to give the RAM back.'],
  ['Many PDFs, one index', 'Every chunk carries its file and page, so a search across a whole folder still cites exactly where the answer lives.'],
];

export default function PdfKnowledge() {
  const f = flagshipBySlug('pdf-knowledge');
  return (
    <ProductShell f={f} links={[{ label: 'Try it on Hugging Face', href: f.live! }, { label: 'Source files', href: f.repo }]}>
      <section className="section wrap">
        <SectionHead n="01" label="Retrieval lab" right="Runs in your browser" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 4rem)', alignItems: 'end' }}>
          <Split text="Slide between keywords and meaning." className="display h-md" />
          <p className="body" data-reveal>
            Ask the handbook about a laptop: the page only says &ldquo;electronic devices&rdquo;, so pure keyword search misses it and the gate refuses. Ask about the wifi password and it should refuse at every setting, because that page does not exist.
          </p>
        </div>
        <div data-reveal><Lab /></div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="02" label="Pipeline" right="Upload to answer" />
        <div className="split2">
          <div>
            <Split text="Nothing leaves the machine." className="display h-md" />
            <p className="body" data-reveal style={{ marginTop: '1.5rem' }}>
              Parsing, embedding, storage and search all happen on the box that runs the container. There are no API keys and no third-party calls, so the tool is safe to point at internal documents.
            </p>
          </div>
          <div className="layers" data-reveal>
            {PIPE.map((l) => (
              <div key={l.name} className="layer">
                <span className="mono">{l.name}</span>
                <span className="chips">{l.items.map((i) => <span key={i}>{i}</span>)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="03" label="Grounding" right="rag_engine.py" />
        <div className="split2">
          <Split text="The refusal is part of the prompt." className="display h-md" />
          <pre className="code" data-reveal>
            <span className="c"># top 3 retrieved chunks become the only context</span>{'\n'}context = <span className="s">"\n\n"</span>.join(context_chunks[:<span className="s">3</span>]){'\n\n'}prompt = <span className="s">f"""Based on the following document content,{'\n'}answer the question accurately and concisely.{'\n'}If the answer is not in the provided content, say{'\n'}"The document does not contain this information."{'\n\n'}Document Content:{'\n'}{'{context}'}{'\n\n'}Question: {'{query}'}{'\n\n'}Answer:"""</span>
          </pre>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="04" label="API surface" right="FastAPI" />
        <table className="table" data-reveal>
          <thead><tr><th>Method</th><th>Endpoint</th><th className="hide-sm-cell">Purpose</th></tr></thead>
          <tbody>
            {API.map(([m, p, d]) => (
              <tr key={p}><td className="mono" style={{ color: 'var(--page-accent)' }}>{m}</td><td className="mono">{p}</td><td className="muted hide-sm-cell">{d}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="feature-grid" style={{ marginTop: 'clamp(4rem, 8vw, 6rem)' }}>
          {FEATURES.map(([t, d], i) => (
            <div key={t} className="feature" data-reveal>
              <span className="num">0{i + 1}</span>
              <h3>{t}</h3>
              <p className="body">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </ProductShell>
  );
}
