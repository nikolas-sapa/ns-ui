"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// StrikeFigure — a full-bleed ASCII hero running the Dielectric Breakdown
// Model (Niemeyer-Pietronero-Wiesmann) directly on the glyph grid. The
// discharge channel is a perfect conductor held at phi = 0; the left and
// right plates are held at phi = 1; top and bottom are insulating (Neumann,
// mirrored rows), which is what makes the figure spread ACROSS the frame
// instead of sprinting for whichever edge happens to be nearest. Each frame
// runs 12 Gauss-Seidel sweeps of the 5-point Laplace stencil over the
// aggregate's bounding box (the far field is flat at 1, so relaxing outside
// it buys nothing), then grows the tree one site at a time by drawing a
// candidate — an unoccupied 4-neighbour of the aggregate — with probability
// proportional to phi_i^eta. Growth is held PLATE_CLEARANCE columns clear of
// the two plates; see that constant for why.
//
// eta is the whole character of the piece. At eta = 1 this is a fat DLA blob;
// at eta = 3 the tip with the steepest local field wins almost every draw, so
// the aggregate collapses into a few long, sharply forked channels covering
// ~3% of the grid and leaving the rest of the frame black. That sparsity is
// structural, not a threshold applied afterwards.
//
// Glyphs are chosen by BRANCH GEOMETRY rather than luminance: the two-link
// chord from a cell's grandparent gives '-', '|', '/' or '\', and any cell
// that acquires a second child becomes '+', the fork. The tree therefore
// reads as drawn line-work. Brightness is pow(1 - depth/maxDepth, 0.7), so
// the trunk near the seed is hot and the fine tips are faint, which is what a
// discharge photograph actually looks like.
//
// The pointer is an electrode. Cells within 6 of it are pinned above plate
// potential on a gaussian profile, eased in over tau 0.45s; because the
// growth weight goes as phi^3, the Laplace solution steepens toward it and
// new branches visibly fork and race for the cursor. On leave the pin eases
// back out and later branching returns to its undisturbed statistics.
// Already-grown channel stays exactly where it is: a discharge does not
// un-happen.
//
// The optional `quiet` rect is a patch of dielectric held at lower field
// strength: its scale multiplies the growth weight, so fewer channels grow
// there and the figure thins out to nothing across the falloff band. Overlaid
// copy therefore reads against bare background without a scrim over the field.
// ---------------------------------------------------------------------------

/** '-' horizontal link, '|' vertical, '/' and '\' the two diagonals, '+' a fork */
const GLYPHS = ["-", "|", "/", "\\", "+"] as const;

const BUCKETS = 6; // alpha buckets — one ctx.globalAlpha write each, never per cell
const SWEEPS = 12; // Gauss-Seidel sweeps per animated frame
const PRIME_SWEEPS = 2; // sweeps per site when a figure is built in one go
const PRIME_WARMUP = 40; // sweeps before the first site of a primed figure

const GROW_MS = 2200; // a figure completes in ~2.2s
const PERIOD_MS = 3600; // a new strike is seeded every 3.6s
const FADE_DELAY_MS = 4900; // ...and starts fading only once its successor is well under way
const FADE_MS = 1600; // ~0.6 alpha/s

const SITES_PER_COL = 3.2; // budget tied to width, because the figure must span it
const MIN_SITES = 160;
const MAX_SITES = 1000;

const RELAX_MARGIN = 14; // cells of slack around the aggregate bbox
// Columns 0 and cols-1 are the plates: the relaxation never writes them, so
// they hold phi = 1 forever. A cell at x = 1 therefore always has a
// full-strength source as a neighbour, and once the channel touched the plate
// it ran straight down it — a dead-straight 1-cell rule glued to the frame
// edge that took ~11% of the figure's sites (measured, both plates). Growth is
// kept this many columns clear of the plates, which drops that to ~4% and
// leaves the branch that gets there reading as a trunk rather than a border.
// x only: the top and bottom rows ARE written, by the Neumann mirror, so they
// are not sources and a y clearance would cost vertical span for nothing.
const PLATE_CLEARANCE = 10; // columns
const ELECTRODE_R = 6; // cells
const ELECTRODE_SIGMA2 = 18;
const ELECTRODE_GAIN = 0.9;
const ELECTRODE_TAU = 0.45; // s
const DT_MAX = 0.05;

