// In-browser port of SLMRouter's deterministic core: prompt -> parse -> execute -> bounded repair loop.
// parse(), coerce(), execute() and run() follow slmrouter/parser.py, coercion.py, executor.py and agent.py.
// The model is replaced by a scripted reply, like slmrouter.backends.SimulatedBackend.

export type ParamType = 'str' | 'int' | 'float' | 'bool';
/** repr: how a non-string default prints in the tool line (Python repr, e.g. True, None, 2.5). */
export type Param = { name: string; type: ParamType; required: boolean; default?: string | number; repr?: string };
export type Tool = { name: string; description: string; params: Param[]; run: (a: Record<string, unknown>) => string };

export type Parsed =
  | { kind: 'action'; tool: string; args: [string, string][]; warnings: string[]; normalized: string }
  | { kind: 'final'; text: string; normalized: string }
  | { kind: 'fail'; code: string; normalized: string };

// ---------- Demo tools (slmrouter/demo_tools.py) ----------

export const TOOLS: Tool[] = [
  { name: 'add', description: 'Add two integers.', params: [{ name: 'a', type: 'int', required: true }, { name: 'b', type: 'int', required: true }],
    run: (a) => String((a.a as number) + (a.b as number)) },
  { name: 'get_weather', description: 'Get fixture weather for a city.', params: [{ name: 'city', type: 'str', required: true }, { name: 'unit', type: 'str', required: false, default: 'c' }],
    run: (a) => `${a.city}: 31 ${a.unit}, clear` },
  { name: 'search', description: 'Search fixture entries.', params: [{ name: 'q', type: 'str', required: true }, { name: 'limit', type: 'int', required: false, default: 5 }],
    run: (a) => `${a.q}: ${a.limit} results` },
  { name: 'set_alarm', description: 'Set a fixture alarm.', params: [{ name: 'hour', type: 'int', required: true }, { name: 'minute', type: 'int', required: true }, { name: 'label', type: 'str', required: false, default: '' }],
    run: (a) => `Alarm ${String(a.hour).padStart(2, '0')}:${String(a.minute).padStart(2, '0')} ${a.label}`.trimEnd() },
  { name: 'boom', description: 'Raise a fixture error.', params: [],
    run: () => { throw new Error('RuntimeError: fixture boom'); } },
];

// ---------- prompt.py ----------

const sanitize = (s: string) => s.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim();

const renderDefault = (v: string | number) => {
  if (typeof v === 'string') { let s = sanitize(v); if (s.length > 20) s = s.slice(0, 20) + '...'; return `"${s}"`; }
  return String(v);
};

export const toolLine = (t: Tool) =>
  `${t.name}(${t.params.map((p) => (p.required ? `${p.name}:${p.type}` : `${p.name}:${p.type}=${p.repr ?? renderDefault(p.default!)}`)).join(', ')}) - ${t.description}`;

