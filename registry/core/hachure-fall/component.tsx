"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// HachureFall — a route elevation profile drawn the way 18th-century military
// engravers drew slope: short strokes perpendicular to the profile line,
// hanging down the fall direction, whose LENGTH and DENSITY are both driven
// by one governing scalar, the local grade g = dh/dx. A flat kilometre earns
// no ink; a 12% ramp earns a dense comb. There is deliberately no colour
// ramp anywhere in this file — colour is the legend hachures were invented
// to remove, and re-introducing it here would defeat the point.
//
// GEOMETRY: the elevation curve itself is auto-fit to a fixed internal band
// (CURVE_BAND_H) purely so the route has a recognisable silhouette — that
// vertical fit is an ordinary chart auto-scale, computed once from the data,
// never exposed as a control. It is NOT the source of stroke length. Stroke
// length comes from the real-world grade percentage (elevation-metres over
// distance-metres), multiplied by the fixed constant K = STROKE_UNIT_PX /
// UNIT_GRADE_PCT, printed in the corner as "1 stroke-height = 5% grade".
// Because the two scales are independent, two routes drawn at different
// auto-fit heights still produce numerically comparable hachures — which is
// the whole reason a vertical-exaggeration SLIDER is refused here: exposing
// one would let a reader silently change what an identical stroke length
// means between two profiles, exactly the dishonesty hachure marks exist to
// prevent. K is a module constant, not a prop.
//
// Every segment's hachures are emitted as ONE <path> (a run of "M..L.."
// subpaths), not one DOM node per stroke — generated from data, never
// hand-placed. Spacing follows spacing = S0 / (1 + |g|) (g as a fraction),
// so a steep segment's ticks crowd together while a flat one thins to
// nothing under MIN_LEN_PX and draws no ticks at all.
//
// SCRUB CURSOR: pointer or keyboard sets a target km; the rendered cursor
// (and which segment is "active" — promoted from --ns-muted to --foreground,
// its ticks lifted ~2px like bristles under a thumb) tracks a 90ms
// critically damped spring toward that target, not the raw input. An
// undamped 1:1 follow flickers across segment boundaries on noisy real
// elevation data; a longer/underdamped spring feels detached from the
// pointer. The spring only runs while hovered or focused — there is no
// resting position to relax back to, the cursor simply appears/disappears.
//
// A11Y: the track itself is role="slider" over distance (km), with
// aria-valuetext "km 14.2, 220 m elevation, 9% climb". PageUp/PageDown do
// not step a fixed distance — they jump to the next point where the grade's
// classification bucket (flat / easy / moderate / steep / very steep, signed
// by climb vs descent) changes, a real navigation unit for a route rather
// than an arbitrary number of km. aria-describedby points at a static
// plain-text shape summary (total climb, named climbs, the single steepest
// point) so the drawing's information survives without vision, independent
// of live scrubbing.
// ---------------------------------------------------------------------------

export interface ElevationPoint {
  /** distance along the route, kilometres, strictly increasing */
  km: number;
  /** elevation at that distance, metres */
  m: number;
}

