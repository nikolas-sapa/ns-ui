"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DomainWalls — an ambient ASCII background running a real 2D Ising model on
// the glyph grid and inking ONLY the domain walls: the bonds where an up-spin
// region meets a down-spin region. Domain interiors, which are the
// overwhelming majority of the lattice, draw absolutely nothing, so the frame
// reads as a sparse network of rough hairlines on empty ground — a Kerr
// micrograph of magnetic domains, or grain boundaries in cooled metal.
//
// Temperature is deliberately 0.92 * Tc (Tc = 2/ln(1+sqrt(2)) = 2.269...).
// Below that walls freeze straight and stop moving; at Tc the whole lattice
// becomes fractal mush. At 0.92 * Tc walls are simultaneously sharp AND
// mobile, which is the only regime where this reads as calm-but-alive.
//
// The pointer is not a brush. It applies a LOCAL MAGNETIC FIELD biasing spins
// toward +1; a uniform field thermodynamically suppresses the minority phase,
// so walls under the cursor retract and annihilate on their own and a clean
// circular clearing tracks the pointer. On leave the field relaxes and
// thermal fluctuation plus the periodic re-seed nucleates domains back into
// the cleared patch over about two seconds.
// ---------------------------------------------------------------------------

const GLYPHS = ["", "|", "-", "+"] as const; // by broken-bond kind
const ALPHA_BUCKETS = 6;

const J = 1; // ferromagnetic coupling
const SWEEP_FRACTION = 0.9; // flip attempts per frame, as a fraction of sites
const LUM_BASE = 0.35; // luminance of a perfectly straight wall cell
const LUM_PER_NEIGHBOUR = 0.09; // added per inked cell in the 8-ring
const RESEED_PERIOD = 3.0; // s between domain nucleations
const RESEED_JITTER = 0.6; // s +- on that period
const RESEED_RADIUS = 6; // cells
const FIELD_MAX = 1.4; // peak H under the pointer
const FIELD_SIGMA = 7; // cells — gaussian width of the field
const FIELD_CUTOFF2 = 24 * 24; // cells^2 beyond which H is numerically nil
const FIELD_TAU = 0.6; // s — field ease in/out time constant
const EQUILIBRATE_SWEEPS = 120; // so the first painted frame is already coarse
const REDUCED_SWEEPS = 400; // static frame equilibration
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