export function renderPrompt(query: string, tools = TOOLS) {
  const q = sanitize(query).slice(0, 2000);
  return `Pick one tool for the query.
Tools:
${tools.map(toolLine).join('\n') || '(none)'}
Reply with ONE line, either:
ACTION: tool_name(arg="value")
FINAL: short answer (only if no tool fits)
Query: ${q}
Reply:`;
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

const REPAIR_REASONS: Record<string, string> = {
  E_EMPTY: 'empty reply',
  E_NO_PREFIX: 'reply must start with ACTION: or FINAL:',
  E_BAD_SYNTAX: 'malformed call',
  E_UNKNOWN_TOOL: 'unknown tool "{detail}"',
  E_MISSING_ARG: 'missing arg "{detail}"',
  E_UNEXPECTED_ARG: 'unknown arg "{detail}"',
  E_TYPE_COERCION: 'wrong type for "{detail}"',
  E_FINAL_NOT_ALLOWED: 'a tool call is required',
};

/** The tail appended to the original prompt. Repairs are not cumulative: the prompt never grows past one retry. */
export function repairTail(previous: string, code: string, detail: string) {
  const reason = (REPAIR_REASONS[code] ?? 'bad format').replace('{detail}', sanitize(detail).slice(0, 40));
  return ` ${sanitize(previous).slice(0, 200)}\nInvalid: ${reason}. Reply with ONE line: ACTION: tool_name(arg="value") or FINAL: text\nReply:`;
}

// ---------- parser.py ----------

const INVISIBLE = /[​﻿]/g;
const FENCE_LINE = /^[ \t]*```[A-Za-z0-9_+.-]*[ \t]*\r?$\n?/gm;
const PREFIX = /(?<![A-Za-z0-9])(ACTION|FINAL)[*_]*[ \t]*:[*_]*/i;
const ANOTHER_ACTION = /(?<![A-Za-z0-9])ACTION[*_]*[ \t]*:/i;
const CALL = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
const KEYWORD = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=([\s\S]*)$/;
const ESCAPES: Record<string, string> = { '\\': '\\', '"': '"', "'": "'", n: '\n', t: '\t' };
const isQuote = (c: string) => c === '"' || c === "'";

function normalize(text: string) {
  let s = text.replace(INVISIBLE, '').replace(FENCE_LINE, '').trim();
  if (s.length >= 2 && s[0] === '`' && s[s.length - 1] === '`') s = s.replace(/^`+|`+$/g, '').trim();
  return s;
}

/** Quote-aware scan from just after "(": comma-separated segments and the index of ")", or null if unterminated. */
function splitArgs(text: string, start: number): [string[], number] | null {
  const segs: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote !== null) {
      cur += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = null;
    } else if (isQuote(c)) { quote = c; cur += c; }
    else if (c === ',') { segs.push(cur); cur = ''; }
    else if (c === ')') { segs.push(cur); return [segs, i]; }
    else cur += c;
  }
  return null;
}

function unquote(v: string): string | null {
  const q = v[0];
  let out = '';
  let i = 1;
  while (i < v.length) {
    const c = v[i];
    if (c === '\\' && i + 1 < v.length) {
      const n = v[i + 1];
      out += n in ESCAPES ? ESCAPES[n] : c + n;
      i += 2;
      continue;
    }
    if (c === q) return i === v.length - 1 ? out : null;
    out += c;
    i++;
  }
  return null;
}

function decodeValue(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (isQuote(v[0])) return unquote(v);
  if (v.includes('"') || v.includes("'")) return null;
  return v;
}

function parseArgs(segs: string[]): [string, string][] | null {
  if (segs.length === 1 && !segs[0].trim()) return [];
  if (!segs[segs.length - 1].trim()) segs = segs.slice(0, -1);
  const args: [string, string][] = [];
  let pos = 0;
  let seenKw = false;
  for (const seg of segs) {
    const kw = KEYWORD.exec(seg);
    let name: string, raw: string;
    if (kw) {
      [name, raw] = [kw[1], kw[2]];
      if (args.some(([k]) => k === name)) return null;
      seenKw = true;
    } else {
      if (seenKw) return null;
      [name, raw] = [`#${pos++}`, seg];
    }
    const v = decodeValue(raw);
    if (v === null) return null;
    args.push([name, v]);
  }
  return args;
}

export function parse(text: string): Parsed {
  const normalized = normalize(text.slice(0, 8000));
  if (!normalized) return { kind: 'fail', code: 'E_EMPTY', normalized };
  const prefix = PREFIX.exec(normalized);
  if (!prefix) return { kind: 'fail', code: 'E_NO_PREFIX', normalized };
  const body = normalized.slice(prefix.index + prefix[0].length);
  if (prefix[1].toUpperCase() === 'ACTION') {
    const call = CALL.exec(body);
    if (!call) return { kind: 'fail', code: 'E_BAD_SYNTAX', normalized };
    const scanned = splitArgs(body, call[0].length);
    if (!scanned) return { kind: 'fail', code: 'E_BAD_SYNTAX', normalized };
    const args = parseArgs(scanned[0]);
    if (!args) return { kind: 'fail', code: 'E_BAD_SYNTAX', normalized };
    const warnings = ANOTHER_ACTION.test(body.slice(scanned[1] + 1)) ? ['multiple_actions'] : [];
    return { kind: 'action', tool: call[1], args, warnings, normalized };
  }
  const final = body.split('\n', 1)[0].trim();
  if (!final) return { kind: 'fail', code: 'E_BAD_SYNTAX', normalized };
  return { kind: 'final', text: final, normalized };
}

