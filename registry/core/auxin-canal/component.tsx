"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AuxinCanal — a full-bleed hero whose vein network grows by space
// colonisation (Runions et al.) through whatever area the copy leaves empty.
// Auxin sources are scattered on a jittered grid across the container, then
// every source that falls inside a measured content box (headline, subcopy,
// CTA row, stat strip — read live via getBoundingClientRect under a
// ResizeObserver) is simply never added. Avoidance is therefore a property
// of where the sources exist, not a mask or clip-path drawn over the result.
//
// Each 30Hz tick: a quadtree of current vein tips answers "which sources are
// within reach", tips advance one step toward the mean direction of every
// source that picked them as nearest, and a second quadtree of sources
// answers "which sources just got swallowed" so they can be removed before
// the next tick. Kill distance dk = 1.7x the mean source spacing (the grid
// cell size); attraction radius = 5x dk; step length = 0.6x dk (always
// smaller than dk, so a step can never leap clean over a source without
// killing it). rho — how tight the source grid is packed — is the one knob
// between a sparse palm-fan network and a dense reticulate mesh.
//
// Segment width is NOT looked up from a lookup table; it is Murray's law,
// maintained incrementally. Every node tracks leafCount = the number of live
// terminal tips its subtree currently ends in (1 while it is itself a tip).
// Extending a tip in place never changes that count. Only the moment a node
// that already has one child grows a SECOND child — an actual fork — does
// its count rise, and that rise is walked straight up its ancestor chain.
// Width of the segment feeding any node = leafCount^(1/3), so a trunk is
// only ever as thick as the tissue still draining through it.
//
// Committed geometry is batched into eight <path> elements bucketed by that
// width (colour is var(--ns-muted) for the four thin buckets, var(--foreground)
// for the four thick ones, via `currentColor` on two wrapping <g>s so a theme
// switch repaints for free); only the current tick's freshly grown segments
// live in a ninth "active tip" path until the next tick folds them in. Once
// no source remains reachable the lamina rests, then abscises — the two
// wrapping groups' `color` transitions to var(--background), draining the
// whole network into the page — and a fresh source scatter begins.
// ---------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Source {
  x: number;
  y: number;
}

interface VNode {
  x: number;
  y: number;
  parent: number; // -1 = seed, enters from the container edge
  leafCount: number;
  children: number[];
}

interface QPoint {
  x: number;
  y: number;
  id: number;
}

/** Minimal point quadtree: insert + circular range query. Rebuilt fresh each
 * tick from whichever point set (tips, or remaining sources) it is asked to
 * index — cheap at these counts (<=1500 points) and avoids ever having to
 * remove a point from a persistent tree. */
class Quadtree {
  private readonly capacity = 8;
  private points: QPoint[] = [];
  private divided = false;
  private nw: Quadtree | null = null;
  private ne: Quadtree | null = null;
  private sw: Quadtree | null = null;
  private se: Quadtree | null = null;

  constructor(private readonly bx: number, private readonly by: number, private readonly bw: number, private readonly bh: number) {}

  private contains(p: QPoint): boolean {
    return p.x >= this.bx && p.x < this.bx + this.bw && p.y >= this.by && p.y < this.by + this.bh;
  }

