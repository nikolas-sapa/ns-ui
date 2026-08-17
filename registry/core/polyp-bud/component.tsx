"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// PolypBud — a coral colony that accretes inward from one edge of its own
// container, one polyp at a time. It is a growth SIMULATION, not an authored
// branch grammar: every 300ms a round-robin timer visits the next living
// growth tip and proposes three candidate bud sites fanned off that tip's own
// heading; each candidate fires five shadow rays spread 15deg around the
// colony's current light direction and is only accepted (budded) if the mean
// fraction of unblocked rays exceeds 0.55 — "unblocked" meaning the ray
// segment reaches the light without crossing any of the colony's OWN existing
// segments. That self-intersection test is the entire mechanism: a tip on the
// colony's own lit face keeps clearing its rays and keeps budding; a tip
// tucked behind its own siblings stops clearing them and sits in stasis,
// re-tried every future round without ever winning again unless the geometry
// around it changes. Nothing about direction is drawn from a random branch
// table — flip the light angle and the SAME ray test starts favouring
// candidates on the opposite face within a handful of ticks, because the
// rays, not a lookup, decide who buds.
//
// Every successful bud walks straight up its own parent chain and deposits
// 0.4 units onto every ancestor segment (not just the fork point), so a
// segment's stroke width is literally how much of the colony still drains
// through it — old trunk near the seed edge goes visibly fat, a two-tick-old
// tip stays hairline. The content passed as `children` is measured (its
// real DOM rect, via ResizeObserver) and treated as a permanently shaded
// occluder with a 48px margin: any candidate whose distance to that box is
// under 48px scores zero exposure automatically, so the colony grows AWAY
// from the copy for the same reason it grows away from its own shadowed
// interior — there is no clip-path, the copy is just another thing blocking
// the light.
//
// The light direction itself drifts continuously (`lightDriftDegPerMin`,
// degrees/minute), which is what makes the whole colony visibly lean over
// time — every future bud is a little more biased toward wherever the light
// has drifted to, and the effect compounds because each generation buds off
// the previous generation's already-biased heading.
//
// Bleaching runs on its own independent random timer: an established branch
// (any non-seed node not already bleached/dead) is picked, every node in its
// subtree reads as var(--ns-muted) for ~2.6s (checked by walking each node's
// own ancestor chain for a bleach/death flag at render — nothing is copied
// down onto descendants, so a bleach or a recovery is a single Map write).
// Budding is paused anywhere under an active bleach. On resolution the
// branch either recovers (resumes budding, colour reverts) or, one time in
// roughly three, dies for good: its whole subtree freezes as var(--border)
// bare skeleton and is dropped from the round-robin permanently.
//
// Rendered as one <line> per skeleton segment plus a small 3-4px "cup" circle
// on every currently-queued growth tip, all stroked with currentColor so a
// single ancestor `color` (var(--foreground) live / var(--ns-muted) bleached
// / var(--border) dead) repaints the whole subtree on a theme switch for
// free. aria-hidden + pointer-events-none; `children` render as completely
// ordinary, independently-focusable DOM the colony only ever measures, never
// touches. prefers-reduced-motion runs the identical round-robin decision
// function synchronously up to 600 times at mount, against a fixed light
// angle and with bleaching never scheduled, then renders that one finished
// frame — the mechanism is unchanged, only its clock is removed.
// ---------------------------------------------------------------------------

type Edge = "left" | "right" | "top" | "bottom";
type Status = "live" | "bleached" | "dead";

