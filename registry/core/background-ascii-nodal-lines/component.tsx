"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// NodalLines — an ambient ASCII background that draws the DESTRUCTIVE
// INTERFERENCE pattern of four point emitters, and only that. Four radial
// waves are SUMMED (background-ascii-caustics multiplies rotated PLANE waves
// and sharpens with a power curve; background-ascii-plasma sums octaves and
// maps luminance — this does neither), and ink appears only along the ZERO
// SET of that sum at the current instant: the cells where the four waves are
// cancelling each other out right now. The
// ~90% of the frame that is oscillating with any amplitude at all draws
// nothing, so what remains is the ripple-tank photograph — smooth curved
// hairlines, the hyperbolic dead-fringe families, fanning between four
// unmarked focal points. The emitters themselves are never drawn.
//
// The pointer is a FIFTH emitter, locked in antiphase with emitter 0.
// Interference depends on the path-length difference to EVERY source, so
// adding one reorganises the whole nodal family and fans a fresh set of dead
// fringes out from the cursor; on leave its amplitude eases back to zero and
// the four-source geometry returns exactly.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;

/** normalized emitter positions on a slightly irregular quadrilateral */
const SOURCES = [
  { nx: 0.24, ny: 0.3, amp: 1.0, phi: 0.0, drift: 0.05 },
  { nx: 0.76, ny: 0.26, amp: 0.88, phi: 0.6, drift: -0.037 },
  { nx: 0.3, ny: 0.74, amp: 1.12, phi: 1.9, drift: 0.061 },
  { nx: 0.72, ny: 0.78, amp: 0.95, phi: 3.1, drift: -0.044 },
] as const;

const K = 0.042; // rad/px — spatial wavenumber
const OMEGA = 1.15; // rad/s — temporal frequency
const R_MIN = 8; // px — clamp so the 1/sqrt(r) decay never blows up
const BAND_PX = 4.0; // px — half-width of the inked band around the zero set
const NODE_POW = 1.3; // falloff across that band
const FLAT_GUARD = 0.4; // skip loud cells (|A|/Amax above this) — see draw()
const POINTER_TAU = 0.5; // s — pointer emitter amplitude ease in/out
const POINTER_AMP = 1.0;
const POINTER_PHI = Math.PI; // antiphase with emitter 0
const DT_MAX = 0.05;

export interface NodalLinesProps {
  /** grid cell size in px */
  cellSize?: number;
  /** how many of the four fixed emitters to use (2–4) */
  sourceCount?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function NodalLines({
  cellSize = 12,
  sourceCount = 4,
  className = "",
}: NodalLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const n = Math.max(2, Math.min(SOURCES.length, Math.round(sourceCount)));

    let fg = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let charBuf = new Uint8Array(0);
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

    // live emitter state, in px, rebuilt on resize
    const sx = new Float64Array(n + 1);
    const sy = new Float64Array(n + 1);
    const sa = new Float64Array(n + 1);
    const sp = new Float64Array(n + 1);

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
      dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      charBuf = new Uint8Array(cols * rows);
      for (let i = 0; i < n; i++) {
        const s = SOURCES[i]!;
        sx[i] = s.nx * width;
        sy[i] = s.ny * height;
        sa[i] = s.amp;
      }
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawStatic();
      }, 150);
    };

    /**
     * One frame. `count` emitters are already loaded into sx/sy/sa/sp.
     *
     * A = sum_i a_i * cos(k*r_i - omega*t + phi_i) / sqrt(max(r_i, R_MIN))
     *
     * The 1/sqrt(r) term is the correct 2D cylindrical-wave amplitude decay —
     * it is what keeps the fringes close to an emitter from washing out. Ink
     * marks only the zero set of A. Point-sampling |A| against a fixed
     * amplitude threshold aliases into speckle at glyph resolution (the band
     * is ~1px wide, the cell is ~7px), so the distance to the nodal curve is
     * taken analytically instead: d = |A| / |grad A|, in px. That is the same
     * set, resolved rather than sampled. |A|/Amax still gates the result, so
     * cells sitting on a stationary point of an otherwise loud field never
     * ink.
     */
    const draw = (t: number, count: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const y = gy * cellH + cellH / 2;
        for (let gx = 0; gx < cols; gx++, i++) {
          const x = gx * cellW + cellW / 2;
          let a = 0; // summed amplitude
          let aMax = 0; // maximum amplitude reachable at this cell
          let gradX = 0;
          let gradY = 0;

          for (let s = 0; s < count; s++) {
            const amp = sa[s]!;
            if (amp <= 0.001) continue;
            const dx = x - sx[s]!;
            const dy = y - sy[s]!;
            const r = Math.max(Math.sqrt(dx * dx + dy * dy), R_MIN);
            const inv = amp / Math.sqrt(r);
            const theta = K * r - OMEGA * t + sp[s]!;
            const c = Math.cos(theta);
            const sn = Math.sin(theta);
            a += inv * c;
            aMax += inv;
            // d/dr of inv*cos(theta), projected onto x and y
            const dAdr = inv * (-sn * K) - (0.5 * inv * c) / r;
            gradX += (dAdr * dx) / r;
            gradY += (dAdr * dy) / r;
          }

          charBuf[i] = 0;
          if (aMax <= 1e-9) continue;
          const abs = Math.abs(a);
          if (abs / aMax > FLAT_GUARD) continue;
          const grad = Math.sqrt(gradX * gradX + gradY * gradY);
          if (grad < 1e-9) continue;
          const d = abs / grad; // px to the nearest nodal curve
          if (d >= BAND_PX) continue;

          const v = Math.pow(1 - d / BAND_PX, NODE_POW);
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(v * ALPHA_BUCKETS)
          );
          const ci = Math.floor(v * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci !== 0) bucketLists[bucket]!.push(i);
        }
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = 0.14 + (b / (ALPHA_BUCKETS - 1)) * 0.86;
        for (let kk = 0; kk < list.length; kk++) {
          const idx = list[kk]!;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            RAMP[charBuf[idx]!]!,
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    /** reduced-motion / theme-flip frame: t = 0, no pointer emitter */
    const drawStatic = () => {
      for (let i = 0; i < n; i++) sp[i] = SOURCES[i]!.phi;
      draw(0, n);
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const pointer = { x: 0, y: 0, has: false, amp: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      // every emitter shares omega, so the whole field swings as
      // |S(x)|*cos(arg S(x) - omega*t) and the inked zero-crossing family
      // already sweeps at a resting ~28 px/s. On top of that each emitter's
      // phase drifts at its own much slower rate, which slowly re-shapes
      // *which* family you get so the pattern never repeats on a short cycle.
      for (let i = 0; i < n; i++) {
        const s = SOURCES[i]!;
        sp[i] = s.phi + s.drift * t;
      }

      const target = pointer.has ? POINTER_AMP : 0;
      pointer.amp += (target - pointer.amp) * Math.min(1, dt / POINTER_TAU);

      let count = n;
      if (pointer.amp > 0.001) {
        sx[n] = pointer.x;
        sy[n] = pointer.y;
        sa[n] = pointer.amp;
        sp[n] = POINTER_PHI;
        count = n + 1;
      }

      draw(t, count);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.has = true;
    };
    const onPointerLeave = () => {
      pointer.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        // a frame queued before the tab was hidden is still pending and fires
        // on return — without this cancel each hide/show cycle would leave an
        // extra self-perpetuating loop running
        cancelAnimationFrame(raf);
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
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
        drawStatic();
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
  }, [cellSize, sourceCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
