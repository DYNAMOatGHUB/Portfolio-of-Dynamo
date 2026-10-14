import { useMemo, useState } from 'react';
import ProductShell, { SectionHead } from '../components/ProductShell';
import { flagshipBySlug } from '../content';
import { Split } from '../lib/motion';
import { Call, estimateTokens, renderPrompt, Result, run } from '../lib/slmrouter';
import { BUILD, CODE_ACTION, CODES, LiveReplay, TEAM, TemplateFinding, ToolForge } from './SlmRouterParts';

type Scenario = { query: string; tool?: string; args: [string, string | number][]; reply: string };

const action = (tool: string, args: [string, string | number][]) => `ACTION: ${tool}(${args.map(([k, v]) => `${k}="${v}"`).join(', ')})`;
const sc = (query: string, tool: string, args: [string, string | number][]): Scenario => ({ query, tool, args, reply: action(tool, args) });

// Queries and canonical replies in the shape of eval/scenarios.py; the final answer matches the README.
const SCENARIOS: Scenario[] = [
  sc('Add 17 and 25', 'add', [['a', 17], ['b', 25]]),
  sc("What's the weather in Pune?", 'get_weather', [['city', 'Pune'], ['unit', 'c']]),
  sc('Set an alarm for 7:30 called gym', 'set_alarm', [['hour', 7], ['minute', 30], ['label', 'gym']]),
  sc('Search Python, limit 3', 'search', [['q', 'Python'], ['limit', 3]]),
  { query: 'Who wrote Hamlet?', args: [], reply: 'FINAL: William Shakespeare' },
];

type Verdict = 'recover' | 'repair' | 'reject';
type Fault = { id: string; label: string; verdict: Verdict; make: (s: Scenario) => string | null };

const INT_ARGS = new Set(['a', 'b', 'limit', 'hour', 'minute']);
const withArgs = (f: (s: Scenario) => string) => (s: Scenario) => (s.tool ? f(s) : null);