  private intersectsCircle(cx: number, cy: number, r: number): boolean {
    const nx = Math.max(this.bx, Math.min(cx, this.bx + this.bw));
    const ny = Math.max(this.by, Math.min(cy, this.by + this.bh));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  private subdivide(): void {
    const hw = this.bw / 2;
    const hh = this.bh / 2;
    this.nw = new Quadtree(this.bx, this.by, hw, hh);
    this.ne = new Quadtree(this.bx + hw, this.by, hw, hh);
    this.sw = new Quadtree(this.bx, this.by + hh, hw, hh);
    this.se = new Quadtree(this.bx + hw, this.by + hh, hw, hh);
    this.divided = true;
  }

  insert(p: QPoint): boolean {
    if (!this.contains(p)) return false;
    if (!this.divided && this.points.length < this.capacity) {
      this.points.push(p);
      return true;
    }
    if (this.bw < 1 || this.bh < 1) {
      // degenerate leaf — stop subdividing, just accumulate
      this.points.push(p);
      return true;
    }
    if (!this.divided) this.subdivide();
    return (
      (this.nw?.insert(p) ?? false) ||
      (this.ne?.insert(p) ?? false) ||
      (this.sw?.insert(p) ?? false) ||
      (this.se?.insert(p) ?? false)
    );
  }

  queryRadius(cx: number, cy: number, r: number, out: QPoint[]): void {
    if (!this.intersectsCircle(cx, cy, r)) return;
    const r2 = r * r;
    for (const p of this.points) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      if (dx * dx + dy * dy <= r2) out.push(p);
    }
    if (this.divided) {
      this.nw?.queryRadius(cx, cy, r, out);
      this.ne?.queryRadius(cx, cy, r, out);
      this.sw?.queryRadius(cx, cy, r, out);
      this.se?.queryRadius(cx, cy, r, out);
    }
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KILL_RATIO = 1.7; // dk = KILL_RATIO * mean source spacing
const ATTRACT_RATIO = 5; // di = ATTRACT_RATIO * dk
const STEP_RATIO = 0.6; // D = STEP_RATIO * dk — always < dk
const BOX_PAD = 22; // px clearance kept around every measured content box
const STEP_MS = 1000 / 30; // fixed 30Hz colonisation tick
const STAGNANT_LIMIT = 3; // consecutive empty ticks before growth is "done"
const MAX_TICKS = 900; // hard safety cap (~30s at 30Hz)
const MAX_NODES = 1600;
const REST_MS = 3200; // how long a completed lamina rests before it drains
const DRAIN_MS = 1500; // colour-drain to --background
const W0 = 0.55; // leaf (tip) stroke width in px

const BUCKET_WIDTH = [0.55, 0.85, 1.15, 1.5, 1.9, 2.4, 3.0, 3.7];
const BUCKET_OPACITY = [0.3, 0.4, 0.5, 0.6, 0.5, 0.66, 0.82, 1];
const THIN_BUCKETS = 4; // buckets 0..3 render in the --ns-muted group

function buildSeeds(w: number, h: number): Source[] {
  return [
    { x: w * 0.14, y: h - 1 },
    { x: w * 0.5, y: h - 1 },
    { x: w * 0.86, y: h - 1 },
    { x: 1, y: h * 0.28 },
    { x: 1, y: h * 0.72 },
    { x: w - 1, y: h * 0.28 },
    { x: w - 1, y: h * 0.72 },
  ];
}

function insideAnyBox(x: number, y: number, boxes: Box[]): boolean {
  for (const b of boxes) {
    if (x >= b.x - BOX_PAD && x <= b.x + b.w + BOX_PAD && y >= b.y - BOX_PAD && y <= b.y + b.h + BOX_PAD) {
      return true;
    }
  }
  return false;
}

function buildSources(
  w: number,
  h: number,
  boxes: Box[],
  targetCount: number,
  rand: () => number
): { sources: Source[]; meanSpacing: number } {
  const area = Math.max(1, w * h);
  const cell = Math.sqrt(area / Math.max(1, targetCount));
  const cols = Math.max(1, Math.round(w / cell));
  const rows = Math.max(1, Math.round(h / cell));
  const cw = w / cols;
  const ch = h / rows;
  const sources: Source[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.5) * cw + (rand() - 0.5) * 0.8 * cw;
      const y = (j + 0.5) * ch + (rand() - 0.5) * 0.8 * ch;
      if (x < 0 || y < 0 || x > w || y > h) continue;
      if (insideAnyBox(x, y, boxes)) continue;
      sources.push({ x, y });
    }
  }
  return { sources, meanSpacing: (cw + ch) / 2 };
}