export interface HachureFallProps {
  /** elevation samples, ordered by km. Needs at least 2 points. */
  data?: ElevationPoint[];
  /** accessible name for the slider. Default "Route elevation profile". */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// -- fixed constants: the falsifiable, non-adjustable half of the contract --
const VW = 760; // internal SVG coordinate width
const PAD_X = 12; // internal px, left/right inset for the plotted curve
const TOP_PAD = 18; // internal px above the curve band
const CURVE_BAND_H = 88; // internal px the elevation silhouette auto-fits into
const HACHURE_ROOM = 66; // internal px reserved below the curve for strokes
const VH = TOP_PAD + CURVE_BAND_H + HACHURE_ROOM;

const STROKE_UNIT_PX = 14; // "1 stroke-height" — the printed legend unit
const UNIT_GRADE_PCT = 5; // ...corresponds to this many percent grade
const K = STROKE_UNIT_PX / UNIT_GRADE_PCT; // px of stroke per percent grade — FIXED
const MAX_LEN_PX = 58; // hard visual ceiling so absurd grades don't blow the layout
const MIN_LEN_PX = 0.6; // below this, draw nothing — the "nearly blank" flat case
const S0 = 9; // base tick spacing (internal px) at ~0 grade

const CURSOR_LIFT_PX = 2; // bristle lift near the scrub cursor
const CURSOR_WINDOW_PX = 42; // internal px falloff radius for the lift

const SPRING_K = 4200; // s^-2 — tuned so the critically damped response settles ~90ms
const SPRING_C = 2 * Math.sqrt(SPRING_K); // critical damping: c = 2*sqrt(k)

const CLASS_BOUNDS = [2, 4, 7, 10]; // abs% grade thresholds separating classes

const DEFAULT_DATA: ElevationPoint[] = [
  { km: 0, m: 140 },
  { km: 1, m: 142 },
  { km: 2, m: 146 },
  { km: 3, m: 148 },
  { km: 4, m: 150 },
  { km: 4.5, m: 172 },
  { km: 5, m: 210 },
  { km: 5.5, m: 258 },
  { km: 6, m: 298 },
  { km: 6.5, m: 322 },
  { km: 7, m: 330 },
  { km: 8, m: 332 },
  { km: 9, m: 328 },
  { km: 10, m: 330 },
  { km: 11, m: 335 },
  { km: 12, m: 338 },
  { km: 13, m: 336 },
  { km: 14, m: 340 },
  { km: 15, m: 344 },
  { km: 16, m: 342 },
  { km: 17, m: 300 },
  { km: 17.5, m: 260 },
  { km: 18, m: 224 },
  { km: 18.5, m: 196 },
  { km: 19, m: 180 },
  { km: 20, m: 178 },
  { km: 21, m: 182 },
  { km: 21.5, m: 210 },
  { km: 22, m: 254 },
  { km: 22.4, m: 296 },
  { km: 22.8, m: 336 },
  { km: 23.2, m: 372 },
  { km: 23.6, m: 400 },
  { km: 24, m: 412 },
  { km: 25, m: 414 },
  { km: 26, m: 410 },
  { km: 27, m: 412 },
  { km: 28, m: 408 },
];

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function classIndexFor(gradePct: number): number {
  const mag = Math.abs(gradePct);
  let bucket = 0;
  for (let i = 0; i < CLASS_BOUNDS.length; i++) {
    if (mag >= CLASS_BOUNDS[i]) bucket = i + 1;
  }
  if (bucket === 0) return 0; // flat, sign doesn't matter
  return gradePct > 0 ? bucket : -bucket;
}

function gradeWord(gradePct: number): string {
  const r = Math.round(Math.abs(gradePct));
  if (gradePct > 0.5) return `${r}% climb`;
  if (gradePct < -0.5) return `${r}% descent`;
  return "flat";
}

interface Point {
  x: number;
  y: number;
}

interface Tick {
  frac: number; // 0..1 along the segment
  bx: number;
  by: number;
  px: number; // unit perpendicular x
  py: number; // unit perpendicular y
  baseLen: number;
}

interface Segment {
  index: number;
  kmStart: number;
  kmEnd: number;
  gradePct: number;
  p0: Point;
  p1: Point;
  dx: number;
  dy: number;
  lenPx: number;
  dBase: string;
  ticks: Tick[];
}

function tickPathD(bx: number, by: number, px: number, py: number, len: number): string {
  const ex = bx + px * len;
  const ey = by + py * len;
  return `M${bx.toFixed(2)},${by.toFixed(2)}L${ex.toFixed(2)},${ey.toFixed(2)}`;
}

function buildSegments(data: ElevationPoint[]): Segment[] {
  if (data.length < 2) return [];
  const elevs = data.map((d) => d.m);
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const range = Math.max(1, maxElev - minElev);
  const totalKm = data[data.length - 1].km || 1;
  const plotW = VW - PAD_X * 2;

  const project = (p: ElevationPoint): Point => ({
    x: PAD_X + (p.km / totalKm) * plotW,
    y: TOP_PAD + CURVE_BAND_H * (1 - (p.m - minElev) / range),
  });

  const segments: Segment[] = [];
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    const p0 = project(a);
    const p1 = project(b);
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const lenPx = Math.hypot(dx, dy);
    const distM = (b.km - a.km) * 1000;
    const gradePct = distM > 0 ? ((b.m - a.m) / distM) * 100 : 0;

    if (lenPx < 0.01) {
      segments.push({ index: i, kmStart: a.km, kmEnd: b.km, gradePct, p0, p1, dx, dy, lenPx: 0.01, dBase: "", ticks: [] });
      continue;
    }

    const tx = dx / lenPx;
    const ty = dy / lenPx;
    // perpendicular, oriented so its y-component is non-negative — "down"
    // in screen space, i.e. the fall direction, regardless of climb or
    // descent sign
    let px = -ty;
    let py = tx;
    if (py < 0 || (py === 0 && px < 0)) {
      px = -px;
      py = -py;
    }

    const strokeLen = clamp(K * Math.abs(gradePct), 0, MAX_LEN_PX);
    const ticks: Tick[] = [];
    let dParts = "";

    if (strokeLen >= MIN_LEN_PX) {
      const spacing = S0 / (1 + Math.abs(gradePct) / 100);
      const nTicks = Math.max(1, Math.min(400, Math.floor(lenPx / spacing)));
      for (let k = 0; k < nTicks; k++) {
        const frac = (k + 0.5) / nTicks;
        const bx = p0.x + dx * frac;
        const by = p0.y + dy * frac;
        ticks.push({ frac, bx, by, px, py, baseLen: strokeLen });
        dParts += tickPathD(bx, by, px, py, strokeLen);
      }
    }

    segments.push({
      index: i,
      kmStart: a.km,
      kmEnd: b.km,
      gradePct,
      p0,
      p1,
      dx,
      dy,
      lenPx,
      dBase: dParts,
      ticks,
    });
  }
  return segments;
}

