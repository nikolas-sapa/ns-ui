"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CrackPolygonOrder — a decorative panel that tiles itself the way a drying
// mud layer actually cracks: a first, widely-spaced generation of cracks
// nucleates and grows across the whole panel; once every primary crack has
// stopped, a 900ms "stress rebuilding" pause elapses and a second generation
// nucleates INSIDE the largest surviving cells and grows outward from a
// point in both directions; the same pause-then-nucleate step repeats once
// more for a third generation. The one rule that makes this desiccation
// cracking rather than a generic Voronoi/crack-seam fill: every new crack
// tip that comes within ~2px of an existing crack (a free surface, zero
// stress) stops there, at close to a right angle — a T-junction, never a
// crossing. Once no cell is worth splitting further the tiling holds fully
// formed, then the whole panel "rewets" (every stroke's opacity eases to 0)
// and a blank cooldown precedes the next, unrelated cycle.
//
// This is a real-time simulation, not a pre-computed path being revealed:
// a 2px-cell occupancy grid records where ink already exists, a random-walk
// tip advances against that grid at a literal 90px/s (segment length
// 6-10px, turning noise +-12deg per segment), and completed generations are
// turned into regions by a flood fill of the still-empty cells so the next
// generation can nucleate inside the biggest 60% of them. Growth is driven
// by real elapsed ms every rAF frame, not snapped to the 6-10px segment
// boundary — a tip's in-progress segment interpolates continuously
// (progressPx / segLen) so the stroke visibly glides at 60fps and only the
// completed, collision-tested segment endpoints are ever committed. Path
// geometry updates happen via direct SVG DOM writes on refs (not React
// state) so ~14 rAF-driven tips can grow every frame without a React
// re-render; React state only changes on the rare event that new <path>
// elements need to mount (once per generation, three times a cycle) or the
// panel resizes.
//
// t0 is deliberately not a fresh, empty panel: on mount the whole tick
// function is run synchronously against a fast, fixed 16ms clock for a
// random 1.5-10.5s of simulated time before the real rAF loop takes over,
// so every visit lands mid-cycle. prefers-reduced-motion runs the same
// synchronous driver all the way to the mature, fully-tiled hold frame and
// then stops for good — the single most structured frame this pattern ever
// produces, all three generations of T-junctions visible at once.
// ---------------------------------------------------------------------------

export interface CrackPolygonOrderProps {
  /** seeds the crack RNG; omit for a fresh, unrepeatable tiling every mount */
  seed?: number;
  className?: string;
}

const CELL = 2; // occupancy-grid cell size, px — matches the ~2px T-junction test
const SPEED_PX_S = 90; // crack tip advance rate
const SEG_MIN = 6;
const SEG_MAX = 10;
const TURN_NOISE = (12 * Math.PI) / 180; // +-12deg per segment
const GEN_PAUSE_MS = 900;
const HOLD_MS = 4000;
const REWET_MS = 2500;
const COOLDOWN_MS = 600;
const MIN_PRIMARY = 4;
const MAX_PRIMARY = 7; // inclusive
const LARGEST_FRACTION = 0.6;
const MIN_REGION_AREA_PX2 = 130; // too small to bother nucleating inside
const MAX_DT_MS = 50; // clamp so a paused-tab / IO resume can't lurch the sim
const FASTFWD_STEP_MS = 16;
const MAX_FASTFWD_ITERS = 4000;
const STROKE_W = 1.5;

type Phase =
  | "primary"
  | "secondary-wait"
  | "secondary"
  | "tertiary-wait"
  | "tertiary"
  | "hold"
  | "rewet"
  | "cooldown";

type Pt = { x: number; y: number };

type Tip = {
  // finalized segment endpoints — collision-tested, never move again
  committed: Pt[];
  // current heading + target length of the segment still in progress
  heading: number;
  segLen: number;
  // px already covered into that in-progress segment, advanced every frame
  // by real elapsed time (not snapped to the segment boundary) so the SVG
  // path visibly glides rather than jumping in 6-10px steps
  progressPx: number;
  done: boolean;
  recentCells: number[];
};

