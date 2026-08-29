"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// FoamDrainCoarsen — a full-bleed aqueous-foam cell mesh that coarsens under
// von Neumann's law and drains under gravity, sourced from real foam physics
// (Weaire & Hutzler, "The Physics of Foams"; Plateau's laws; von Neumann's
// law for 2D cell growth).
//
// THE TESSELLATION IS A REAL LAGUERRE / POWER DIAGRAM, not an authored cell
// pattern and not Lloyd relaxation. Every site carries a weight w_i as well
// as a position; a point x belongs to site i when the POWER DISTANCE
// |x-i|^2 - w_i is smaller than every other site's, which is exactly the
// mathematical model materials scientists use for real foam/grain
// tessellations (a weighted Voronoi diagram). Each site's cell is built by
// clipping the canvas rectangle against every other site's power bisector
// half-plane (Sutherland-Hodgman), so cell boundaries are exact vector
// polygons, never a rasterised approximation.
//
// GROWTH: von Neumann's law says a 2D foam cell with n sides grows or
// shrinks at dA/dt = kappa*(n-6) — more than six neighbours, it grows; fewer,
// it shrinks toward zero and vanishes (a T2 event). n_i for each site is
// measured from the REAL tessellation, not guessed: for every edge of a
// cell's clipped polygon, the edge midpoint's power distance is checked
// against every other site, and whichever site ties the cell's own power
// distance there is that edge's true neighbour — n is the count of distinct
// neighbours found this way. That measurement (and the growth-law weight
// update it drives) runs on a throttled ~7Hz tick (CLASSIFY_INTERVAL_MS);
// the polygon CLIPPING that measurement reads, and that the frame draws,
// still happens every rAF frame so growth reads as continuous even though
// the topology count itself only needs to be fresh every couple hundred ms.
// A cell whose measured area drops under DEATH_AREA_PX2 is a genuine T2
// event: the site is retired and a replacement site (weight 0, a short
// birth grace period immune to the death check) is scattered elsewhere,
// biased toward the lower half of the frame — this is what keeps the field
// unbounded forever instead of coarsening to one giant cell and stopping.
// T1 edge-flip-style rewiring is never special-cased: because neighbour
// topology is re-measured from the live tessellation rather than tracked as
// a fixed graph, an edge appearing or disappearing between two cells falls
// straight out of the weight changes with no separate event code.
//
// DRAINAGE: real foam is wetter (thicker Plateau borders) near the base and
// dries out (hairline borders) toward the top as liquid drains under
// gravity. Every rendered edge's stroke width is `lerp(BORDER_MIN,
// BORDER_MAX, midpointY / height)` plus an additive wetness bias near the
// base that ramps up over REFILL_RAMP_MS then decays across the rest of a
// REFILL_PERIOD_MS cycle — a slow re-wetting-then-draining sawtooth, the
// same liberty leaven-crest-fall's feed pulse takes on a different mechanic,
// taken here so the field never fully dries out and goes idle.
//
// PERFORMANCE: edges are bucketed by their final stroke width into 8
// Path2D objects (same "bucket by value, stroke once per bucket" pattern
// auxin-canal uses for Murray's-law width) so the whole mesh strokes in a
// fixed ~8 canvas draw calls regardless of cell count, not one stroke call
// per edge. Cell count is derived from the container's smaller dimension
// per the spec (targetCellSize = minDim/9, clamped [40,140]) but hard
// capped at MAX_CELLS=90 — the documented deviation from an uncapped area
// formula, kept for the O(N^2) clip/classify cost this tessellation method
// carries at very large viewports.
//
// DIFFERENTIATOR — read before assuming this is a restyle: background-
// lloyd-relax drives every site toward its OWN cell's centroid every frame
// (a relaxation whose fixed point is a centroidal Voronoi tessellation, so
// at rest it reads as one uniformly-toned engraved screen). This component
// never moves a site toward a centroid at all — sites only change their
// WEIGHT under an explicit physical growth law, and the identity carried by
// the mesh is the height-graded border-width wetness gradient plus visible
// T2 vanish events, not a uniformly relaxed tone. background-ascii-voronoi-
// walls draws walls-only from an unweighted, static, unchanging Voronoi
// diagram at fixed cell resolution; this is a continuously growing/shrinking
// WEIGHTED (Laguerre) diagram whose weights evolve under a named physical
// law. If a build of this ever reads, at a glance, indistinguishable from
// either sibling, the wetness gradient and vanish events are not doing
// their job and this component should not ship.
//
// Tokens: --background clears the canvas (and IS every cell's transparent
// gas interior — nothing is filled, only the Plateau-border strokes paint).
// --foreground is the border stroke colour, mixed toward higher alpha only
// (never --ns-accent, never a hue shift) within POINTER_RADIUS of the
// pointer, drawn as a small separate overlay pass so the base 8-bucket
// stroke pass never needs a per-edge alpha. getComputedStyle at mount +
// re-read on a MutationObserver watching documentElement's class; nothing
// paints before that first read.
// ---------------------------------------------------------------------------