function profilePath(data: ElevationPoint[], segments: Segment[]): string {
  if (segments.length === 0) return "";
  let d = `M${segments[0].p0.x.toFixed(2)},${segments[0].p0.y.toFixed(2)}`;
  for (const s of segments) d += `L${s.p1.x.toFixed(2)},${s.p1.y.toFixed(2)}`;
  return d;
}

interface Climb {
  startKm: number;
  endKm: number;
  avgGradePct: number;
}

interface RouteSummary {
  text: string;
  boundaries: number[]; // km positions where the grade class changes
}

function summarizeRoute(data: ElevationPoint[], segments: Segment[]): RouteSummary {
  if (segments.length === 0) {
    return { text: "No elevation data.", boundaries: [] };
  }

  let totalClimbM = 0;
  for (let i = 0; i < data.length - 1; i++) {
    const rise = data[i + 1].m - data[i].m;
    if (rise > 0) totalClimbM += rise;
  }

  const boundaries: number[] = [];
  let prevClass = classIndexFor(segments[0].gradePct);
  for (let i = 1; i < segments.length; i++) {
    const cls = classIndexFor(segments[i].gradePct);
    if (cls !== prevClass) boundaries.push(segments[i].kmStart);
    prevClass = cls;
  }

  // group consecutive "climbing" segments (>3% grade) into named climbs,
  // weighting the average grade by distance
  const climbs: Climb[] = [];
  let cur: { startKm: number; endKm: number; distM: number; gainM: number } | null = null;
  for (const s of segments) {
    if (s.gradePct > 3) {
      const distM = (s.kmEnd - s.kmStart) * 1000;
      const gainM = distM * (s.gradePct / 100);
      if (cur) {
        cur.endKm = s.kmEnd;
        cur.distM += distM;
        cur.gainM += gainM;
      } else {
        cur = { startKm: s.kmStart, endKm: s.kmEnd, distM, gainM };
      }
    } else if (cur) {
      climbs.push({ startKm: cur.startKm, endKm: cur.endKm, avgGradePct: (cur.gainM / cur.distM) * 100 });
      cur = null;
    }
  }
  if (cur) climbs.push({ startKm: cur.startKm, endKm: cur.endKm, avgGradePct: (cur.gainM / cur.distM) * 100 });

  let steepest = segments[0];
  for (const s of segments) if (Math.abs(s.gradePct) > Math.abs(steepest.gradePct)) steepest = s;
  const steepestKm = (steepest.kmStart + steepest.kmEnd) / 2;

  const climbText = climbs.length
    ? `${climbs.length} climb${climbs.length === 1 ? "" : "s"}: ${climbs
        .map((c) => `km ${c.startKm.toFixed(0)}–${c.endKm.toFixed(0)} avg ${Math.round(c.avgGradePct)}%`)
        .join(", ")}`
    : "no sustained climbs";

  const text = `total climb ${Math.round(totalClimbM)} m; ${climbText}; steepest ${Math.round(
    Math.abs(steepest.gradePct)
  )}% at km ${steepestKm.toFixed(1)}`;

  return { text, boundaries };
}

function findSegmentIndex(segments: Segment[], km: number): number {
  if (segments.length === 0) return -1;
  if (km <= segments[0].kmStart) return 0;
  const last = segments[segments.length - 1];
  if (km >= last.kmEnd) return segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (km >= segments[i].kmStart && km <= segments[i].kmEnd) return i;
  }
  return segments.length - 1;
}