export interface AuxinCanalProps {
  /** mono eyebrow line above the headline */
  eyebrow?: string;
  /** display headline, one string per rendered line */
  headlineLines?: string[];
  /** muted supporting copy under the headline */
  subcopy?: string;
  /** accent primary CTA */
  primaryCta?: { label: string; href: string };
  /** ghost secondary CTA */
  secondaryCta?: { label: string; href: string };
  /** three mono stats for the bordered strip below the CTAs */
  stats?: { value: string; label: string }[];
  /** target auxin source count before content-box exclusion (rho's knob) */
  sourceCount?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function AuxinCanal({
  eyebrow = "SPACE-COLONISED ROUTING",
  headlineLines = ["Traffic finds every channel", "your interface leaves open"],
  subcopy = "Auxin Canal grows a delivery network through whatever capacity the page doesn't use — sources scattered across the empty space, consumed as tips reach them, and widened by Murray's law so trunks earn their thickness from the load they actually carry.",
  primaryCta = { label: "Read the docs", href: "#docs" },
  secondaryCta = { label: "View the API", href: "#api" },
  stats = [
    { value: "1,200", label: "auxin sources / cycle" },
    { value: "1.7×", label: "kill-distance ratio" },
    { value: "30Hz", label: "colonisation tick" },
  ],
  sourceCount = 1200,
  className = "",
}: AuxinCanalProps) {
  const rootRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bucketRefs = useRef<(SVGPathElement | null)[]>([]);
  const activeRef = useRef<SVGPathElement | null>(null);
  const [draining, setDraining] = useState(false);
  const linesKey = headlineLines.join(" ");

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0xa0c1a2);

    let disposed = false;
    let w = 0;
    let h = 0;
    let sized = false;

    let nodes: VNode[] = [];
    let sources: Source[] = [];
    let dk = 1;
    let di = 1;
    let step = 1;
    let newTickStart = 0;
    let stagnant = 0;
    let tickCount = 0;
    let phase: "grow" | "rest" | "drain" = "grow";
    let visible = true;

    let raf = 0;
    let acc = 0;
    let last = 0;
    let restTimer = 0;
    let drainTimer = 0;