// The 16 fault classes from eval/faults.py, applied to the selected scenario's clean reply.
const FAULTS: Fault[] = [
  { id: 'F01', label: 'Markdown fence', verdict: 'recover', make: (s) => '```\n' + s.reply + '\n```' },
  { id: 'F02', label: 'Prose before', verdict: 'recover', make: (s) => 'Here is the answer:\n' + s.reply },
  { id: 'F03', label: 'Prose after', verdict: 'recover', make: (s) => s.reply + '\nThat is all.' },
  { id: 'F04', label: 'Lowercase prefix', verdict: 'recover', make: (s) => s.reply.replace(/^(ACTION|FINAL):/, (m) => m.toLowerCase()) },
  { id: 'F05', label: 'Single quotes', verdict: 'recover', make: withArgs((s) => s.reply.replace(/"/g, "'")) },
  { id: 'F06', label: 'Unquoted numbers', verdict: 'recover', make: withArgs((s) => s.reply.replace(/="([+-]?\d+)"/g, '=$1')) },
  { id: 'F07', label: 'Positional args', verdict: 'recover', make: withArgs((s) => `ACTION: ${s.tool}(${s.args.map(([, v]) => `"${v}"`).join(', ')})`) },
  { id: 'F08', label: 'Trailing comma', verdict: 'recover', make: withArgs((s) => s.reply.slice(0, -1) + ',)') },
  { id: 'F09', label: 'JSON instead', verdict: 'repair', make: withArgs((s) => `{"tool": "${s.tool}", "args": {${s.args.map(([k, v]) => `"${k}": ${typeof v === 'number' ? v : `"${v}"`}`).join(', ')}}}`) },
  { id: 'F10', label: 'Missing ")"', verdict: 'repair', make: withArgs((s) => s.reply.slice(0, -1)) },
  { id: 'F11', label: 'Invented tool', verdict: 'repair', make: withArgs((s) => s.reply.replace(`${s.tool}(`, `${s.tool}_numbers(`)) },
  { id: 'F12', label: 'Wrong arg name', verdict: 'repair', make: withArgs((s) => s.reply.replace(`${s.args[0][0]}=`, 'x=')) },
  { id: 'F13', label: 'Missing arg', verdict: 'repair', make: withArgs((s) => action(s.tool!, s.args.slice(1))) },
  { id: 'F14', label: '"two" for an int', verdict: 'repair', make: withArgs((s) => {
    const k = s.args.find(([n]) => INT_ARGS.has(n));
    return k ? s.reply.replace(`${k[0]}="${k[1]}"`, `${k[0]}="two"`) : s.reply;
  }) },
  { id: 'F15', label: 'Empty reply', verdict: 'repair', make: () => '' },
  { id: 'F16', label: 'Tool that raises', verdict: 'reject', make: () => 'ACTION: boom()' },
];

const VERDICT_NOTE: Record<Verdict, string> = {
  recover: 'parsed on the first call',
  repair: 'one short repair prompt',
  reject: 'fails closed, never retried',
};

function CallCard({ c, last, repeat }: { c: Call; last: boolean; repeat: boolean; key?: number }) {
  const p = c.parsed;
  const parseNote =
    p.kind === 'action' ? `ACTION ${p.tool}(${p.args.map(([k, v]) => `${k}="${v}"`).join(', ')})${p.warnings.length ? ', warning: multiple_actions' : ''}`
      : p.kind === 'final' ? `FINAL "${p.text}"`
        : p.code;
  const steps = [{ label: 'parse', ok: p.kind !== 'fail', note: parseNote }, ...(c.exec?.steps ?? [])];
  if (p.kind === 'final') steps.push({ label: 'route', ok: !c.code, note: c.code ? 'require_tool is on, a tool call is required' : 'no tool fits, answer comes from the model' });
  return (
    <li className="sr-call">
      <div className="mono sr-call-head">
        <span>Call {c.n}{c.n > 1 ? ` / repair${repeat ? ', model repeats itself' : ''}` : ''}</span>
        <span className="muted">prompt ≈ {estimateTokens(c.prompt)} tokens</span>
      </div>
      <pre className="sr-reply">{c.reply || <span className="muted">(empty reply)</span>}</pre>
      <ol className="sr-steps">
        {steps.map((s) => (
          <li key={s.label} className={s.ok ? 'ok' : 'bad'}>
            <span className="mono">{s.label}</span>
            <span className="sr-note">{s.note}</span>
          </li>
        ))}
      </ol>
      {c.code && (
        <p className="sr-code sr-next">
          {last ? `${c.code}, and no repairs left` : `${c.code}, so the original prompt is resent with one "Invalid:" line`}
        </p>
      )}
    </li>
  );
}

/** The state-machine path one query took (ARCHITECTURE.md section 3.5). */
function PathStrip({ r }: { r: Result }) {
  const steps: { l: string; t: 'ok' | 'bad' | 'end' }[] = [];
  r.calls.forEach((c, i) => {
    steps.push({ l: i ? 'repair' : 'prompt', t: 'ok' }, { l: 'infer', t: 'ok' });
    steps.push({ l: 'parse', t: c.parsed.kind === 'fail' ? 'bad' : 'ok' });
    if (c.exec) steps.push({ l: 'execute', t: c.exec.ok ? 'ok' : 'bad' });
    if (c.parsed.kind === 'final') steps.push({ l: 'final', t: c.code ? 'bad' : 'ok' });
  });
  steps.push({ l: r.status === 'error' ? r.errorCode ?? 'error' : r.status, t: 'end' });
  return (
    <ol className="sr-path" aria-label="Path through the state machine">
      {steps.map((s, i) => <li key={i} className={s.t}>{s.l}</li>)}
    </ol>
  );
}

function Lab() {
  const [si, setSi] = useState(0);
  const [fault, setFault] = useState<string | null>('F01');
  const [reply, setReply] = useState(() => FAULTS[0].make(SCENARIOS[0])!);
  const [maxRepairs, setMaxRepairs] = useState<0 | 1 | 2>(1);
  const [requireTool, setRequireTool] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [view, setView] = useState<'trace' | 'prompt'>('trace');
  const s = SCENARIOS[si];

  const pick = (nextSi: number, nextFault: string | null) => {
    const ns = SCENARIOS[nextSi];
    const f = FAULTS.find((x) => x.id === nextFault);
    const made = f?.make(ns);
    const usable = f && made != null && made !== ns.reply;
    setSi(nextSi);
    setFault(usable ? f.id : null);
    setReply(usable ? made! : ns.reply);
  };

  const result = useMemo(() => run(s.query, repeat ? [reply] : [reply, s.reply], maxRepairs, requireTool), [s, reply, maxRepairs, requireTool, repeat]);
  const lastCall = result.calls[result.calls.length - 1];
  const original = renderPrompt(s.query);

  return (
    <div className="sr-grid">
      <div className="panel sr-controls">
        <div>
          <span className="mono muted">Query</span>
          <div className="filters" style={{ margin: '0.7rem 0 0' }}>
            {SCENARIOS.map((x, i) => (
              <button key={x.query} className="chip" aria-pressed={si === i} onClick={() => pick(i, fault)}>{x.query}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="mono" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
            <span className="muted">Inject a fault</span>
            <button className="mono sr-reset" onClick={() => pick(si, null)}>clean reply</button>
          </span>
          <div className="sr-faults">
            {FAULTS.map((f) => {
              const made = f.make(s);
              const off = made == null || made === s.reply;
              return (
                <button
                  key={f.id} className={`sr-fault ${f.verdict}`} aria-pressed={fault === f.id} disabled={off}
                  onClick={() => pick(si, f.id)} title={`${f.id}: ${VERDICT_NOTE[f.verdict]}`}
                >
                  <span className="mono">{f.id}</span>{f.label}
                </button>
              );
            })}
          </div>
          <p className="mono muted sr-legend">
            <span><i className="recover" /> recover</span><span><i className="repair" /> repair</span><span><i className="reject" /> reject</span>
          </p>
        </div>
        <label className="sr-edit">
          <span className="mono muted">Model reply, call 1 (edit it)</span>
          <textarea
            value={reply} rows={4} spellCheck={false}
            onChange={(e) => { setReply(e.target.value); setFault(null); }}
          />
        </label>
        <div>
          <span className="mono muted">max_repairs</span>
          <div className="filters" style={{ margin: '0.6rem 0 0' }}>
            {([0, 1, 2] as const).map((n) => (
              <button key={n} className="chip" aria-pressed={maxRepairs === n} onClick={() => setMaxRepairs(n)}>{n}</button>
            ))}
          </div>
          <label className="pf-toggle mono">
            <input type="checkbox" checked={requireTool} onChange={(e) => setRequireTool(e.target.checked)} />
            <span className={`check ${requireTool ? 'on' : ''}`} /> require_tool
          </label>
          <label className="pf-toggle mono" style={{ marginTop: '0.7rem' }}>
            <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
            <span className={`check ${repeat ? 'on' : ''}`} /> Model repeats its mistake
          </label>
        </div>
      </div>

      <div className="sr-main">
        <div className="sr-result" aria-live="polite">
          <pre className={`sr-cli ${result.status}`}>
            <span className="muted">$ slmrouter "{s.query}"</span>{'\n'}
            status: <b>{result.status}</b>{'\n'}
            provenance: {result.provenance}{'\n'}
            model_calls: {result.calls.length} <span className="muted">/ ceiling {1 + maxRepairs}</span>{'\n'}
            {result.errorCode && <>error_code: {result.errorCode}{'\n'}</>}
            text: {result.text}
          </pre>
          <PathStrip r={result} />
          {result.status === 'final' && <p className="sr-code sr-warn">The model answered by itself. This text is not verified; require_tool would refuse it.</p>}
        </div>

        <div className="tabs" role="tablist" style={{ marginTop: '1.2rem' }}>
          {(['trace', 'prompt'] as const).map((v) => (
            <button key={v} role="tab" className="chip" aria-selected={view === v} aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'trace' ? 'Trace' : `Prompt, call ${lastCall.n}`}
            </button>
          ))}
        </div>
        {view === 'trace' ? (
          <ol className="sr-calls">
            {result.calls.map((c, i) => <CallCard key={c.n} c={c} last={i === maxRepairs} repeat={repeat} />)}
          </ol>
        ) : (
          <pre className="code sr-prompt">
            {original}
            {lastCall.prompt.length > original.length && <mark>{lastCall.prompt.slice(original.length)}</mark>}
          </pre>
        )}
      </div>
    </div>
  );
}

const DUTIES = [
  ['Knowing the tools', 'Long JSON Schema in the prompt', 'Python signatures, one short line per tool'],
  ['Output structure', "The model's JSON skill", 'One-line grammar, tolerant parser'],
  ['Argument types', 'The model', 'Strict coercion in code'],
  ['Error recovery', 'Multi-turn self-correction', 'At most 2 short repairs, then fail closed'],
  ['Stopping', 'The model deciding it is done', 'A hard call ceiling'],
  ['Randomness', 'Default sampling', 'Temperature 0, fixed seed, top_k 1'],
];

const CODE = (
  <>
    <span className="k">from</span> slmrouter <span className="k">import</span> SLMRouter, ToolRegistry, tool{'\n'}
    <span className="k">from</span> slmrouter.backends <span className="k">import</span> OllamaBackend{'\n\n'}
    registry = ToolRegistry(){'\n\n'}
    @tool(registry=registry){'\n'}
    <span className="k">def</span> add(a: int, b: int) -&gt; int:{'\n'}
    {'    '}<span className="s">"""Add two integers."""</span>{'\n'}
    {'    '}<span className="k">return</span> a + b{'\n\n'}
    agent = SLMRouter(OllamaBackend(<span className="s">"mistral:latest"</span>), registry){'\n'}
    result = agent.run(<span className="s">"What is 2+3?"</span>){'\n'}
    <span className="c"># 5 (provenance: tool)</span>
  </>
);

const CLI = (
  <>
    <span className="c">$</span> pip install slmrouter{'\n\n'}
    <span className="c">$</span> slmrouter --backend ollama --model llama3:8b <span className="s">"What's the weather in Pune?"</span>{'\n'}
    status: <span className="k">tool</span>{'\n'}provenance: tool{'\n'}model_calls: 1{'\n'}text: Pune: 31 c, clear{'\n\n'}
    <span className="c">$</span> slmrouter --backend ollama --model llama3:8b <span className="s">"Who wrote Hamlet?"</span>{'\n'}
    status: <span className="k">final</span>{'\n'}provenance: model{'\n'}model_calls: 1{'\n'}text: William Shakespeare
  </>
);

const SIM = [
  { value: '795', label: 'injected fault cases' },
  { value: '280/280', label: 'recoverable faults fixed on the first call' },
  { value: '0', label: 'false executions' },
  { value: '0.003', label: 'ms p99 parse time' },
];

const LIVE = [
  ['Ollama 0.34, GPU', 'llama3:8b Q4_0', '50/50', '50/50', '0', '109 / 156 ms'],
  ['Ollama 0.34, GPU', 'mistral 7.2B Q4_K_M', '50/50', '50/50', '0', '130 / 184 ms'],
  ['llama.cpp b11565, CPU only', 'mistral 7B Q4_K_M', '50/50', '50/50', '0', '1378 / 1634 ms'],
];

const FEATURES = [
  ['Model text never becomes code', 'There is no eval, exec, compile, pickle or importlib anywhere in the package, and an AST gate in CI keeps it that way.'],
  ['Exact names only', 'Only registered tools run, matched by exact name. "add_numbers" is not "add"; it goes back for a repair instead of being guessed.'],
  ['Ambiguity is rejected', 'Unterminated quotes, duplicate arguments and "2.5" for an int are refused, never rounded or patched.'],
  ['Repairs do not grow', 'Every repair is the original prompt plus one "Invalid:" line. Errors never pile up in the context the way they do in a chat loop.'],
  ['Honest provenance', 'Every result says whether the text came from a tool or from the model, so an unverified answer is never dressed up as a lookup.'],
  ['CI without a GPU', 'Live runs are recorded and replayed exactly, so the full test suite runs on Python 3.10 to 3.13 on an ordinary CI runner.'],
];

export default function SlmRouter() {
  const f = flagshipBySlug('slmrouter');
  return (
    <ProductShell f={f} links={[{ label: 'View on GitHub', href: f.repo }, { label: 'pip install slmrouter', href: f.live! }]}>
      <section className="section wrap">
        <SectionHead n="01" label="Router lab" right="The real parser, in your browser" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 4rem)', alignItems: 'end' }}>
          <Split text="Break the reply. Watch it hold." className="display h-md" />
          <p className="body" data-reveal>
            Pick a query, then inject any of the 16 fault classes from the evaluation, or type your own reply. The parser, the argument coercion and the bounded repair loop are ported line for line from the library. Only the model is scripted: on a repair it answers correctly, unless you tell it to repeat its mistake.
          </p>
        </div>
        <div data-reveal><Lab /></div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="02" label="Live replay" right="eval/fixtures, 150 recorded replies" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 3.5rem)', alignItems: 'end' }}>
          <Split text="What real 8B models actually wrote." className="display h-md" />
          <p className="body" data-reveal>
            These are the exact replies recorded from the 50-query benchmark on three runtimes. The page feeds each one through the same ported parser and executor as the lab above and checks the result against the expected tool and arguments.
          </p>
        </div>
        <div data-reveal><LiveReplay /></div>
        <div className="split2" style={{ marginTop: 'clamp(3rem, 7vw, 5rem)', alignItems: 'center' }}>
          <div>
            <span className="mono muted">One finding from the live runs</span>
            <h3 className="display h-sm" style={{ marginTop: '0.8rem' }}>Same weights, same prompt, 23 more right answers.</h3>
            <p className="body" style={{ marginTop: '1rem' }}>
              llama.cpp&rsquo;s <code>/completion</code> endpoint sends the prompt raw. Instruction-tuned Mistral only follows it when it is wrapped in the model&rsquo;s chat template, so the backend now uses the chat endpoint by default.
            </p>
          </div>
          <div data-reveal><TemplateFinding /></div>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="03" label="The idea" right="ARCHITECTURE.md" />
        <div className="split2">
          <div>
            <Split text="Correctness lives in code, not in the model." className="display h-md" />
            <p className="body" data-reveal style={{ marginTop: '1.5rem' }}>
              Agent frameworks built for cloud models make the model the reliability layer: when the JSON breaks, they show it the error and ask again, and the prompt grows every round. An 8B model gets worse with every round, so SLMRouter moves each of those jobs into plain Python.
            </p>
          </div>
          <table className="table" data-reveal>
            <thead><tr><th>Job</th><th className="hide-sm-cell">Cloud framework</th><th>SLMRouter</th></tr></thead>
            <tbody>
              {DUTIES.map(([j, a, b]) => (
                <tr key={j}><td>{j}</td><td className="muted hide-sm-cell">{a}</td><td>{b}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="04" label="Write a tool" right="@tool reflection" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 3.5rem)', alignItems: 'end' }}>
          <Split text="No JSON Schema. Just a Python function." className="display h-md" />
          <p className="body" data-reveal>
            <code>@tool</code> reads the signature, the type hints and the first docstring line, and turns them into one short line of prompt. Edit the function: unsupported types, <code>*args</code> and positional-only parameters are refused when the module loads, never halfway through a query.
          </p>
        </div>
        <div data-reveal><ToolForge /></div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="05" label="Evaluation" right="eval/report*.md" />
        <Split text="Measured, then recorded." className="display h-md" />
        <div className="sr-stats" data-reveal>
          {SIM.map((m) => (
            <div key={m.label}><b>{m.value}</b><span className="mono muted">{m.label}</span></div>
          ))}
        </div>
        <p className="body" data-reveal style={{ margin: '0 0 2rem', maxWidth: '62ch' }}>
          Simulated run: 35 scenarios crossed with the 16 fault classes, no model needed, never more than 2 model calls against a ceiling of 2. Live run: the 50-query benchmark on one Linux machine with an RTX 5070, on 12 October 2026. These are measurements on one machine, not guarantees.
        </p>
        <table className="table" data-reveal>
          <thead>
            <tr><th>Runtime</th><th>Model</th><th>Tool pick</th><th>Arguments</th><th className="hide-sm-cell">Repairs</th><th className="hide-sm-cell">p50 / p95</th></tr>
          </thead>
          <tbody>
            {LIVE.map((r) => (
              <tr key={r[0] + r[1]}>
                <td>{r[0]}</td><td className="sr-code">{r[1]}</td>
                <td style={{ color: 'var(--page-accent)' }}>{r[2]}</td><td style={{ color: 'var(--page-accent)' }}>{r[3]}</td>
                <td className="hide-sm-cell">{r[4]}</td><td className="muted hide-sm-cell">{r[5]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="06" label="Failure map" right="Every error is typed" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 3.5rem)' }}>
          <Split text="It never raises for bad model output." className="display h-md" />
          <p className="body" data-reveal>
            <code>run()</code> returns a typed result for every failure and raises only for programmer errors, like an empty query. Model mistakes get a short repair. Anything that might have touched the outside world is never repeated.
          </p>
        </div>
        <table className="table sr-codes" data-reveal>
          <thead><tr><th>Stage</th><th>Code</th><th className="hide-sm-cell">When</th><th>Then</th></tr></thead>
          <tbody>
            {CODES.map(([stage, code, when, act]) => (
              <tr key={code}>
                <td className="muted">{stage}</td><td className="sr-code">{code}</td><td className="hide-sm-cell">{when}</td>
                <td className={`sr-act ${act}`}>{CODE_ACTION[act]}</td>
              </tr>
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

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="07" label="Build log" right="Git history, October 2026" />
        <div className="split2">
          <div>
            <Split text="Eight days from frozen contracts to PyPI." className="display h-md" />
            <p className="body" data-reveal style={{ marginTop: '1.5rem' }}>
              A team of four, each owning one module behind interfaces frozen on day one, so the parts could be built in parallel and tested against stubs. I led it and owned the orchestrator, the evaluation and the release.
            </p>
            <ul className="sr-team" data-reveal>
              {TEAM.map(([n, r]) => <li key={n}><span>{n}</span><span className="mono muted">{r}</span></li>)}
            </ul>
            <p className="mono muted" style={{ marginTop: '0.8rem' }}>Module owners as listed in ARCHITECTURE.md</p>
          </div>
          <ol className="path sr-build">
            {BUILD.map((b) => (
              <li key={b.title} data-reveal>
                <span className="mono muted">{b.date}</span>
                <span className="h-sm serif">{b.title}</span>
                <span className="body">{b.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="08" label="Use it" right="Python 3.10+, no dependencies" />
        <div className="split2">
          <div>
            <Split text="One install, any local model." className="display h-md" />
            <pre className="code" data-reveal style={{ marginTop: '2rem' }}>{CLI}</pre>
          </div>
          <pre className="code" data-reveal>{CODE}</pre>
        </div>
      </section>
    </ProductShell>
  );
}
