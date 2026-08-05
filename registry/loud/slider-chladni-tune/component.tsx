"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChladniTune — a precision-tuning slider whose readout is a plate of sand.
// A few thousand grains random-walk across a square Canvas 2D plate; how far
// the slider sits from an unstated `target` sets both how hard they jitter
// and how strongly they're pulled onto the nodal lines of a Chladni figure
// sin(n*pi*x)*sin(m*pi*y) - sin(m*pi*x)*sin(n*pi*y) = 0 for a mode (n, m)
// picked deterministically from `target`. Off target the grains churn in a
// formless haze; on target they lock into the crisp symmetric figure and
// hold still. Distance-to-correct is encoded as PATTERN COHERENCE — a
// continuous, directionless "how close" signal, the way you'd tune an
// instrument by ear rather than by reading a number.
//
// MECHANISM: rather than integrating a force field (expensive, and force
// magnitude near a saddle of |f| doesn't actually read as "coherence"), each
// grain proposes a small random step and the step is judged by whether it
// makes |f(x, y)| bigger or smaller — a Metropolis-style accept/reject, the
// standard trick real-time Chladni-sand demos use. A step that improves
// (shrinks) |f| is always taken. A step that worsens it is taken anyway with
// probability normalizedDetune^1.4 — that probability IS the "attraction
// strength = 1 - normalizedDetune" the brief describes, just expressed as a
// rejection rate instead of a force: at detune 0 worse moves are almost
// never accepted, so grains that reach the zero set stay there (locked,
// motionless); at detune 1 they're accepted almost always, so the walk is
// unbiased and grains never accumulate anywhere (pure scatter). Jitter
// magnitude also scales linearly with detune, so besides drifting or holding,
// off-target grains visibly move harder. No dt-scaling: this is a discrete
// per-frame Markov step, not a velocity integration, so running it once per
// rAF tick (not scaled by elapsed time) is the correct thing to do, same as
// any other frame-stepped cellular automaton.
//
// Grain positions live in a plain Float32Array pair, updated in place —
// never React state. Canvas ink (plate = --background, grains = --foreground
// at low alpha) is read via getComputedStyle at mount and re-derived on a
// MutationObserver watching documentElement's class attribute, so a theme
// flip repaints correctly instead of leaving stale colors baked into a
// gradient. The rAF loop pauses via IntersectionObserver while offscreen and
// on document.hidden; it never fully sleeps otherwise, because even a locked
// plate still carries a small residual jitter (real sand vibrates, it
// doesn't teleport to a stop) — that's deliberate, not a missed easing.
//
// A11Y: the slider is a real native <input type="range"> (role=slider, full
// arrow/Home/End/PageUp/PageDown keyboard support for free), aria-valuetext
// reporting both the number and a categorical proximity phrase ("42.1, very
// close to target"). The canvas is aria-hidden; a Geist Mono readout beneath
// the slider duplicates the same value/coherence numbers in text, so the
// sand is never the only channel carrying the signal. A dedicated
// aria-live=polite region announces "On target." exactly on the transition
// into lock (empty otherwise, so it never spams on every drag tick).
// REDUCED MOTION: the whole simulation is replaced by a static, non-canvas
// SVG figure with three fixed point sets (scattered / forming / locked)
// computed once per mode; the live detune/lock state just selects which of
// the three to render — an instant swap, never an animation. Zero deps.
// ---------------------------------------------------------------------------

