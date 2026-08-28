"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// HoneycombDraw — an ambient background built on real comb formation: bees
// deposit wax as loosely packed circular tubes at near-uniform spacing, and
// each three-way wall junction relaxes toward 120 degrees purely through
// LOCAL wall-by-wall straightening as neighbouring circles overlap — no cell
// ever "decides" to be a hexagon (Pirk et al. 2004; Bauer & Bienefeld 2013).
//
// This is deliberately NOT a hex grid that fades in. Every cell tracks its
// own growing radius plus, independently, a per-neighbour wall spring: a
// wall starts relaxing only once that specific pair of circles overlaps by
// more than a threshold, and each wall settles on its own schedule. A cell's
// silhouette is sampled at 36 angles as an interpolation between its current
// circular radius and each neighbour-facing wall's target distance, weighted
// by that wall's own spring progress — so a cell can show three straight
// facets and three still-round ones at once, which is the visible signature
// that distinguishes this from a static grid whose opacity is ramping.
// ---------------------------------------------------------------------------

export interface HoneycombDrawProps {
  /** Freezes on the fully-relaxed SETTLED_COMB frame without unmounting. */
  paused?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbaCss([r, g, b]: [number, number, number], a: number): string {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
}
function lerpRGB(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const GROWTH_SECONDS = 2.2;
const RADIUS_FRAC = 0.62; // of spacing s
const OVERLAP_TRIGGER_FRAC = 0.06; // of s
const SPRING_K = 90;
const SPRING_DAMP = 1.0; // critical
const SEED_RATE = 0.6; // cells/s
const FILL_CAP = 0.85;
const RECAP_MIN = 4;
const RECAP_MAX = 7;
const RECAP_FLASH = 0.26;
const RECAP_FADE = 0.9;
const SAMPLES = 36; // boundary samples per cell, for the polygon outline

// Standard "odd-r" offset-triangular-lattice neighbour offsets — six
// directions per cell, three shared with the row above and three with the
// row below, so the whole field tiles without gaps.
const NEI_EVEN: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [1, -1],
  [0, 1],
  [1, 1],
];
const NEI_ODD: [number, number][] = [
  [1, 0],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [-1, 1],
  [0, 1],
];

interface Wall {
  neighbor: Cell | null;
  triggered: boolean;
  progress: number; // 0..1 spring value
  velocity: number;
  wallDist: number; // px, distance from this cell's centre to the shared wall
  angle: number; // rad, direction from this cell to the neighbour
}

interface Cell {
  col: number;
  row: number;
  x: number;
  y: number;
  spawnAt: number;
  walls: Wall[]; // length 6, index-aligned with NEI_EVEN/NEI_ODD
  recapStart: number | null;
}

function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

export function HoneycombDraw({ paused = false, className = "", style }: HoneycombDrawProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let disposed = false;
    let running = false;
    let raf = 0;
    let staticMode = false;
    let lastMs = performance.now();
    let simTime = 0;
    let s = 40; // lattice spacing, recomputed on resize

    let cols = 0;
    let rows = 0;
    let cells: (Cell | null)[] = [];
    let filledCount = 0;
    let slotTotal = 0;
    let spawnAcc = 0;
    let nextRecapAt = 0;

    let border: [number, number, number] = [0.5, 0.5, 0.5];
    let muted: [number, number, number] = [0.5, 0.5, 0.5];
    let fg: [number, number, number] = [0.09, 0.09, 0.09];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      border = parseHex(cs.getPropertyValue("--border")) ?? [0.5, 0.5, 0.5];
      muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
    };
    readColors();

    const cellAt = (c: number, r: number): Cell | null => {
      if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
      return cells[r * cols + c];
    };

    const layout = () => {
      const ref = Math.min(cssW, cssH) || 1;
      s = ref / 11;
      const rowH = s * (Math.sqrt(3) / 2);
      cols = Math.max(1, Math.ceil(cssW / s) + 2);
      rows = Math.max(1, Math.ceil(cssH / rowH) + 2);
      cells = new Array(cols * rows).fill(null);
      filledCount = 0;
      slotTotal = cols * rows;
      spawnAcc = 0;
      nextRecapAt = simTime + RECAP_MIN + Math.random() * (RECAP_MAX - RECAP_MIN);
    };

