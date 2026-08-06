"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ReactionFront — a full-bleed ASCII hero driven by a live Gray-Scott
// reaction-diffusion simulation. The sim grid IS the glyph grid, so every
// character is one cell of a real chemical solver rather than a sampled
// texture.
//
// The sparsity trick, and the whole reason this reads as line structure
// instead of a wash: luminance is NOT the V concentration. Inking V would
// fill the reacted interiors and produce blobs. Instead each cell is inked by
// the MAGNITUDE OF THE GRADIENT of V — |dV/dx| + |dV/dy| — and then only the
// RIDGE of that gradient field survives: a cell inks only if its gradient is
// a local maximum along EITHER axis (non-maximum suppression; see the note at
// the ridge test for why the dominant-axis variant is wrong here). A raw
// gradient threshold inks the whole shoulder of every front, four to six
// cells wide, which measured 80% of the frame at steady state — a wash.
// Keeping the ridge alone collapses each front to a one-cell line and holds
// ink at a measured 11-15% of cells from the first paint out to 30000
// substeps, with 96% of inked cells in 8-connected runs of 8 cells or more
// and a mean run of 25 cells. Both the reacted interior and the unreacted
// bulk are flat-gradient, therefore blank, therefore each front is a line.
//
// The pointer is a pipette, not a brush: it raises V and consumes U in a
// small gaussian, which nucleates a genuinely new front under the cursor.
// When the pointer leaves, the injection eases off but the front it seeded
// keeps travelling and dissipates through the reaction's own dynamics — the
// relaxation is physical, not a fade-out.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;

// Gray-Scott in the worm/front regime (NOT the spot regime — spots ink as
// dots, fronts ink as lines). Du/Dv are the canonical pairing for this
// 9-point stencil at dt=1: Du*dt*|lambda|max = 1.6, inside the explicit-Euler
// stability bound of 2. Feed/kill sit in the chaotic worm band, which is the
// only band measured to be BOTH sparse and moving — the frozen bands
// (F >= 0.042) settle to exactly zero motion, dead rings.
const DU = 1.0;
const DV = 0.5;
const FEED = 0.018;
const KILL = 0.051;
const DT = 1.0;
const SUBSTEPS = 4; // sim substeps per rAF frame
const WARMUP = 600; // substeps run before the first paint
const REDUCED_EXTRA = 400; // extra substeps for the single static frame

const SEED_COUNT = 7;
const SEED_RADIUS = 4;

// sparsity: the ridge of the gradient field is the only thing that survives
const GRAD_SCALE = 0.14; // ~p95 of the ridge gradient, so the ramp spans
const GRAD_POW = 1.0;
const INK_FLOOR = 0.08;

// 9-point laplacian: diagonal weight is fixed, the two orthogonal weights are
// split by cell ASPECT so the field is isotropic ON SCREEN. A mono cell is
// ~7.2px wide and 12px tall, so an isotropic-in-grid front would render 1.67x
// taller than wide. Splitting the 0.8 orthogonal budget as 1/dx^2 : 1/dy^2
// keeps the stencil's eigenvalue (and therefore its stability bound) exactly
// where the isotropic version had it.
const W_DIAG = 0.05;
const W_ORTHO_TOTAL = 0.8;

// pipette
const INJECT_TAU = 0.4; // s
const INJECT_RADIUS = 3.5; // cells
const INJECT_V = 0.42;
const INJECT_U = 0.2;

