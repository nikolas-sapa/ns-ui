"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SeepLattice — a feature-flag rollout picker where "blast radius" is
// computed as literal site percolation, not a smooth percentage. Every user
// segment is a cell in a fixed grid lattice; adjacency is DECLARED as an
// explicit edge list (each cell's up/down/left/right neighbours — the
// lattice standing in for shared-infra/shared-tenancy proximity), never
// inferred from distance to the slider value. One scalar `p` (the rollout
// percentage) governs everything: a fixed seeded permutation orders every
// cell once at mount, and the wet set is always exactly the first
// round(p/100 * n) cells of that order — so p directly prefixes the wet
// set, dragging back down un-wets in EXACT reverse, and nothing is ever
// re-rolled mid-drag. On every value change, union-find runs over the
// declared adjacency graph (never a radial or rectangular zone guess) to
// find the largest connected wet cluster; that cluster's outer boundary is
// traced into ONE SVG perimeter path (marching-squares-style edge walk, not
// per-cell borders), and its size is the headline figure. The containment
// threshold line is measured once at mount by binary search over THIS
// lattice's actual spanning behaviour (top-row-to-bottom-row connectivity),
// not the textbook 0.5927 — a finite lattice with this adjacency has its
// own threshold. Newly-wet cells fill with a capillary stagger: a mini BFS
// over just the cells added this step, seeded from wherever they touch
// already-wet cells, delays each cell's fill transition by its BFS depth —
// water visibly floods outward from existing wet regions, not a uniform
// flash. Everything is a pure function of p and the lattice; the only
// interactive control is the rollout slider itself.
// ---------------------------------------------------------------------------

const CELL_GAP = 0.16; // inset per cell, in viewBox cell-units
const FRONT_SPEED_MS = 16; // ms per BFS-depth step of capillary stagger
const MAX_STAGGER_MS = 260; // cap so a huge jump doesn't queue forever
const FILL_DURATION_MS = 200;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

// -- seeded PRNG + permutation ----------------------------------------------

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

// -- declared adjacency (4-neighbour grid, explicit edge list) --------------

function buildNeighbors(rows: number, cols: number): number[][] {
  const n = rows * cols;
  const neighbors: number[][] = new Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const list: number[] = [];
      if (r > 0) list.push(idx - cols);
      if (r < rows - 1) list.push(idx + cols);
      if (c > 0) list.push(idx - 1);
      if (c < cols - 1) list.push(idx + 1);
      neighbors[idx] = list;
    }
  }
  return neighbors;
}

// -- spanning test (top row <-> bottom row) over the wet prefix -------------

function isSpanning(
  k: number,
  order: number[],
  neighbors: number[][],
  rows: number,
  cols: number,
  n: number
): boolean {
  const TOP = n;
  const BOTTOM = n + 1;
  const parent = new Int32Array(n + 2);
  for (let i = 0; i < n + 2; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const wet = new Uint8Array(n);
  for (let i = 0; i < k; i++) wet[order[i]] = 1;
  for (let c = 0; c < n; c++) {
    if (!wet[c]) continue;
    const row = Math.floor(c / cols);
    if (row === 0) union(c, TOP);
    if (row === rows - 1) union(c, BOTTOM);
    for (const nb of neighbors[c]) if (wet[nb]) union(c, nb);
  }
  return find(TOP) === find(BOTTOM);
}

interface Lattice {
  n: number;
  rows: number;
  cols: number;
  neighbors: number[][];
  order: number[];
  thresholdK: number;
  thresholdPct: number;
}

// Built once per (rows, cols, seed): declares adjacency, fixes the wetting
// permutation, and measures this exact lattice's own percolation threshold
// by binary search (spanning is monotonic in k since wet cells only ever
// accumulate along a fixed prefix).
function buildLattice(rows: number, cols: number, seed: number): Lattice {
  const n = rows * cols;
  const neighbors = buildNeighbors(rows, cols);
  const order = seededOrder(n, seed);
  let lo = 0;
  let hi = n;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (isSpanning(mid, order, neighbors, rows, cols, n)) hi = mid;
    else lo = mid;
  }
  return { n, rows, cols, neighbors, order, thresholdK: hi, thresholdPct: (hi / n) * 100 };
}

