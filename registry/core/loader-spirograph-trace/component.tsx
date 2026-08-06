"use client";

// ---------------------------------------------------------------------------
// SpiroTrace — a determinate loader that inks in a real hypotrochoid.
//
// The curve is the classic spirograph pen path:
//   x(phi) = (R - r)cos(phi) + d*cos(((R - r)/r) * phi)
//   y(phi) = (R - r)sin(phi) - d*sin(((R - r)/r) * phi)
// With R = 5, r = 3 (gcd 1) the pen closes after r/gcd = 3 revolutions, so phi
// sweeps 0 -> 6*PI and the result is a closed five-petal rosette (petals =
// R/gcd = 5). It is sampled once into a single "M ... L ... Z" path string,
// memoised on R/r/d, and fitted to a 0 0 100 100 viewBox with a 6-unit margin.
//
// The whole rosette is ALWAYS on screen as a faint ghost; progress is simply
// the fraction of that curve's ARC LENGTH inked on top of it (pathLength="1",
// dasharray "1 1", dashoffset 1 - progress). So 0% and 100% are both legible
// shapes, and the route the loader will take is readable before it moves.
//
// Indeterminate is not a different widget: the same curve keeps a fixed
// 0.18-length dash window travelling around it at a constant arc-length rate.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";

const SAMPLES = 720; // points sampled along the closed curve
const MARGIN = 6; // viewBox units of breathing room around the fitted rosette
const VIEW = 100;
const GLIDE_MS = 260; // determinate ease, matched to the CSS transition below
const SWEEP_MS = 2400; // one full traversal in indeterminate mode
const DASH = 0.18; // indeterminate window, as a fraction of arc length

const CSS = `
.ns-sg-trace{transition:stroke-dashoffset ${GLIDE_MS}ms cubic-bezier(.33,1,.68,1)}
.ns-sg-sweep{animation:ns-sg-sweep ${SWEEP_MS}ms linear infinite}
@keyframes ns-sg-sweep{from{stroke-dashoffset:0}to{stroke-dashoffset:-1}}
@media (prefers-reduced-motion: reduce){
  .ns-sg-trace{transition:none}
  .ns-sg-sweep{animation:none}
}
`;

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

function easeOutCubic(p: number): number {
  return 1 - (1 - p) ** 3;
}

/** Sample the hypotrochoid once and fit it into the viewBox with a margin. */
function buildRosette(R: number, r: number, d: number): string {
  const turns = Math.max(1, Math.round(r / gcd(Math.round(R), Math.round(r))));
  const phiMax = 2 * Math.PI * turns;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const phi = (i / SAMPLES) * phiMax;
    xs.push((R - r) * Math.cos(phi) + d * Math.cos(((R - r) / r) * phi));
    ys.push((R - r) * Math.sin(phi) - d * Math.sin(((R - r) / r) * phi));
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    if (xs[i] < minX) minX = xs[i];
    if (xs[i] > maxX) maxX = xs[i];
    if (ys[i] < minY) minY = ys[i];
    if (ys[i] > maxY) maxY = ys[i];
  }
  const span = VIEW - MARGIN * 2;
  const scale = Math.min(span / (maxX - minX || 1), span / (maxY - minY || 1));
  const ox = (VIEW - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (VIEW - (maxY - minY) * scale) / 2 - minY * scale;
  const pt = (i: number) =>
    `${(xs[i] * scale + ox).toFixed(2)} ${(ys[i] * scale + oy).toFixed(2)}`;
  let out = `M ${pt(0)}`;
  for (let i = 1; i < SAMPLES; i++) out += ` L ${pt(i)}`;
  return `${out} Z`;
}

