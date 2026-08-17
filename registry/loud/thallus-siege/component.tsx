"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ThallusSiege — a pane of crustose lichen fighting a slow, never-finished war
// for the same patch of rock.
//
// TERRITORY IS GROWN, NOT PARTITIONED. A dozen concurrent "thalli" nucleate at
// staggered moments on bare substrate. Each grows a front of ~180 radial
// spokes; every spoke advances at its own thallus's rate, scaled by a slow
// angular/temporal noise term so the margin comes out lobed rather than a
// clean circle. A spoke stamps the cell it enters into a shared occupancy
// lattice (owner id + claim time). Stepping into a cell another thallus
// already owns kills the spoke's advance there UNLESS this thallus's rate
// exceeds the rival's by more than 1.3x, in which case it keeps creeping in
// at (ratio - 1.3) * base — slow, but real reconquest, not a redraw. Nothing
// here ever asks "which seed is nearest" — the tells that would give away a
// Voronoi/distance-field impostor (boundaries bowing toward the slow side,
// a late seed walled into a concave cell, a centre that never reopens) are
// exactly the behaviours this front-growth mechanism produces for free.
//
// THE GOVERNING SCALAR is growth-rate variance across thalli (the `variance`
// prop). At variance = 0 every thallus grows at the same pace, the 1.3x
// dead-band is never crossed, no front ever reconquers another, and the
// mosaic settles into flat, static, roughly-equidistant cells — a fair
// near-Voronoi partition in every way but how it was computed. That is the
// exact failure this piece exists to avoid, which is why variance defaults
// to a real spread rather than a token one.
//
// SENESCENCE falls out of the same lattice for free: a cell's claim time is
// stamped once and not refreshed, so the cells nearest a thallus's own
// nucleation point are always its oldest. Aging a cell out past its thallus's
// senescence limit therefore clears centre-first, outward, automatically —
// no separate "shrink from the middle" pass is needed. A cleared cell is
// bare substrate again; the neighbour whose front already stalled against it
// resumes growing into it on the very next step. When a thallus's last cell
// clears, its slot goes quiet for a staggered cooldown and then nucleates
// again elsewhere, so the war never actually finishes — it only ever pauses
// between shifts, which is the whole point of a 20-simulated-minute prewarm:
// the frame you land on already has one or two turnovers baked into it.
//
// A contested cell that reverts to substrate — either by senescence or by
// being overrun — leaves a mark in a separate, slowly-decaying "seam" field.
// Rendered as a hairline lattice of --border, it is the pane's memory of
// where a border used to run even after both sides that drew it are gone.
//
// RENDER is plain 2D canvas, no WebGL. The occupancy lattice is coarse
// (quarter the density of anything a viewer could resolve as a grid); its
// blocky per-cell ownership is smoothed into an organic contour with a real
// marching-squares pass over the lattice (binary field per species, a single
// segment per 2-crossing square, the diagonal pair for the 4-crossing saddle
// case) rather than any blur or upscale trick. Fill is per-species ordered
// dithering between --background and --ns-muted — 12 fixed densities, one
// per lattice slot, so a slot keeps a recognisable "species" texture across
// however many generations nucleate into it. Every colour is read from
// getComputedStyle at mount and on a documentElement class mutation; nothing
// is a literal. --ns-accent never appears — this is idle rock, nothing here
// is being interacted with.
// ---------------------------------------------------------------------------

