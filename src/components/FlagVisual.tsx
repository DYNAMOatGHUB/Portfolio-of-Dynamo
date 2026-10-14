import { Flagship } from '../content';

const MONO = 'Geist Mono, monospace';

/** Lightweight, code-native hero visual for each flagship card (no image payload). */
export default function FlagVisual({ slug, accent }: { slug: Flagship['slug']; accent: string }) {
  if (slug === 'slmrouter') {
    // A small model's messy reply on the left of the arrow, what the router made of it on the right.
    const rows: [string, string, string][] = [
      ['model', '```', 'muted'],
      ['', "action: get_weather(city='Pune')", 'reply'],
      ['', '```', 'muted'],
      ['parse', 'fence, case, quotes: recovered', 'ok'],
      ['bind', 'city="Pune", unit="c" (default)', 'ok'],
      ['run', 'get_weather -> Pune: 31 c, clear', 'ok'],
    ];
    return (
      <svg viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="400" fill="#1B1814" />
        <circle cx="330" cy="70" r="170" fill={accent} fillOpacity="0.14" />
        <rect x="34" y="56" width="332" height="288" rx="10" fill="#ECE8DF" />
        <text x="52" y="84" fontFamily={MONO} fontSize="10" fill="#1B1814" fillOpacity="0.55">$ slmrouter "Weather in Pune?"</text>
        {rows.map(([k, v, tone], i) => (
          <g key={i} transform={`translate(52 ${112 + i * 24})`}>
            <text fontFamily={MONO} fontSize="10" fill="#1B1814" fillOpacity="0.45">{k}</text>
            {tone === 'ok' && <circle cx="50" cy="-3.5" r="3.5" fill={accent} />}
            <text x="60" fontFamily={MONO} fontSize="10" fill={tone === 'reply' ? accent : '#1B1814'} fillOpacity={tone === 'muted' ? 0.4 : 1}>{v}</text>
          </g>
        ))}
        <line x1="52" y1="268" x2="348" y2="268" stroke="#1B1814" strokeOpacity="0.15" />
        <text x="52" y="292" fontFamily={MONO} fontSize="10.5" fill="#1B1814">status: tool / provenance: tool</text>
        <text x="52" y="314" fontFamily={MONO} fontSize="10.5" fill={accent}>model_calls: 1 / ceiling 2</text>
      </svg>
    );
  }
  if (slug === 'pdf-knowledge') {
    const lines = [
      [180, 0], [210, 0], [150, 1], [205, 1], [190, 1], [120, 0], [200, 0], [176, 2], [210, 2], [96, 0], [188, 0], [204, 0],
    ] as const;
    return (
      <svg viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="400" height="400" fill="#0E0E10" />
        <rect x="70" y="40" width="260" height="330" rx="4" fill="#EFEDE6" />
        <text x="92" y="72" fontFamily={MONO} fontSize="9" fill="#0E0E10" fillOpacity="0.5">p. 14 / handbook.pdf</text>
        {lines.map(([w, hl], i) => (
          <g key={i}>
            {hl === 1 && <rect x="88" y={88 + i * 22} width={w + 8} height="15" fill={accent} />}
            {hl === 2 && <rect x="88" y={88 + i * 22} width={w + 8} height="15" fill={accent} fillOpacity="0.45" />}
            <rect x="92" y={94 + i * 22} width={w} height="4" rx="2" fill="#0E0E10" fillOpacity="0.35" />
          </g>
        ))}
        <g transform="translate(206 300)">
          <rect width="168" height="62" rx="12" fill="#0E0E10" stroke={accent} />
          <text x="14" y="24" fontFamily={MONO} fontSize="9" fill="#EFEDE6">bm25 0.71 / dense 0.83</text>
          <text x="14" y="44" fontFamily={MONO} fontSize="9" fill={accent}>hybrid 0.79  cite p.14</text>
        </g>
      </svg>
    );
  }
  // posefit: a squat at the bottom of the rep, with the knee angle drawn in.
  const J = { sh: [176, 168], hip: [242, 258], knee: [182, 262], ankle: [200, 330], head: [160, 136] };
  const line = (a: number[], b: number[]) => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ECF3EC" strokeWidth="7" strokeLinecap="round" />;
  return (
    <svg viewBox="0 0 400 400" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="400" fill="#0B0F0C" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1="0" y1={i * 50} x2="400" y2={i * 50} stroke="#ECF3EC" strokeOpacity="0.05" />
      ))}
      <line x1="40" y1="334" x2="360" y2="334" stroke="#ECF3EC" strokeOpacity="0.25" />
      {line(J.sh, J.hip)}
      {line(J.hip, J.knee)}
      {line(J.knee, J.ankle)}
      {line(J.sh, [112, 196])}
      <circle cx={J.head[0]} cy={J.head[1]} r="20" fill="none" stroke="#ECF3EC" strokeWidth="6" />
      <path d="M 208 260 A 26 26 0 0 1 189 287" fill="none" stroke={accent} strokeWidth="3" />
      {[J.sh, J.hip, J.knee, J.ankle].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill={accent} stroke="#0B0F0C" strokeWidth="2" />
      ))}
      <text x="214" y="296" fontFamily={MONO} fontSize="12" fill={accent}>79°</text>
      <text x="40" y="60" fontFamily={MONO} fontSize="11" fill="#ECF3EC" fillOpacity="0.6">REPS</text>
      <text x="40" y="110" fontFamily="Instrument Serif, serif" fontSize="56" fill="#ECF3EC">07</text>
      <text x="292" y="60" fontFamily={MONO} fontSize="11" fill={accent}>GOOD FORM</text>
      <text x="292" y="80" fontFamily={MONO} fontSize="11" fill="#ECF3EC" fillOpacity="0.6">SCORE 95</text>
    </svg>
  );
}