type CrackData = { id: number; gen: 1 | 2 | 3; a: Tip; b: Tip };
type CrackMeta = { id: number; gen: 1 | 2 | 3; initialDA: string; initialDB: string };

/** mulberry32 — small, fast, deterministic given a seed */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function pointsToPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  return `M ${pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")}`;
}

/** committed points plus the current in-progress segment's live, interpolated tip — this is what gets drawn every frame */
function renderPoints(tip: Tip): Pt[] {
  if (tip.done) return tip.committed;
  const from = tip.committed[tip.committed.length - 1];
  const t = tip.segLen > 0 ? tip.progressPx / tip.segLen : 0;
  const live: Pt = {
    x: from.x + Math.cos(tip.heading) * tip.segLen * t,
    y: from.y + Math.sin(tip.heading) * tip.segLen * t,
  };
  return [...tip.committed, live];
}

function makeTip(x: number, y: number, heading: number, rng: () => number): Tip {
  return {
    committed: [{ x, y }],
    heading,
    segLen: SEG_MIN + rng() * (SEG_MAX - SEG_MIN),
    progressPx: 0,
    done: false,
    recentCells: [],
  };
}

/** Occupancy grid: one Uint8Array cell per CELLxCELL px, 0 = empty. */
class Grid {
  cols: number;
  rows: number;
  cells: Uint8Array;
  constructor(w: number, h: number) {
    this.cols = Math.max(1, Math.ceil(w / CELL));
    this.rows = Math.max(1, Math.ceil(h / CELL));
    this.cells = new Uint8Array(this.cols * this.rows);
  }
  idx(cx: number, cy: number) {
    return cy * this.cols + cx;
  }
  mark(x: number, y: number, tip: Tip) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)));
    const i = this.idx(cx, cy);
    this.cells[i] = 1;
    tip.recentCells.push(i);
    if (tip.recentCells.length > 8) tip.recentCells.shift();
  }
  /** true if (x,y)'s 3x3 cell neighbourhood holds ink not owned by `tip`'s recent trail */
  collides(x: number, y: number, tip: Tip): boolean {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
        const i = this.idx(nx, ny);
        if (this.cells[i] !== 0 && !tip.recentCells.includes(i)) return true;
      }
    }
    return false;
  }
}

type Region = { cells: number[]; area: number };

function findRegions(grid: Grid): Region[] {
  const { cols, rows, cells } = grid;
  const visited = new Uint8Array(cols * rows);
  const regions: Region[] = [];
  const stack: number[] = [];
  for (let start = 0; start < cells.length; start++) {
    if (cells[start] !== 0 || visited[start]) continue;
    const regionCells: number[] = [];
    stack.length = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      regionCells.push(i);
      const cx = i % cols;
      const cy = (i / cols) | 0;
      const neighbours = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (visited[ni] || cells[ni] !== 0) continue;
        visited[ni] = 1;
        stack.push(ni);
      }
    }
    regions.push({ cells: regionCells, area: regionCells.length * CELL * CELL });
  }
  return regions;
}