type Vec3 = readonly [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// canonical asymmetric (n, m) pairs — n === m makes the Chladni expression
// identically zero everywhere (a degenerate, non-figure "target"), so every
// entry here deliberately keeps n !== m.
const CHLADNI_MODES: readonly (readonly [number, number])[] = [
  [2, 1],
  [3, 1],
  [3, 2],
  [4, 1],
  [4, 3],
  [5, 2],
  [5, 3],
  [5, 4],
  [6, 1],
  [6, 5],
];

function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function modeForTarget(target: number): readonly [number, number] {
  const idx = Math.floor(hash01(target) * CHLADNI_MODES.length) % CHLADNI_MODES.length;
  return CHLADNI_MODES[idx] ?? CHLADNI_MODES[0];
}

function chladni(n: number, m: number, x: number, y: number): number {
  return (
    Math.sin(n * Math.PI * x) * Math.sin(m * Math.PI * y) -
    Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * y)
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function proximityWord(detune: number, locked: boolean): string {
  if (locked) return "on target";
  if (detune < 0.15) return "very close to target";
  if (detune < 0.4) return "close to target";
  if (detune < 0.75) return "off target";
  return "far from target";
}

function stateBucket(detune: number, locked: boolean): "locked" | "converging" | "scattered" {
  if (locked) return "locked";
  return detune < 0.55 ? "converging" : "scattered";
}

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const REDUCED_GRID = 44; // sample grid resolution for the static figure
const REDUCED_COUNT = 220; // point count in every static bucket

function computeLockedPoints(n: number, m: number): readonly (readonly [number, number])[] {
  const candidates: { x: number; y: number; a: number }[] = [];
  for (let i = 0; i <= REDUCED_GRID; i++) {
    for (let j = 0; j <= REDUCED_GRID; j++) {
      const x = i / REDUCED_GRID;
      const y = j / REDUCED_GRID;
      candidates.push({ x, y, a: Math.abs(chladni(n, m, x, y)) });
    }
  }
  candidates.sort((p, q) => p.a - q.a);
  return candidates.slice(0, REDUCED_COUNT).map((p) => [p.x, p.y] as const);
}

function computeScatteredPoints(): readonly (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i < REDUCED_COUNT; i++) {
    pts.push([hash01(i * 12.9898 + 1.7), hash01(i * 78.233 + 4.1)] as const);
  }
  return pts;
}

function computeFormingPoints(
  scattered: readonly (readonly [number, number])[],
  locked: readonly (readonly [number, number])[]
): readonly (readonly [number, number])[] {
  return scattered.map(([sx, sy], i) => {
    const [lx, ly] = locked[i % locked.length] ?? [sx, sy];
    return [sx + (lx - sx) * 0.55, sy + (ly - sy) * 0.55] as const;
  });
}

function ReducedFigure({
  bucket,
  scattered,
  forming,
  locked,
}: {
  bucket: "locked" | "converging" | "scattered";
  scattered: readonly (readonly [number, number])[];
  forming: readonly (readonly [number, number])[];
  locked: readonly (readonly [number, number])[];
}) {
  const points = bucket === "locked" ? locked : bucket === "converging" ? forming : scattered;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
    >
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x * 100}
          cy={y * 100}
          r={0.9}
          className="fill-foreground/45"
        />
      ))}
    </svg>
  );
}

export interface ChladniTuneProps {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  /** the value the plate resolves at — never rendered as a number in the UI */
  target: number;
  min?: number;
  max?: number;
  step?: number;
  /** value distance at which detune reaches 1 (full chaos). default: 25% of the range */
  detuneSpan?: number;
  /** value distance within which the plate is considered locked. default: max(step, 0.5% of the range) */
  lockEpsilon?: number;
  /** override the auto-derived Chladni mode (n, m); n === m is rejected as degenerate */
  mode?: readonly [number, number];
  /** sand grain count on the canvas plate. default 2200 */
  grainCount?: number;
  onValueChange?: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}