export interface SpiroTraceProps {
  /** progress 0-100. Leave undefined for indeterminate (a travelling sweep). */
  value?: number;
  /** glyph size in px. */
  size?: number;
  /** accessible name for the progressbar. */
  label?: string;
  /** fixed radius of the spirograph ring. */
  R?: number;
  /** rolling radius. gcd(R, r) = 1 keeps the rosette a single closed curve. */
  r?: number;
  /** pen offset from the rolling circle's centre. */
  d?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SpiroTrace({
  value,
  size = 160,
  label = "Loading",
  R = 5,
  r = 3,
  d = 2.1,
  className = "",
}: SpiroTraceProps) {
  const indeterminate = value == null || Number.isNaN(value);
  const target = indeterminate ? 0 : Math.min(100, Math.max(0, value ?? 0)) / 100;

  const path = useMemo(() => buildRosette(R, r, d), [R, r, d]);
  // the curve's first sampled point, parsed straight back out of the path
  // string: it is where the pen is parked before the effect measures the
  // path, so the very first painted frame already shows the dot on the curve
  // rather than off-canvas.
  const start = useMemo(() => {
    const m = path.slice(2, path.indexOf(" L")).split(" ");
    return { x: Number(m[0]), y: Number(m[1]) };
  }, [path]);

  const ghostRef = useRef<SVGPathElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGCircleElement>(null);
  // last progress actually painted, in arc-length fraction — the indeterminate
  // sweep keeps writing to it, which is how a real value converges from where
  // the window happened to be rather than restarting from zero.
  const displayRef = useRef(indeterminate ? 0 : target);
  const wasIndetRef = useRef(indeterminate);

  useEffect(() => {
    const ghost = ghostRef.current;
    const trace = traceRef.current;
    const pen = penRef.current;
    if (!ghost || !trace || !pen) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const total = ghost.getTotalLength();
    let raf = 0;

    const placePen = (p: number) => {
      const at = ((p % 1) + 1) % 1;
      const pt = ghost.getPointAtLength(at * total);
      pen.setAttribute("cx", pt.x.toFixed(2));
      pen.setAttribute("cy", pt.y.toFixed(2));
    };

    if (indeterminate) {
      trace.style.transition = "";
      trace.style.strokeDashoffset = "0";
      wasIndetRef.current = true;
      if (reduced) {
        // static window: the same shape, frozen at a fixed offset, still legible
        displayRef.current = DASH;
        placePen(DASH);
        return;
      }
      const start = performance.now();
      const loop = (now: number) => {
        // constant arc-length rate: one full traversal per SWEEP_MS
        const head = (((now - start) / SWEEP_MS) % 1) + DASH;
        displayRef.current = head % 1;
        placePen(head);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }

    const from = displayRef.current;

    if (wasIndetRef.current) {
      // Coming out of the sweep: seed the inline dashoffset at wherever the
      // window's head was, with the transition suppressed for that one write,
      // so the following write to `target` glides from there instead of
      // snapping back to an empty ring.
      trace.style.transition = "none";
      trace.style.strokeDashoffset = String(1 - from);
      void trace.getBoundingClientRect(); // force a style recalc before re-enabling
      trace.style.transition = "";
      wasIndetRef.current = false;
    }
    trace.style.strokeDashoffset = String(1 - target);

    if (reduced || Math.abs(target - from) < 1e-4) {
      displayRef.current = target;
      placePen(target);
      return;
    }

    // the pen only needs a loop while progress is in flight; it stops after
    const startedAt = performance.now();
    const loop = (now: number) => {
      const p = Math.min(1, (now - startedAt) / GLIDE_MS);
      const at = from + (target - from) * easeOutCubic(p);
      displayRef.current = at;
      placePen(at);
      raf = p < 1 ? requestAnimationFrame(loop) : 0;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [indeterminate, target, path]);

  const pct = Math.round(target * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      // omitted entirely while indeterminate — that absence IS the signal
      aria-valuenow={indeterminate ? undefined : pct}
      data-spiro-trace
      className={`inline-flex items-center gap-4 ${className}`}
    >
      <style>{CSS}</style>
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="shrink-0 overflow-visible"
      >
        {/* the whole closed rosette, always visible: the route, not a track */}
        <path
          ref={ghostRef}
          d={path}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.22}
          strokeWidth={1.1}
          strokeLinejoin="round"
        />
        {/* the inked fraction of that same curve */}
        <path
          ref={traceRef}
          className={`ns-sg-trace${indeterminate ? " ns-sg-sweep" : ""}`}
          d={path}
          pathLength={1}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.92}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={indeterminate ? `${DASH} ${1 - DASH}` : "1 1"}
          style={{ strokeDashoffset: indeterminate ? 0 : 1 - target }}
        />
        {/* the pen, riding the curve at the current position */}
        <circle ref={penRef} r={2.2} cx={start.x} cy={start.y} fill="var(--ns-accent)" />
      </svg>

      <span aria-hidden="true" className="font-mono text-sm tabular-nums text-ns-muted">
        {indeterminate ? "———" : `${pct}%`}
      </span>
    </div>
  );
}