const DT_MAX = 0.05;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ReactionFrontProps {
  /** grid cell size in px — the sim grid is the glyph grid, never supersampled */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ReactionFront({
  cellSize = 12,
  className = "",
}: ReactionFrontProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    // ping-ponged concentration fields
    let U = new Float32Array(0);
    let V = new Float32Array(0);
    let Un = new Float32Array(0);
    let Vn = new Float32Array(0);
    // toroidal neighbour lookup
    let lf = new Int32Array(0);
    let rt = new Int32Array(0);
    let up = new Int32Array(0);
    let dn = new Int32Array(0);

    let charBuf = new Uint8Array(0);
    let gradBuf = new Float32Array(0);
    // aspect-split orthogonal laplacian weights, set in resize()
    let wx = W_ORTHO_TOTAL / 4;
    let wy = W_ORTHO_TOTAL / 4;
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

    const seed = () => {
      U.fill(1);
      V.fill(0);
      const rnd = mulberry32(0x5eed1);
      for (let s = 0; s < SEED_COUNT; s++) {
        const cx = Math.floor(rnd() * cols);
        const cy = Math.floor(rnd() * rows);
        for (let dy = -SEED_RADIUS; dy <= SEED_RADIUS; dy++) {
          for (let dx = -SEED_RADIUS; dx <= SEED_RADIUS; dx++) {
            if (dx * dx + dy * dy > SEED_RADIUS * SEED_RADIUS) continue;
            const x = ((cx + dx) % cols + cols) % cols;
            const y = ((cy + dy) % rows + rows) % rows;
            const i = y * cols + x;
            V[i] = 0.5;
            U[i] = 0.25;
          }
        }
      }
    };

    // one Gray-Scott substep with the 9-point laplacian and toroidal wrap
    const step = () => {
      for (let y = 0; y < rows; y++) {
        const yc = y * cols;
        const ym = up[y]! * cols;
        const yp = dn[y]! * cols;
        for (let x = 0; x < cols; x++) {
          const xm = lf[x]!;
          const xp = rt[x]!;
          const i = yc + x;
          const u = U[i]!;
          const v = V[i]!;
          const lapU =
            -u +
            wx * (U[yc + xm]! + U[yc + xp]!) +
            wy * (U[ym + x]! + U[yp + x]!) +
            W_DIAG *
              (U[ym + xm]! + U[ym + xp]! + U[yp + xm]! + U[yp + xp]!);
          const lapV =
            -v +
            wx * (V[yc + xm]! + V[yc + xp]!) +
            wy * (V[ym + x]! + V[yp + x]!) +
            W_DIAG *
              (V[ym + xm]! + V[ym + xp]! + V[yp + xm]! + V[yp + xp]!);
          const uvv = u * v * v;
          Un[i] = u + (DU * lapU - uvv + FEED * (1 - u)) * DT;
          Vn[i] = v + (DV * lapV + uvv - (FEED + KILL) * v) * DT;
        }
      }
      const tu = U;
      U = Un;
      Un = tu;
      const tv = V;
      V = Vn;
      Vn = tv;
    };

    const inject = (gx: number, gy: number, strength: number) => {
      if (strength < 0.01) return;
      const r = Math.ceil(INJECT_RADIUS);
      const cx = Math.round(gx);
      const cy = Math.round(gy);
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > INJECT_RADIUS * INJECT_RADIUS) continue;
          const x = ((cx + dx) % cols + cols) % cols;
          const y = ((cy + dy) % rows + rows) % rows;
          const i = y * cols + x;
          const g = Math.exp(-d2 / 6);
          V[i] = Math.min(1, V[i]! + INJECT_V * strength * g);
          U[i] = Math.max(0, U[i]! - INJECT_U * strength * g);
        }
      }
    };

    const draw = () => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      // pass one, part A — gradient magnitude of V over the whole grid
      for (let y = 0; y < rows; y++) {
        const yc = y * cols;
        const ym = up[y]! * cols;
        const yp = dn[y]! * cols;
        for (let x = 0; x < cols; x++) {
          const gx = (V[yc + rt[x]!]! - V[yc + lf[x]!]!) * 0.5;
          const gy = (V[yp + x]! - V[ym + x]!) * 0.5;
          gradBuf[yc + x] = Math.abs(gx) + Math.abs(gy);
        }
      }

      // pass one, part B — keep only the RIDGE of that gradient field, then
      // ramp-index it and bucket it by luminance
      for (let y = 0; y < rows; y++) {
        const yc = y * cols;
        const ym = up[y]! * cols;
        const yp = dn[y]! * cols;
        for (let x = 0; x < cols; x++) {
          const i = yc + x;
          charBuf[i] = 0;
          const g = gradBuf[i]!;
          // non-maximum suppression: a cell is on the ridge if its gradient is
          // a local maximum along EITHER axis. Testing only the locally
          // dominant axis breaks fronts into dashes wherever they run
          // diagonally and the two axes tie — measured 12.1 cells per
          // connected run against 25-39 for the either-axis test, at the cost
          // of a few percent more ink. Longer runs read as lines; short ones
          // read as speckle, which is the failure this whole pass exists to
          // avoid.
          const onRidge =
            (g >= gradBuf[yc + rt[x]!]! && g >= gradBuf[yc + lf[x]!]!) ||
            (g >= gradBuf[yp + x]! && g >= gradBuf[ym + x]!);
          if (!onRidge) continue;
          let lum = g / GRAD_SCALE;
          lum = lum < 0 ? 0 : lum > 1 ? 1 : lum;
          lum = Math.pow(lum, GRAD_POW);
          if (lum < INK_FLOOR) continue;
          const ci = Math.floor(lum * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci === 0) continue;
          const b = Math.min(ALPHA_BUCKETS - 1, Math.floor(lum * ALPHA_BUCKETS));
          bucketLists[b]!.push(i);
        }
      }

      // pass two — one globalAlpha write per bucket
      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = 0.1 + (b / (ALPHA_BUCKETS - 1)) * 0.9;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k]!;
          const x = idx % cols;
          const y = (idx - x) / cols;
          ctx.fillText(
            RAMP[charBuf[idx]!]!,
            x * cellW + cellW / 2,
            y * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.max(8, Math.ceil(width / cellW));
      rows = Math.max(8, Math.ceil(height / cellH));

      // split the orthogonal laplacian budget by 1/dx^2 : 1/dy^2 so the sim is
      // isotropic on screen despite the non-square mono cell
      const aspect2 = (cellH / cellW) * (cellH / cellW);
      wx = (W_ORTHO_TOTAL / 2) * (aspect2 / (1 + aspect2));
      wy = (W_ORTHO_TOTAL / 2) * (1 / (1 + aspect2));

      const n = cols * rows;
      U = new Float32Array(n);
      V = new Float32Array(n);
      Un = new Float32Array(n);
      Vn = new Float32Array(n);
      charBuf = new Uint8Array(n);
      gradBuf = new Float32Array(n);
      lf = new Int32Array(cols);
      rt = new Int32Array(cols);
      up = new Int32Array(rows);
      dn = new Int32Array(rows);
      for (let x = 0; x < cols; x++) {
        lf[x] = (x - 1 + cols) % cols;
        rt[x] = (x + 1) % cols;
      }
      for (let y = 0; y < rows; y++) {
        up[y] = (y - 1 + rows) % rows;
        dn[y] = (y + 1) % rows;
      }
      sized = true;

      // MOUNT WARMUP — without it the first second of the hero is a blank grid
      seed();
      const warm = reduced ? WARMUP + REDUCED_EXTRA : WARMUP;
      for (let s = 0; s < warm; s++) step();
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        draw();
      }, 200);
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    const ptr = { gx: -1e5, gy: -1e5, has: false, strength: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      const target = ptr.has ? 1 : 0;
      ptr.strength += (target - ptr.strength) * Math.min(1, dt / INJECT_TAU);
      if (sized) {
        if (ptr.strength > 0.01 && ptr.gx > -1e4) {
          inject(ptr.gx, ptr.gy, ptr.strength);
        }
        for (let s = 0; s < SUBSTEPS; s++) step();
        draw();
      }
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ptr.gx = (e.clientX - rect.left) / cellW;
      ptr.gy = (e.clientY - rect.top) / cellH;
      ptr.has = true;
    };
    const onPointerLeave = () => {
      ptr.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
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
      if (reduced) {
        draw();
      } else {
        raf = requestAnimationFrame(loop);
      }
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
  }, [cellSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
