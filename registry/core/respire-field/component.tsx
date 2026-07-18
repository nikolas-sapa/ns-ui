"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

// ---------------------------------------------------------------------------
// deterministic 2-octave value noise — no deps, stable across frames
// ---------------------------------------------------------------------------
function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.65 * vnoise(x, y) + 0.35 * vnoise(x * 2.1 + 19.7, y * 2.1 + 7.3);
}

// cubic-bezier(0.22, 1, 0.36, 1) solved via Newton–Raphson
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const s = slopeX(t);
      if (Math.abs(s) < 1e-6) break;
      t -= (sampleX(t) - x) / s;
    }
    return sampleY(Math.min(1, Math.max(0, t)));
  };
}
const glideEase = makeBezier(0.22, 1, 0.36, 1);

const TAU = Math.PI * 2;
const PAD = 24; // canvas overhang — worst-case displacement (6+8+~3px) fits
const POINTS = 96;
// the brief's noise2(s*3, ·) frequency (3 noise units per lap) sampled on a
// closed ring so the membrane has no seam where s wraps: circumference
// 2πR = 3 → R = 3/2π
const NOISE_R = 3 / TAU;
const SIGMA = 0.06; // gaussian pulse width, normalized perimeter
const PULSE_SPEED = 1.2; // perimeters per second
const PULSE_TAU = 0.6; // seconds
const TWO_SIGMA2 = 2 * SIGMA * SIGMA;

