"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ForceChains — an ambient ASCII background of a granular packing under load.
//
// A static disc packing is built once per resize (seeded Poisson-disk
// sampling, polydisperse radii, a fixed contact graph). Nothing is ever
// re-packed, and no collisions are solved — the only thing that changes per
// frame is how the load DISTRIBUTES through that fixed contact network.
//
// Load enters at the top boundary, each grain adds its own weight, and every
// grain passes what it carries down to the grains beneath it in proportion to
// how vertical each contact normal is. That is the q-model of granular stress
// transmission: a multiplicative cascade down a disordered network, whose
// steady state is a heavy-tailed force distribution. Only the small minority
// of contacts carrying well above the mean force is inked, so what is drawn is
// the load-bearing skeleton — thin branching chains threading downward — while
// the ~88% of "spectator" grains carrying nothing draw absolutely nothing.
// That sparsity is the physics, not a stylistic filter: it is what a
// photoelastic sand experiment actually looks like.
//
// The pointer is an INDENTER pressed into the pile. Its point load is injected
// at the nearest grain and the relaxation redistributes it, so a bright stress
// cone fans downward and outward at roughly the packing's 45-degree cone
// angle, and unrelated chains DIM because the mean force rises and they lose
// their share of the threshold. On leave the load eases back to zero and the
// gravity-only skeleton returns.
// ---------------------------------------------------------------------------

/** ' .:-=+*#%@' at 0..9, then the four chain-body slope glyphs at 10..13. */
const GLYPHS = " .:-=+*#%@-|/\\";
const SLOPE_BASE = 10;
const ALPHA_BUCKETS = 6;

// -- packing ---------------------------------------------------------------
/** min-spacing solved from the target count: R = sqrt(area / (n * K)). */
const SPACING_K = 1.57;
/** min spacing expressed in grain radii — 1.9 * grainR. */
const SPACING_IN_RADII = 1.9;
/** radius polydispersity; a monodisperse packing crystallises into a hex lattice. */
const R_JITTER_MIN = 0.85;
const R_JITTER_SPAN = 0.3;
/** Bridson annulus width. Narrow (R..1.3R) packs jammed rather than loose. */
const ANNULUS = 0.3;
const CANDIDATES = 30;
/** contact where centre distance < (r_i + r_j) * TOL. Tuned for z ~= 4. */
const CONTACT_TOL = 1.35;

// -- load ------------------------------------------------------------------
/** depth of the top boundary row, in min-spacings. */
const TOP_BAND = 1.6;
/** total flux injected at the top, split across the top row — viewport-independent. */
const TOP_FLUX = 3.6;
/** total self-weight of the pile, split across every grain. */
const TOTAL_WEIGHT = 5.9;
/** point load of the indenter, comparable to the whole ambient flux. */
const INDENT_LOAD = 3.2;
const INDENT_TAU = 0.5; // s

// -- sparsity --------------------------------------------------------------
/** ink only contacts above this multiple of the mean force. ~12% survive. */
const CHAIN_THRESHOLD = 1.9;
/** width of the luminance ramp above the threshold, in units of the mean. */
const CHAIN_RANGE = 2.6;
const CHAIN_GAMMA = 0.8;
/** below this luminance a contact is drawn with the density ramp, not a slope glyph. */
const FAINT_CUTOFF = 0.34;

const DT_MAX = 0.05;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Packing {
  n: number;
  /** grain centres and radii, sorted top-to-bottom (depth order). */
  px: Float32Array;
  py: Float32Array;
  pr: Float32Array;
  /** contact edges, always directed from the upper grain to the lower one. */
  ea: Int32Array;
  eb: Int32Array;
  /** vertical component of each contact normal, always >= 0 by construction. */
  eny: Float32Array;
  /** CSR-style offsets into ea/eb for each grain's outgoing contacts. */
  off: Int32Array;
  /** sum of eny over each grain's outgoing contacts; 0 = nothing beneath it. */
  sumny: Float32Array;
  /** indices of the top-boundary grains and the column each one sits in. */
  topIdx: Int32Array;
  topCol: Int32Array;
  spacing: number;
  f: Float32Array;
  inF: Float32Array;
}