    const measureBoxes = (): Box[] => {
      const rect = root.getBoundingClientRect();
      const boxes: Box[] = [];
      root.querySelectorAll<HTMLElement>("[data-auxin-box]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        boxes.push({ x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height });
      });
      return boxes;
    };

    const applyD = (idx: number, d: string) => {
      const el = bucketRefs.current[idx];
      if (el) el.setAttribute("d", d);
    };

    const clearPaths = () => {
      for (let i = 0; i < 8; i++) applyD(i, "");
      activeRef.current?.setAttribute("d", "");
    };

    // -- one node ends a tip's flight; adding a child is where Murray's law
    // actually happens: extending an existing tip in place costs nothing,
    // only a genuine fork (a node gaining its SECOND child) raises leafCount,
    // and that rise is walked straight up the ancestor chain. --------------
    const addChild = (parentIdx: number, x: number, y: number): number => {
      const idx = nodes.length;
      nodes.push({ x, y, parent: parentIdx, leafCount: 1, children: [] });
      const parent = nodes[parentIdx];
      if (!parent) return idx;
      const wasLeaf = parent.children.length === 0;
      parent.children.push(idx);
      if (!wasLeaf) {
        let cur: number = parentIdx;
        while (cur !== -1) {
          const n = nodes[cur];
          if (!n) break;
          n.leafCount += 1;
          cur = n.parent;
        }
      }
      return idx;
    };

    // -- one fixed-length colonisation step: attract every live source to
    // its nearest reachable tip via a quadtree of nodes, advance every tip
    // that attracted at least one source, then kill every source a fresh
    // node lands within dk of via a quadtree of sources. ------------------
    const tick = (): boolean => {
      if (sources.length === 0 || nodes.length >= MAX_NODES) return false;

      const nodeQT = new Quadtree(-di, -di, w + 2 * di, h + 2 * di);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n) nodeQT.insert({ x: n.x, y: n.y, id: i });
      }

      const sumX = new Map<number, number>();
      const sumY = new Map<number, number>();
      const buf: QPoint[] = [];
      for (const s of sources) {
        buf.length = 0;
        nodeQT.queryRadius(s.x, s.y, di, buf);
        if (buf.length === 0) continue;
        let bestId = -1;
        let bestD = Infinity;
        for (const p of buf) {
          const dx = p.x - s.x;
          const dy = p.y - s.y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            bestId = p.id;
          }
        }
        if (bestId < 0) continue;
        const node = nodes[bestId];
        if (!node) continue;
        const dx = s.x - node.x;
        const dy = s.y - node.y;
        const len = Math.hypot(dx, dy) || 1;
        sumX.set(bestId, (sumX.get(bestId) ?? 0) + dx / len);
        sumY.set(bestId, (sumY.get(bestId) ?? 0) + dy / len);
      }
      if (sumX.size === 0) return false;

      newTickStart = nodes.length;
      for (const [idx, sx] of sumX) {
        const sy = sumY.get(idx) ?? 0;
        const len = Math.hypot(sx, sy) || 1;
        const parent = nodes[idx];
        if (!parent) continue;
        const nx = parent.x + (sx / len) * step;
        const ny = parent.y + (sy / len) * step;
        addChild(idx, nx, ny);
        if (nodes.length >= MAX_NODES) break;
      }
      if (nodes.length === newTickStart) return false;

      const srcQT = new Quadtree(-1, -1, w + 2, h + 2);
      for (let i = 0; i < sources.length; i++) {
        const s = sources[i];
        if (s) srcQT.insert({ x: s.x, y: s.y, id: i });
      }
      const dead = new Set<number>();
      const kbuf: QPoint[] = [];
      for (let i = newTickStart; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n) continue;
        kbuf.length = 0;
        srcQT.queryRadius(n.x, n.y, dk, kbuf);
        for (const p of kbuf) dead.add(p.id);
      }
      if (dead.size > 0) sources = sources.filter((_, i) => !dead.has(i));
      return true;
    };

    // -- rebuild the eight committed buckets (everything grown before this
    // tick) and the one active-tip path (everything grown this tick). Full
    // rebuild every tick is O(nodes) — trivial at these counts (<=1600). --
    const render = () => {
      let maxLeaf = 1;
      for (const n of nodes) if (n.leafCount > maxLeaf) maxLeaf = n.leafCount;
      const maxWidth = W0 * Math.cbrt(maxLeaf);
      const spans = new Array(8).fill("") as string[];
      let activeSpan = "";
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n || n.parent === -1) continue;
        const p = nodes[n.parent];
        if (!p) continue;
        const seg = `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
        if (i >= newTickStart) {
          activeSpan += seg;
          continue;
        }
        const width = W0 * Math.cbrt(n.leafCount);
        const t = maxWidth > W0 ? (width - W0) / (maxWidth - W0) : 0;
        const bi = Math.min(7, Math.max(0, Math.floor(t * 8)));
        spans[bi] += seg;
      }
      for (let i = 0; i < 8; i++) applyD(i, spans[i] ?? "");
      activeRef.current?.setAttribute("d", activeSpan);
    };

    const finishGrowth = () => {
      phase = "rest";
      newTickStart = nodes.length; // fold whatever was still "active" in
      render();
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(beginDrain, REST_MS);
    };

    const beginDrain = () => {
      if (disposed) return;
      phase = "drain";
      setDraining(true);
      window.clearTimeout(drainTimer);
      drainTimer = window.setTimeout(resetCycle, DRAIN_MS);
    };

    const resetCycle = () => {
      if (disposed) return;
      setDraining(false);
      clearPaths();
      startCycle();
    };

    const startCycle = () => {
      window.clearTimeout(restTimer);
      window.clearTimeout(drainTimer);
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      sized = true;
      const boxes = measureBoxes();
      const built = buildSources(w, h, boxes, sourceCount, rand);
      sources = built.sources;
      dk = KILL_RATIO * built.meanSpacing;
      di = ATTRACT_RATIO * dk;
      step = STEP_RATIO * dk;
      nodes = buildSeeds(w, h).map((s) => ({ x: s.x, y: s.y, parent: -1, leafCount: 1, children: [] }));
      newTickStart = nodes.length;
      stagnant = 0;
      tickCount = 0;
      phase = "grow";

      if (reduced) {
        // run the whole cycle to completion synchronously, once, and stop
        for (let i = 0; i < MAX_TICKS; i++) {
          const grew = tick();
          if (!grew) {
            stagnant += 1;
            if (stagnant >= STAGNANT_LIMIT) break;
          } else {
            stagnant = 0;
          }
        }
        newTickStart = nodes.length;
        render();
        phase = "rest"; // settled — no drain, no further cycles
        return;
      }

      last = 0;
      acc = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized || phase !== "grow") return;
      if (last === 0) last = now;
      acc += Math.min(100, now - last);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        const grew = tick();
        tickCount += 1;
        if (!grew) {
          stagnant += 1;
        } else {
          stagnant = 0;
        }
        if (stagnant >= STAGNANT_LIMIT || tickCount >= MAX_TICKS) {
          finishGrowth();
          return;
        }
      }
      render();
      raf = requestAnimationFrame(loop);
    };

    startCycle();

    // -- resize / layout observers: re-measure content boxes and restart
    // the whole cycle, so a moved headline genuinely changes the topology
    // rather than just clipping the same network differently. ------------
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        window.clearTimeout(restTimer);
        window.clearTimeout(drainTimer);
        setDraining(false);
        clearPaths();
        startCycle();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && phase === "grow" && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) onResize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(restTimer);
      window.clearTimeout(drainTimer);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, sourceCount]);

  return (
    <section
      ref={rootRef}
      className={`relative isolate overflow-hidden bg-background ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <g
          style={{
            color: draining ? "var(--background)" : "var(--ns-muted)",
            transition: "color 1500ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {BUCKET_WIDTH.slice(0, THIN_BUCKETS).map((width, i) => (
            <path
              key={i}
              ref={(el) => {
                bucketRefs.current[i] = el;
              }}
              d=""
              fill="none"
              stroke="currentColor"
              strokeOpacity={BUCKET_OPACITY[i]}
              strokeWidth={width}
              strokeLinecap="round"
            />
          ))}
          <path
            ref={activeRef}
            d=""
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={BUCKET_WIDTH[0]}
            strokeLinecap="round"
          />
        </g>
        <g
          style={{
            color: draining ? "var(--background)" : "var(--foreground)",
            transition: "color 1500ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {BUCKET_WIDTH.slice(THIN_BUCKETS).map((width, i) => (
            <path
              key={i + THIN_BUCKETS}
              ref={(el) => {
                bucketRefs.current[i + THIN_BUCKETS] = el;
              }}
              d=""
              fill="none"
              stroke="currentColor"
              strokeOpacity={BUCKET_OPACITY[i + THIN_BUCKETS]}
              strokeWidth={width}
              strokeLinecap="round"
            />
          ))}
        </g>
      </svg>
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-24 sm:pt-32">
        <p className="mb-6 font-mono text-[11px] tracking-widest text-ns-muted">{eyebrow}</p>
        <h1
          data-auxin-box
          className="font-semibold text-foreground"
          style={{ fontSize: "clamp(2.5rem, 6.5vw, 4.5rem)", lineHeight: 1.06, letterSpacing: "-0.03em" }}
        >
          {headlineLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p data-auxin-box className="mt-6 max-w-xl text-base leading-relaxed text-ns-muted">
          {subcopy}
        </p>
        <div data-auxin-box className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <a
            href={primaryCta.href}
            className="rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {primaryCta.label}
          </a>
          <a
            href={secondaryCta.href}
            className="rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {secondaryCta.label}
          </a>
        </div>
        <div
          data-auxin-box
          className="mt-16 grid w-full max-w-2xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0"
        >
          {stats.slice(0, 3).map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 px-6 py-4">
              <span className="font-mono text-lg text-foreground">{s.value}</span>
              <span className="font-mono text-[11px] tracking-widest text-ns-muted">
                {s.label.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