    // Jittered lattice position for a slot — jitter is fixed per slot (seeded
    // from its indices) so it never shifts after the cell is spawned.
    const slotPos = (c: number, r: number): { x: number; y: number } => {
      const rowH = s * (Math.sqrt(3) / 2);
      const jseed = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
      const jx = ((jseed - Math.floor(jseed)) - 0.5) * 2 * (0.12 * s);
      const jseed2 = Math.sin(c * 39.346 + r * 11.135) * 24634.634;
      const jy = ((jseed2 - Math.floor(jseed2)) - 0.5) * 2 * (0.12 * s);
      const x = c * s + (Math.abs(r % 2) === 1 ? s / 2 : 0) + jx;
      const y = r * rowH + jy;
      return { x, y };
    };

    const spawnCell = (c: number, r: number) => {
      if (cellAt(c, r)) return;
      const { x, y } = slotPos(c, r);
      const cell: Cell = { col: c, row: r, x, y, spawnAt: simTime, walls: [], recapStart: null };
      cells[r * cols + c] = cell;
      filledCount++;
      // walls are wired lazily once both cells in a pair exist, in linkWalls()
    };

    // Wire (or re-wire) the 6 potential walls for every cell whose neighbour
    // set might have changed — cheap enough to run whenever a new cell spawns
    // since it only touches existing neighbours.
    const linkWalls = () => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cellAt(c, r);
          if (!cell) continue;
          const offsets = Math.abs(r % 2) === 1 ? NEI_ODD : NEI_EVEN;
          if (cell.walls.length !== 6) {
            cell.walls = offsets.map(() => ({
              neighbor: null,
              triggered: false,
              progress: 0,
              velocity: 0,
              wallDist: s * 0.5,
              angle: 0,
            }));
          }
          for (let k = 0; k < 6; k++) {
            const [dc, dr] = offsets[k];
            const nb = cellAt(c + dc, r + dr);
            const w = cell.walls[k];
            if (nb && w.neighbor !== nb) {
              w.neighbor = nb;
              const dx = nb.x - cell.x;
              const dy = nb.y - cell.y;
              w.angle = Math.atan2(dy, dx);
              w.wallDist = Math.hypot(dx, dy) * 0.5; // Voronoi bisector foot
            }
          }
        }
      }
    };

    const radiusOf = (cell: Cell, t: number): number => {
      const age = t - cell.spawnAt;
      const k = Math.max(0, Math.min(1, age / GROWTH_SECONDS));
      return RADIUS_FRAC * s * easeOutCubic(k);
    };

    const springStep = (w: Wall, dt: number) => {
      if (!w.triggered) return;
      const target = 1;
      const force = -SPRING_K * (w.progress - target) - 2 * Math.sqrt(SPRING_K) * SPRING_DAMP * w.velocity;
      w.velocity += force * dt;
      w.progress += w.velocity * dt;
      if (w.progress > 1 && Math.abs(w.velocity) < 0.001) {
        w.progress = 1;
        w.velocity = 0;
      }
    };

    const step = (dt: number) => {
      simTime += dt;

      // growth + overlap trigger + spring integration
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell) continue;
        const r0 = radiusOf(cell, simTime);
        for (const w of cell.walls) {
          if (!w.neighbor) continue;
          if (!w.triggered) {
            const r1 = radiusOf(w.neighbor, simTime);
            const dist = w.wallDist * 2;
            const overlap = r0 + r1 - dist;
            if (overlap > OVERLAP_TRIGGER_FRAC * s) w.triggered = true;
          }
          springStep(w, dt);
        }
      }

      // seed new cells along the left edge while under the fill cap
      if (filledCount / slotTotal < FILL_CAP) {
        spawnAcc += dt * SEED_RATE;
        while (spawnAcc >= 1 && filledCount / slotTotal < FILL_CAP) {
          spawnAcc -= 1;
          // leftmost column with an empty slot, topmost row first
          let spawned = false;
          for (let c = 0; c < cols && !spawned; c++) {
            for (let r = 0; r < rows; r++) {
              if (!cellAt(c, r)) {
                spawnCell(c, r);
                spawned = true;
                break;
              }
            }
          }
          if (!spawned) break;
        }
        linkWalls();
      }

      // recap flash: once the grid is essentially full, periodically re-flash
      // one existing cell's wall stroke — this is what keeps the piece alive
      // at rest indefinitely once growth finishes.
      if (filledCount / slotTotal >= FILL_CAP * 0.999 && simTime >= nextRecapAt) {
        const alive = cells.filter((c): c is Cell => !!c);
        if (alive.length > 0) {
          const pick = alive[Math.floor(Math.random() * alive.length)];
          pick.recapStart = simTime;
        }
        nextRecapAt = simTime + RECAP_MIN + Math.random() * (RECAP_MAX - RECAP_MIN);
      }
    };

    // Precomputes the fully-grown, fully-relaxed lattice deterministically —
    // used both for the reduced-motion/paused SETTLED_COMB frame and to seed
    // a resize so the surface never shows a blank field while catching up.
    const settle = () => {
      layout();
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) spawnCell(c, r);
      }
      linkWalls();
      for (const cell of cells) {
        if (!cell) continue;
        cell.spawnAt = simTime - GROWTH_SECONDS * 2;
        for (const w of cell.walls) {
          if (!w.neighbor) continue;
          w.triggered = true;
          w.progress = 1;
          w.velocity = 0;
        }
      }
    };

    const strokeColorFor = (cell: Cell, t: number): [number, number, number] => {
      if (cell.recapStart == null) return border;
      const elapsed = t - cell.recapStart;
      if (elapsed < 0) return border;
      if (elapsed < RECAP_FLASH) return fg;
      if (elapsed < RECAP_FLASH + RECAP_FADE) {
        return lerpRGB(fg, border, (elapsed - RECAP_FLASH) / RECAP_FADE);
      }
      cell.recapStart = null;
      return border;
    };

    const drawCell = (cell: Cell, t: number) => {
      const r0 = radiusOf(cell, t);
      if (r0 <= 0.5) return;
      // 6 control distances, one per lattice direction, blended between the
      // circular radius and that specific wall's target distance by ITS OWN
      // spring progress — the source of the wall-by-wall (not all-at-once)
      // relaxation read.
      const dirs: number[] = [];
      const dists: number[] = [];
      for (const w of cell.walls) {
        const target = w.neighbor ? w.wallDist : r0;
        const d = w.neighbor ? r0 + (target - r0) * w.progress : r0;
        dirs.push(w.angle);
        dists.push(Math.min(d, r0 * 1.05));
      }
      if (dirs.length === 0) {
        ctx.beginPath();
        ctx.arc(cell.x, cell.y, r0, 0, Math.PI * 2);
      } else {
        // sort control points by angle so the angular interpolation below
        // walks the boundary in order
        const order = dirs.map((_, i) => i).sort((a, b) => dirs[a] - dirs[b]);
        const sortedAngles = order.map((i) => dirs[i]);
        const sortedDists = order.map((i) => dists[i]);
        const n = sortedAngles.length;
        ctx.beginPath();
        for (let i = 0; i < SAMPLES; i++) {
          const theta = (i / SAMPLES) * Math.PI * 2 - Math.PI;
          // find bracketing control points (wrap-around)
          let k = 0;
          while (k < n && sortedAngles[k] < theta) k++;
          const k1 = ((k % n) + n) % n;
          const k0 = ((k1 - 1) % n + n) % n;
          let a0 = sortedAngles[k0];
          let a1 = sortedAngles[k1];
          if (a1 <= a0) a1 += Math.PI * 2;
          let th = theta;
          if (th < a0) th += Math.PI * 2;
          const f = a1 > a0 ? (th - a0) / (a1 - a0) : 0;
          const rad = sortedDists[k0] + (sortedDists[k1] - sortedDists[k0]) * f;
          const px = cell.x + Math.cos(theta) * rad;
          const py = cell.y + Math.sin(theta) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      }
      ctx.fillStyle = rgbaCss(muted, 0.1);
      ctx.fill();
      const [cr, cg, cb] = strokeColorFor(cell, t);
      ctx.strokeStyle = rgbaCss([cr, cg, cb], cell.recapStart != null ? 0.9 : 0.55);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const draw = () => {
      if (cssW <= 0 || cssH <= 0) return;
      ctx.clearRect(0, 0, cssW, cssH);
      for (const cell of cells) {
        if (cell) drawCell(cell, simTime);
      }
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      applyBacking();
      if (staticMode) {
        settle();
      } else {
        layout();
      }
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        settle();
        draw();
      } else {
        staticMode = false;
        layout();
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    resize();
    applyMode();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(poll);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      data-honeycomb-draw={uid}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
    </div>
  );
}

HoneycombDraw.displayName = "HoneycombDraw";