/** picks a cell biased toward a region's interior: sample a few candidates, keep the one with the most empty neighbours */
function pickSeedCell(region: Region, grid: Grid, rng: () => number): { x: number; y: number } {
  const tries = Math.min(8, region.cells.length);
  let best = region.cells[Math.floor(rng() * region.cells.length)];
  let bestScore = -1;
  for (let t = 0; t < tries; t++) {
    const i = region.cells[Math.floor(rng() * region.cells.length)];
    const cx = i % grid.cols;
    const cy = (i / grid.cols) | 0;
    let score = 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      if (grid.cells[ny * grid.cols + nx] === 0) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  const cx = best % grid.cols;
  const cy = (best / grid.cols) | 0;
  return { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
}

/**
 * advances one tip by dtMs of simulated growth against the shared grid.
 * The in-progress segment's `progressPx` moves by real elapsed distance
 * every call (never snapped straight to a segment boundary), so a caller
 * repainting every rAF frame sees the path glide continuously at
 * SPEED_PX_S rather than jump in SEG_MIN..SEG_MAX chunks every ~70-110ms.
 * A segment is only collision/edge-tested — and only then can it terminate
 * the tip at a T-junction — the instant progressPx reaches segLen.
 */
function growTip(tip: Tip, dtMs: number, grid: Grid, w: number, h: number) {
  if (tip.done) return;
  let dt = dtMs;
  let guard = 0;
  while (dt > 0 && !tip.done && guard < 40) {
    guard++;
    const remainingSegPx = tip.segLen - tip.progressPx;
    const availablePx = (SPEED_PX_S / 1000) * dt;

    if (availablePx < remainingSegPx) {
      tip.progressPx += availablePx;
      dt = 0;
      break;
    }

    // enough distance this tick to finish the in-progress segment — spend
    // only the ms it actually needed and carry the rest into the next one
    const neededMs = (remainingSegPx / SPEED_PX_S) * 1000;
    dt -= neededMs;

    const from = tip.committed[tip.committed.length - 1];
    const to = {
      x: from.x + Math.cos(tip.heading) * tip.segLen,
      y: from.y + Math.sin(tip.heading) * tip.segLen,
    };

    if (to.x < 0 || to.x > w || to.y < 0 || to.y > h) {
      const cx = Math.min(w, Math.max(0, to.x));
      const cy = Math.min(h, Math.max(0, to.y));
      tip.committed.push({ x: cx, y: cy });
      grid.mark(cx, cy, tip);
      tip.done = true;
      break;
    }

    // sample a few points along the finished segment: earliest collision
    // wins, and every clean sample gets marked so the raster has no gap
    // another crack could slip through
    let hit = false;
    const samples = 3;
    for (let s = 1; s <= samples; s++) {
      const t = s / samples;
      const px = from.x + (to.x - from.x) * t;
      const py = from.y + (to.y - from.y) * t;
      if (grid.collides(px, py, tip)) {
        tip.committed.push({ x: px, y: py });
        grid.mark(px, py, tip);
        tip.done = true;
        hit = true;
        break;
      }
      grid.mark(px, py, tip);
    }
    if (hit) break;

    tip.committed.push(to);
    tip.heading += (rngFor() - 0.5) * 2 * TURN_NOISE;
    tip.segLen = SEG_MIN + rngFor() * (SEG_MAX - SEG_MIN);
    tip.progressPx = 0;
  }
}

// a tiny module-level RNG stream (reseeded whenever the component's own
// seeded rng is (re)created) avoids threading the seeded generator through
// every tip while still keeping the whole pattern reproducible from `seed`
let sharedRng: () => number = mulberry32(1);
function rngFor() {
  return sharedRng();
}

function spawnCrack(id: number, gen: 1 | 2 | 3, x: number, y: number, rng: () => number): CrackData {
  const heading = rng() * Math.PI * 2;
  const a = makeTip(x, y, heading, rng);
  const b = makeTip(x, y, heading + Math.PI + (rng() - 0.5) * 0.6, rng);
  return { id, gen, a, b };
}

export function CrackPolygonOrder({ seed, className = "" }: CrackPolygonOrderProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const pathRefs = useRef<Map<number, { a: SVGPathElement | null; b: SVGPathElement | null }>>(new Map());

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [cracks, setCracks] = useState<CrackMeta[]>([]);
  const [reduced, setReduced] = useState(false);

  const gridRef = useRef<Grid | null>(null);
  const cracksMapRef = useRef<Map<number, CrackData>>(new Map());
  const cracksDirtyRef = useRef(false);
  const phaseRef = useRef<Phase>("primary");
  const phaseTimerRef = useRef(0);
  const nextIdRef = useRef(0);
  const rngRef = useRef<() => number>(mulberry32(1));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const visibleRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // -- resize: measure the panel, (re)build the grid at that size --
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width < 4 || height < 4) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const sameSize =
          initializedRef.current && Math.abs(width - dims.w) < 4 && Math.abs(height - dims.h) < 4;
        if (sameSize) return;
        setDims({ w: Math.round(width), h: Math.round(height) });
      }, 120);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (debounce) clearTimeout(debounce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- visibility gate: pause the growth loop off-screen, resume in place --
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      visibleRef.current = entries.some((e) => e.isIntersecting);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const syncCracksToDom = () => {
    if (!cracksDirtyRef.current) return;
    cracksDirtyRef.current = false;
    const meta: CrackMeta[] = Array.from(cracksMapRef.current.values()).map((c) => ({
      id: c.id,
      gen: c.gen,
      initialDA: pointsToPath(renderPoints(c.a)),
      initialDB: pointsToPath(renderPoints(c.b)),
    }));
    setCracks(meta);
  };

  const beginGeneration = (gen: 1 | 2 | 3, w: number, h: number, rng: () => number) => {
    const grid = gridRef.current;
    if (!grid) return;
    if (gen === 1) {
      const count = MIN_PRIMARY + Math.floor(rng() * (MAX_PRIMARY - MIN_PRIMARY + 1));
      for (let i = 0; i < count; i++) {
        const x = rng() * w;
        const y = rng() * h;
        const crack = spawnCrack(nextIdRef.current++, 1, x, y, rng);
        cracksMapRef.current.set(crack.id, crack);
      }
    } else {
      const regions = findRegions(grid).filter((r) => r.area >= MIN_REGION_AREA_PX2);
      regions.sort((a, b) => b.area - a.area);
      const take = Math.ceil(regions.length * LARGEST_FRACTION);
      for (const region of regions.slice(0, take)) {
        const seedPt = pickSeedCell(region, grid, rng);
        const crack = spawnCrack(nextIdRef.current++, gen, seedPt.x, seedPt.y, rng);
        cracksMapRef.current.set(crack.id, crack);
      }
    }
    cracksDirtyRef.current = true;
  };

  const resetCycle = (w: number, h: number) => {
    gridRef.current = new Grid(w, h);
    cracksMapRef.current.clear();
    cracksDirtyRef.current = true;
    phaseRef.current = "primary";
    phaseTimerRef.current = 0;
    if (gRef.current) gRef.current.style.opacity = "1";
    beginGeneration(1, w, h, rngRef.current);
  };

  /** advances the whole simulation by dtMs: growth, phase transitions, generation spawns */
  const tick = (dtMs: number, w: number, h: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const rng = rngRef.current;
    const phase = phaseRef.current;

    const stepGen = (gen: 1 | 2 | 3) => {
      let allDone = true;
      for (const c of cracksMapRef.current.values()) {
        if (c.gen !== gen) continue;
        growTip(c.a, dtMs, grid, w, h);
        growTip(c.b, dtMs, grid, w, h);
        if (!(c.a.done && c.b.done)) allDone = false;
      }
      return allDone;
    };

    switch (phase) {
      case "primary":
        if (stepGen(1)) {
          phaseRef.current = "secondary-wait";
          phaseTimerRef.current = 0;
        }
        break;
      case "secondary-wait":
        phaseTimerRef.current += dtMs;
        if (phaseTimerRef.current >= GEN_PAUSE_MS) {
          beginGeneration(2, w, h, rng);
          phaseRef.current = "secondary";
        }
        break;
      case "secondary":
        if (stepGen(2)) {
          phaseRef.current = "tertiary-wait";
          phaseTimerRef.current = 0;
        }
        break;
      case "tertiary-wait":
        phaseTimerRef.current += dtMs;
        if (phaseTimerRef.current >= GEN_PAUSE_MS) {
          beginGeneration(3, w, h, rng);
          phaseRef.current = "tertiary";
        }
        break;
      case "tertiary":
        if (stepGen(3)) {
          phaseRef.current = "hold";
          phaseTimerRef.current = 0;
        }
        break;
      case "hold":
        phaseTimerRef.current += dtMs;
        if (phaseTimerRef.current >= HOLD_MS) {
          phaseRef.current = "rewet";
          phaseTimerRef.current = 0;
        }
        break;
      case "rewet": {
        phaseTimerRef.current += dtMs;
        const t = Math.min(1, phaseTimerRef.current / REWET_MS);
        if (gRef.current) gRef.current.style.opacity = String(1 - easeInOutCubic(t));
        if (phaseTimerRef.current >= REWET_MS) {
          gridRef.current = new Grid(w, h);
          cracksMapRef.current.clear();
          cracksDirtyRef.current = true;
          if (gRef.current) gRef.current.style.opacity = "1";
          phaseRef.current = "cooldown";
          phaseTimerRef.current = 0;
        }
        break;
      }
      case "cooldown":
        phaseTimerRef.current += dtMs;
        if (phaseTimerRef.current >= COOLDOWN_MS) {
          phaseRef.current = "primary";
          phaseTimerRef.current = 0;
          beginGeneration(1, w, h, rng);
        }
        break;
    }
  };

  // -- write per-frame growth straight to the DOM, bypassing React --
  const paintFrame = () => {
    for (const c of cracksMapRef.current.values()) {
      const refs = pathRefs.current.get(c.id);
      if (!refs) continue;
      if (refs.a) refs.a.setAttribute("d", pointsToPath(renderPoints(c.a)));
      if (refs.b) refs.b.setAttribute("d", pointsToPath(renderPoints(c.b)));
    }
  };

  // -- init + main loop: waits for a real measurement, then either freezes
  // at the mature frame (reduced motion) or fast-forwards into a random
  // mid-cycle point before handing off to a live rAF loop --
  useEffect(() => {
    if (dims.w < 4 || dims.h < 4) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rngRef.current = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
      sharedRng = rngRef.current;
      gridRef.current = new Grid(dims.w, dims.h);
      cracksMapRef.current.clear();
      phaseRef.current = "primary";
      phaseTimerRef.current = 0;
      beginGeneration(1, dims.w, dims.h, rngRef.current);
      let iters = 0;
      while ((phaseRef.current as Phase) !== "hold" && iters < MAX_FASTFWD_ITERS) {
        tick(FASTFWD_STEP_MS, dims.w, dims.h);
        iters++;
      }
      syncCracksToDom();
      initializedRef.current = true;
      return;
    }

    if (!initializedRef.current) {
      rngRef.current = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
      sharedRng = rngRef.current;
      resetCycle(dims.w, dims.h);
      const leadInMs = 1500 + rngRef.current() * 9000;
      let simulated = 0;
      let iters = 0;
      while (simulated < leadInMs && iters < MAX_FASTFWD_ITERS) {
        tick(FASTFWD_STEP_MS, dims.w, dims.h);
        simulated += FASTFWD_STEP_MS;
        iters++;
      }
      syncCracksToDom();
      paintFrame();
      initializedRef.current = true;
    } else {
      // a real resize after init: rebuild fresh at the new size, no lead-in
      resetCycle(dims.w, dims.h);
      syncCracksToDom();
      paintFrame();
    }

    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!visibleRef.current) {
        lastTsRef.current = ts;
        return;
      }
      const last = lastTsRef.current ?? ts;
      const dt = Math.min(MAX_DT_MS, ts - last);
      lastTsRef.current = ts;
      if (dt <= 0) return;
      tick(dt, dims.w, dims.h);
      syncCracksToDom();
      paintFrame();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.w, dims.h, seed]);

  return (
    <div
      ref={wrapRef}
      data-crack-polygon-order
      aria-hidden
      className={`ns-crack-polygon-order relative h-full w-full overflow-hidden ${className}`}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(1, dims.w)} ${Math.max(1, dims.h)}`}
        preserveAspectRatio="none"
        className="block"
      >
        <rect x={0} y={0} width={dims.w} height={dims.h} fill="var(--background)" />
        <g ref={gRef}>
          {cracks.map((c) => (
            <g key={c.id}>
              <path
                ref={(el) => {
                  const entry = pathRefs.current.get(c.id) ?? { a: null, b: null };
                  entry.a = el;
                  pathRefs.current.set(c.id, entry);
                }}
                d={c.initialDA}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                ref={(el) => {
                  const entry = pathRefs.current.get(c.id) ?? { a: null, b: null };
                  entry.b = el;
                  pathRefs.current.set(c.id, entry);
                }}
                d={c.initialDB}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={STROKE_W}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
