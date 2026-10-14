import { useMemo, useState } from 'react';
import { estimateTokens, execute, parse, reflect, renderPrompt, toolLine, TOOLS } from '../lib/slmrouter';
import { QUERIES, RUNS } from './slmLive';

// ---------------- Live replay: the recorded benchmark runs, re-parsed in the browser ----------------

type Shape = 'keyword' | 'positional' | 'mixed';
type Row = { i: number; query: string; reply: string; ms: number; shape: Shape; template: boolean; bare: boolean; ok: boolean; output: string };

/** Raw argument segments of a one-line ACTION reply (values in this benchmark never contain commas). */
function segments(reply: string) {
  const inside = /\(([\s\S]*)\)/.exec(reply)?.[1] ?? '';
  return inside.split(',').map((s) => s.trim()).filter(Boolean);
}

function analyse(runIndex: number): Row[] {
  return RUNS[runIndex].replies.map(([reply, ms], i) => {
    const q = QUERIES[i];
    const p = parse(reply);
    const ex = p.kind === 'action' ? execute(p.tool, p.args) : null;
    const ok = !!ex?.ok && p.kind === 'action' && p.tool === q.tool && Object.entries(q.args).every(([k, v]) => ex.kwargs[k] === v);
    const segs = segments(reply);
    const kw = segs.filter((s) => /^[A-Za-z_]\w*\s*=/.test(s)).length;
    const values = segs.map((s) => s.replace(/^[A-Za-z_]\w*\s*=\s*/, ''));
    const shape: Shape = kw === segs.length ? 'keyword' : kw === 0 ? 'positional' : 'mixed';
    return {
      i, query: q.query, reply, ms, shape, ok, output: ex?.output ?? ex?.code ?? '',
      template: shape === 'keyword' && values.every((v) => /^["']/.test(v)),
      bare: values.some((v) => /^[A-Za-z]/.test(v)),
    };
  });
}

const PUBLISHED = [{ p50: 109, p95: 156 }, { p50: 130, p95: 184 }, { p50: 1378, p95: 1634 }];

// Log-scale latency axis, 70 ms to 4 s.
const W = 1200, X0 = 230, X1 = 1170, LO = Math.log(70), HI = Math.log(4000);
const xOf = (ms: number) => X0 + ((Math.log(ms) - LO) / (HI - LO)) * (X1 - X0);
const TICKS: [number, string][] = [[100, '100 ms'], [200, '200 ms'], [500, '500 ms'], [1000, '1 s'], [2000, '2 s']];

function LatencyPlot({ sel, hover, setHover, onPick }: { sel: number; hover: number | null; setHover: (i: number | null) => void; onPick: (r: number) => void }) {
  const [tip, setTip] = useState<{ r: number; i: number } | null>(null);
  const rowY = (r: number) => 34 + r * 54;
  return (
    <div className="sr-plot-wrap" data-lenis-prevent><div className="sr-plot">
      <svg viewBox={`0 0 ${W} 200`} role="img" aria-label="Latency of every recorded reply, one row per runtime, log scale">
        {TICKS.map(([ms, l]) => (
          <g key={ms}>
            <line x1={xOf(ms)} x2={xOf(ms)} y1={12} y2={170} className="sr-grid-line" />
            <text x={xOf(ms)} y={190} textAnchor="middle" className="sr-axis">{l}</text>
          </g>
        ))}
        {RUNS.map((run, r) => {
          const on = r === sel;
          return (
            <g key={run.id} className={on ? 'on' : 'off'} onClick={() => onPick(r)} style={{ cursor: 'pointer' }}>
              <text x={0} y={rowY(r) - 8} className="sr-axis sr-row-label">{run.model}</text>
              <text x={0} y={rowY(r) + 12} className="sr-axis">{run.runtime}</text>
              <line x1={xOf(PUBLISHED[r].p50)} x2={xOf(PUBLISHED[r].p50)} y1={rowY(r) - 15} y2={rowY(r) + 15} className="sr-p50" />
              {on && <text x={xOf(PUBLISHED[r].p50)} y={rowY(r) - 19} textAnchor="middle" className="sr-axis">p50 {PUBLISHED[r].p50} ms</text>}
              {run.replies.map(([, ms], i) => {
                const lit = on && (hover === i || (tip?.r === r && tip.i === i));
                return (
                  <circle
                    key={i} cx={xOf(ms)} cy={rowY(r) + ((i % 5) - 2) * 2.4} r={lit ? 7 : 4.5} className={`sr-dot ${lit ? 'lit' : ''}`}
                    onMouseEnter={() => { setTip({ r, i }); if (on) setHover(i); }} onMouseLeave={() => { setTip(null); setHover(null); }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && (
        <div className="sr-tip mono" style={{ left: `${(xOf(RUNS[tip.r].replies[tip.i][1]) / W) * 100}%`, top: `${((rowY(tip.r) - 30) / 200) * 100}%` }}>
          {QUERIES[tip.i].query} / {RUNS[tip.r].replies[tip.i][1]} ms
        </div>
      )}
    </div></div>
  );
}

export function LiveReplay() {
  const [sel, setSel] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const rows = useMemo(() => analyse(sel), [sel]);
  const count = (f: (r: Row) => boolean) => rows.filter(f).length;
  const offTemplate = count((r) => !r.template);
  const tiles = [
    { v: `${count((r) => r.ok)}/50`, l: 'right tool and arguments' },
    { v: String(offTemplate), l: 'replies off the prompt’s template form' },
    { v: String(count((r) => r.shape === 'positional')), l: 'positional, like add(2, 3)' },
    { v: String(count((r) => r.shape === 'mixed') + count((r) => r.bare)), l: 'mixed or unquoted strings' },
  ];

  return (
    <div className="sr-live">
      <div className="filters" role="group" aria-label="Recorded run">
        {RUNS.map((r, i) => (
          <button key={r.id} className="chip" aria-pressed={sel === i} onClick={() => setSel(i)}>{r.model} <sup>{r.runtime}</sup></button>
        ))}
      </div>
      <div className="sr-tiles">
        {tiles.map((t) => <div key={t.l}><b>{t.v}</b><span className="mono muted">{t.l}</span></div>)}
      </div>
      <p className="body" style={{ maxWidth: '64ch', margin: '0 0 1.6rem' }}>
        The prompt asks for <code>tool(arg="value")</code>. {offTemplate} of these 50 replies wrote something else, and none of them was JSON. Every one still parsed to the right tool with the right arguments, with zero repairs, because the parser was written for what small models actually emit.
      </p>
      <LatencyPlot sel={sel} hover={hover} setHover={setHover} onPick={setSel} />
      <p className="mono muted sr-plot-note">
        Every dot is one recorded reply, log scale. Click a row to switch runs. The slow GPU dots at the start of a run are the model loading into memory on the first calls.
      </p>
      <div className="sr-replies" data-lenis-prevent role="table" aria-label="Recorded replies">
        <div className="sr-rrow head mono muted" role="row">
          <span role="columnheader">#</span><span role="columnheader">Query</span><span role="columnheader">Model reply, verbatim</span>
          <span role="columnheader" className="hide-sm-cell">Shape</span><span role="columnheader">Tool output</span><span role="columnheader">ms</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.i} role="row" className={`sr-rrow ${hover === r.i ? 'lit' : ''}`}
            onMouseEnter={() => setHover(r.i)} onMouseLeave={() => setHover(null)}
          >
            <span className="mono muted">{String(r.i + 1).padStart(2, '0')}</span>
            <span>{r.query}</span>
            <code className="sr-verbatim">{r.reply}</code>
            <span className="mono muted hide-sm-cell">{r.template ? 'template' : r.shape}{r.bare ? ', unquoted' : ''}</span>
            <span className={r.ok ? '' : 'sr-bad'}>{r.ok ? '● ' : '○ '}{r.output}</span>
            <span className="mono">{r.ms}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Same weights, same prompt: only the chat-template wrapping differs (ARCHITECTURE.md section 6). */
export function TemplateFinding() {
  const bars: [string, number][] = [['raw prompt to /completion', 27], ['chat template, /v1/chat/completions', 50]];
  return (
    <div className="sr-template">
      {bars.map(([l, v]) => (
        <div key={l} className="sr-tbar">
          <span className="sr-code">{l}</span>
          <span className="track"><i style={{ width: `${(v / 50) * 100}%` }} /></span>
          <b>{v}/50</b>
        </div>
      ))}
    </div>
  );
}

// ---------------- Tool reflection playground ----------------

const PRESETS: [string, string][] = [
  ['Stock price', `@tool
def get_stock_price(symbol: str, exchange: str = "NSE") -> float:
    """Latest closing price for a stock symbol."""
    ...`],
  ['Optional arg', `@tool
def set_volume(level: int, device: Optional[str] = None, mute: bool = False) -> str:
    """Set the speaker volume, 0 to 100."""
    ...`],
  ['Long docstring', `@tool
def book_room(room: str, hour: int, minutes: int = 60) -> str:
    """Book a meeting room in the main building for a given hour of the day, with an optional duration."""
    ...`],
  ['A list param', `@tool
def send_email(to: list[str], subject: str, body: str) -> str:
    """Send an email to one or more people."""
    ...`],
  ['*args', `@tool
def log_event(*parts: str) -> None:
    """Write one line to the audit log."""
    ...`],
];

export function ToolForge() {
  const [src, setSrc] = useState(PRESETS[0][1]);
  const r = useMemo(() => reflect(src), [src]);
  const dup = r.ok && TOOLS.some((t) => t.name === r.tool.name);
  const tools = r.ok && !dup ? [...TOOLS, r.tool] : TOOLS;
  const prompt = renderPrompt('Add 17 and 25', tools);
  const line = r.ok ? toolLine(r.tool) : '';
  const at = line && !dup ? prompt.indexOf(line) : -1;

  return (
    <div className="sr-forge">
      <div>
        <div className="filters" style={{ margin: '0 0 0.8rem' }}>
          {PRESETS.map(([l, s]) => <button key={l} className="chip" aria-pressed={src === s} onClick={() => setSrc(s)}>{l}</button>)}
        </div>
        <label className="sr-edit">
          <span className="mono muted">Your Python function</span>
          <textarea value={src} onChange={(e) => setSrc(e.target.value)} rows={7} spellCheck={false} />
        </label>
        <div className={`sr-verdict ${r.ok && !dup ? 'ok' : 'bad'}`} aria-live="polite">
          {r.ok && !dup ? (
            <>
              <span className="mono">Registered / what the model sees</span>
              <code className="sr-verbatim">{line}</code>
              <span className="mono muted">≈ {estimateTokens(line)} tokens / budget 40 per tool</span>
            </>
          ) : (
            <>
              <span className="mono">Rejected at import time, before any query runs</span>
              <code className="sr-verbatim">{dup ? `ValueError: a tool named "${r.ok ? r.tool.name : ''}" is already registered` : (r as { error: string }).error}</code>
            </>
          )}
        </div>
      </div>
      <div>
        <pre className="code sr-prompt">
          {at < 0 ? prompt : <>{prompt.slice(0, at)}<mark>{line}</mark>{prompt.slice(at + line.length)}</>}
        </pre>
        <p className="mono muted" style={{ marginTop: '0.9rem' }}>Whole prompt ≈ {estimateTokens(prompt)} tokens with {tools.length} tools</p>
      </div>
    </div>
  );
}

// ---------------- Failure map, build log ----------------

export const CODES: [string, string, string, 'repair' | 'stop' | 'closed' | 'end'][] = [
  ['Parse', 'E_EMPTY / E_NO_PREFIX / E_BAD_SYNTAX', 'Nothing usable, JSON instead of the grammar, or a broken call', 'repair'],
  ['Arguments', 'E_UNKNOWN_TOOL / E_UNEXPECTED_ARG / E_MISSING_ARG / E_TYPE_COERCION', 'A well-formed call that does not match a registered signature', 'repair'],
  ['Agent', 'E_FINAL_NOT_ALLOWED', 'A plain answer while require_tool is on', 'repair'],
  ['Agent', 'E_RETRY_EXHAUSTED', 'Still invalid after max_repairs', 'end'],
  ['Tool', 'E_TOOL_EXCEPTION / E_TOOL_TIMEOUT', 'Your function raised, or ran past 10 s', 'stop'],
  ['Backend', 'E_BACKEND_UNREACHABLE / _TIMEOUT / _HTTP / _PROTOCOL', 'Ollama or llama.cpp is down, slow or answered in an unknown shape', 'closed'],
];

export const CODE_ACTION = {
  repair: 'One short repair prompt',
  end: 'Typed error, no more calls',
  stop: 'Never retried: tools may have side effects',
  closed: 'Never retried: fails closed with a typed error',
};

export const BUILD: { date: string; title: string; detail: string }[] = [
  { date: '6 Oct', title: 'Contracts frozen, reflection and prompt', detail: 'types.py and errors.py frozen before anyone wrote logic. Aisha Amna built @tool reflection, the registry and the prompt compiler (R1).' },
  { date: '6 Oct', title: 'Orchestration and simulation layer', detail: 'The bounded run loop, the simulated and replay backends and the release scaffolding (R4).' },
  { date: '12 Oct', title: 'Transport, parser, executor, integration', detail: 'Native Ollama and llama.cpp transport (R2), the quote-aware parser, strict coercion and allowlisted executor (R3), then the full pipeline under CI.' },
  { date: '12 Oct', title: 'Live runs recorded', detail: 'Llama 3 8B and Mistral 7B on an RTX 5070, and Mistral on llama.cpp CPU. Raw prompts on llama.cpp scored 27/50, so the backend moved to the chat template and reached 50/50.' },
  { date: '13 Oct', title: 'TinyAgent becomes SLMRouter', detail: 'Renamed for release, relicensed under Apache-2.0, architecture doc v1.2 signed off.' },
  { date: '14 Oct', title: 'v0.1.0 on PyPI', detail: 'pip install slmrouter. A clean-install smoke test in CI builds the wheel, checks it with twine and runs the CLI outside the source tree.' },
];

export const TEAM: [string, string][] = [
  ['Dhyanesh Mahendiran', 'Lead. Orchestrator, simulator, evaluation, CLI and release'],
  ['Aisha Amna', 'Reflection and prompt'],
  ['Deepak', 'Inference transport'],
  ['Dharshini', 'Parser and executor'],
];
