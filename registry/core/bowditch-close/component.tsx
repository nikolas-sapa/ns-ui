"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BowditchClose — a geofence/traverse editor built like a real closed survey
// traverse, not a stock "click a ring" polygon tool. Every corner you place
// is a leg; when you click back near the start the loop does NOT snap shut —
// that click becomes its own vertex (the point where your closing sight
// actually landed), and the gap between it and the true start is drawn as an
// --ns-accent hairline: the misclosure. Nothing is hidden or auto-corrected.
//
// The ONE governing scalar is the misclosure vector (dx, dy) between the
// closing vertex and vertex 0. Pressing "Balance traverse" runs the 1807
// Bowditch compass rule: each vertex i is corrected by
//   misclosure * (chainage_i / totalPerimeter)
// — chainage_i being the cumulative leg distance walked to reach it. Vertex 0
// (chainage 0) never moves; the closing vertex (chainage = totalPerimeter)
// gets the FULL misclosure and lands exactly on vertex 0, merging into it.
// Every vertex in between moves a fraction set by how much distance it
// carries — never equal-per-vertex, never all dumped on the last point. That
// gradation IS the falsifiable content of the rule: short first legs stay
// almost put, the long final leg absorbs most of the correction, because
// error is assumed proportional to distance run, not to vertex count.
//
// All corrections are pre-computed once (target_i = origin_i + correction_i)
// and then every vertex is driven by ONE shared spring scalar s: 0 -> 1
// (near-critically damped, one small overshoot), position_i = origin_i +
// (target_i - origin_i) * s. That is what makes it read as a drawstring
// pulling the whole ring taut at once, not one point jumping to close a gap.
//
// Distinct from stock polygon tools: this never silently teleports the last
// click onto the first. The gap is drawn, its precision graded live
// ("1:4300", Geist Mono) as a Bowditch survey report would, and closing it is
// an explicit, announced, undoable-until-pressed action. DOM + SVG + CSS
// only, tokens only, no canvas.
// ---------------------------------------------------------------------------

export interface BowditchPoint {
  x: number;
  y: number;
}

export interface BowditchCloseResult {
  ratio: number;
  areaHectares: number;
  perimeterMeters: number;
}

export interface BowditchCloseProps {
  /** vertices already placed, in local px coordinates */
  initialVertices?: BowditchPoint[];
  /** true when the last entry of initialVertices is already the misclosure/closing point */
  initialClosed?: boolean;
  /** canvas size in px */
  width?: number;
  height?: number;
  /** px per metre — governs the 1 m / 10 m nudge step and the area readout */
  pxPerMeter?: number;
  /** fires once, the moment Balance finishes */
  onBalance?: (result: BowditchCloseResult) => void;
  /** accessible label prefix for the drawing region */
  label?: string;
  className?: string;
}

type Phase = "drawing" | "unbalanced" | "balancing" | "balanced";

const CLOSE_RADIUS = 22; // px — how near vertex 0 a click must land to become the closing vertex
const VERTEX_R = 6; // 12px circle
const SPRING_K = 230;
const SPRING_ZETA = 0.9; // just under critical — one small overshoot, like a drawstring taking up the last of the slack
const SPRING_C = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
const REST_S = 0.01;
const REST_V = 0.015;