export interface FoamDrainCoarsenProps {
  /** target cell spacing as a fraction of the container's smaller dimension. @default 1/9 */
  cellSizeRatio?: number;
  /** freeze the field at its warm-start frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Site = {
  x: number;
  y: number;
  w: number;
  alive: boolean;
  n: number;
  area: number;
  bornAt: number;
};

type Pt = [number, number];

const KAPPA = 0.35; // von Neumann growth constant, area-units/s per side-deficit
const DEATH_AREA = 6; // px^2 — below this a cell is retired (T2 event)
const BIRTH_GRACE_MS = 500; // a freshly spawned site is immune to the death check this long
const CELL_SIZE_DIVISOR = 9;
const CELL_SIZE_MIN = 40;
const CELL_SIZE_MAX = 140;
const MAX_CELLS = 90; // hard perf cap, see header comment
const BORDER_MIN = 0.5;
const BORDER_MAX = 4;
const WETNESS_BOOST = 1.5;
const REFILL_PERIOD_MS = 40000;
const REFILL_RAMP_MS = 6000;
const REFILL_DECAY_MS = REFILL_PERIOD_MS - REFILL_RAMP_MS;
const CLASSIFY_INTERVAL_MS = 150;
const POINTER_RADIUS = 140;
const POINTER_BOOST_ALPHA = 0.3;
const WIDTH_BUCKETS = 8;
const WARM_MS = 6000; // reduced-motion freeze target: t=6s of the 40s cycle

function clipHalfPlane(poly: Pt[], a: number, b: number, c: number): Pt[] {
  if (poly.length === 0) return poly;
  const out: Pt[] = [];
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const curr = poly[k];
    const next = poly[(k + 1) % n];
    const cVal = a * curr[0] + b * curr[1] - c;
    const nVal = a * next[0] + b * next[1] - c;
    const cIn = cVal <= 0;
    const nIn = nVal <= 0;
    if (cIn) out.push(curr);
    if (cIn !== nIn) {
      const t = cVal / (cVal - nVal);
      out.push([curr[0] + t * (next[0] - curr[0]), curr[1] + t * (next[1] - curr[1])]);
    }
  }
  return out;
}

function clipCell(site: Site, sites: Site[], width: number, height: number): Pt[] {
  let poly: Pt[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ];
  for (let j = 0; j < sites.length; j++) {
    const other = sites[j];
    if (other === site || !other.alive) continue;
    const a = 2 * (other.x - site.x);
    const b = 2 * (other.y - site.y);
    const c =
      other.x * other.x + other.y * other.y - other.w - (site.x * site.x + site.y * site.y - site.w);
    poly = clipHalfPlane(poly, a, b, c);
    if (poly.length === 0) return poly;
  }
  return poly;
}

function polygonArea(poly: Pt[]): number {
  let sum = 0;
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const [x1, y1] = poly[k];
    const [x2, y2] = poly[(k + 1) % n];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function powerDist(px: number, py: number, s: Site): number {
  const dx = px - s.x;
  const dy = py - s.y;
  return dx * dx + dy * dy - s.w;
}

function spawnSite(rand: () => number, width: number, height: number, now: number): Site {
  const bottomBiased = rand() < 0.7;
  const y = bottomBiased ? height * (0.5 + rand() * 0.5) : rand() * height;
  return {
    x: rand() * width,
    y,
    w: 0,
    alive: true,
    n: 6,
    area: 0,
    bornAt: now,
  };
}

function initSites(rand: () => number, width: number, height: number, spacing: number, now: number): Site[] {
  const cols = Math.max(1, Math.round(width / spacing));
  const rows = Math.max(1, Math.round(height / spacing));
  const sites: Site[] = [];
  for (let r = 0; r < rows && sites.length < MAX_CELLS; r++) {
    for (let c = 0; c < cols && sites.length < MAX_CELLS; c++) {
      const jx = (rand() - 0.5) * spacing * 0.7;
      const jy = (rand() - 0.5) * spacing * 0.7;
      sites.push({
        x: (c + 0.5) * (width / cols) + jx,
        y: (r + 0.5) * (height / rows) + jy,
        w: (rand() - 0.5) * spacing * spacing * 0.4, // small initial jitter so growth is visible immediately
        alive: true,
        n: 6,
        area: 0,
        bornAt: now,
      });
    }
  }
  return sites;
}

function wetnessBias(cycleT: number): number {
  if (cycleT < REFILL_RAMP_MS) return cycleT / REFILL_RAMP_MS;
  const u = (cycleT - REFILL_RAMP_MS) / REFILL_DECAY_MS;
  return Math.exp(-u * 3.2);
}

function classifyAndGrow(sites: Site[], polys: (Pt[] | null)[], width: number, height: number, spacing: number, dtSec: number) {
  const eps = 0.06 * spacing * spacing;
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const poly = polys[i];
    if (!s.alive || !poly || poly.length < 3) continue;
    const neighbors = new Set<number>();
    const len = poly.length;
    for (let k = 0; k < len; k++) {
      const [x1, y1] = poly[k];
      const [x2, y2] = poly[(k + 1) % len];
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dI = powerDist(mx, my, s);
      let bestJ = -1;
      let bestVal = Infinity;
      for (let j = 0; j < sites.length; j++) {
        if (j === i || !sites[j].alive) continue;
        const dJ = powerDist(mx, my, sites[j]);
        if (dJ < bestVal) {
          bestVal = dJ;
          bestJ = j;
        }
      }
      if (bestJ !== -1 && bestVal - dI < eps) neighbors.add(bestJ);
    }
    s.n = neighbors.size || 6;
    s.w += KAPPA * (s.n - 6) * dtSec;
  }
  void width;
  void height;
}

export function FoamDrainCoarsen({
  cellSizeRatio = 1 / CELL_SIZE_DIVISOR,
  paused = false,
  children,
  className = "",
  style,
}: FoamDrainCoarsenProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim();
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let spacing = 60;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0;
    let lastClassify = 0;

    const rand = mulberry32(0x666f616d);
    let sites: Site[] = [];
    let polys: (Pt[] | null)[] = [];

    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;

    const buildField = () => {
      spacing = Math.min(CELL_SIZE_MAX, Math.max(CELL_SIZE_MIN, Math.min(width, height) * cellSizeRatio));
      sites = initSites(rand, width, height, spacing, simTime);
      polys = sites.map(() => null);
    };

    const clipAll = () => {
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        if (!s.alive) {
          polys[i] = null;
          continue;
        }
        const poly = clipCell(s, sites, width, height);
        polys[i] = poly;
        s.area = poly.length >= 3 ? polygonArea(poly) : 0;
      }
    };

    const killAndRespawn = () => {
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        if (!s.alive) continue;
        if (simTime - s.bornAt < BIRTH_GRACE_MS) continue;
        if (s.area > 0 && s.area < DEATH_AREA) {
          sites[i] = spawnSite(rand, width, height, simTime);
        }
      }
    };

    const step = (dtMs: number) => {
      simTime += dtMs;
      clipAll();
      killAndRespawn();
      if (simTime - lastClassify >= CLASSIFY_INTERVAL_MS) {
        const dtSec = (simTime - lastClassify) / 1000;
        lastClassify = simTime;
        classifyAndGrow(sites, polys, width, height, spacing, dtSec);
      }
    };

    const widthFor = (my: number, bias: number): number => {
      const normY = Math.min(1, Math.max(0, my / Math.max(1, height)));
      return BORDER_MIN + (BORDER_MAX - BORDER_MIN) * normY + bias * WETNESS_BOOST * (1 - normY);
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      if (!fg) return;

      const bias = wetnessBias(simTime % REFILL_PERIOD_MS);
      const buckets: Path2D[] = Array.from({ length: WIDTH_BUCKETS }, () => new Path2D());
      const wLo = BORDER_MIN;
      const wHi = BORDER_MAX + WETNESS_BOOST;
      const bucketSpan = (wHi - wLo) / WIDTH_BUCKETS;

      const pointerPath = new Path2D();
      let hasPointerEdges = false;

      for (let i = 0; i < sites.length; i++) {
        const s = sites[i];
        const poly = polys[i];
        if (!s.alive || !poly || poly.length < 3) continue;
        const len = poly.length;
        for (let k = 0; k < len; k++) {
          const [x1, y1] = poly[k];
          const [x2, y2] = poly[(k + 1) % len];
          const my = (y1 + y2) / 2;
          const w = widthFor(my, bias);
          const idx = Math.min(WIDTH_BUCKETS - 1, Math.max(0, Math.floor((w - wLo) / bucketSpan)));
          buckets[idx].moveTo(x1, y1);
          buckets[idx].lineTo(x2, y2);

          if (pointerActive) {
            const mx = (x1 + x2) / 2;
            const d = Math.hypot(mx - pointerX, my - pointerY);
            if (d < POINTER_RADIUS) {
              pointerPath.moveTo(x1, y1);
              pointerPath.lineTo(x2, y2);
              hasPointerEdges = true;
            }
          }
        }
      }

      ctx.strokeStyle = fg;
      ctx.lineCap = "round";
      for (let b = 0; b < WIDTH_BUCKETS; b++) {
        const centerW = wLo + bucketSpan * (b + 0.5);
        ctx.lineWidth = centerW;
        ctx.stroke(buckets[b]);
      }

      if (hasPointerEdges) {
        ctx.save();
        ctx.globalAlpha = POINTER_BOOST_ALPHA;
        ctx.lineWidth = BORDER_MAX * 0.9;
        ctx.stroke(pointerPath);
        ctx.restore();
      }
    };

    const drawStaticFreeze = () => {
      simTime = 0;
      lastClassify = 0;
      buildField();
      const steps = Math.round(WARM_MS / CLASSIFY_INTERVAL_MS);
      for (let i = 0; i < steps; i++) step(CLASSIFY_INTERVAL_MS);
      draw();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField();
      sized = true;
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dtMs = last ? Math.min(50, now - last) : 1000 / 60;
      last = now;
      step(dtMs);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        if (reduced || paused) {
          drawStaticFreeze();
        } else {
          simTime = 0;
          lastClassify = 0;
          draw();
          ready = true;
          if (visible && !raf) {
            last = 0;
            raf = requestAnimationFrame(loop);
          }
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(root);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) drawStaticFreeze();
      else draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = root.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      pointerActive = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerActive = false;
    };
    if (!reduced) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
    }

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      if (reduced || paused) {
        drawStaticFreeze();
        ready = true;
      } else {
        simTime = 0;
        lastClassify = 0;
        draw();
        ready = true;
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [cellSizeRatio, paused]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

FoamDrainCoarsen.displayName = "FoamDrainCoarsen";