function buildPacking(w: number, h: number, count: number): Packing {
  const rnd = mulberry32(0x9e3779b9);
  const spacing = Math.max(6, Math.sqrt((w * h) / (count * SPACING_K)));
  const grainR = spacing / SPACING_IN_RADII;

  // --- seeded Poisson-disk sampling (Bridson) ---
  const cell = spacing / Math.SQRT2;
  const gw = Math.ceil(w / cell) + 1;
  const gh = Math.ceil(h / cell) + 1;
  const grid = new Int32Array(gw * gh).fill(-1);
  const xs: number[] = [];
  const ys: number[] = [];
  const rs: number[] = [];
  const active: number[] = [];
  const push = (x: number, y: number) => {
    const i = xs.length;
    xs.push(x);
    ys.push(y);
    rs.push(grainR * (R_JITTER_MIN + R_JITTER_SPAN * rnd()));
    grid[((y / cell) | 0) * gw + ((x / cell) | 0)] = i;
    active.push(i);
  };
  const free = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const cx = (x / cell) | 0;
    const cy = (y / cell) | 0;
    for (let j = Math.max(0, cy - 2); j <= Math.min(gh - 1, cy + 2); j++) {
      for (let i = Math.max(0, cx - 2); i <= Math.min(gw - 1, cx + 2); i++) {
        const k = grid[j * gw + i]!;
        if (k < 0) continue;
        const dx = xs[k]! - x;
        const dy = ys[k]! - y;
        if (dx * dx + dy * dy < spacing * spacing) return false;
      }
    }
    return true;
  };
  push(rnd() * w, rnd() * h);
  while (active.length && xs.length < count) {
    const ai = (active.length * rnd()) | 0;
    const p = active[ai]!;
    let placed = false;
    for (let k = 0; k < CANDIDATES; k++) {
      const a = rnd() * Math.PI * 2;
      const d = spacing * (1 + ANNULUS * rnd());
      const x = xs[p]! + Math.cos(a) * d;
      const y = ys[p]! + Math.sin(a) * d;
      if (free(x, y)) {
        push(x, y);
        placed = true;
        break;
      }
    }
    if (!placed) {
      active[ai] = active[active.length - 1]!;
      active.pop();
    }
  }

  // --- sort top-to-bottom: depth order makes the contact graph a DAG ---
  const n = xs.length;
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => ys[a]! - ys[b]!
  );
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const pr = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    px[k] = xs[order[k]!]!;
    py[k] = ys[order[k]!]!;
    pr[k] = rs[order[k]!]!;
  }

  // --- contact graph via a uniform neighbour grid, built once ---
  const cs = spacing * 1.8;
  const cw = Math.ceil(w / cs) + 1;
  const chh = Math.ceil(h / cs) + 1;
  const heads = new Int32Array(cw * chh).fill(-1);
  const next = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const c = ((py[i]! / cs) | 0) * cw + ((px[i]! / cs) | 0);
    next[i] = heads[c]!;
    heads[c] = i;
  }
  const ea: number[] = [];
  const eb: number[] = [];
  const eny: number[] = [];
  const off = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    off[i] = ea.length; // outgoing edges of i start here (i ascends, so CSR is contiguous)
    const cx = (px[i]! / cs) | 0;
    const cy = (py[i]! / cs) | 0;
    for (let j = Math.max(0, cy - 1); j <= Math.min(chh - 1, cy + 1); j++) {
      for (let k = Math.max(0, cx - 1); k <= Math.min(cw - 1, cx + 1); k++) {
        for (let q = heads[j * cw + k]!; q !== -1; q = next[q]!) {
          if (q <= i) continue; // q is at or below i in depth order
          const dx = px[q]! - px[i]!;
          const dy = py[q]! - py[i]!;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= (pr[i]! + pr[q]!) * CONTACT_TOL || d < 1e-6) continue;
          ea.push(i);
          eb.push(q);
          eny.push(dy / d);
        }
      }
    }
  }
  off[n] = ea.length;

  // --- per-grain sum of outgoing n.y, computed once ---
  const enyArr = Float32Array.from(eny);
  const sumny = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let e = off[i]!; e < off[i + 1]!; e++) s += enyArr[e]!;
    sumny[i] = s;
  }

  // --- top boundary row and its columns ---
  const band = spacing * TOP_BAND;
  const topIdx: number[] = [];
  const topCol: number[] = [];
  for (let i = 0; i < n; i++) {
    if (py[i]! > band) break; // sorted by depth
    topIdx.push(i);
    topCol.push(Math.floor(px[i]! / spacing));
  }

  return {
    n,
    px,
    py,
    pr,
    ea: Int32Array.from(ea),
    eb: Int32Array.from(eb),
    eny: enyArr,
    off,
    sumny,
    topIdx: Int32Array.from(topIdx),
    topCol: Int32Array.from(topCol),
    spacing,
    f: new Float32Array(ea.length),
    inF: new Float32Array(n),
  };
}