/** deterministic PRNG — a session replays identically, unlike Math.random */
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

interface Strike {
  occupied: Uint8Array;
  parent: Int32Array;
  candParent: Int32Array;
  depth: Uint16Array;
  kids: Uint8Array;
  glyph: Uint8Array;
  order: Int32Array;
  isCand: Uint8Array;
  cands: number[];
  count: number;
  maxDepth: number;
  born: number; // seconds, on the loop clock
  done: boolean;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface StrikeFigureProps {
  /** grid cell size in px */
  cellSize?: number;
  /** DBM growth exponent — 1 is a fat blob, 3 the sparse forked lightning figure */
  eta?: number;
  /**
   * Rect of lowered field strength in normalized frame coords (0..1 from the
   * top-left) — pass the rect the overlaid copy occupies. Growth weight is
   * scaled to zero inside it and ramps back to full just outside, so the
   * discharge grows fewer channels there instead of being masked afterwards.
   */
  quiet?: { x: number; y: number; w: number; h: number };
  /** copy overlaid on the discharge; also informs the `quiet` rect's contents */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function StrikeFigure({
  cellSize = 12,
  eta = 3.0,
  quiet,
  children,
  className = "",
}: StrikeFigureProps) {
  // primitives, not the object: an inline literal from the parent would
  // otherwise be a fresh identity every render and rebuild the whole figure
  const qx = quiet ? quiet.x : 0;
  const qy = quiet ? quiet.y : 0;
  const qw = quiet ? quiet.w : 0;
  const qh = quiet ? quiet.h : 0;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let accent = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let target = 0;
    let keep = 1; // resolved plate clearance, clamped to the grid in rebuild()
    let sized = false;
    let disposed = false;

    let phi = new Float32Array(0);
    // per-cell field scale: 1 everywhere by default, 0 inside the quiet rect,
    // smoothstepped back up across the falloff band so there is no contour
    let quietMask: Float32Array | null = null;
    let pool: Strike[] = [];
    let live: Strike[] = [];
    let poolCursor = 0;
    let rng = mulberry32(0x1ec47);
    let seedFlip = 0;
    let nextBirth = 0;

    const bucketLists: number[][] = Array.from({ length: BUCKETS }, () => []);

    // -- tokens ---------------------------------------------------------------
    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--ns-accent")
        .trim();
      accent = raw || fg;
    };

    // -- geometry -------------------------------------------------------------
    const makeStrike = (): Strike => {
      const n = cols * rows;
      return {
        occupied: new Uint8Array(n),
        parent: new Int32Array(n),
        candParent: new Int32Array(n),
        depth: new Uint16Array(n),
        kids: new Uint8Array(n),
        glyph: new Uint8Array(n),
        order: new Int32Array(target),
        isCand: new Uint8Array(n),
        cands: [],
        count: 0,
        maxDepth: 1,
        born: 0,
        done: false,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
      };
    };

    // -- field ----------------------------------------------------------------
    // Dirichlet phi = 1 on the left and right plates (columns 0 and cols-1),
    // Neumann on top and bottom, phi = 0 inside the channel.
    const resetField = () => {
      phi.fill(1);
    };

    /**
     * A region of the dielectric held at lower field strength grows fewer
     * channels — that is all this is. The scale multiplies the growth weight,
     * so the tree thins out and stops at the edge of the rect on its own
     * rather than being covered up after the fact.
     */
    const buildQuietMask = () => {
      if (qw <= 0 || qh <= 0) {
        quietMask = null;
        return;
      }
      const x0 = qx * cols;
      const x1 = (qx + qw) * cols;
      const y0 = qy * rows;
      const y1 = (qy + qh) * rows;
      // the falloff band, 5% of the frame width and never under 2 cells: a
      // hard edge would read as the panel this whole approach exists to avoid
      const band = Math.max(2, 0.05 * cols);
      const m = new Float32Array(cols * rows);
      for (let y = 0; y < rows; y++) {
        const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
        for (let x = 0; x < cols; x++) {
          const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
          const d = Math.sqrt(dx * dx + dy * dy) / band;
          const f = d < 1 ? d : 1;
          m[y * cols + x] = f * f * (3 - 2 * f); // smoothstep
        }
      }
      quietMask = m;
    };

    const electrode = { gx: -1e5, gy: -1e5, has: false, strength: 0 };

    const pinElectrode = () => {
      if (electrode.strength <= 0.01) return;
      const ex = electrode.gx;
      const ey = electrode.gy;
      const s = live[live.length - 1];
      if (!s) return;
      const x0 = Math.max(1, Math.floor(ex - ELECTRODE_R));
      const x1 = Math.min(cols - 2, Math.ceil(ex + ELECTRODE_R));
      const y0 = Math.max(1, Math.floor(ey - ELECTRODE_R));
      const y1 = Math.min(rows - 2, Math.ceil(ey + ELECTRODE_R));
      const r2 = ELECTRODE_R * ELECTRODE_R;
      for (let y = y0; y <= y1; y++) {
        const row = y * cols;
        for (let x = x0; x <= x1; x++) {
          const dx = x - ex;
          const dy = y - ey;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const i = row + x;
          if (s.occupied[i]) continue;
          phi[i] =
            1 +
            ELECTRODE_GAIN * Math.exp(-d2 / ELECTRODE_SIGMA2) * electrode.strength;
        }
      }
    };

    const relax = (sweeps: number, s: Strike) => {
      let x0 = Math.max(1, s.minX - RELAX_MARGIN);
      let x1 = Math.min(cols - 2, s.maxX + RELAX_MARGIN);
      let y0 = Math.max(1, s.minY - RELAX_MARGIN);
      let y1 = Math.min(rows - 2, s.maxY + RELAX_MARGIN);
      if (electrode.strength > 0.01) {
        x0 = Math.max(1, Math.min(x0, Math.floor(electrode.gx - ELECTRODE_R - 2)));
        x1 = Math.min(cols - 2, Math.max(x1, Math.ceil(electrode.gx + ELECTRODE_R + 2)));
        y0 = Math.max(1, Math.min(y0, Math.floor(electrode.gy - ELECTRODE_R - 2)));
        y1 = Math.min(rows - 2, Math.max(y1, Math.ceil(electrode.gy + ELECTRODE_R + 2)));
      }
      if (x1 < x0 || y1 < y0) return;
      const occ = s.occupied;
      for (let k = 0; k < sweeps; k++) {
        for (let y = y0; y <= y1; y++) {
          const row = y * cols;
          for (let x = x0; x <= x1; x++) {
            const i = row + x;
            if (occ[i]) {
              phi[i] = 0;
              continue;
            }
            phi[i] =
              0.25 * (phi[i - 1] + phi[i + 1] + phi[i - cols] + phi[i + cols]);
          }
        }
        // insulating top/bottom: the ghost row mirrors its neighbour
        if (y0 <= 1) {
          for (let x = x0; x <= x1; x++) phi[x] = phi[cols + x];
        }
        if (y1 >= rows - 2) {
          const a = (rows - 1) * cols;
          const b = (rows - 2) * cols;
          for (let x = x0; x <= x1; x++) phi[a + x] = phi[b + x];
        }
        pinElectrode();
      }
    };

    // -- growth ---------------------------------------------------------------
    const addCandidate = (s: Strike, i: number, from: number) => {
      if (s.occupied[i] || s.isCand[i]) return;
      s.isCand[i] = 1;
      s.candParent[i] = from;
      s.cands.push(i);
    };

    const occupy = (s: Strike, i: number, from: number) => {
      s.occupied[i] = 1;
      phi[i] = 0;
      s.parent[i] = from;
      const x = i % cols;
      const y = (i - x) / cols;
      if (s.count === 0) {
        s.minX = s.maxX = x;
        s.minY = s.maxY = y;
      } else {
        if (x < s.minX) s.minX = x;
        if (x > s.maxX) s.maxX = x;
        if (y < s.minY) s.minY = y;
        if (y > s.maxY) s.maxY = y;
      }

      if (from < 0) {
        s.depth[i] = 0;
        s.glyph[i] = 4;
      } else {
        const d = s.depth[from]! + 1;
        s.depth[i] = d;
        if (d > s.maxDepth) s.maxDepth = d;
        s.kids[from] = (s.kids[from]! + 1) as number;
        if (s.kids[from]! >= 2) s.glyph[from] = 4; // this cell forked

        // glyph from the two-link chord (grandparent -> here), so a staircase
        // run reads as a diagonal rather than a stack of alternating dashes
        const gp = s.parent[from]! >= 0 ? s.parent[from]! : from;
        const gx = gp % cols;
        const gy = (gp - gx) / cols;
        const dx = x - gx;
        const dy = y - gy;
        const adx = dx < 0 ? -dx : dx;
        const ady = dy < 0 ? -dy : dy;
        let g: number;
        if (adx > 0 && ady > 0) g = dx * dy > 0 ? 3 : 2;
        else if (adx >= ady) g = 0;
        else g = 1;
        s.glyph[i] = g;
      }

      s.order[s.count] = i;
      s.count++;

      if (y > 1) addCandidate(s, i - cols, i);
      if (y < rows - 2) addCandidate(s, i + cols, i);
      if (x > keep) addCandidate(s, i - 1, i);
      if (x < cols - 1 - keep) addCandidate(s, i + 1, i);
    };

    /** one DBM growth event: draw a candidate with p ∝ phi^eta */
    const growOne = (s: Strike): boolean => {
      const cands = s.cands;
      const n = cands.length;
      if (n === 0 || s.count >= target) return false;
      const q = quietMask;
      let total = 0;
      for (let k = 0; k < n; k++) {
        const c = cands[k]!;
        const p = phi[c]!;
        if (p > 0) total += Math.pow(p, eta) * (q ? q[c]! : 1);
      }
      let li: number;
      if (total > 1e-12) {
        const r = rng() * total;
        let acc = 0;
        li = n - 1;
        for (let k = 0; k < n; k++) {
          const c = cands[k]!;
          const p = phi[c]!;
          if (p > 0) acc += Math.pow(p, eta) * (q ? q[c]! : 1);
          if (acc >= r) {
            li = k;
            break;
          }
        }
      } else {
        li = Math.min(n - 1, Math.floor(rng() * n));
      }
      const pick = cands[li]!;
      cands[li] = cands[n - 1]!;
      cands.pop();
      s.isCand[pick] = 0;
      occupy(s, pick, s.candParent[pick]!);
      return true;
    };

    const seedStrike = (s: Strike, t: number) => {
      s.occupied.fill(0);
      s.isCand.fill(0);
      s.kids.fill(0);
      s.cands.length = 0;
      s.count = 0;
      s.maxDepth = 1;
      s.done = false;
      s.born = t;
      resetField();

      // two anchors, alternating, with a jittered offset — successive strikes
      // land on opposite thirds of the frame
      const upperLeft = seedFlip % 2 === 0;
      seedFlip++;
      const fx = upperLeft ? 0.3 : 0.7;
      const fy = upperLeft ? 0.34 : 0.66;
      const jx = (rng() - 0.5) * 0.1 * cols;
      const jy = (rng() - 0.5) * 0.16 * rows;
      const sx = Math.min(
        cols - 2 - keep,
        Math.max(keep + 1, Math.round(fx * cols + jx))
      );
      const sy = Math.min(rows - 3, Math.max(2, Math.round(fy * rows + jy)));
      occupy(s, sy * cols + sx, -1);
    };

    /** build one complete figure in a single blocking pass */
    const primeStrike = (s: Strike, t: number) => {
      seedStrike(s, t);
      relax(PRIME_WARMUP, s);
      while (s.count < target) {
        relax(PRIME_SWEEPS, s);
        if (!growOne(s)) break;
      }
      s.done = true;
    };

    // -- render ---------------------------------------------------------------
    const strikeAlpha = (s: Strike, t: number) => {
      const ageMs = (t - s.born) * 1000;
      if (ageMs <= FADE_DELAY_MS) return 1;
      return Math.max(0, 1 - (ageMs - FADE_DELAY_MS) / FADE_MS);
    };

    const draw = (t: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW, rows * cellH);
      for (let b = 0; b < BUCKETS; b++) bucketLists[b]!.length = 0;

      for (let si = 0; si < live.length; si++) {
        const s = live[si]!;
        const a = strikeAlpha(s, t);
        if (a <= 0.01) continue;
        const md = Math.max(4, s.maxDepth);
        for (let k = 0; k < s.count; k++) {
          const idx = s.order[k]!;
          const rel = 1 - s.depth[idx]! / md;
          const lum = Math.pow(rel > 0.08 ? rel : 0.08, 0.7) * a;
          let b = Math.floor(lum * BUCKETS);
          if (b < 0) b = 0;
          else if (b > BUCKETS - 1) b = BUCKETS - 1;
          bucketLists[b]!.push(idx * 5 + s.glyph[idx]!);
        }
      }

      for (let b = 0; b < BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = 0.1 + (b / (BUCKETS - 1)) * 0.9;
        // the hot core of the channel carries the one accent; everything else
        // is monochrome ink
        ctx.fillStyle = b === BUCKETS - 1 ? accent : fg;
        for (let k = 0; k < list.length; k++) {
          const v = list[k]!;
          const g = v % 5;
          const idx = (v - g) / 5;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            GLYPHS[g]!,
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- sizing ---------------------------------------------------------------
    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const rebuild = (t: number) => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.max(12, Math.ceil(width / cellW));
      rows = Math.max(12, Math.ceil(height / cellH));
      // a narrow grid must still leave room to grow between the two clearances
      keep = Math.max(1, Math.min(PLATE_CLEARANCE, Math.floor(cols / 6)));
      target = Math.max(
        MIN_SITES,
        Math.min(MAX_SITES, Math.round(cols * SITES_PER_COL))
      );
      phi = new Float32Array(cols * rows);
      buildQuietMask();
      rng = mulberry32(0x1ec47);
      seedFlip = 0;
      pool = [makeStrike(), makeStrike()];
      poolCursor = 0;
      live = [];
      sized = true;

      // the frame is never allowed to open empty: the first figure is built
      // complete, then back-dated so it is already in its hold phase
      const first = pool[0]!;
      poolCursor = 1;
      primeStrike(first, t - GROW_MS / 1000);
      live = [first];
      nextBirth = first.born + PERIOD_MS / 1000;
      draw(t);
    };

    // -- loop -----------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let clock = 0;

    const step = (dt: number) => {
      clock += dt;
      const t = clock;

      const want = electrode.has ? 1 : 0;
      electrode.strength +=
        (want - electrode.strength) * Math.min(1, dt / ELECTRODE_TAU);

      // retire dead strikes before spawning, so the pool of two always has a
      // free slot
      for (let i = live.length - 1; i >= 0; i--) {
        if ((t - live[i]!.born) * 1000 > FADE_DELAY_MS + FADE_MS) live.splice(i, 1);
      }

      if (t >= nextBirth) {
        const s = pool[poolCursor % 2]!;
        poolCursor++;
        const at = live.indexOf(s);
        if (at >= 0) live.splice(at, 1);
        seedStrike(s, t);
        live.push(s);
        nextBirth = t + PERIOD_MS / 1000;
      }

      const g = live[live.length - 1];
      if (g) {
        if (!g.done) {
          relax(SWEEPS, g);
          const wantN = Math.min(
            target,
            Math.round((target * ((t - g.born) * 1000)) / GROW_MS)
          );
          let n = wantN - g.count;
          while (n-- > 0 && growOne(g)) {
            /* one site per tick */
          }
          if (g.count >= target || g.cands.length === 0) g.done = true;
        } else if (electrode.strength > 0.01) {
          // keep the field warm so the electrode is already in the solution
          // when the next strike seeds
          relax(2, g);
        }
      }

      draw(t);
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    // -- listeners ------------------------------------------------------------
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        rebuild(clock);
      }, 150);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      electrode.gx = (e.clientX - rect.left) / cellW;
      electrode.gy = (e.clientY - rect.top) / cellH;
      electrode.has = true;
    };
    const onPointerLeave = () => {
      electrode.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(clock);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      rebuild(0);
      if (!reduced) raf = requestAnimationFrame(loop);
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, eta, qx, qy, qw, qh]);

  // `h-full` matters as much as the min-height: a min-height is only a floor,
  // so a stretched grid/flex parent taller than it would leave a band of dead
  // background under the field.
  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full text-foreground"
      />
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
