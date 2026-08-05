"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GyreMote — an AI "thinking" indicator rendered as a rotating sphere of dots,
// pure SVG (<circle> pool) + one direct-DOM rAF loop, NO canvas and NO WebGL.
// ~80-140 points are placed on a unit sphere by a Fibonacci/golden-spiral
// distribution so they read as an even field, spun about a tilted vertical
// axis, projected to 2D, then depth-sorted and repainted back-to-front every
// frame. Depth is the whole signature: a dot near the viewer is larger, fully
// opaque and inked with --foreground; a dot on the far side is smaller, dim,
// and inked with --ns-muted — that size+opacity ramp is what makes the field read
// as a SPHERE and not a flat ring. Four states are distinct by MOTION, not
// color: thinking = steady spin; searching = spin plus an accent latitude band
// that sweeps pole to pole; done = the sphere contracts and decelerates to a
// calm, brighter, settled ball; idle = a very slow drift with a gentle axis
// wobble. Every color is a CSS custom property already in scope, so both
// themes inherit correctly. prefers-reduced-motion freezes the loop and leaves
// a static, still-depth-cued sphere whose state stays legible (searching keeps
// a static band, done keeps its settled contracted look). One rAF loop, paused
// when the tab is hidden, cancelled on unmount. Zero dependencies.
// ---------------------------------------------------------------------------

export type GyreMoteState = "thinking" | "searching" | "done" | "idle";

const STATE_LABEL: Record<GyreMoteState, string> = {
  thinking: "Thinking…",
  searching: "Searching…",
  done: "Done",
  idle: "Idle",
};

// viewBox is a fixed 100x100 box; all geometry is in those units and scales
// with the pixel `size`, so nothing has to be recomputed per pixel size.
const VB = 100;
const CX = VB / 2;
const CY = VB / 2;
const SPHERE_R = 38; // sphere radius in viewBox units
const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad
const TILT = -0.42; // fixed view tilt (radians) — look slightly from above
const TAU = Math.PI * 2;

// per-state target angular velocity (rad/s) and resting sphere scale
const STATE_VEL: Record<GyreMoteState, number> = {
  thinking: 0.72,
  searching: 0.52,
  done: 0.05,
  idle: 0.13,
};
const STATE_SCALE: Record<GyreMoteState, number> = {
  thinking: 1,
  searching: 1,
  done: 0.84, // contracts to a calm, smaller ball
  idle: 1,
};

// dot count scales with size for legibility: fewer, cleaner dots when tiny;
// a denser field when it is a showpiece.
function dotCount(size: number): number {
  const n = Math.round(80 + (size - 24) * 0.34);
  return Math.max(80, Math.min(140, n));
}

export interface GyreMoteProps {
  /** diameter in px. legible from ~24 inline to ~200 as a showpiece. default 96. */
  size?: number;
  /** which cadence to render — the motion pattern is the signal, not color. default "thinking". */
  state?: GyreMoteState;
  /**
   * accessible text announced via the component's own aria-live region on
   * every state change. Defaults to a plain state name ("Thinking…"). Pass the
   * same string you show in an adjacent visible label so the two never diverge.
   */
  label?: string;
  /** render `label` as a visible text node beside the sphere (still announced). */
  showLabel?: boolean;
  className?: string;
}