function dist(a: BowditchPoint, b: BowditchPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function chainageOf(vs: BowditchPoint[]): number[] {
  const c = [0];
  for (let i = 1; i < vs.length; i++) c.push(c[i - 1] + dist(vs[i - 1], vs[i]));
  return c;
}

function shoelaceArea(vs: BowditchPoint[]): number {
  let s = 0;
  for (let i = 0; i < vs.length; i++) {
    const a = vs[i];
    const b = vs[(i + 1) % vs.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function pathFrom(vs: BowditchPoint[], close: boolean): string {
  if (vs.length === 0) return "";
  let d = `M ${vs[0].x.toFixed(2)} ${vs[0].y.toFixed(2)}`;
  for (let i = 1; i < vs.length; i++) d += ` L ${vs[i].x.toFixed(2)} ${vs[i].y.toFixed(2)}`;
  if (close) d += " Z";
  return d;
}

export function BowditchClose({
  initialVertices,
  initialClosed = false,
  width = 440,
  height = 300,
  pxPerMeter = 5,
  onBalance,
  label = "Geofence traverse",
  className = "",
}: BowditchCloseProps) {
  const uid = useId().replace(/[:]/g, "");

  const startPhase: Phase = initialClosed && (initialVertices?.length ?? 0) >= 4 ? "unbalanced" : "drawing";

  const [verts, setVerts] = useState<BowditchPoint[]>(() => initialVertices?.map((p) => ({ ...p })) ?? []);
  const [phase, setPhase] = useState<Phase>(startPhase);
  const [renderVerts, setRenderVerts] = useState<BowditchPoint[] | null>(null);
  const [frozenRatio, setFrozenRatio] = useState<number | null>(null);
  const [reducedGhost, setReducedGhost] = useState<BowditchPoint[] | null>(null);
  const [reduced, setReduced] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const vertexRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const springRef = useRef<{
    raf: number;
    s: number;
    vel: number;
    origins: BowditchPoint[];
    targets: BowditchPoint[];
    lastT: number;
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(
    () => () => {
      if (springRef.current) cancelAnimationFrame(springRef.current.raf);
    },
    []
  );

  // pts is the single source both the ring/hairline drawing and the vertex
  // buttons read from — during the tween that is the interpolated frame,
  // otherwise it is the committed vertex list.
  const pts = phase === "balancing" && renderVerts ? renderVerts : verts;

  const chainage = useMemo(() => chainageOf(verts), [verts]);
  const totalRun = chainage[chainage.length - 1] ?? 0;
  const misclosureMag =
    phase !== "drawing" && verts.length > 0 ? dist(verts[0], verts[verts.length - 1]) : 0;
  const liveRatio = misclosureMag > 0 && totalRun > 0 ? totalRun / misclosureMag : null;
  const ratioToShow = phase === "balanced" || phase === "balancing" ? frozenRatio : liveRatio;

  const finalize = useCallback(
    (targets: BowditchPoint[], ratio: number) => {
      const closedRing = targets.slice(0, -1);
      const perimeterPx = chainageOf(targets)[targets.length - 1] ?? 0;
      const areaPx2 = shoelaceArea(closedRing);
      const perimeterMeters = perimeterPx / pxPerMeter;
      const areaHectares = areaPx2 / (pxPerMeter * pxPerMeter) / 10000;

      setVerts(closedRing);
      setPhase("balanced");
      setRenderVerts(null);
      springRef.current = null;
      onBalance?.({ ratio, areaHectares, perimeterMeters });

      // the closing vertex just merged into vertex 0 — if it (or anything
      // past the new end) held focus, land it on vertex 0 rather than losing
      // focus to the document.
      const active = document.activeElement;
      const stillMounted = active instanceof HTMLElement && containerRef.current?.contains(active);
      if (!stillMounted || (active && !closedRing.some((_, i) => vertexRefs.current.get(i) === active))) {
        vertexRefs.current.get(0)?.focus();
      }
    },
    [onBalance, pxPerMeter]
  );

  const runSpring = useCallback(
    (origins: BowditchPoint[], targets: BowditchPoint[], ratio: number) => {
      springRef.current = { raf: 0, s: 0, vel: 0, origins, targets, lastT: 0 };
      const tick = (now: number) => {
        const st = springRef.current;
        if (!st) return;
        const dt = st.lastT === 0 ? 1 / 60 : Math.min(0.032, (now - st.lastT) / 1000);
        st.lastT = now;
        const disp = st.s - 1;
        st.vel += (-SPRING_K * disp - SPRING_C * st.vel) * dt;
        st.s += st.vel * dt;
        const frame = st.origins.map((o, i) => ({
          x: o.x + (st.targets[i].x - o.x) * st.s,
          y: o.y + (st.targets[i].y - o.y) * st.s,
        }));
        setRenderVerts(frame);
        if (Math.abs(st.s - 1) < REST_S && Math.abs(st.vel) < REST_V) {
          finalize(st.targets, ratio);
          return;
        }
        st.raf = requestAnimationFrame(tick);
      };
      springRef.current.raf = requestAnimationFrame(tick);
    },
    [finalize]
  );

  const onBalancePress = useCallback(() => {
    if (phase !== "unbalanced") return;
    const n = verts.length - 1;
    const total = chainage[n] ?? 0;
    if (total <= 0 || liveRatio === null) return;
    const ratioAtClose = liveRatio;
    const misclosure = { dx: verts[0].x - verts[n].x, dy: verts[0].y - verts[n].y };
    const targets = verts.map((v, i) => ({
      x: v.x + misclosure.dx * (chainage[i] / total),
      y: v.y + misclosure.dy * (chainage[i] / total),
    }));
    setFrozenRatio(ratioAtClose);

    if (reduced) {
      setReducedGhost(verts.slice(0, -1));
      finalize(targets, ratioAtClose);
      return;
    }
    setPhase("balancing");
    runSpring(
      verts.map((v) => ({ ...v })),
      targets,
      ratioAtClose
    );
  }, [phase, verts, chainage, liveRatio, reduced, finalize, runSpring]);

  const onReset = useCallback(() => {
    if (springRef.current) cancelAnimationFrame(springRef.current.raf);
    springRef.current = null;
    setVerts([]);
    setPhase("drawing");
    setRenderVerts(null);
    setFrozenRatio(null);
    setReducedGhost(null);
  }, []);

  const localPoint = useCallback(
    (e: { clientX: number; clientY: number }): BowditchPoint => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const sx = width / rect.width;
      const sy = height / rect.height;
      return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
    },
    [width, height]
  );

  const onCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (phase !== "drawing") return;
      const pt = localPoint(e);
      if (verts.length >= 3 && dist(pt, verts[0]) <= CLOSE_RADIUS) {
        setVerts([...verts, pt]);
        setPhase("unbalanced");
        return;
      }
      setVerts((vs) => [...vs, pt]);
    },
    [phase, verts, localPoint]
  );

  const onVertexKeyDown = useCallback(
    (i: number, e: React.KeyboardEvent) => {
      if (phase === "balancing") return;
      let dx = 0;
      let dy = 0;
      const step = (e.shiftKey ? 10 : 1) * pxPerMeter;
      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else return;
      e.preventDefault();
      setVerts((vs) => vs.map((v, idx) => (idx === i ? { x: v.x + dx, y: v.y + dy } : v)));
    },
    [phase, pxPerMeter]
  );

  const closed = phase === "balanced";
  const showHairline = phase === "unbalanced" || phase === "balancing";
  const showCloseHint = phase === "drawing" && verts.length >= 3;
  const ringPath = pathFrom(pts, closed);
  const gapFrom = pts[pts.length - 1];
  const gapTo = pts[0];

  const areaHa = closed ? shoelaceArea(verts) / (pxPerMeter * pxPerMeter) / 10000 : null;

  const statusText =
    phase === "drawing"
      ? verts.length === 0
        ? "click to place the first corner"
        : `placing corners — ${verts.length} placed${showCloseHint ? ", click near the start to close" : ""}`
      : phase === "unbalanced"
        ? `traverse closed, 1:${ratioToShow ? Math.round(ratioToShow) : "—"} — balance to close the gap`
        : phase === "balancing"
          ? "balancing…"
          : `closed, 1:${ratioToShow ? Math.round(ratioToShow) : "—"}`;

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <div
        ref={containerRef}
        className="relative touch-none select-none rounded-md border border-border bg-background"
        style={{ width, height }}
        aria-label={label}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden
          className="absolute inset-0"
        >
          <defs>
            <pattern id={`${uid}-stipple`} x={0} y={0} width={8} height={8} patternUnits="userSpaceOnUse">
              <circle cx={2} cy={2} r={1} fill="var(--border)" />
            </pattern>
          </defs>

          {/* background click surface — pointer-only, placing a vertex has no
              natural keyboard equivalent; editing (arrow-key nudge) is fully
              keyboard operable below */}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onClick={onCanvasClick}
            style={{ cursor: phase === "drawing" ? "crosshair" : "default" }}
          />

          {reducedGhost && closed ? (
            <path
              d={pathFrom(reducedGhost, false)}
              fill="none"
              stroke="var(--ns-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}

          {showCloseHint ? (
            <circle
              cx={verts[0].x}
              cy={verts[0].y}
              r={CLOSE_RADIUS}
              fill="none"
              stroke="var(--ns-muted)"
              strokeWidth={1}
              strokeDasharray="2 3"
            />
          ) : null}

          {ringPath ? (
            <path
              d={ringPath}
              fill={closed ? `url(#${uid}-stipple)` : "none"}
              stroke="var(--border)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ) : null}

          {showHairline && gapFrom && gapTo ? (
            <line
              x1={gapFrom.x}
              y1={gapFrom.y}
              x2={gapTo.x}
              y2={gapTo.y}
              stroke="var(--ns-accent)"
              strokeWidth={1.5}
            />
          ) : null}
        </svg>

        <div className="absolute inset-0">
          {pts.map((p, i) => (
            <button
              key={i}
              ref={(el) => {
                if (el) vertexRefs.current.set(i, el);
                else vertexRefs.current.delete(i);
              }}
              type="button"
              disabled={phase === "balancing"}
              onKeyDown={(e) => onVertexKeyDown(i, e)}
              aria-label={`Vertex ${i + 1} of ${pts.length}${i === pts.length - 1 && phase === "unbalanced" ? ", misclosure point" : ""}`}
              className="absolute rounded-full border border-border bg-background transition-colors duration-150 hover:border-ns-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              style={{
                left: p.x - VERTEX_R,
                top: p.y - VERTEX_R,
                width: VERTEX_R * 2,
                height: VERTEX_R * 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-bowditch-balance
            disabled={phase !== "unbalanced"}
            onClick={onBalancePress}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-ns-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Balance traverse
          </button>
          <button
            type="button"
            data-bowditch-reset
            disabled={phase === "balancing"}
            onClick={onReset}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            New traverse
          </button>
        </div>

        <div role="status" aria-live="polite" className="font-mono text-[11px] text-ns-muted">
          {statusText}
          {closed && areaHa !== null ? (
            <span data-bowditch-area className="text-foreground">
              {`, area ${areaHa.toFixed(1)} ha`}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