// -- union-find over the wet prefix, every frame -----------------------------

interface WetResult {
  wetMask: Uint8Array;
  clusterMask: Uint8Array;
  largestSize: number;
}

function computeWet(k: number, lattice: Lattice): WetResult {
  const { n, order, neighbors } = lattice;
  const wet = new Uint8Array(n);
  for (let i = 0; i < k; i++) wet[order[i]] = 1;
  const parent = new Int32Array(n);
  const size = new Int32Array(n).fill(1);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a: number, b: number) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (size[ra] < size[rb]) {
      const t = ra;
      ra = rb;
      rb = t;
    }
    parent[rb] = ra;
    size[ra] += size[rb];
  };
  for (let c = 0; c < n; c++) {
    if (!wet[c]) continue;
    for (const nb of neighbors[c]) if (wet[nb]) union(c, nb);
  }
  let bestRoot = -1;
  let bestSize = 0;
  for (let c = 0; c < n; c++) {
    if (!wet[c]) continue;
    const r = find(c);
    if (size[r] > bestSize) {
      bestSize = size[r];
      bestRoot = r;
    }
  }
  const clusterMask = new Uint8Array(n);
  if (bestRoot >= 0) {
    for (let c = 0; c < n; c++) if (wet[c] && find(c) === bestRoot) clusterMask[c] = 1;
  }
  return { wetMask: wet, clusterMask, largestSize: bestSize };
}

// -- trace the largest cluster's outer boundary into one (or more, if it
// has a hole) SVG path loop, by walking declared grid edges — not by
// drawing per-cell borders. Any deterministic pick at a rare diagonal-touch
// vertex still decomposes the edge set into valid closed loops. -----------