// ---------- coercion.py ----------

const INT = /^([+-]?[0-9]+)(?:\.0+)?$/;
// Python float() literals: digits with optional "_" groups, a point, an exponent, or inf/nan.
const FLOAT = /^[+-]?(?:(?:\d(?:_?\d)*)?\.?\d(?:_?\d)*(?:[eE][+-]?\d(?:_?\d)*)?|\d(?:_?\d)*\.|inf(?:inity)?|nan)$/i;
const TRUE = new Set(['true', 'yes', '1', 'on']);
const FALSE = new Set(['false', 'no', '0', 'off']);

export function coerce(raw: string, p: Param): unknown {
  const t = raw.trim();
  if (p.type === 'str') return raw;
  if (p.type === 'int') {
    const m = INT.exec(t);
    if (!m) throw new Error('not an integer');
    if (m[1].replace(/^[+-]/, '').length > 30) throw new Error('integer longer than 30 digits');
    return parseInt(m[1], 10);
  }
  if (p.type === 'float') {
    if (!FLOAT.test(t)) throw new Error('not a number');
    const v = Number(t.replace(/_/g, ''));
    if (!Number.isFinite(v)) throw new Error('number is not finite');
    return v;
  }
  const l = t.toLowerCase();
  if (TRUE.has(l)) return true;
  if (FALSE.has(l)) return false;
  throw new Error('not a boolean');
}

// ---------- executor.py ----------

export type Step = { label: string; ok: boolean; note: string };
export type Exec = { ok: boolean; output?: string; code?: string; detail?: string; kwargs: Record<string, unknown>; steps: Step[] };