export interface DomainWallsProps {
  /** grid cell size in px — this is also the Ising lattice spacing */
  cellSize?: number;
  /** Ising temperature in units of J/k_B; Tc is 2.269, default sits at 0.92 Tc */
  temperature?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DomainWalls({
  cellSize = 12,
  temperature = 2.09,
  className = "",
}: DomainWallsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const T = Math.max(0.4, temperature);
    const rand = mulberry32(0x15196e);

    let fg = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let n = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let spins = new Int8Array(0);
    let glyphBuf = new Uint8Array(0);
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

    // Only five values of dE are reachable at H = 0 (neighbour sum is one of
    // -4,-2,0,2,4 and s is +-1), so the Boltzmann factor is a lookup and
    // Math.exp never runs in the hot loop except for the few hundred cells
    // actually inside the pointer's field.
    const expTable = new Float64Array(5);
    for (let k = 0; k < 5; k++) expTable[k] = Math.exp(-(k * 4 - 8) / T);

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

    const seedLattice = () => {
      spins = new Int8Array(n);
      for (let i = 0; i < n; i++) spins[i] = rand() < 0.5 ? 1 : -1;
    };

    /** Nucleate a fresh single-sign domain. Without this, curvature-driven
     *  coarsening eventually swallows every wall and the frame goes blank. */
    const reseed = () => {
      const cx = (rand() * cols) | 0;
      const cy = (rand() * rows) | 0;
      const sign = rand() < 0.5 ? 1 : -1;
      const r2 = RESEED_RADIUS * RESEED_RADIUS;
      for (let dy = -RESEED_RADIUS; dy <= RESEED_RADIUS; dy++) {
        for (let dx = -RESEED_RADIUS; dx <= RESEED_RADIUS; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const gx = (((cx + dx) % cols) + cols) % cols;
          const gy = (((cy + dy) % rows) + rows) % rows;
          spins[gy * cols + gx] = sign;
        }
      }
    };

    /** Metropolis single-spin-flip, periodic boundaries. */
    const step = (attempts: number, fx: number, fy: number, strength: number) => {
      const fieldOn = strength > 0.01;
      const amp = FIELD_MAX * strength;
      for (let a = 0; a < attempts; a++) {
        const gx = (rand() * cols) | 0;
        const gy = (rand() * rows) | 0;
        const i = gy * cols + gx;
        const s = spins[i]!;
        const rowOff = gy * cols;
        const xl = gx > 0 ? gx - 1 : cols - 1;
        const xr = gx < cols - 1 ? gx + 1 : 0;
        const yu = gy > 0 ? gy - 1 : rows - 1;
        const yd = gy < rows - 1 ? gy + 1 : 0;
        const sum =
          spins[rowOff + xl]! +
          spins[rowOff + xr]! +
          spins[yu * cols + gx]! +
          spins[yd * cols + gx]!;
        const dEj = 2 * J * s * sum;

        if (fieldOn) {
          const dx = gx - fx;
          const dy = gy - fy;
          const d2 = dx * dx + dy * dy;
          if (d2 < FIELD_CUTOFF2) {
            // E includes -H*s, so flipping costs +2*H*s: a positive H makes
            // flipping a down spin up cheap and the reverse expensive.
            const h = amp * Math.exp(-d2 / (2 * FIELD_SIGMA * FIELD_SIGMA));
            const dE = dEj + 2 * h * s;
            if (dE <= 0 || rand() < Math.exp(-dE / T)) spins[i] = -s as -1 | 1;
            continue;
          }
        }
        if (dEj <= 0 || rand() < expTable[(dEj + 8) >> 2]!) {
          spins[i] = -s as -1 | 1;
        }
      }
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
      n = cols * rows;
      glyphBuf = new Uint8Array(n);
      seedLattice();
      const warm = reduced ? REDUCED_SWEEPS : EQUILIBRATE_SWEEPS;
      const perReseed = Math.max(1, Math.round(warm / 3));
      for (let k = 0; k < warm; k++) {
        step(n, 0, 0, 0);
        if (k > 0 && k % perReseed === 0) reseed();
      }
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 150);
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW, rows * cellH);
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      // Pass one — a cell inks only if its right OR down bond is broken. Which
      // bond broke picks the glyph, so the ink is genuine line-work along the
      // wall rather than a stipple.
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const rowOff = gy * cols;
        const downOff = (gy < rows - 1 ? gy + 1 : 0) * cols;
        for (let gx = 0; gx < cols; gx++, i++) {
          const s = spins[i]!;
          const right = s !== spins[rowOff + (gx < cols - 1 ? gx + 1 : 0)]!;
          const down = s !== spins[downOff + gx]!;
          glyphBuf[i] = right ? (down ? 3 : 1) : down ? 2 : 0;
        }
      }

      // Luminance is wall CURVATURE: how many of the 8 surrounding cells also
      // sit on a wall. A kinked, high-energy stretch reads brighter than a
      // straight one, which is exactly what costs energy.
      i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const yu = (gy > 0 ? gy - 1 : rows - 1) * cols;
        const ym = gy * cols;
        const yd = (gy < rows - 1 ? gy + 1 : 0) * cols;
        for (let gx = 0; gx < cols; gx++, i++) {
          if (glyphBuf[i] === 0) continue;
          const xl = gx > 0 ? gx - 1 : cols - 1;
          const xr = gx < cols - 1 ? gx + 1 : 0;
          let c = 0;
          if (glyphBuf[yu + xl]) c++;
          if (glyphBuf[yu + gx]) c++;
          if (glyphBuf[yu + xr]) c++;
          if (glyphBuf[ym + xl]) c++;
          if (glyphBuf[ym + xr]) c++;
          if (glyphBuf[yd + xl]) c++;
          if (glyphBuf[yd + gx]) c++;
          if (glyphBuf[yd + xr]) c++;
          const lum = Math.min(1, LUM_BASE + LUM_PER_NEIGHBOUR * c);
          const b = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(((lum - LUM_BASE) / (1 - LUM_BASE)) * ALPHA_BUCKETS)
          );
          bucketLists[b]!.push(i);
        }
      }

      // Pass two — one globalAlpha write per bucket, never per cell.
      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha =
          LUM_BASE + ((b + 0.5) / ALPHA_BUCKETS) * (1 - LUM_BASE);
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
    let reseedIn = RESEED_PERIOD;
    const field = { gx: 0, gy: 0, has: false, strength: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;

      const target = field.has ? 1 : 0;
      field.strength += (target - field.strength) * Math.min(1, dt / FIELD_TAU);

      if (sized) {
        reseedIn -= dt;
        if (reseedIn <= 0) {
          reseed();
          reseedIn = RESEED_PERIOD + (rand() * 2 - 1) * RESEED_JITTER;
        }
        step(
          Math.round(SWEEP_FRACTION * n),
          field.gx,
          field.gy,
          field.strength
        );
        draw();
      }
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      field.gx = (e.clientX - rect.left) / cellW;
      field.gy = (e.clientY - rect.top) / cellH;
      field.has = true;
    };
    const onPointerLeave = () => {
      field.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        // A frame requested just before the tab hid is still queued and fires
        // on return; without this cancel it would coexist with the one below
        // and the lattice would evolve at double rate forever.
        cancelAnimationFrame(raf);
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
  }, [cellSize, temperature]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
