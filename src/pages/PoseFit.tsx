import { useEffect, useRef, useState } from 'react';
import ProductShell, { SectionHead } from '../components/ProductShell';
import { flagshipBySlug } from '../content';
import { Split } from '../lib/motion';
import { prefersReducedMotion } from '../lib/smooth';

type P = { x: number; y: number };

// Straight ports of POSE_FIT web/src/core/angle-utils.js.
function findAngle(p1: P, p2: P, p3: P) {
  const a = Math.abs((Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x)) * (180 / Math.PI));
  return a > 180 ? 360 - a : a;
}
function interp(v: number, [i0, i1]: [number, number], [o0, o1]: [number, number]) {
  const c = Math.max(Math.min(v, Math.max(i0, i1)), Math.min(i0, i1));
  return o0 + ((c - i0) / (i1 - i0)) * (o1 - o0);
}

/** Side-view body from a knee angle and an extra forward lean. Stands in for MediaPipe's landmarks. */
function body(knee: number, extraLean: number) {
  const rad = Math.PI / 180;
  const A = { x: 190, y: 330 };
  const bend = 180 - knee;
  const shin = bend * 0.4 * rad;
  const K = { x: A.x + 80 * Math.sin(shin), y: A.y - 80 * Math.cos(shin) };
  const thigh = (90 + bend * 0.4 + knee) * rad;
  const H = { x: K.x + 80 * Math.cos(thigh), y: K.y + 80 * Math.sin(thigh) };
  // Bad-form lean grows with depth, so standing upright still calibrates.
  const lean = (bend * 0.25 + extraLean * Math.max(0, Math.min((bend - 12) / 45, 1))) * rad;
  const S = { x: H.x + 92 * Math.sin(lean), y: H.y - 92 * Math.cos(lean) };
  const head = { x: H.x + 116 * Math.sin(lean), y: H.y - 116 * Math.cos(lean) };
  const arm = (90 - Math.min(bend / 100, 1) * 88) * rad;
  const hand = { x: S.x + 66 * Math.cos(arm), y: S.y + 66 * Math.sin(arm) };
  return { A, K, H, S, head, hand };
}

type Hud = {
  status: string; reps: number; score: number | null; feedback: string;
  knee: number; hip: number; torso: number; per: number; ready: boolean; hold: number; down: boolean; scores: number[];
};

/** squat.js onFrame(), minus the visibility check: same thresholds, same transitions, same scoring. */
class Squat {
  count = 0; down = false; isReady = false; readyStart: number | null = null; scores: number[] = [];
  last = 0; minKnee = 180; feedback = ''; status = 'Calibrating...'; knee = 0; hip = 0; torso = 0; per = 0;
  static HOLD = 1.5;

  frame(b: ReturnType<typeof body>, now: number) {
    this.knee = findAngle(b.H, b.K, b.A);
    this.hip = findAngle(b.S, b.H, b.K);
    if (!this.isReady) {
      this.status = 'Stand Up Straight';
      if (this.knee > 165 && this.hip > 170) {
        if (this.readyStart === null) this.readyStart = now;
        else if (now - this.readyStart >= Squat.HOLD) this.isReady = true;
      } else this.readyStart = null;
    }
    if (this.isReady) {
      this.torso = findAngle(b.S, b.H, { x: b.H.x, y: b.H.y + 100 });
      this.feedback = this.torso < 150 ? 'Keep Back Straight' : 'Good Form';
      this.per = interp(this.knee, [70, 170], [100, 0]);
      if (!this.down) {
        this.status = 'Ready';
        if (this.per >= 50) { this.down = true; this.minKnee = this.knee; }
      }
      if (this.down) {
        this.status = 'Squatting';
        this.minKnee = Math.min(this.minKnee, this.knee);
        if (this.per <= 5) {
          this.down = false;
          this.count++;
          this.last = Math.min(100, interp(this.minKnee, [90, 70], [50, 100]));
          this.scores.push(this.last);
          this.minKnee = 180;
        }
      }
    }
  }