interface PolypNode {
  x: number;
  y: number;
  parent: number; // -1 = seed, planted on the edge
  heading: number; // degrees, direction this node grew in from its parent
  deposit: number; // accumulated 0.4-unit deposits from every descendant bud
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PolypBudProps {
  /** Edge the colony's seeds are planted on and grows inward from. */
  edge?: Edge;
  /** The permanently shaded content the colony measures and grows away from. */
  children: ReactNode;
  /** Degrees the light direction drifts per minute — the colony's visible lean. */
  lightDriftDegPerMin?: number;
  /** Seed polyps planted along the edge at mount. */
  seedCount?: number;
  className?: string;
  id?: string;
}

const MAX_NODES = 400;
const TICK_MS = 300;
const RAY_COUNT = 5;
const RAY_SPREAD_DEG = 15;
const RAY_LEN = 46;
const EXPOSURE_THRESHOLD = 0.55;
const DEPOSIT_PER_BUD = 0.4;
const STEP_LEN = 15;
const CANDIDATE_OFFSETS_DEG = [-30, 0, 30];
const HEADING_JITTER_DEG = 8;
const CONTENT_MARGIN = 48;
const MIN_SEPARATION = STEP_LEN * 0.55;
const BLEACH_MIN_MS = 2600;
const BLEACH_MAX_MS = 5400;
const BLEACH_DURATION_MS = 2600;
const BLEACH_DEATH_PROB = 0.34;
const REDUCED_MOTION_ATTEMPTS = 600;
// Same synchronous round-robin the reduced-motion path runs, but shorter, and
// run in the animated path too: at TICK_MS=300 a cold mount shows five ~15px
// stubs for the first half-minute, which reads as an empty ornament rather
// than a colony. Prewarming leaves the live timer visibly budding (cap is
// MAX_NODES) while first paint is already a grown reef.
const PREWARM_ATTEMPTS = 300;
const WIDTH_MIN = 1;
const WIDTH_MAX = 4.5;
const WIDTH_SLOPE = 0.4;
const CUP_R_MIN = 1.5;
const CUP_R_MAX = 2;

function baseAngleForEdge(edge: Edge): number {
  // screen-space, y-down: 0=+x, 90=+y(down), 180=-x, -90/270=-y(up)
  switch (edge) {
    case "left":
      return 0;
    case "right":
      return 180;
    case "top":
      return 90;
    case "bottom":
      return -90;
  }
}

function seedPoints(edge: Edge, w: number, h: number, count: number): { x: number; y: number }[] {
  const n = Math.max(1, count);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / (n + 1);
    if (edge === "left") pts.push({ x: 0, y: f * h });
    else if (edge === "right") pts.push({ x: w, y: f * h });
    else if (edge === "top") pts.push({ x: f * w, y: 0 });
    else pts.push({ x: f * w, y: h });
  }
  return pts;
}