// ---------------------------------------------------------------------------
// RespireField — a real, fully native <input> under a decoration-only canvas
// membrane: a 96-point noise-displaced loop that breathes on idle, dilates on
// focus, sends a peristaltic pulse around the loop from the caret on each
// keystroke, constricts and quivers on error, and exhales once on valid
// submit. Direct-DOM rAF is the sole writer; the loop sleeps when blurred and
// every transient has settled below 0.05px.
// ---------------------------------------------------------------------------
export function RespireField({
  error = false,
  exhaleKey = 0,
  className = "",
  ...inputProps
}: {
  /** constricts the membrane -3px, quivers once, blends stroke toward red */
  error?: boolean;
  /** bump after a valid submit to trigger the single 8px exhale */
  exhaleKey?: number;
  /** classes for the wrapper; input styling is internal */
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const errorRef = useRef(false);
  const quiverStartRef = useRef(-1);
  const exhaleStartRef = useRef(-1);
  const prevErrRef = useRef(false);
  const prevExRef = useRef(exhaleKey);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    const input = inputRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !input || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const measure = document.createElement("canvas").getContext("2d");

    // geometry — rebuilt on resize, read every frame
    let w = 0;
    let h = 0;
    let dpr = 1;
    let radius = 6;
    let font = "";
    let padLeft = 14;
    let L = 1; // perimeter length in px
    const px = new Float32Array(POINTS);
    const py = new Float32Array(POINTS);
    const nx = new Float32Array(POINTS);
    const ny = new Float32Array(POINTS);

    // s=0 at the left end of the top edge, clockwise: top → TR arc → right
    // → BR arc → bottom → BL arc → left → TL arc. Positions + outward normals.
    const rebuild = () => {
      const r = Math.min(6, w / 2, h / 2);
      radius = r;
      const sw = w - 2 * r;
      const sh = h - 2 * r;
      const arc = (Math.PI * r) / 2;
      L = Math.max(1, 2 * sw + 2 * sh + 4 * arc);
      const seg = [sw, arc, sh, arc, sw, arc, sh, arc];
      for (let i = 0; i < POINTS; i++) {
        let d = (i / POINTS) * L;
        let k = 0;
        while (k < 7 && d > (seg[k] ?? 0)) {
          d -= seg[k] ?? 0;
          k++;
        }
        let x = 0;
        let y = 0;
        let ox = 0;
        let oy = 0;
        switch (k) {
          case 0:
            x = r + d;
            ox = 0;
            oy = -1;
            break;
          case 1: {
            const a = -Math.PI / 2 + d / r;
            x = w - r + r * Math.cos(a);
            y = r + r * Math.sin(a);
            ox = Math.cos(a);
            oy = Math.sin(a);
            break;
          }
          case 2:
            x = w;
            y = r + d;
            ox = 1;
            break;
          case 3: {
            const a = d / r;
            x = w - r + r * Math.cos(a);
            y = h - r + r * Math.sin(a);
            ox = Math.cos(a);
            oy = Math.sin(a);
            break;
          }
          case 4:
            x = w - r - d;
            y = h;
            oy = 1;
            break;
          case 5: {
            const a = Math.PI / 2 + d / r;
            x = r + r * Math.cos(a);
            y = h - r + r * Math.sin(a);
            ox = Math.cos(a);
            oy = Math.sin(a);
            break;
          }
          case 6:
            x = 0;
            y = h - r - d;
            ox = -1;
            break;
          default: {
            const a = Math.PI + d / r;
            x = r + r * Math.cos(a);
            y = r + r * Math.sin(a);
            ox = Math.cos(a);
            oy = Math.sin(a);
            break;
          }
        }
        px[i] = x + PAD;
        py[i] = y + PAD;
        nx[i] = ox;
        ny[i] = oy;
      }
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round((w + PAD * 2) * dpr));
      canvas.height = Math.max(1, Math.round((h + PAD * 2) * dpr));
      const cs = getComputedStyle(input);
      font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
      padLeft = parseFloat(cs.paddingLeft) || 0;
      rebuild();
    };
    resize();

    // hot-path state — locals only, never React state
    let raf = 0;
    let last = 0;
    let focused = document.activeElement === input;
    let fp = focused ? 1 : 0; // focus progress 0..1 (offset, breath, stroke)
    let focusFrom = fp;
    let focusTo = fp;
    let focusStart = -1;
    let errMix = 0;
    const pulses: { s: number; t: number }[] = [];

    // caret x → normalized position on the top-edge run of the perimeter
    const caretS = () => {
      if (!measure) return 0.05;
      let caret = input.value.length;
      try {
        const sel = input.selectionStart;
        if (sel != null) caret = sel;
      } catch {
        // email/number inputs refuse the selection API — caret ≈ end of value
      }
      measure.font = font;
      const tx =
        padLeft +
        measure.measureText(input.value.slice(0, caret)).width -
        input.scrollLeft;
      const d = Math.min(
        Math.max(tx - radius, 0),
        Math.max(1, w - 2 * radius)
      );
      return d / L;
    };

    const loop = (now: number) => {
      const t = now / 1000;
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      // focus dilation: 0 → +6px over 350ms on the glide bezier, reversible
      if (focusStart >= 0) {
        const q = (now - focusStart) / 350;
        if (q >= 1) {
          fp = focusTo;
          focusStart = -1;
        } else {
          fp = focusFrom + (focusTo - focusFrom) * glideEase(q);
        }
      }

      // error blend eases toward its target, then snaps so sleep can trigger
      const errTarget = errorRef.current ? 1 : 0;
      errMix += (errTarget - errMix) * (1 - Math.exp(-dt * 12));
      if (Math.abs(errMix - errTarget) < 0.01) errMix = errTarget;

      // quiver: 14Hz, 1.2px, fading out over its 500ms window
      let quiver = 0;
      const qs = quiverStartRef.current;
      if (qs >= 0) {
        const age = now - qs;
        if (age >= 500) quiverStartRef.current = -1;
        else quiver = Math.sin(TAU * 14 * (age / 1000)) * 1.2 * (1 - age / 500);
      }

      // exhale: amplitude spikes +8px, decays over 700ms ease-out (cubic)
      let exhale = 0;
      const es = exhaleStartRef.current;
      if (es >= 0) {
        const p = (now - es) / 700;
        if (p >= 1) exhaleStartRef.current = -1;
        else {
          const e = 1 - p;
          exhale = 8 * e * e * e;
        }
      }

      // prune dead pulses (5px * e^-2.6/0.6 ≈ 0.06px — under threshold)
      for (let j = pulses.length - 1; j >= 0; j--) {
        const pu = pulses[j];
        if (!pu || now - pu.t > 2600) pulses.splice(j, 1);
      }

      const base = 6 * fp - 3 * errMix + quiver;
      // idle breath 1.5px → 2.5px focused, on a 4.5s sine period; the sine
      // never fully deflates the noise so the membrane always reads alive
      const breathAmp =
        (1.5 + 1.0 * fp) * (0.6 + 0.4 * Math.sin((TAU * t) / 4.5));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w + PAD * 2, h + PAD * 2);
      ctx.beginPath();
      for (let i = 0; i < POINTS; i++) {
        const s = i / POINTS;
        const n = noise2(
          NOISE_R * Math.cos(s * TAU) + 7.3 + t * 0.15,
          NOISE_R * Math.sin(s * TAU) + 3.1 + t * 0.12
        );
        let disp = base + n * (breathAmp + exhale);
        // peristaltic pulses: two gaussian wavefronts leave the caret and
        // travel opposite ways around the loop at 1.2 perimeters/s
        for (const pu of pulses) {
          const age = (now - pu.t) / 1000;
          const amp = 5 * Math.exp(-age / PULSE_TAU);
          const travel = PULSE_SPEED * age;
          let d1 = Math.abs(s - ((pu.s + travel) % 1));
          d1 = Math.min(d1, 1 - d1);
          let d2 = Math.abs(s - ((((pu.s - travel) % 1) + 1) % 1));
          d2 = Math.min(d2, 1 - d2);
          disp +=
            amp *
            (Math.exp(-(d1 * d1) / TWO_SIGMA2) +
              Math.exp(-(d2 * d2) / TWO_SIGMA2));
        }
        const x = (px[i] ?? 0) + (nx[i] ?? 0) * disp;
        const y = (py[i] ?? 0) + (ny[i] ?? 0) * disp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      // stroke: #8f8f8f blurred → #ededed focused, blended toward
      // rgba(234,0,29,0.6) while the error state holds (status use only)
      const g = Math.round(143 + (237 - 143) * fp);
      const cr = Math.round(g + (234 - g) * errMix);
      const cg = Math.round(g * (1 - errMix));
      const cb = Math.round(g + (29 - g) * errMix);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${1 - 0.4 * errMix})`;
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      ctx.stroke();

      // sleep: blurred and every transient fully settled (< 0.05px) — the
      // idle breath freezes at its current phase until the next wake
      const settled =
        !focused &&
        focusStart < 0 &&
        fp === 0 &&
        pulses.length === 0 &&
        errMix === 0 &&
        !errorRef.current &&
        quiverStartRef.current < 0 &&
        exhaleStartRef.current < 0;
      if (settled) {
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    wakeRef.current = wake;
    wake(); // first paint; settles immediately if nothing is alive

    const onFocus = () => {
      focused = true;
      focusFrom = fp;
      focusTo = 1;
      focusStart = performance.now();
      wake();
    };
    const onBlur = () => {
      focused = false;
      focusFrom = fp;
      focusTo = 0;
      focusStart = performance.now();
      wake();
    };
    const onInput = () => {
      pulses.push({ s: caretS(), t: performance.now() });
      if (pulses.length > 24) pulses.shift();
      wake();
    };
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    input.addEventListener("input", onInput);
    const ro = new ResizeObserver(() => {
      resize();
      wake();
    });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      ro.disconnect();
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("input", onInput);
    };
  }, [reduced]);

  // error is a prop, not hot-path state: refs carry it into the loop
  useEffect(() => {
    errorRef.current = error;
    if (error && !prevErrRef.current) {
      quiverStartRef.current = performance.now();
    }
    prevErrRef.current = error;
    wakeRef.current?.();
  }, [error]);

  useEffect(() => {
    if (exhaleKey === prevExRef.current) return;
    prevExRef.current = exhaleKey;
    exhaleStartRef.current = performance.now();
    wakeRef.current?.();
  }, [exhaleKey]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        {...inputProps}
        className={
          reduced
            ? // reduced motion: canvas hidden, standard border + default ring
              "w-full rounded-sm border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted/60"
            : "w-full rounded-sm border border-transparent bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/60"
        }
      />
      {!reduced && (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ inset: -PAD }}
        />
      )}
    </div>
  );
}