export function GyreMote({
  size = 96,
  state = "thinking",
  label,
  showLabel = false,
  className = "",
}: GyreMoteProps) {
  const N = dotCount(size);

  const svgRef = useRef<SVGSVGElement>(null);
  const circleEls = useRef<(SVGCircleElement | null)[]>([]);
  const stateRef = useRef<GyreMoteState>(state);
  const drawRef = useRef<(() => void) | null>(null);
  const doneStartRef = useRef(-1);

  // main animation effect — rebuilt only when the point count changes.
  useEffect(() => {
    const circles = circleEls.current.slice(0, N);
    if (circles.some((c) => !c)) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Fibonacci sphere — even golden-spiral distribution. bx/by/bz is the
    // resting point; by (latitude) is invariant under the Y-axis spin, so a
    // latitude band stays a clean horizontal ring while the sphere rotates.
    const bx = new Float64Array(N);
    const by = new Float64Array(N);
    const bz = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * GOLDEN;
      bx[i] = Math.cos(th) * rad;
      by[i] = y;
      bz[i] = Math.sin(th) * rad;
    }

    // scratch buffers for the projected frame + a depth-sort index
    const sx = new Float64Array(N);
    const sy = new Float64Array(N);
    const sr = new Float64Array(N);
    const so = new Float64Array(N);
    const sd = new Float64Array(N); // view depth zv, the sort key
    const sf = new Uint8Array(N); // 0 muted, 1 foreground, 2 accent (band)
    const order = new Int32Array(N);
    for (let i = 0; i < N; i++) order[i] = i;

    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);

    // dot radii in viewBox units — near dots ~2.7x the far dots.
    const R_FAR = 1.15;
    const R_NEAR = 3.15;

    // compute one frame and paint it back-to-front into the circle pool.
    const drawFrame = (
      angle: number,
      scale: number,
      bandCenter: number | null,
      dimFar: number
    ) => {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const r = SPHERE_R * scale;

      for (let i = 0; i < N; i++) {
        const x0 = bx[i]!;
        const y0 = by[i]!;
        const z0 = bz[i]!;
        // spin about Y
        const xr = x0 * ca + z0 * sa;
        const zr = -x0 * sa + z0 * ca;
        // tilt about X (view)
        const yv = y0 * cosT - zr * sinT;
        const zv = y0 * sinT + zr * cosT;

        const depth = (zv + 1) * 0.5; // 0 back .. 1 front
        const persp = 1 / (1 - zv * 0.16); // mild bulge toward the viewer

        sx[i] = CX + xr * r * persp;
        sy[i] = CY - yv * r * persp;
        sd[i] = zv;

        let rr = R_FAR + depth * (R_NEAR - R_FAR);
        let oo = (0.12 + depth * 0.88) * dimFar; // idle drops presence
        let fill: number = depth >= 0.5 ? 1 : 0; // fg near / muted far

        // searching: an accent latitude band sweeping pole to pole. by is
        // spin-invariant, so this is a horizontal ring gliding vertically.
        if (bandCenter !== null) {
          const d = Math.abs(y0 - bandCenter);
          if (d < 0.26) {
            const k = 1 - d / 0.26; // 0 edge .. 1 centre of band
            rr += k * 1.4;
            oo = Math.min(1, oo + k * 0.6);
            fill = 2;
          }
        }

        sr[i] = rr;
        so[i] = oo;
        sf[i] = fill;
      }

      // depth sort: back (small zv) first so near dots paint over far ones.
      // insertion sort — stable and near-linear on the nearly-sorted frames.
      for (let a = 1; a < N; a++) {
        const v = order[a]!;
        const kz = sd[v]!;
        let b = a - 1;
        while (b >= 0 && sd[order[b]!]! > kz) {
          order[b + 1] = order[b]!;
          b--;
        }
        order[b + 1] = v;
      }

      for (let k = 0; k < N; k++) {
        const i = order[k]!;
        const c = circles[k]!;
        c.setAttribute("cx", sx[i]!.toFixed(2));
        c.setAttribute("cy", sy[i]!.toFixed(2));
        c.setAttribute("r", sr[i]!.toFixed(2));
        c.style.opacity = so[i]!.toFixed(3);
        c.style.fill =
          sf[i] === 2
            ? "var(--ns-accent)"
            : sf[i] === 1
              ? "var(--foreground)"
              : "var(--ns-muted)";
      }
    };

    // ---- reduced motion: one static, depth-cued frame, no loop ----
    if (reduced) {
      const paint = () => {
        const st = stateRef.current;
        const band = st === "searching" ? 0.12 : null;
        const scale = st === "done" ? STATE_SCALE.done : 1;
        const dim = st === "idle" ? 0.6 : 1;
        drawFrame(0.7, scale, band, dim);
      };
      drawRef.current = paint;
      paint();
      return () => {
        drawRef.current = null;
      };
    }

    // ---- animated: one rAF loop, sole DOM writer ----
    let raf = 0;
    let last = 0;
    let angle = 0.3;
    let vel = STATE_VEL[stateRef.current];
    let scale = STATE_SCALE[stateRef.current];

    const loop = (now: number) => {
      const t = now / 1000;
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, t - last);
      last = t;

      const st = stateRef.current;
      const targetVel = STATE_VEL[st];
      const targetScale = STATE_SCALE[st];

      // ease angular velocity + sphere scale toward their per-state targets
      vel += (targetVel - vel) * (1 - Math.exp(-dt * 4));
      scale += (targetScale - scale) * (1 - Math.exp(-dt * 5));

      // idle: gentle axis wobble layered on the slow drift
      let ang = angle;
      if (st === "idle") ang += Math.sin(t * 0.5) * 0.12;
      angle += vel * dt;

      // searching: latitude band sweeps pole to pole on a 2.4s cosine
      const band =
        st === "searching" ? Math.cos(t * (TAU / 2.4)) * 0.92 : null;

      // done: brief inward convergence overshoot on entry, then holds calm.
      let sc = scale;
      let dim = 1;
      if (st === "done") {
        const ds = doneStartRef.current;
        if (ds >= 0) {
          const p = (now - ds) / 620;
          if (p < 1) {
            // ease-out with a small settle dip below the resting scale
            const e = 1 - Math.pow(1 - p, 3);
            sc = scale - Math.sin(p * Math.PI) * 0.06 * (1 - e * 0.4);
          } else {
            doneStartRef.current = -1;
          }
        }
      }
      if (st === "idle") dim = 0.62;

      drawFrame(ang, sc, band, dim);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf === 0 && !document.hidden) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    };
    // pause when the tab is hidden — no wasted frames, no leaked loop
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    drawRef.current = null; // animated path owns the DOM; no external repaint
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [N]);

  // state lives in a ref so the loop is never torn down on a state change.
  // On entering `done`, stamp the convergence start; under reduced motion,
  // repaint the static frame so the new state reads immediately.
  useEffect(() => {
    const prev = stateRef.current;
    stateRef.current = state;
    if (state === "done" && prev !== "done") {
      doneStartRef.current =
        typeof performance !== "undefined" ? performance.now() : 0;
    }
    drawRef.current?.();
  }, [state]);

  const text = label ?? STATE_LABEL[state];

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center gap-2.5 ${className}`}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="block overflow-visible"
      >
        {Array.from({ length: N }, (_, i) => (
          <circle
            key={i}
            ref={(el) => {
              circleEls.current[i] = el;
            }}
            cx={CX}
            cy={CY}
            r={1.5}
            style={{ fill: "var(--ns-muted)" }}
          />
        ))}
      </svg>
      {showLabel ? (
        <span className="text-sm text-ns-muted">{text}</span>
      ) : (
        <span className="sr-only">{text}</span>
      )}
    </span>
  );
}