  hud(now: number): Hud {
    return {
      status: this.status, reps: this.count, score: this.last > 0 ? Math.round(this.last) : null, feedback: this.feedback,
      knee: Math.round(this.knee), hip: Math.round(this.hip), torso: Math.round(this.torso), per: Math.round(this.per),
      ready: this.isReady, down: this.down, scores: this.scores,
      hold: this.isReady ? 1 : this.readyStart === null ? 0 : Math.min((now - this.readyStart) / Squat.HOLD, 1),
    };
  }
}

const PRESETS = [
  { id: 'deep', label: 'Deep squat', knee: 72, note: 'Counts, scores high' },
  { id: 'parallel', label: 'To parallel', knee: 90, note: 'Counts, scores 50' },
  { id: 'shallow', label: 'Half rep', knee: 128, note: 'Never crosses 50% depth' },
] as const;

function SquatLab() {
  const [auto, setAuto] = useState(!prefersReducedMotion);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('deep');
  const [manualKnee, setManualKnee] = useState(172);
  const [lean, setLean] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [pose, setPose] = useState(() => body(172, 0));
  const ex = useRef(new Squat());
  const input = useRef({ auto, preset, manualKnee, lean });
  input.current = { auto, preset, manualKnee, lean };
  const stage = useRef<HTMLDivElement>(null);
  const t0 = useRef(0);

  useEffect(() => {
    let raf = 0;
    let visible = true;
    t0.current = performance.now();
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    if (stage.current) io.observe(stage.current);
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const { auto, preset, manualKnee, lean } = input.current;
      let knee = manualKnee;
      if (auto) {
        // Stand still until calibration passes, then cycle a rep every 2.8s.
        if (!ex.current.isReady) t0.current = t;
        const el = (t - t0.current) / 1000;
        const target = PRESETS.find((p) => p.id === preset)!.knee;
        knee = 172 - (172 - target) * (0.5 - 0.5 * Math.cos((el / 2.8) * Math.PI * 2));
      }
      const b = body(knee, lean ? 22 : 0);
      ex.current.frame(b, t / 1000);
      setPose(b);
      setHud(ex.current.hud(t / 1000));
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  const resetSet = () => { ex.current = new Squat(); };

  const h = hud;
  const good = h?.feedback === 'Good Form';
  const seg = (a: P, b: P, w = 7) => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--page-fg)" strokeWidth={w} strokeLinecap="round" />;
  const { A, K, H, S, head, hand } = pose;

  return (
    <div className="pf-grid">
      <div ref={stage} className="panel pf-stage">
        <div className="pf-hud mono">
          <div><span className="muted">Status</span><b>{h?.status ?? 'Calibrating...'}</b></div>
          <div><span className="muted">Reps</span><b className="pf-big">{String(h?.reps ?? 0).padStart(2, '0')}</b></div>
          <div><span className="muted">Last score</span><b>{h?.score ?? '--'}</b></div>
        </div>
        <svg viewBox="30 20 340 330" className="pf-svg" role="img" aria-label={`Skeleton at a knee angle of ${h?.knee ?? 172} degrees`}>
          {Array.from({ length: 7 }, (_, i) => <line key={i} x1="40" x2="360" y1={60 + i * 50} y2={60 + i * 50} stroke="var(--page-fg)" strokeOpacity="0.05" />)}
          <line x1="60" x2="340" y1={A.y + 6} y2={A.y + 6} stroke="var(--page-fg)" strokeOpacity="0.3" />
          {seg(A, { x: A.x + 26, y: A.y + 2 }, 6)}
          {seg(A, K)}{seg(K, H)}{seg(H, S)}{seg(S, hand, 5)}
          <line x1={H.x} y1={H.y} x2={H.x} y2={H.y + 60} stroke="var(--page-fg)" strokeOpacity="0.3" strokeDasharray="3 4" />
          <circle cx={head.x} cy={head.y} r="15" fill="none" stroke="var(--page-fg)" strokeWidth="5" />
          {[S, H, K, A].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="6.5" fill={i === 2 ? 'var(--page-accent)' : i === 0 && !good && h?.ready ? '#FF6B4A' : 'var(--page-fg)'} stroke="var(--page-bg)" strokeWidth="2" />
          ))}
          <text x={K.x + 14} y={K.y + 4} fontFamily="Geist Mono, monospace" fontSize="12" fill="var(--page-accent)">{h?.knee ?? 172}°</text>
          <text x={H.x - 46} y={H.y + 4} fontFamily="Geist Mono, monospace" fontSize="11" fill="var(--page-fg)" fillOpacity="0.6">{h?.hip ?? 180}°</text>
        </svg>
        <div className="pf-foot mono">
          {!h?.ready ? (
            <span>Stand straight to calibrate <span className="pf-hold"><i style={{ transform: `scaleX(${h?.hold ?? 0})` }} /></span></span>
          ) : (
            <span style={{ color: good ? 'var(--page-accent)' : '#FF6B4A' }}>{h.feedback}</span>
          )}
          <span className="muted">torso {h?.ready ? `${h.torso}°` : '--'}</span>
        </div>
      </div>

      <div className="pf-side">
        <div>
          <span className="mono muted">Drive it</span>
          <div className="filters" style={{ margin: '0.8rem 0 0' }} role="group" aria-label="Rep type">
            <button className="chip" aria-pressed={auto} onClick={() => setAuto((a) => !a)}>{auto ? 'Auto: on' : 'Auto: off'}</button>
            {PRESETS.map((p) => (
              <button key={p.id} className="chip" aria-pressed={auto && preset === p.id} onClick={() => { setPreset(p.id); setAuto(true); }} title={p.note}>{p.label}</button>
            ))}
          </div>
          <label style={{ display: 'block', marginTop: '1.4rem' }}>
            <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Knee angle, drag right to squat</span><span>{auto ? 'auto' : `${manualKnee}°`}</span>
            </span>
            <input
              className="range" type="range" min={60} max={176} step={1} value={auto ? (h?.knee ?? 172) : manualKnee}
              onChange={(e) => { setAuto(false); setManualKnee(parseInt(e.target.value, 10)); }}
              style={{ marginTop: '0.8rem', direction: 'rtl' }} aria-label="Knee angle"
            />
          </label>
          <label className="pf-toggle mono">
            <input type="checkbox" checked={lean} onChange={(e) => setLean(e.target.checked)} />
            <span className={`check ${lean ? 'on' : ''}`} /> Lean forward 22° (bad form)
          </label>
        </div>

        <div>
          <span className="mono muted">State machine, live</span>
          <div className="pf-states">
            {[
              ['Calibrate', !h?.ready, 'knee > 165° and hip > 170° for 1.5s'],
              ['Ready', !!h?.ready && !h.down, 'wait for depth ≥ 50% (knee ≤ 120°)'],
              ['Squatting', !!h?.down, 'track min knee angle; rep at depth ≤ 5%'],
            ].map(([n, on, d]) => (
              <div key={n as string} className={`pf-state ${on ? 'on' : ''}`}>
                <span>{n}</span><span className="mono muted">{d}</span>
              </div>
            ))}
          </div>
          <div className="pf-depth mono" aria-label={`Depth ${h?.per ?? 0} percent`}>
            <span>depth</span><span className="bar"><i style={{ transform: `scaleX(${(h?.per ?? 0) / 100})` }} /><em style={{ left: '50%' }} /><em style={{ left: '5%' }} /></span><span>{h?.ready ? h.per : 0}%</span>
          </div>
        </div>

        <div>
          <span className="mono muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Set log</span>
            <button className="ulink mono" onClick={resetSet}>New set</button>
          </span>
          <div className="pf-log">
            {(h?.scores ?? []).slice(-8).map((s, i, arr) => (
              <span key={i} style={{ opacity: 0.45 + (0.55 * (i + 1)) / arr.length }}>
                <b>{Math.round(s)}</b><span className="mono muted">rep {(h?.scores.length ?? 0) - arr.length + i + 1}</span>
              </span>
            ))}
            {!h?.scores.length && <span className="mono muted">No reps yet. Half reps never land here.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

const PIPE = [
  { name: 'Identify', items: ['Webcam', 'face-api.js SSD MobileNet', '128-d descriptor', 'match < 0.5 distance'] },
  { name: 'Track', items: ['MediaPipe Pose', '33 landmarks', 'visibility ≥ 0.5 gate'] },
  { name: 'Judge', items: ['findAngle()', 'knee / hip / torso', 'rep state machine', 'depth score'] },
  { name: 'Store', items: ['MongoDB (local engine)', 'Firestore sync', 'per-set scores'] },
  { name: 'Show', items: ['Vite dashboard', 'history view', 'personal bests'] },
];

const FEATURES = [
  ['Face before reps', 'The session belongs to whoever the camera recognises. Descriptors are compared by Euclidean distance at 0.5, stricter than the usual 0.6.'],
  ['Calibration gate', 'Nothing counts until you have stood straight for 1.5 seconds, so walking into frame never registers as a rep.'],
  ['Depth, not motion', 'A rep needs the knee past 120° on the way down and back above 165° on the way up. Bobbing in the middle does nothing.'],
  ['Score from the bottom', 'The deepest knee angle in each rep maps to a score: 90° earns 50, 70° earns 100. The average becomes the set score.'],
  ['Form feedback', 'Torso angle against a virtual vertical through the hip. Lean past 30° and the HUD tells you to keep your back straight.'],
  ['Three exercises', 'Squats, bicep curls with a shoulder-swing check, and a vertical jump that calibrates pixels to centimetres from your height.'],
];

export default function PoseFit() {
  const f = flagshipBySlug('posefit');
  return (
    <ProductShell f={f} links={[{ label: 'View on GitHub', href: f.repo }, { label: 'Open the web app', href: f.live! }]}>
      <section className="section wrap">
        <SectionHead n="01" label="Squat lab" right="Interactive, real thresholds" />
        <div className="split2" style={{ marginBottom: 'clamp(2rem, 5vw, 4rem)', alignItems: 'end' }}>
          <Split text="Try to cheat the counter." className="display h-md" />
          <p className="body" data-reveal>
            This runs the actual rep logic from <code>squat.js</code>: the same angle maths, thresholds and scoring. The only stand-in is the skeleton, which here comes from a slider instead of MediaPipe. Try a half rep, or turn on the forward lean.
          </p>
        </div>
        <div data-reveal><SquatLab /></div>
      </section>

      <section className="section wrap" style={{ paddingTop: 0 }}>
        <SectionHead n="02" label="Pipeline" right="Camera to dashboard" />
        <div className="split2">
          <div>
            <Split text="Heavy vision locally, history in the cloud." className="display h-md" />
            <p className="body" data-reveal style={{ marginTop: '1.5rem' }}>
              The pose engine runs on your own machine, so there is no network round-trip between a frame and the rep count. Only the finished set, meaning reps and scores, gets written to MongoDB and then synced to Firestore for the dashboard.
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
        <SectionHead n="03" label="Engineering details" right="What makes a rep a rep" />
        <div className="feature-grid">
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
        <SectionHead n="04" label="One function, two runtimes" right="Python and a 1:1 JS port" />
        <div className="split2">
          <Split text="Every angle comes from three points." className="display h-md" />
          <pre className="code" data-reveal>
            <span className="c"># detection/pose_detector.py</span>{'\n'}angle = math.degrees(math.atan2(y3 - y2, x3 - x2) -{'\n'}                     math.atan2(y1 - y2, x1 - x2)){'\n'}angle = abs(angle){'\n'}<span className="k">if</span> angle &gt; <span className="s">180</span>:{'\n'}    angle = <span className="s">360</span> - angle{'\n\n'}<span className="c"># exercises/squat.py</span>{'\n'}per = np.interp(avg_knee_angle, (<span className="s">70</span>, <span className="s">170</span>), (<span className="s">100</span>, <span className="s">0</span>)){'\n'}depth_score = np.interp(min_knee_angle_in_rep, (<span className="s">90</span>, <span className="s">70</span>), (<span className="s">50</span>, <span className="s">100</span>))
          </pre>
        </div>
      </section>
    </ProductShell>
  );
}