export interface ThallusSiegeProps {
  /** Concurrent lichen thalli contesting the pane. @default 12 */
  count?: number;
  /**
   * Spread of growth rate sampled per thallus — the mechanism's governing
   * scalar. 0 flattens every front to the same pace, the 1.3x reconquest
   * band is never crossed, and the mosaic settles into fair, static,
   * near-Voronoi cells: the exact failure this piece is built to avoid.
   * @default 1
   */
  variance?: number;
  /** Simulation-time multiplier. @default 1 */
  speed?: number;
  /** Freezes the pane on its current developed frame without unmounting. */
  paused?: boolean;
  /** Rendered over the pane — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const TAU = Math.PI * 2;

// Lattice + spoke geometry.
const CELL = 6; // css px per occupancy cell — coarse on purpose
const SPOKES = 180;

// Growth mechanics.
const BASE_RATE = 0.85; // px/s at variance's centre — deliberately glacial
const CONTACT_RATIO = 1.3; // dead-band: a spoke stalls below this rate ratio
const NOISE_AMOUNT = 0.3; // fraction of rate the margin noise can add/remove

// Lifecycle timing, all in SIMULATED seconds.
const T_SEN_BASE = 780; // ~13 sim-minutes before a thallus's oldest cells fade
const T_SEN_SPREAD = 0.4; // +/- fraction of variety across individuals
const SEAM_TAU = 220; // ghost-seam decay time constant
const STAGGER_WINDOW = 300; // initial dozen nucleate across this span
const COOLDOWN_MIN = 40; // shortest gap before a retired slot tries again
const COOLDOWN_SPREAD = 140;
const NUCLEATION_CLEARANCE = CELL * 2.5;

// The pane arrives already having fought over itself for a while.
const PREWARM_SECONDS = 1200; // 20 simulated minutes
const PREWARM_DT = 2; // sim seconds per prewarm step -> 600 steps

const DRAW_INTERVAL_MS = 380; // growth is glacial; redraw far under 60fps

// 8x8 ordered (Bayer) dither matrix, values 0..63.
const BAYER8: number[][] = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

type Thallus = {
  id: number;
  slot: number;
  cx: number;
  cy: number;
  rate: number;
  seed: number;
  senLimit: number;
  spokeR: Float32Array;
  bboxMinC: number;
  bboxMaxC: number;
  bboxMinR: number;
  bboxMaxR: number;
  cellCount: number;
};

/** Slow, lobed angular perturbation. Not true curl noise — a stand-in built
 * from a few incommensurate sine terms in theta with a slow phase drift in
 * t, tuned so the margin scallops rather than either vanishing flat or
 * spiking into fingers. */
function marginNoise(theta: number, simTime: number, seed: number): number {
  const a = Math.sin(theta * 3 + seed * 7.1 + simTime * 0.013);
  const b = Math.sin(theta * 5 - seed * 3.3 + simTime * 0.021) * 0.6;
  const c = Math.sin(theta * 8 + seed * 11.7 - simTime * 0.009) * 0.35;
  return (a + b + c) / 1.95;
}

export function ThallusSiege({
  count = 12,
  variance = 1,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: ThallusSiegeProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nSlots = Math.max(4, Math.min(24, Math.round(count)));
    const varAmt = Math.max(0, variance);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let sized = false;
    let staticMode = false;

    // -- occupancy lattice -----------------------------------------------
    let owner: Uint16Array = new Uint16Array(0);
    let claimedAt: Float32Array = new Float32Array(0);
    let seam: Float32Array = new Float32Array(0);
    const seamCells = new Set<number>();

    let simTime = 0;
    let idSeq = 1;
    let rngState = 0x9e3779b9 >>> 0;
    const rng = () => {
      rngState ^= rngState << 13;
      rngState >>>= 0;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      rngState >>>= 0;
      return rngState / 4294967296;
    };

    const slots: (Thallus | null)[] = new Array(nSlots).fill(null);
    const slotCooldown = new Float32Array(nSlots);
    const activeById = new Map<number, Thallus>();

    // -- colors -------------------------------------------------------------
    let bgColor = "#ffffff";
    let mutedColor = "#4d4d4d";
    let borderColor = "#ebebeb";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bgColor = (cs.getPropertyValue("--background") || "#ffffff").trim() || "#ffffff";
      mutedColor = (cs.getPropertyValue("--ns-muted") || "#4d4d4d").trim() || "#4d4d4d";
      borderColor = (cs.getPropertyValue("--border") || "#ebebeb").trim() || "#ebebeb";
    };
    readColors();

    // Per-slot dithered fill, rebuilt on resize (dpr change) and theme change.
    let patterns: CanvasPattern[] = [];
    const buildPatterns = () => {
      const tileCss = 8;
      const size = Math.max(1, Math.round(tileCss * dpr));
      const next: CanvasPattern[] = [];
      for (let s = 0; s < nSlots; s++) {
        const density = nSlots > 1 ? 0.14 + (s / (nSlots - 1)) * 0.46 : 0.3;
        const off = document.createElement("canvas");
        off.width = size;
        off.height = size;
        const octx = off.getContext("2d");
        if (!octx) continue;
        for (let py = 0; py < size; py++) {
          const by = Math.min(7, Math.floor((py / size) * 8));
          for (let px = 0; px < size; px++) {
            const bx = Math.min(7, Math.floor((px / size) * 8));
            const thr = (BAYER8[by]![bx]! + 0.5) / 64;
            octx.fillStyle = thr < density ? mutedColor : bgColor;
            octx.fillRect(px, py, 1, 1);
          }
        }
        const pat = ctx.createPattern(off, "repeat");
        if (!pat) continue;
        pat.setTransform(new DOMMatrix([1 / dpr, 0, 0, 1 / dpr, 0, 0]));
        next[s] = pat;
      }
      patterns = next;
    };

    // -- lattice helpers ------------------------------------------------
    const cellIndexAt = (x: number, y: number): number => {
      const gx = Math.floor(x / CELL);
      const gy = Math.floor(y / CELL);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
      return gy * cols + gx;
    };

    const clearAround = (x: number, y: number, r: number): boolean => {
      const gx = Math.floor(x / CELL);
      const gy = Math.floor(y / CELL);
      const rc = Math.ceil(r / CELL);
      for (let j = -rc; j <= rc; j++) {
        const gy2 = gy + j;
        if (gy2 < 0 || gy2 >= rows) continue;
        const row = gy2 * cols;
        for (let i = -rc; i <= rc; i++) {
          const gx2 = gx + i;
          if (gx2 < 0 || gx2 >= cols) continue;
          if (owner[row + gx2] !== 0) return false;
        }
      }
      return true;
    };

    const markSeam = (ci: number) => {
      seam[ci] = 1;
      seamCells.add(ci);
    };

    const retireThallus = (t: Thallus) => {
      activeById.delete(t.id);
      slots[t.slot] = null;
      slotCooldown[t.slot] = simTime + COOLDOWN_MIN + rng() * COOLDOWN_SPREAD;
    };

    const releaseCell = (ci: number) => {
      const prevId = owner[ci];
      if (prevId === 0) return;
      const t = activeById.get(prevId);
      if (t) {
        t.cellCount--;
        if (t.cellCount <= 0) retireThallus(t);
      }
      owner[ci] = 0;
    };

    const updateBBox = (t: Thallus, ci: number) => {
      const gx = ci % cols;
      const gy = (ci / cols) | 0;
      if (gx < t.bboxMinC) t.bboxMinC = gx;
      if (gx > t.bboxMaxC) t.bboxMaxC = gx;
      if (gy < t.bboxMinR) t.bboxMinR = gy;
      if (gy > t.bboxMaxR) t.bboxMaxR = gy;
    };

    const claimCell = (ci: number, t: Thallus, now: number) => {
      const prevId = owner[ci];
      if (prevId === t.id) return;
      if (prevId !== 0) {
        const rival = activeById.get(prevId);
        if (rival) {
          rival.cellCount--;
          if (rival.cellCount <= 0) retireThallus(rival);
        }
        markSeam(ci);
      }
      owner[ci] = t.id;
      claimedAt[ci] = now;
      t.cellCount++;
      updateBBox(t, ci);
    };

    // -- nucleation -------------------------------------------------------
    const nucleate = (slot: number, now: number) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const x = rng() * cssW;
        const y = rng() * cssH;
        if (clearAround(x, y, NUCLEATION_CLEARANCE)) {
          const id = idSeq++;
          const rate = BASE_RATE * Math.pow(2, (rng() * 2 - 1) * varAmt);
          const t: Thallus = {
            id,
            slot,
            cx: x,
            cy: y,
            rate,
            seed: rng() * 1000,
            senLimit: T_SEN_BASE * (1 - T_SEN_SPREAD / 2 + rng() * T_SEN_SPREAD),
            spokeR: new Float32Array(SPOKES),
            bboxMinC: Infinity,
            bboxMaxC: -Infinity,
            bboxMinR: Infinity,
            bboxMaxR: -Infinity,
            cellCount: 0,
          };
          slots[slot] = t;
          activeById.set(id, t);
          return;
        }
      }
      slotCooldown[slot] = now + 5; // no room yet; try again soon
    };

    const growThallus = (t: Thallus, dt: number) => {
      for (let k = 0; k < SPOKES; k++) {
        const theta = (k * TAU) / SPOKES;
        const n = marginNoise(theta, simTime, t.seed);
        const vel = t.rate * Math.max(0.15, 1 + NOISE_AMOUNT * n);
        const candR = t.spokeR[k]! + vel * dt;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const ci = cellIndexAt(t.cx + cos * candR, t.cy + sin * candR);
        if (ci < 0) continue; // spoke stalls at the pane's edge
        const own = owner[ci];
        if (own === 0 || own === t.id) {
          claimCell(ci, t, simTime);
          t.spokeR[k] = candR;
          continue;
        }
        const rival = activeById.get(own);
        if (!rival) {
          claimCell(ci, t, simTime);
          t.spokeR[k] = candR;
          continue;
        }
        const ratio = t.rate / rival.rate;
        if (ratio > CONTACT_RATIO) {
          const advVel = (ratio - CONTACT_RATIO) * BASE_RATE;
          const advR = t.spokeR[k]! + advVel * dt;
          const ci2 = cellIndexAt(t.cx + cos * advR, t.cy + sin * advR);
          if (ci2 >= 0) claimCell(ci2, t, simTime);
          t.spokeR[k] = advR;
        }
        // else: rate ratio inside the dead band — this spoke stalls here.
      }
    };

    const neighborDiffers = (gx: number, gy: number, ownBefore: number): boolean => {
      const dirs: Array<[number, number]> = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dy] of dirs) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const no = owner[ny * cols + nx];
        if (no !== 0 && no !== ownBefore) return true;
      }
      return false;
    };

    const senescenceSweep = () => {
      const living = Array.from(activeById.values());
      for (const t of living) {
        if (!activeById.has(t.id)) continue; // retired earlier this sweep
        const c0 = Math.max(0, Math.floor(t.bboxMinC));
        const c1 = Math.min(cols - 1, Math.floor(t.bboxMaxC));
        const r0 = Math.max(0, Math.floor(t.bboxMinR));
        const r1 = Math.min(rows - 1, Math.floor(t.bboxMaxR));
        for (let gy = r0; gy <= r1; gy++) {
          const row = gy * cols;
          for (let gx = c0; gx <= c1; gx++) {
            const ci = row + gx;
            if (owner[ci] !== t.id) continue;
            const age = simTime - claimedAt[ci]!;
            if (age > t.senLimit) {
              if (neighborDiffers(gx, gy, t.id)) markSeam(ci);
              releaseCell(ci);
            }
          }
        }
      }
    };

    const decaySeams = (dt: number) => {
      if (seamCells.size === 0) return;
      const decay = Math.exp(-dt / SEAM_TAU);
      for (const ci of seamCells) {
        const v = seam[ci]! * decay;
        seam[ci] = v;
        if (v < 0.02) seamCells.delete(ci);
      }
    };

    const stepSim = (dt: number) => {
      if (dt <= 0) return;
      simTime += dt;
      for (let s = 0; s < nSlots; s++) {
        if (!slots[s] && simTime >= slotCooldown[s]!) nucleate(s, simTime);
      }
      for (let s = 0; s < nSlots; s++) {
        const t = slots[s];
        if (t) growThallus(t, dt);
      }
      senescenceSweep();
      decaySeams(dt);
    };

    const resetSim = () => {
      cols = Math.max(1, Math.ceil(cssW / CELL));
      rows = Math.max(1, Math.ceil(cssH / CELL));
      owner = new Uint16Array(cols * rows);
      claimedAt = new Float32Array(cols * rows);
      seam = new Float32Array(cols * rows);
      seamCells.clear();
      simTime = 0;
      idSeq = 1;
      rngState = 0x9e3779b9 >>> 0;
      activeById.clear();
      for (let s = 0; s < nSlots; s++) {
        slots[s] = null;
        slotCooldown[s] = rng() * STAGGER_WINDOW;
      }
    };

    const prewarm = () => {
      const steps = Math.round(PREWARM_SECONDS / PREWARM_DT);
      for (let i = 0; i < steps; i++) stepSim(PREWARM_DT);
    };

    // -- marching squares over the binary field for one species ----------
    const marchSpecies = (t: Thallus, path: Path2D) => {
      if (t.cellCount <= 0) return;
      const i0 = Math.max(0, Math.floor(t.bboxMinC) - 1);
      const i1 = Math.min(cols - 2, Math.floor(t.bboxMaxC));
      const j0 = Math.max(0, Math.floor(t.bboxMinR) - 1);
      const j1 = Math.min(rows - 2, Math.floor(t.bboxMaxR));
      if (i1 < i0 || j1 < j0) return;
      const sampleAt = (gx: number, gy: number): number => {
        if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return 0;
        return owner[gy * cols + gx] === t.id ? 1 : 0;
      };
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const tl = sampleAt(i, j);
          const tr = sampleAt(i + 1, j);
          const br = sampleAt(i + 1, j + 1);
          const bl = sampleAt(i, j + 1);
          if (tl === tr && tr === br && br === bl) continue;
          const x0 = i * CELL;
          const x1 = x0 + CELL;
          const y0 = j * CELL;
          const y1 = y0 + CELL;
          const midX = (x0 + x1) / 2;
          const midY = (y0 + y1) / 2;
          const T: [number, number] = [midX, y0];
          const R: [number, number] = [x1, midY];
          const B: [number, number] = [midX, y1];
          const L: [number, number] = [x0, midY];
          const crossTop = tl !== tr;
          const crossRight = tr !== br;
          const crossBottom = bl !== br;
          const crossLeft = tl !== bl;
          const count =
            (crossTop ? 1 : 0) + (crossRight ? 1 : 0) + (crossBottom ? 1 : 0) + (crossLeft ? 1 : 0);
          if (count === 2) {
            const pts: Array<[number, number]> = [];
            if (crossTop) pts.push(T);
            if (crossRight) pts.push(R);
            if (crossBottom) pts.push(B);
            if (crossLeft) pts.push(L);
            path.moveTo(pts[0]![0], pts[0]![1]);
            path.lineTo(pts[1]![0], pts[1]![1]);
          } else if (count === 4) {
            if (tl === 1) {
              path.moveTo(T[0], T[1]);
              path.lineTo(L[0], L[1]);
              path.moveTo(B[0], B[1]);
              path.lineTo(R[0], R[1]);
            } else {
              path.moveTo(T[0], T[1]);
              path.lineTo(R[0], R[1]);
              path.moveTo(B[0], B[1]);
              path.lineTo(L[0], L[1]);
            }
          }
        }
      }
    };

    const fillThallus = (t: Thallus) => {
      if (t.cellCount <= 0) return;
      const pat = patterns[t.slot];
      if (!pat) return;
      const c0 = Math.max(0, Math.floor(t.bboxMinC));
      const c1 = Math.min(cols - 1, Math.floor(t.bboxMaxC));
      const r0 = Math.max(0, Math.floor(t.bboxMinR));
      const r1 = Math.min(rows - 1, Math.floor(t.bboxMaxR));
      const path = new Path2D();
      let any = false;
      for (let gy = r0; gy <= r1; gy++) {
        const row = gy * cols;
        for (let gx = c0; gx <= c1; gx++) {
          if (owner[row + gx] === t.id) {
            path.rect(gx * CELL, gy * CELL, CELL, CELL);
            any = true;
          }
        }
      }
      if (!any) return;
      ctx.fillStyle = pat;
      ctx.fill(path);
    };

    const SEAM_BUCKET_T = [0.25, 0.5, 0.75, 1.01];
    const SEAM_BUCKET_ALPHA = [0.12, 0.22, 0.32, 0.42];

    const drawSeams = () => {
      if (seamCells.size === 0) return;
      const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (const ci of seamCells) {
        const v = seam[ci]!;
        if (v < 0.02) continue;
        let b = 0;
        while (b < 3 && v > SEAM_BUCKET_T[b]!) b++;
        const gx = ci % cols;
        const gy = (ci / cols) | 0;
        buckets[b]!.rect(gx * CELL + 1, gy * CELL + 1, CELL - 2, CELL - 2);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = borderColor;
      for (let b = 0; b < 4; b++) {
        ctx.globalAlpha = SEAM_BUCKET_ALPHA[b]!;
        ctx.stroke(buckets[b]!);
      }
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cssW, cssH);
      for (const t of activeById.values()) fillThallus(t);
      const boundary = new Path2D();
      for (const t of activeById.values()) marchSpecies(t, boundary);
      ctx.lineWidth = 1;
      ctx.strokeStyle = borderColor;
      ctx.globalAlpha = 0.55;
      ctx.stroke(boundary);
      ctx.globalAlpha = 1;
      drawSeams();
    };

    // -- host plumbing ------------------------------------------------------
    const applyBacking = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const rebuild = () => {
      if (cssW < 2 || cssH < 2) {
        sized = false;
        return;
      }
      applyBacking();
      buildPatterns();
      resetSim();
      prewarm();
      sized = true;
      draw();
    };

    let lastW = 0;
    let lastH = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      if (Math.abs(rect.width - lastW) < 2 && Math.abs(rect.height - lastH) < 2) return;
      lastW = rect.width;
      lastH = rect.height;
      cssW = rect.width;
      cssH = rect.height;
      rebuild();
    };

    let raf = 0;
    let running = false;
    let lastMs = 0;
    let lastDrawMs = 0;

    const loop = (now: number) => {
      const dt = lastMs ? Math.min(0.25, (now - lastMs) / 1000) : 1 / 60;
      lastMs = now;
      stepSim(dt * Math.max(0, speed));
      if (now - lastDrawMs >= DRAW_INTERVAL_MS) {
        draw();
        lastDrawMs = now;
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed || !sized || staticMode) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const applyMode = () => {
      staticMode = reduced || pausedRef.current;
      if (staticMode) {
        sleep();
        draw();
      } else {
        wake();
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    applyMode();

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

    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (sized) {
        buildPatterns();
        draw();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // paused is polled rather than an effect dependency, so toggling it does
    // not tear down and re-prewarm 20 minutes of simulated history.
    let lastPolledPaused = pausedRef.current;
    let pollTimer = 0;
    const poll = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      pollTimer = window.setTimeout(poll, 160);
    };
    poll();

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      window.clearTimeout(pollTimer);
      sleep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, variance, speed]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

ThallusSiege.displayName = "ThallusSiege";