const PATH = /(?<![\w.])(?:\/[\w.-]+){2,}\/?|\b[A-Za-z]:\\[^\s'"]*/g;
const singleLine = (v: string, limit: number) => v.split(/\s+/).filter(Boolean).join(' ').replace(PATH, '[path]').slice(0, limit);

export function execute(tool: string, args: [string, string][], tools = TOOLS): Exec {
  const steps: Step[] = [];
  const fail = (code: string, detail: string, kwargs: Record<string, unknown> = {}): Exec => ({ ok: false, code, detail, kwargs, steps });

  const spec = tools.find((t) => t.name === tool);
  steps.push({ label: 'allowlist', ok: !!spec, note: spec ? `"${tool}" is registered` : `no tool named "${singleLine(tool, 40)}", no fuzzy match` });
  if (!spec) return fail('E_UNKNOWN_TOOL', singleLine(tool, 40));

  // bind positional (#0, #1) and keyword args onto parameter names
  const names = spec.params.map((p) => p.name);
  const kws = new Map(args.filter(([k]) => !k.startsWith('#')));
  const bound = new Map<string, string>();
  for (const [k, v] of args) {
    if (!k.startsWith('#')) continue;
    const i = Number(k.slice(1));
    if (i >= names.length) { steps.push({ label: 'bind', ok: false, note: `positional ${k} has no parameter` }); return fail('E_UNEXPECTED_ARG', k); }
    if (kws.has(names[i])) { steps.push({ label: 'bind', ok: false, note: `"${names[i]}" given twice` }); return fail('E_UNEXPECTED_ARG', names[i]); }
    bound.set(names[i], v);
  }
  for (const [k, v] of kws) {
    if (!names.includes(k)) { steps.push({ label: 'bind', ok: false, note: `"${k}" is not a parameter of ${tool}` }); return fail('E_UNEXPECTED_ARG', singleLine(k, 40)); }
    bound.set(k, v);
  }
  const missing = spec.params.find((p) => p.required && !bound.has(p.name));
  if (missing) { steps.push({ label: 'bind', ok: false, note: `required "${missing.name}" is missing` }); return fail('E_MISSING_ARG', missing.name); }
  steps.push({ label: 'bind', ok: true, note: names.length ? names.map((n) => (bound.has(n) ? n : `${n} (default)`)).join(', ') : 'no parameters' });

  const kwargs: Record<string, unknown> = {};
  const notes: string[] = [];
  for (const p of spec.params) {
    if (!bound.has(p.name)) { kwargs[p.name] = p.default; continue; }
    const raw = bound.get(p.name)!;
    try {
      kwargs[p.name] = coerce(raw, p);
      notes.push(`${p.name} "${raw}" -> ${p.type === 'str' ? `"${raw}"` : String(kwargs[p.name])}`);
    } catch (e) {
      steps.push({ label: 'coerce', ok: false, note: `${p.name} "${raw}" is ${(e as Error).message}` });
      return fail('E_TYPE_COERCION', p.name);
    }
  }
  steps.push({ label: 'coerce', ok: true, note: notes.join(', ') || 'nothing to coerce' });

  try {
    const out = spec.run(kwargs);
    steps.push({ label: 'run', ok: true, note: `${tool}(**kwargs) returned` });
    return { ok: true, output: out.length > 4000 ? out.slice(0, 4000) + '...[truncated]' : out, kwargs, steps };
  } catch (e) {
    steps.push({ label: 'run', ok: false, note: 'tool raised; never retried, it may have side effects' });
    return fail('E_TOOL_EXCEPTION', singleLine((e as Error).message, 200), kwargs);
  }
}

// ---------- agent.py ----------

export type Call = { n: number; prompt: string; reply: string; parsed: Parsed; exec?: Exec; code?: string; detail?: string };
export type Result = { status: 'tool' | 'final' | 'error'; provenance: 'tool' | 'model' | 'none'; text: string; errorCode?: string; calls: Call[] };

const TERMINAL = new Set(['E_TOOL_EXCEPTION', 'E_TOOL_TIMEOUT']);

/** SLMRouter.run with a scripted backend: script[i] is the model's reply to call i. At most 1 + maxRepairs calls. */
export function run(query: string, script: string[], maxRepairs: 0 | 1 | 2, requireTool: boolean): Result {
  const original = renderPrompt(query);
  let current = original;
  const calls: Call[] = [];
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const reply = script[Math.min(attempt, script.length - 1)];
    const parsed = parse(reply);
    const call: Call = { n: attempt + 1, prompt: current, reply, parsed };
    calls.push(call);
    let code: string, detail = '';
    if (parsed.kind === 'action') {
      const ex = execute(parsed.tool, parsed.args);
      call.exec = ex;
      if (ex.ok) return { status: 'tool', provenance: 'tool', text: ex.output!, calls };
      code = ex.code!;
      detail = ex.detail ?? '';
      if (TERMINAL.has(code)) return { status: 'error', provenance: 'none', text: `${code}: ${detail}`, errorCode: code, calls };
    } else if (parsed.kind === 'final') {
      if (!requireTool) return { status: 'final', provenance: 'model', text: parsed.text, calls };
      code = 'E_FINAL_NOT_ALLOWED';
    } else {
      code = parsed.code;
    }
    call.code = code;
    call.detail = detail;
    if (attempt === maxRepairs) return { status: 'error', provenance: 'none', text: `retry exhausted after ${code}`, errorCode: 'E_RETRY_EXHAUSTED', calls };
    current = original + repairTail(reply, code, detail);
  }
  throw new Error('unreachable');
}

// ---------- reflection.py (@tool), reading a Python def from source text ----------

export type Reflected = { ok: true; tool: Tool } | { ok: false; error: string };