function elevationAt(data: ElevationPoint[], km: number): number {
  if (data.length === 0) return 0;
  if (km <= data[0].km) return data[0].m;
  const last = data[data.length - 1];
  if (km >= last.km) return last.m;
  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    if (km >= a.km && km <= b.km) {
      const frac = b.km === a.km ? 0 : (km - a.km) / (b.km - a.km);
      return a.m + (b.m - a.m) * frac;
    }
  }
  return last.m;
}

export function HachureFall({
  data = DEFAULT_DATA,
  label = "Route elevation profile",
  className = "",
}: HachureFallProps) {
  const uid = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const cursorGroupRef = useRef<SVGGElement>(null);
  const cursorDotRef = useRef<SVGCircleElement>(null);

  const segments = useMemo(() => buildSegments(data), [data]);
  const totalKm = data.length > 0 ? data[data.length - 1].km : 0;
  const outline = useMemo(() => profilePath(data, segments), [data, segments]);
  const summary = useMemo(() => summarizeRoute(data, segments), [data, segments]);

  const [active, setActive] = useState(false);
  const [announceKm, setAnnounceKm] = useState(0);

  const reducedRef = useRef(false);
  const targetKmRef = useRef(0);
  const springKmRef = useRef(0);
  const velRef = useRef(0);
  const activeSegRef = useRef(-1);
  const rafRef = useRef(0);
  const lastTRef = useRef(0);
  const lastAnnouncedRef = useRef(-1);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // reset any lifted path back to its resting geometry/colour
  const restoreSegment = useCallback((idx: number) => {
    const el = pathRefs.current[idx];
    const seg = segments[idx];
    if (!el || !seg) return;
    el.setAttribute("d", seg.dBase);
    el.setAttribute("stroke", "var(--ns-muted)");
  }, [segments]);

  const applyFrame = useCallback(() => {
    const km = clamp(springKmRef.current, 0, totalKm);
    const segIdx = findSegmentIndex(segments, km);

    if (segIdx !== activeSegRef.current) {
      if (activeSegRef.current >= 0) restoreSegment(activeSegRef.current);
      activeSegRef.current = segIdx;
      const el = pathRefs.current[segIdx];
      if (el) el.setAttribute("stroke", "var(--foreground)");
    }

    const seg = segments[segIdx];
    if (seg) {
      const el = pathRefs.current[segIdx];
      if (el && seg.ticks.length > 0) {
        const segFrac = seg.lenPx > 0 ? clamp((km - seg.kmStart) / Math.max(1e-6, seg.kmEnd - seg.kmStart), 0, 1) : 0;
        let d = "";
        for (const t of seg.ticks) {
          const distPx = seg.lenPx * Math.abs(t.frac - segFrac);
          const liftFactor = reducedRef.current ? 0 : clamp(1 - distPx / CURSOR_WINDOW_PX, 0, 1);
          const len = t.baseLen + CURSOR_LIFT_PX * liftFactor;
          d += tickPathD(t.bx, t.by, t.px, t.py, len);
        }
        el.setAttribute("d", d);
      }

      const p0 = seg.p0;
      const frac = clamp((km - seg.kmStart) / Math.max(1e-6, seg.kmEnd - seg.kmStart), 0, 1);
      const cx = p0.x + seg.dx * frac;
      const cy = p0.y + seg.dy * frac;
      if (cursorGroupRef.current) cursorGroupRef.current.setAttribute("transform", `translate(${cx.toFixed(2)},0)`);
      if (cursorDotRef.current) {
        cursorDotRef.current.setAttribute("cx", "0");
        cursorDotRef.current.setAttribute("cy", cy.toFixed(2));
      }
    }

    const rounded = Math.round(km * 10) / 10;
    if (rounded !== lastAnnouncedRef.current) {
      lastAnnouncedRef.current = rounded;
      setAnnounceKm(rounded);
    }
  }, [segments, totalKm, restoreSegment]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    lastTRef.current = 0;
    const tick = (now: number) => {
      const dt = lastTRef.current === 0 ? 1 / 60 : Math.min(0.05, (now - lastTRef.current) / 1000);
      lastTRef.current = now;

      if (reducedRef.current) {
        springKmRef.current = targetKmRef.current;
        velRef.current = 0;
      } else {
        // semi-implicit Euler on this spring's stiffness needs omega*h well
        // under 1 to stay stable (omega = sqrt(SPRING_K) ~= 65 rad/s, so a
        // single 60fps step of ~16.7ms already overshoots that badly and
        // diverges exponentially frame over frame). Substep at a fixed small
        // h so the 90ms settle time from SPRING_K is preserved without
        // blowing up the integrator.
        const H = 0.004;
        const steps = Math.max(1, Math.ceil(dt / H));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          const err = springKmRef.current - targetKmRef.current;
          const acc = -SPRING_K * err - SPRING_C * velRef.current;
          velRef.current += acc * h;
          springKmRef.current += velRef.current * h;
        }
        // hard guard: no retune of the constants above should ever be able
        // to hand a NaN/out-of-range value to setAttribute downstream.
        springKmRef.current = clamp(springKmRef.current, 0, totalKm);
      }

      applyFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyFrame]);

  useEffect(() => stopLoop, [stopLoop]);

  const setTarget = useCallback(
    (km: number, immediate = false) => {
      const c = clamp(km, 0, totalKm);
      targetKmRef.current = c;
      if (immediate || reducedRef.current) {
        springKmRef.current = c;
        velRef.current = 0;
      }
      if (!active) setActive(true);
      startLoop();
    },
    [active, startLoop, totalKm]
  );

  const kmFromClientX = useCallback(
    (clientX: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return targetKmRef.current;
      const frac = clamp((clientX - rect.left) / rect.width, 0, 1);
      return frac * totalKm;
    },
    [totalKm]
  );

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    setTarget(kmFromClientX(e.clientX));
  };

  const onPointerLeave = () => {
    if (document.activeElement === rootRef.current) return;
    setActive(false);
    stopLoop();
    if (activeSegRef.current >= 0) {
      restoreSegment(activeSegRef.current);
      activeSegRef.current = -1;
    }
  };

  const onFocus = () => {
    setTarget(targetKmRef.current || 0, true);
  };

  const onBlur = () => {
    setActive(false);
    stopLoop();
    if (activeSegRef.current >= 0) {
      restoreSegment(activeSegRef.current);
      activeSegRef.current = -1;
    }
  };

  const stepSize = Math.max(0.1, totalKm / 200);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = clamp(springKmRef.current, 0, totalKm);
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        setTarget(current + stepSize);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        setTarget(current - stepSize);
        break;
      case "PageUp": {
        e.preventDefault();
        const next = summary.boundaries.find((b) => b > current + 1e-6);
        setTarget(next ?? totalKm);
        break;
      }
      case "PageDown": {
        e.preventDefault();
        const prev = [...summary.boundaries].reverse().find((b) => b < current - 1e-6);
        setTarget(prev ?? 0);
        break;
      }
      case "Home":
        e.preventDefault();
        setTarget(0);
        break;
      case "End":
        e.preventDefault();
        setTarget(totalKm);
        break;
      default:
        break;
    }
  };

  const elevNow = elevationAt(data, announceKm);
  const segNow = segments[findSegmentIndex(segments, announceKm)];
  const gradeNow = segNow ? segNow.gradePct : 0;
  const valueText = `km ${announceKm.toFixed(1)}, ${Math.round(elevNow)} m elevation, ${gradeWord(gradeNow)}`;
  const describeId = `hachure-fall-summary-${uid}`;

  return (
    <div className={`relative ${className}`}>
      <div
        ref={rootRef}
        data-hachure-fall-track=""
        role="slider"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={totalKm}
        aria-valuenow={Math.round(announceKm * 10) / 10}
        aria-valuetext={valueText}
        aria-describedby={describeId}
        className="relative w-full cursor-crosshair select-none rounded-[12px] border border-border bg-background px-2 pb-8 pt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block h-auto w-full"
          aria-hidden="true"
        >
          {/* the profile line itself — thin, subordinate to the hachures */}
          <path d={outline} fill="none" stroke="var(--border)" strokeWidth={1.25} />

          {segments.map((seg, i) => (
            <path
              key={seg.index}
              ref={(el) => {
                pathRefs.current[i] = el;
              }}
              d={seg.dBase}
              fill="none"
              stroke="var(--ns-muted)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          ))}

          <g ref={cursorGroupRef} style={{ opacity: active ? 1 : 0, transition: active ? undefined : "opacity 120ms ease-out" }}>
            <line x1={0} y1={0} x2={0} y2={VH} stroke="var(--ns-accent)" strokeWidth={1} strokeDasharray="2 3" />
            <circle ref={cursorDotRef} r={2.75} fill="var(--ns-accent)" />
          </g>
        </svg>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 left-2 font-mono text-[10px] tabular-nums text-ns-muted transition-opacity"
          style={{ opacity: active ? 1 : 0 }}
        >
          km {announceKm.toFixed(1)} · {Math.round(elevNow)} m · {gradeWord(gradeNow)}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[10px] text-ns-muted"
        >
          1 stroke-height = 5% grade
        </div>
      </div>

      <p id={describeId} className="sr-only">
        {summary.text}
      </p>
    </div>
  );
}