/**
 * One ordered top-down sweep of the Gauss-Seidel force relaxation. Because the
 * grains are sorted by depth every contact points from an earlier index to a
 * later one, so the contact network is a DAG and a single in-order sweep IS
 * the converged fixed point — further iterations reproduce it exactly.
 */
function relax(p: Packing, t: number, indX: number, indY: number, indS: number) {
  const { n, inF, f, eb, eny, off, sumny, topIdx, topCol } = p;
  inF.fill(0);

  const unit = TOP_FLUX / Math.max(1, topIdx.length);
  const breathe = 0.08 * Math.sin(t * 1.7);
  for (let k = 0; k < topIdx.length; k++) {
    inF[topIdx[k]!] +=
      unit * (1 + 0.22 * Math.sin(t * 0.5 + topCol[k]! * 0.4) + breathe);
  }

  if (indS > 0.002) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < n; i++) {
      // a grain with nothing beneath it terminates the load, so pressing on one
      // would do literally nothing (~4% of pointer positions, measured) — the
      // indenter always seats on the nearest grain that can transmit
      if (sumny[i]! <= 1e-6) continue;
      const dx = p.px[i]! - indX;
      const dy = p.py[i]! - indY;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) inF[best] += INDENT_LOAD * indS;
  }

  const weight = TOTAL_WEIGHT / Math.max(1, n);
  for (let i = 0; i < n; i++) {
    const s = off[i + 1]!;
    const total = inF[i]! + weight;
    const sum = sumny[i]!;
    if (sum <= 1e-6) continue; // resting on the floor: the load terminates here
    for (let e = off[i]!; e < s; e++) {
      const v = (total * eny[e]!) / sum;
      f[e] = v;
      inF[eb[e]!] += v;
    }
  }
}

export interface ForceChainsProps {
  /** glyph grid cell size in px */
  cellSize?: number;
  /** target number of grains in the packing */
  grainCount?: number;
  className?: string;
}