const ALLOWED: Record<string, ParamType> = { str: 'str', int: 'int', float: 'float', bool: 'bool' };
const BUILTIN_CLASSES = new Set(['list', 'dict', 'tuple', 'set', 'bytes', 'object', 'complex', 'frozenset']);

/** Split on commas that are not inside brackets or quotes. */
function splitTop(s: string) {
  const out: string[] = [];
  let depth = 0, cur = '', q: string | null = null;
  for (const c of s) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if ('[({'.includes(c)) depth++;
    if ('])}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

function annotationType(ann: string): [ParamType, boolean] | null {
  const a = ann.replace(/\s+/g, '').replace(/^typing\./, '');
  if (a in ALLOWED) return [ALLOWED[a], false];
  const inner =
    /^Optional\[(\w+)\]$/.exec(a)?.[1] ??
    /^Union\[(\w+),None\]$/.exec(a)?.[1] ?? /^Union\[None,(\w+)\]$/.exec(a)?.[1] ??
    /^(\w+)\|None$/.exec(a)?.[1] ?? /^None\|(\w+)$/.exec(a)?.[1];
  return inner && inner in ALLOWED ? [ALLOWED[inner], true] : null;
}

/** Mirrors @tool: the same rules and the same error text, raised "at decoration time". */
export function reflect(source: string): Reflected {
  const m = /^\s*(?:@tool\S*\s*)?def\s+([A-Za-z_]\w*)\s*\(([\s\S]*?)\)\s*(?:->\s*[^:]+)?:([\s\S]*)$/.exec(source);
  if (!m) return { ok: false, error: 'SyntaxError: expected one "def name(...):" with a body' };
  const [, fn, rawParams, body] = m;
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(fn)) return { ok: false, error: `ValueError: Invalid tool name: '${fn}'` };

  const parts = splitTop(rawParams);
  const slash = parts.indexOf('/');
  const params: Param[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === '/' || p === '*') continue;
    const name = p.replace(/^\*{1,2}/, '').split(/[:=]/)[0].trim();
    const kind = p.startsWith('**') ? 'VAR_KEYWORD' : p.startsWith('*') ? 'VAR_POSITIONAL' : i < slash ? 'POSITIONAL_ONLY' : null;
    if (kind) return { ok: false, error: `TypeError: @tool: parameter '${name}' of '${fn}' has unsupported kind ${kind}` };
    const pm = /^([A-Za-z_]\w*)\s*(?::\s*([^=]+?))?\s*(?:=\s*([\s\S]+))?$/.exec(p);
    if (!pm) return { ok: false, error: `SyntaxError: cannot read parameter "${p}"` };
    const [, pname, ann, def] = pm;
    let type: ParamType = 'str';
    if (ann) {
      const t = annotationType(ann);
      if (!t) {
        const shown = BUILTIN_CLASSES.has(ann.trim()) ? `<class '${ann.trim()}'>` : ann.trim();
        return { ok: false, error: `TypeError: @tool: parameter '${pname}' of '${fn}' has unsupported type ${shown}; allowed: str,int,float,bool` };
      }
      type = t[0];
    }
    if (def === undefined) { params.push({ name: pname, type, required: true }); continue; }
    const d = def.trim();
    const quoted = /^(["'])([\s\S]*)\1$/.exec(d);
    // A quoted default is a str and renders sanitised and quoted; anything else (5, True, None, 2.5) renders as written.
    params.push(quoted ? { name: pname, type, required: false, default: quoted[2] } : { name: pname, type, required: false, default: d, repr: d });
  }

  const doc = /^\s*(?:"""|''')([\s\S]*?)(?:"""|''')/.exec(body)?.[1] ?? /^\s*(["'])(.*?)\1/.exec(body)?.[2] ?? '';
  const first = doc.split('\n').find((l) => l.trim());
  let description = first ? first.split(/\s+/).filter(Boolean).join(' ') : fn;
  if (description.length > 80) description = description.slice(0, 77) + '...';

  return { ok: true, tool: { name: fn, description, params, run: () => '' } };
}