function distToBox(px: number, py: number, box: Box): number {
  const dx = Math.max(box.x - px, 0, px - (box.x + box.w));
  const dy = Math.max(box.y - py, 0, py - (box.y + box.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Standard 2D segment intersection: does ray (p1->p2) cross segment (p3->p4)? */
function segmentsCross(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  p4x: number,
  p4y: number
): boolean {
  const d1x = p2x - p1x;
  const d1y = p2y - p1y;
  const d2x = p4x - p3x;
  const d2y = p4y - p3y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / denom;
  const u = ((p3x - p1x) * d1y - (p3y - p1y) * d1x) / denom;
  return t > 0.02 && t <= 1 && u >= 0 && u <= 1;
}

/** Mean fraction of RAY_COUNT rays, fanned RAY_SPREAD_DEG around lightAngleDeg,
 * that reach the light without crossing any existing colony segment. The
 * content box counts as a permanent, unconditional shade: inside its
 * CONTENT_MARGIN, exposure is 0 before a single ray is cast. */
function exposureAt(
  cx: number,
  cy: number,
  lightAngleDeg: number,
  nodes: PolypNode[],
  contentBox: Box | null
): number {
  if (contentBox && distToBox(cx, cy, contentBox) < CONTENT_MARGIN) return 0;
  let clear = 0;
  for (let i = 0; i < RAY_COUNT; i++) {
    const off = -RAY_SPREAD_DEG / 2 + (RAY_SPREAD_DEG / (RAY_COUNT - 1)) * i;
    const rad = ((lightAngleDeg + off) * Math.PI) / 180;
    const ex = cx + Math.cos(rad) * RAY_LEN;
    const ey = cy + Math.sin(rad) * RAY_LEN;
    let blocked = false;
    for (let k = 0; k < nodes.length; k++) {
      const n = nodes[k];
      if (n.parent === -1) continue;
      const p = nodes[n.parent];
      if (segmentsCross(cx, cy, ex, ey, p.x, p.y, n.x, n.y)) {
        blocked = true;
        break;
      }
    }
    if (!blocked) clear++;
  }
  return clear / RAY_COUNT;
}

function statusOf(idx: number, nodes: PolypNode[], bleach: Map<number, "bleached" | "dead">): Status {
  let i = idx;
  while (i !== -1) {
    const s = bleach.get(i);
    if (s) return s;
    i = nodes[i].parent;
  }
  return "live";
}

function widthOf(deposit: number): number {
  return Math.min(WIDTH_MAX, WIDTH_MIN + deposit * WIDTH_SLOPE);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PolypBud({
  edge = "left",
  children,
  lightDriftDegPerMin = 6,
  seedCount = 5,
  className = "",
  id,
}: PolypBudProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<PolypNode[]>([]);
  const queueRef = useRef<number[]>([]);
  const bleachRef = useRef<Map<number, "bleached" | "dead">>(new Map());
  const contentBoxRef = useRef<Box | null>(null);
  const boundsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const startRef = useRef<number>(0);
  // Bumped after anything the SVG needs to repaint for: a bud, a bleach
  // event, a resolution, or the 300ms round-robin tick (queue order can
  // change the front-most cup even on a failed attempt). Node/cup elements
  // are keyed by their own stable index, never by `gen`, so this re-render
  // updates attributes in place — it does not remount anything, which is
  // what keeps the stroke/fill colour CSS transition below actually visible.
  const [gen, setGen] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    const contentEl = contentRef.current;
    if (!root) return;

    let disposed = false;
    let budTimer: ReturnType<typeof setInterval> | undefined;
    let bleachTimer: ReturnType<typeof setTimeout> | undefined;
    const reduced = prefersReducedMotion();

    const inBounds = (x: number, y: number): boolean => {
      const { w, h } = boundsRef.current;
      return x >= -2 && x <= w + 2 && y >= -2 && y <= h + 2;
    };

    const tooClose = (x: number, y: number): boolean => {
      const nodes = nodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - x;
        const dy = nodes[i].y - y;
        if (dx * dx + dy * dy < MIN_SEPARATION * MIN_SEPARATION) return true;
      }
      return false;
    };

    const currentLightAngle = (fixed: boolean): number => {
      const base = baseAngleForEdge(edge);
      if (fixed) return base;
      const elapsed = performance.now() - startRef.current;
      return base + (lightDriftDegPerMin / 60000) * elapsed;
    };

    /** One round-robin decision: pop the next queued tip, propose candidates
     * fanned off its heading, ray-test each, bud the best if it clears the
     * exposure threshold. Returns true if a bud was created. */
    const attemptOneBud = (fixedLight: boolean): boolean => {
      const nodes = nodesRef.current;
      if (nodes.length >= MAX_NODES) return false;
      const queue = queueRef.current;
      const idx = queue.shift();
      if (idx === undefined) return false;
      const status = statusOf(idx, nodes, bleachRef.current);
      if (status === "dead") return false; // dropped from rotation for good
      if (status === "bleached") {
        queue.push(idx);
        return false;
      }
      const node = nodes[idx];
      const lightAngle = currentLightAngle(fixedLight);
      let bestX = 0;
      let bestY = 0;
      let bestHeading = 0;
      let bestExposure = -1;
      for (const off of CANDIDATE_OFFSETS_DEG) {
        const jitter = (Math.random() * 2 - 1) * HEADING_JITTER_DEG;
        const heading = node.heading + off + jitter;
        const rad = (heading * Math.PI) / 180;
        const cx = node.x + Math.cos(rad) * STEP_LEN;
        const cy = node.y + Math.sin(rad) * STEP_LEN;
        if (!inBounds(cx, cy) || tooClose(cx, cy)) continue;
        const exp = exposureAt(cx, cy, lightAngle, nodes, contentBoxRef.current);
        if (exp > bestExposure) {
          bestExposure = exp;
          bestX = cx;
          bestY = cy;
          bestHeading = heading;
        }
      }
      queue.push(idx); // stays in rotation — may fork again, or keep failing in stasis
      if (bestExposure > EXPOSURE_THRESHOLD && nodes.length < MAX_NODES) {
        const newIdx = nodes.length;
        nodes.push({ x: bestX, y: bestY, parent: idx, heading: bestHeading, deposit: 0 });
        let a = idx;
        while (a !== -1) {
          nodes[a].deposit += DEPOSIT_PER_BUD;
          a = nodes[a].parent;
        }
        queue.push(newIdx);
        return true;
      }
      return false;
    };

    const scheduleBleach = () => {
      const delay = BLEACH_MIN_MS + Math.random() * (BLEACH_MAX_MS - BLEACH_MIN_MS);
      bleachTimer = setTimeout(() => {
        if (disposed) return;
        const nodes = nodesRef.current;
        if (nodes.length > 6) {
          for (let attempt = 0; attempt < 6; attempt++) {
            const idx = 1 + Math.floor(Math.random() * (nodes.length - 1));
            if (statusOf(idx, nodes, bleachRef.current) !== "live") continue;
            bleachRef.current.set(idx, "bleached");
            setGen((g) => g + 1);
            const resolveIdx = idx;
            setTimeout(() => {
              if (disposed) return;
              if (bleachRef.current.get(resolveIdx) !== "bleached") return;
              if (Math.random() < BLEACH_DEATH_PROB) bleachRef.current.set(resolveIdx, "dead");
              else bleachRef.current.delete(resolveIdx);
              setGen((g) => g + 1);
            }, BLEACH_DURATION_MS);
            break;
          }
        }
        scheduleBleach();
      }, delay);
    };

    // The wrapper div around `children` is a plain block box: its width is
    // "fill the container" regardless of how narrow the actual content is,
    // so measuring the WRAPPER's rect would treat the whole container as
    // occupied and zero every candidate's exposure everywhere. What the
    // colony actually needs to avoid is the visual footprint of the content
    // itself, so this unions the rects of the wrapper's direct element
    // children instead — the same DOM the ResizeObserver below watches.
    const measureContentBox = () => {
      if (!contentEl) return;
      const rootRect = root.getBoundingClientRect();
      let box: Box | null = null;
      for (const child of Array.from(contentEl.children)) {
        const r = child.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const cx = r.left - rootRect.left;
        const cy = r.top - rootRect.top;
        if (!box) {
          box = { x: cx, y: cy, w: r.width, h: r.height };
        } else {
          const x2 = Math.max(box.x + box.w, cx + r.width);
          const y2 = Math.max(box.y + box.h, cy + r.height);
          box.x = Math.min(box.x, cx);
          box.y = Math.min(box.y, cy);
          box.w = x2 - box.x;
          box.h = y2 - box.y;
        }
      }
      contentBoxRef.current = box;
    };

    const start = () => {
      const rect = root.getBoundingClientRect();
      boundsRef.current = { w: rect.width, h: rect.height };
      measureContentBox();
      if (rect.width < 4 || rect.height < 4) return;

      nodesRef.current = seedPoints(edge, rect.width, rect.height, seedCount).map((s) => ({
        x: s.x,
        y: s.y,
        parent: -1,
        heading: baseAngleForEdge(edge),
        deposit: 0,
      }));
      queueRef.current = nodesRef.current.map((_, i) => i);
      bleachRef.current = new Map();
      startRef.current = performance.now();

      if (reduced) {
        for (let i = 0; i < REDUCED_MOTION_ATTEMPTS && nodesRef.current.length < MAX_NODES; i++) {
          attemptOneBud(true);
        }
        setGen((g) => g + 1);
        return; // headless: no timers, no bleaching
      }

      for (let i = 0; i < PREWARM_ATTEMPTS && nodesRef.current.length < MAX_NODES; i++) {
        attemptOneBud(true);
      }

      budTimer = setInterval(() => {
        if (disposed) return;
        attemptOneBud(false);
        setGen((g) => g + 1);
      }, TICK_MS);
      scheduleBleach();
    };

    start();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        const rect = root.getBoundingClientRect();
        boundsRef.current = { w: rect.width, h: rect.height };
        measureContentBox();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    if (contentEl) {
      ro.observe(contentEl);
      // The wrapper's own width never changes (block box, fills the
      // container), so a reflow that only changes a child's width — the
      // dimension the occluder box actually cares about — wouldn't
      // otherwise trigger a remeasure.
      for (const child of Array.from(contentEl.children)) ro.observe(child);
    }

    return () => {
      disposed = true;
      if (budTimer) clearInterval(budTimer);
      if (bleachTimer) clearTimeout(bleachTimer);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge, lightDriftDegPerMin, seedCount]);

  const nodes = nodesRef.current;
  const bleach = bleachRef.current;
  const statusColor: Record<Status, string> = {
    live: "var(--foreground)",
    bleached: "var(--ns-muted)",
    dead: "var(--border)",
  };

  const uniqueTips = Array.from(new Set(queueRef.current));

  return (
    <div id={id} ref={rootRef} className={`relative overflow-hidden ${className}`}>
      <style>{`
@media (prefers-reduced-motion: reduce){
  .ns-pb-seg,.ns-pb-cup{transition:none !important}
}
.ns-pb-seg,.ns-pb-cup{transition:stroke 900ms ease-out,fill 900ms ease-out}
`}</style>
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {nodes.map((n, i) => {
          if (n.parent === -1) return null;
          const p = nodes[n.parent];
          const status = statusOf(i, nodes, bleach);
          return (
            <line
              key={i}
              className="ns-pb-seg"
              x1={p.x}
              y1={p.y}
              x2={n.x}
              y2={n.y}
              stroke={statusColor[status]}
              strokeWidth={widthOf(n.deposit)}
              strokeLinecap="round"
            />
          );
        })}
        {uniqueTips.map((idx) => {
          const n = nodes[idx];
          if (!n) return null;
          const status = statusOf(idx, nodes, bleach);
          if (status === "dead") return null;
          const r = Math.min(CUP_R_MAX, CUP_R_MIN + n.deposit * 0.05);
          return (
            <circle
              key={idx}
              className="ns-pb-cup"
              cx={n.x}
              cy={n.y}
              r={r}
              fill={statusColor[status]}
            />
          );
        })}
      </svg>
      <div ref={contentRef} className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export default PolypBud;