function tracePerimeter(mask: Uint8Array, rows: number, cols: number): string {
  const at = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols ? mask[r * cols + c] === 1 : false;

  const out = new Map<string, { x: number; y: number }[]>();
  const push = (fx: number, fy: number, tx: number, ty: number) => {
    const key = `${fx},${fy}`;
    const arr = out.get(key);
    if (arr) arr.push({ x: tx, y: ty });
    else out.set(key, [{ x: tx, y: ty }]);
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(r, c)) continue;
      if (!at(r - 1, c)) push(c + 1, r, c, r); // north edge, right -> left
      if (!at(r, c + 1)) push(c + 1, r + 1, c + 1, r); // east edge, bottom -> top
      if (!at(r + 1, c)) push(c, r + 1, c + 1, r + 1); // south edge, left -> right
      if (!at(r, c - 1)) push(c, r, c, r + 1); // west edge, top -> bottom
    }
  }

  const loops: { x: number; y: number }[][] = [];
  for (const [startKey, arr] of out) {
    while (arr.length) {
      const [sx, sy] = startKey.split(",").map(Number);
      let cx = sx;
      let cy = sy;
      const loop: { x: number; y: number }[] = [{ x: cx, y: cy }];
      let guard = 0;
      while (guard++ < 100000) {
        const outs = out.get(`${cx},${cy}`);
        if (!outs || outs.length === 0) break;
        const next = outs.pop() as { x: number; y: number };
        cx = next.x;
        cy = next.y;
        if (cx === sx && cy === sy) break;
        loop.push({ x: cx, y: cy });
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }

  if (!loops.length) return "";
  return loops.map((loop) => `M ${loop.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`).join(" ");
}

// -----------------------------------------------------------------------------

export interface SeepLatticeProps {
  /** lattice height, in cells (kept small so union-find stays cheap per frame) */
  rows?: number;
  /** lattice width, in cells */
  cols?: number;
  /** fixed seed for the wetting permutation and adjacency — same seed, same lattice */
  seed?: number;
  /** controlled rollout percentage, 0-100 */
  rollout?: number;
  /** uncontrolled initial rollout percentage */
  defaultRollout?: number;
  /** called with the new rollout percentage on every change */
  onRolloutChange?: (v: number) => void;
  /** noun used in the readouts, e.g. "traffic" (default) or "requests" */
  segmentLabel?: string;
  /** extra classes merged onto the root element */
  className?: string;
}

export function SeepLattice({
  rows = 16,
  cols = 24,
  seed = 20260817,
  rollout,
  defaultRollout = 35,
  onRolloutChange,
  segmentLabel = "traffic",
  className = "",
}: SeepLatticeProps) {
  const isControlled = rollout !== undefined;
  const [rolloutInternal, setRolloutInternal] = useState(() => clamp(defaultRollout, 0, 100));
  const value = isControlled ? (rollout as number) : rolloutInternal;
  const valueRef = useRef(value);
  valueRef.current = value;

  const safeRows = Math.max(2, Math.floor(rows));
  const safeCols = Math.max(2, Math.floor(cols));
  const lattice = useMemo(() => buildLattice(safeRows, safeCols, seed), [safeRows, safeCols, seed]);

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const k = clamp(Math.round((value / 100) * lattice.n), 0, lattice.n);

  const { wetMask, clusterMask, largestSize } = useMemo(() => computeWet(k, lattice), [k, lattice]);
  const perimeterD = useMemo(
    () => tracePerimeter(clusterMask, lattice.rows, lattice.cols),
    [clusterMask, lattice]
  );

  const clusterPct = lattice.n > 0 ? Math.round((largestSize / lattice.n) * 100) : 0;
  const roundedRollout = Math.round(value);
  const thresholdRoundedPct = Math.round(lattice.thresholdPct);
  const aboveThreshold = k >= lattice.thresholdK;

  // -- capillary stagger: a mini BFS over just this step's newly-wet cells,
  // seeded from wherever they touch already-wet cells, sets each affected
  // cell's transition-delay directly (skipped outright under reduced motion
  // — cells then just snap, no stagger, no entrance). Runs in a layout
  // effect so the delay lands before the browser paints the fill change
  // committed in the same render. --------------------------------------
  const cellElsRef = useRef<(SVGRectElement | null)[]>([]);
  const prevKRef = useRef(0);
  const prevWetRef = useRef<Uint8Array | null>(null);

  useLayoutEffect(() => {
    const { n, order, neighbors } = lattice;
    if (!prevWetRef.current || prevWetRef.current.length !== n) {
      prevWetRef.current = new Uint8Array(n);
      prevKRef.current = 0;
    }
    const prevWet = prevWetRef.current;
    const prevK = prevKRef.current;

    // Un-wetting (dragging p down) is always instant with no stagger — clear
    // any delay left over from a prior flood before deciding whether this
    // step needs a new one, or a cell that flooded in staggered would dry
    // out staggered by a delay computed for a different pass.
    for (let i = 0; i < n; i++) {
      const el = cellElsRef.current[i];
      if (el && el.style.transitionDelay) el.style.transitionDelay = "";
    }

    if (!reduced && k > prevK) {
      const newlySet = new Set<number>();
      for (let i = prevK; i < k; i++) newlySet.add(order[i]);
      const depth = new Map<number, number>();
      const queue: number[] = [];
      for (const cell of newlySet) {
        for (const nb of neighbors[cell]) {
          if (prevWet[nb]) {
            depth.set(cell, 0);
            queue.push(cell);
            break;
          }
        }
      }
      if (queue.length === 0) {
        for (const cell of newlySet) {
          depth.set(cell, 0);
          queue.push(cell);
        }
      }
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        const d = depth.get(cur) as number;
        for (const nb of neighbors[cur]) {
          if (newlySet.has(nb) && !depth.has(nb)) {
            depth.set(nb, d + 1);
            queue.push(nb);
          }
        }
      }
      for (const [cell, d] of depth) {
        const el = cellElsRef.current[cell];
        if (el) el.style.transitionDelay = `${Math.min(d * FRONT_SPEED_MS, MAX_STAGGER_MS)}ms`;
      }
    }

    const curWet = new Uint8Array(n);
    for (let i = 0; i < k; i++) curWet[order[i]] = 1;
    prevWetRef.current = curWet;
    prevKRef.current = k;
  }, [lattice, k, reduced]);

  // -- one polite announcement per threshold crossing, in each direction --
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);
  const prevAboveRef = useRef(aboveThreshold);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevAboveRef.current = aboveThreshold;
      return;
    }
    if (aboveThreshold !== prevAboveRef.current) {
      prevAboveRef.current = aboveThreshold;
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = aboveThreshold
          ? `Crossed containment threshold — largest connected exposure now spans the lattice.`
          : `Back below containment threshold.`;
      }
    }
  }, [aboveThreshold]);

  const commit = (v: number) => {
    const q = clamp(v, 0, 100);
    if (Math.abs(q - valueRef.current) < 1e-9) return;
    if (!isControlled) setRolloutInternal(q);
    onRolloutChange?.(q);
  };

  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [active, setActive] = useState(false);

  const posToValue = (clientX: number): number => {
    const track = trackRef.current;
    if (!track) return valueRef.current;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return valueRef.current;
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  };

  const onTrackPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setActive(true);
    commit(posToValue(e.clientX));
  };
  const onTrackPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    commit(posToValue(e.clientX));
  };
  const endDrag = () => {
    draggingRef.current = false;
    setActive(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = valueRef.current;
    const cellStep = Math.max(100 / lattice.n, 0.5);
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = v + cellStep;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = v - cellStep;
        break;
      case "PageUp":
        next = v + 10;
        break;
      case "PageDown":
        next = v - 10;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 100;
        break;
      default:
        return;
    }
    e.preventDefault();
    commit(clamp(next, 0, 100));
  };

  const valueText = `rollout ${roundedRollout}% — largest connected exposure ${clusterPct}% of ${segmentLabel}, ${
    aboveThreshold ? "above" : "below"
  } containment threshold`;

  return (
    <div className={`w-full select-none ${className}`}>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${lattice.cols} ${lattice.rows}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full rounded-md border border-border bg-background"
        style={{ aspectRatio: `${lattice.cols} / ${lattice.rows}` }}
      >
        {Array.from({ length: lattice.n }, (_, i) => {
          const r = Math.floor(i / lattice.cols);
          const c = i % lattice.cols;
          const isWet = wetMask[i] === 1;
          const isCluster = clusterMask[i] === 1;
          const fill = isCluster ? "var(--foreground)" : isWet ? "var(--ns-muted)" : "var(--border)";
          return (
            <rect
              key={i}
              ref={(el) => {
                cellElsRef.current[i] = el;
              }}
              x={c + CELL_GAP / 2}
              y={r + CELL_GAP / 2}
              width={1 - CELL_GAP}
              height={1 - CELL_GAP}
              rx={0.06}
              fill={fill}
              className="transition-colors ease-out motion-reduce:transition-none"
              style={{ transitionDuration: `${FILL_DURATION_MS}ms` }}
            />
          );
        })}
        {perimeterD && (
          <path
            d={perimeterD}
            fill="var(--foreground)"
            fillOpacity={0.06}
            fillRule="evenodd"
            stroke="var(--foreground)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <div className="mt-3 flex items-center justify-between font-mono text-xs">
        <span className="text-ns-muted">Rollout</span>
        <span className="tabular-nums text-foreground">{roundedRollout}%</span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Rollout percentage"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedRollout}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="group relative mt-1.5 h-5 w-full cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-border" />
        <span
          aria-hidden
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-foreground/70"
          style={{ width: `${roundedRollout}%` }}
        />
        <span
          aria-hidden
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/50"
          style={{ left: `${thresholdRoundedPct}%` }}
        />
        <span
          aria-hidden
          data-active={active}
          style={{ left: `${roundedRollout}%` }}
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background transition-colors duration-150 group-hover:border-foreground/40 data-[active=true]:border-ns-accent"
        />
      </div>

      <p className="mt-2 font-mono text-xs text-ns-muted">
        threshold <span className="tabular-nums text-foreground">{thresholdRoundedPct}%</span>
        {" · "}largest connected exposure{" "}
        <span className="tabular-nums text-foreground">{clusterPct}%</span> of {segmentLabel}
        {" — "}
        <span className={aboveThreshold ? "text-foreground" : "text-ns-muted"}>
          {aboveThreshold ? "above" : "below"} containment threshold
        </span>
      </p>

      <div aria-live="polite" className="sr-only" ref={liveRegionRef} />
    </div>
  );
}