export function ForceChains({
  cellSize = 12,
  grainCount = 900,
  className = "",
}: ForceChainsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = Math.max(200, Math.min(2000, Math.round(grainCount)));

    let fg = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let pack: Packing | null = null;

    let glyphBuf = new Uint8Array(0);
    let lumBuf = new Float32Array(0);
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const resize = () => {
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
      cols = Math.max(4, Math.ceil(width / cellW));
      rows = Math.max(4, Math.ceil(height / cellH));
      glyphBuf = new Uint8Array(cols * rows);
      lumBuf = new Float32Array(cols * rows);
      pack = buildPacking(width, height, count);
      sized = true;
    };

    const draw = () => {
      const p = pack;
      if (!sized || !p) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      glyphBuf.fill(0);
      lumBuf.fill(0);
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      // --- mean contact force, the sparsity reference ---
      const E = p.f.length;
      if (!E) return;
      let sum = 0;
      for (let e = 0; e < E; e++) sum += p.f[e]!;
      const fbar = sum / E;
      if (fbar <= 1e-9) return;

      // --- pass one: rasterise only the chain-carrying contacts ---
      const step = Math.min(cellW, cellH);
      for (let e = 0; e < E; e++) {
        const ratio = p.f[e]! / fbar;
        if (ratio <= CHAIN_THRESHOLD) continue;
        const lum = Math.pow(
          Math.min(1, (ratio - CHAIN_THRESHOLD) / CHAIN_RANGE),
          CHAIN_GAMMA
        );
        const a = p.ea[e]!;
        const b = p.eb[e]!;
        const ax = p.px[a]!;
        const ay = p.py[a]!;
        const dx = p.px[b]! - ax;
        const dy = p.py[b]! - ay;
        const len = Math.sqrt(dx * dx + dy * dy);
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // dy >= 0, so 0..180
        let slope: number;
        if (deg < 22.5 || deg > 157.5) slope = 0; // '-'
        else if (deg > 67.5 && deg < 112.5) slope = 1; // '|'
        else if (deg < 67.5) slope = 3; // '\'
        else slope = 2; // '/'
        // faint load is texture, so it stays on '.' / ':' — letting it reach
        // '-' put 145 horizontal marks on screen against 36 genuinely
        // horizontal chain cells (measured), which reads as streaking in a
        // field whose subject is vertical chains
        const gi =
          lum < FAINT_CUTOFF
            ? 1 + Math.min(1, Math.floor(lum * 8.8))
            : SLOPE_BASE + slope;
        const steps = Math.max(1, Math.ceil(len / step));
        for (let s = 0; s <= steps; s++) {
          const gx = ((ax + (dx * s) / steps) / cellW) | 0;
          const gy = ((ay + (dy * s) / steps) / cellH) | 0;
          if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
          const idx = gy * cols + gx;
          if (lum <= lumBuf[idx]!) continue; // brightest chain wins the cell
          lumBuf[idx] = lum;
          glyphBuf[idx] = gi;
        }
      }

      for (let i = 0; i < glyphBuf.length; i++) {
        if (!glyphBuf[i]) continue;
        const b = Math.min(ALPHA_BUCKETS - 1, (lumBuf[i]! * ALPHA_BUCKETS) | 0);
        bucketLists[b]!.push(i);
      }

      // --- pass two: one globalAlpha write per bucket ---
      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (!list.length) continue;
        ctx.globalAlpha = 0.1 + (b / (ALPHA_BUCKETS - 1)) * 0.9;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k]!;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            GLYPHS[glyphBuf[idx]!]!,
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const ind = { x: -1e5, y: -1e5, has: false, strength: 0 };

    const still = () => {
      if (!pack) return;
      relax(pack, 0, -1e5, -1e5, 0);
      draw();
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const target = ind.has ? 1 : 0;
      ind.strength += (target - ind.strength) * Math.min(1, dt / INDENT_TAU);
      if (pack) relax(pack, t, ind.x, ind.y, ind.strength);
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ind.x = e.clientX - rect.left;
      ind.y = e.clientY - rect.top;
      ind.has = true;
    };
    const onPointerLeave = () => {
      ind.has = false;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) still();
      }, 150);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        // a rAF queued before the tab was hidden fires again on restore, so
        // cancel it first — otherwise resuming leaves two loops running
        cancelAnimationFrame(raf);
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) still();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) still();
      else raf = requestAnimationFrame(loop);
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, grainCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