export function ChladniTune({
  value,
  defaultValue = 50,
  target,
  min = 0,
  max = 100,
  step = 0.1,
  detuneSpan,
  lockEpsilon,
  mode,
  grainCount = 2200,
  onValueChange,
  className = "",
  "aria-label": ariaLabel = "Tuning value",
}: ChladniTuneProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clamp(defaultValue, min, max));
  const current = isControlled ? (value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const span = Math.max(1e-9, max - min);
  const dSpan = detuneSpan ?? span * 0.25;
  const lockEps = lockEpsilon ?? Math.max(step, span * 0.005);

  const rawMode = mode ?? modeForTarget(target);
  const resolvedMode: readonly [number, number] =
    rawMode[0] === rawMode[1] ? modeForTarget(target + 1) : rawMode;
  const [n, m] = resolvedMode;

  const detune = clamp(Math.abs(current - target) / Math.max(1e-9, dSpan), 0, 1);
  const locked = Math.abs(current - target) <= lockEps;
  const coherencePct = Math.round((1 - detune) * 100);
  const word = proximityWord(detune, locked);
  const bucket = stateBucket(detune, locked);

  const reduced = useReducedMotionPref();

  const detuneRef = useRef(detune);
  detuneRef.current = detune;
  const modeRef = useRef(resolvedMode);
  modeRef.current = resolvedMode;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (reduced) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink: read at mount, re-derived on theme class flips --
    let plateColor = "#ffffff";
    let grainColor = "rgba(23,23,23,0.5)";
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background"));
      const fg = parseColor(cs.getPropertyValue("--foreground"));
      if (bg) plateColor = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
      if (fg) grainColor = `rgba(${fg[0]}, ${fg[1]}, ${fg[2]}, 0.5)`;
    };
    deriveColors();

    const count = Math.max(200, Math.floor(grainCount));
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      xs[i] = Math.random();
      ys[i] = Math.random();
    }

    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let visible = true;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sized = true;
    };
    resize();

    const GRAIN_PX = 1.4;
    const JITTER_MIN = 0.0016; // normalized-unit step at detune 0 — a held-still shimmer, not zero
    const JITTER_MAX = 0.03; // normalized-unit step at detune 1 — a visibly churning haze

    const stepGrains = () => {
      const [cn, cm] = modeRef.current;
      const d = detuneRef.current;
      const jitter = JITTER_MIN + (JITTER_MAX - JITTER_MIN) * d;
      const chaosAccept = Math.pow(d, 1.4); // probability a worse move is kept anyway
      for (let i = 0; i < count; i++) {
        const x = xs[i];
        const y = ys[i];
        const f0 = chladni(cn, cm, x, y);
        let nx = x + (Math.random() - 0.5) * jitter;
        let ny = y + (Math.random() - 0.5) * jitter;
        if (nx < 0) nx = -nx;
        else if (nx > 1) nx = 2 - nx;
        if (ny < 0) ny = -ny;
        else if (ny > 1) ny = 2 - ny;
        const f1 = chladni(cn, cm, nx, ny);
        if (Math.abs(f1) <= Math.abs(f0) || Math.random() < chaosAccept) {
          xs[i] = nx;
          ys[i] = ny;
        }
      }
    };

    const render = () => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = plateColor;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = grainColor;
      const g = GRAIN_PX;
      for (let i = 0; i < count; i++) {
        ctx.fillRect(xs[i] * w - g / 2, ys[i] * h - g / 2, g, g);
      }
    };

    const loop = () => {
      stepGrains();
      render();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf && sized && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    render();
    wake();

    const ro = new ResizeObserver(() => {
      resize();
      render();
    });
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else sleep();
    });
    io.observe(container);

    // theme toggle flips the `dark` class on <html> — re-derive plate/grain
    // ink from the tokens, or the wrong theme's colors stay baked in
    const mo = new MutationObserver(() => {
      deriveColors();
      render();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (document.hidden) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      sleep();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // grainCount and the resolved mode are the only things that require a
    // fresh grain field / redraw cadence; detune/current flow through refs
    // so ordinary slider movement never tears down and re-seeds the plate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, grainCount, n, m]);

  const scattered = useMemo(() => computeScatteredPoints(), []);
  const lockedPts = useMemo(() => computeLockedPoints(n, m), [n, m]);
  const forming = useMemo(() => computeFormingPoints(scattered, lockedPts), [scattered, lockedPts]);

  // -- custom track: a real native <input type=range> carries keyboard a11y
  // (sr-only, not display:none, so Tab reaches it and arrow/Home/End/PageUp/
  // PageDown come free from native semantics) while a plain DOM track+thumb
  // pair carries pointer interaction and the visible "core-styled" look.
  // This split (compare-crack-seam's / slider-range-shear's pattern in this registry)
  // matters beyond taste: a synthetic pointerdown/pointermove dispatched at
  // a native range's thumb is not guaranteed to move it — that native
  // click-drag-to-set-value behavior is UA-internal, not something a script
  // can reliably trigger with untrusted events — so autoplay's "drag" mode
  // needs a plain element whose own onPointer* handlers do the mapping.
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const draggingRef = useRef(false);

  const commit = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const r = track.getBoundingClientRect();
    const frac = clamp(r.width > 0 ? (clientX - r.left) / r.width : 0, 0, 1);
    const raw = min + frac * span;
    const snapped = Math.round((raw - min) / step) * step + min;
    const v = clamp(Number(snapped.toFixed(6)), min, max);
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic (autoplay) pointerIds match no live pointer — drag still works
    }
    draggingRef.current = true;
    inputRef.current?.focus();
    commit(e.clientX);
  };
  const onTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    commit(e.clientX);
  };
  const onTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op — see onTrackPointerDown
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = clamp(Number(e.target.value), min, max);
    if (!isControlled) setInternal(v);
    onValueChange?.(v);
  };

  const pct = span > 0 ? ((current - min) / span) * 100 : 0;

  return (
    <div className={`flex w-full flex-col items-center gap-5 ${className}`}>
      <div
        ref={containerRef}
        aria-hidden
        className="relative aspect-square w-full max-w-xs overflow-hidden rounded-md border border-border bg-background"
      >
        {!reduced && <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />}
        {reduced && (
          <ReducedFigure bucket={bucket} scattered={scattered} forming={forming} locked={lockedPts} />
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={onTrackPointerUp}
          onPointerCancel={onTrackPointerUp}
          className="chladni-track relative flex h-4 w-full cursor-pointer touch-none select-none items-center"
        >
          <div aria-hidden className="pointer-events-none h-1.5 w-full rounded-full bg-border">
            <div
              aria-hidden
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div
            aria-hidden
            className={`pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-foreground transition-shadow duration-150 ${
              focused ? "ring-2 ring-ns-accent ring-offset-2 ring-offset-background" : ""
            }`}
            style={{ left: `${pct}%` }}
          />
          <input
            ref={inputRef}
            type="range"
            min={min}
            max={max}
            step={step}
            value={current}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label={ariaLabel}
            aria-valuetext={`${current.toFixed(1)}, ${word}`}
            className="sr-only"
          />
        </div>

        <div className="flex items-baseline justify-between font-mono text-xs text-ns-muted tabular-nums">
          <span>VALUE {current.toFixed(1)}</span>
          <span>COHERENCE {String(Math.max(0, coherencePct)).padStart(3, "0")}%</span>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ns-muted">
          {bucket === "locked" ? "locked" : bucket === "converging" ? "converging" : "scattered"}
        </p>

        <p aria-live="polite" className="sr-only">
          {locked ? "On target." : ""}
        </p>
      </div>
    </div>
  );
}
