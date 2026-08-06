"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CausticVeil — an ambient ASCII water-caustics background rendered in ink
// density. Three periodic wave grids, each rotated to its own angle and
// drifting at its own phase speed, are combined MULTIPLICATIVELY (not summed,
// which is background-ascii-plasma's technique) — sin(a) * sin(b) * sin(c) —
// and the product's distance from zero is sharpened by a power curve, which
// is exactly how two or three overlapping wave-fronts of light produce thin,
// bright, web-like caustic lines rather than smooth blobby luminance: the
// bright filaments trace where the waves cross in near-perfect
// anti/constructive alignment. The pointer acts as a LENS, not a stamp or an
// outward push: samples within its radius are pulled INWARD toward the
// cursor (the opposite sign of plasma's warp), so the caustic web visibly
// contracts and focuses toward the pointer like light converging through a
// magnifier, and relaxes back outward once the pointer leaves.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;
const LAYERS = [
  { angle: 0.0, freq: 0.07, speed: 0.22 },
  { angle: 1.15, freq: 0.09, speed: -0.17 },
  { angle: 2.3, freq: 0.05, speed: 0.13 },
] as const;
const CAUSTIC_POW = 5.5; // higher = thinner, sharper filaments
const LENS_TAU = 0.55; // s — lens strength relax time constant
const LENS_RADIUS = 10; // grid cells
const LENS_MAX = 3.4; // grid cells max inward pull
const DT_MAX = 0.05;

function caustic(x: number, y: number, t: number): number {
  let product = 1;
  for (let i = 0; i < LAYERS.length; i++) {
    const l = LAYERS[i]!;
    const rx = x * Math.cos(l.angle) + y * Math.sin(l.angle);
    product *= Math.sin(rx * l.freq + t * l.speed);
  }
  const v = Math.max(0, 1 - Math.abs(product));
  return Math.pow(v, CAUSTIC_POW);
}

export interface CausticVeilProps {
  /** grid cell size in px */
  cellSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function CausticVeil({ cellSize = 12, className = "" }: CausticVeilProps) {
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

    let charBuf = new Uint8Array(0);
    const bucketLists: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);

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
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, -1e5, -1e5, 0);
      }, 150);
    };

    const draw = (t: number, lensGx: number, lensGy: number, lensStrength: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      const r2 = LENS_RADIUS * LENS_RADIUS;
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++, i++) {
          let sx = gx;
          let sy = gy;
          if (lensStrength > 0.01) {
            const dx = lensGx - gx;
            const dy = lensGy - gy;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2 * 4) {
              const dist = Math.sqrt(d2) || 1e-4;
              const falloff = Math.exp(-d2 / r2);
              const pull = lensStrength * falloff * LENS_MAX;
              // INWARD: sample coordinate moves toward the lens center, the
              // opposite sign of an outward push — the field contracts here
              sx = gx + (dx / dist) * pull;
              sy = gy + (dy / dist) * pull;
            }
          }
          const v = caustic(sx, sy, t);
          const bucket = Math.min(ALPHA_BUCKETS - 1, Math.floor(v * ALPHA_BUCKETS));
          const ci = Math.floor(v * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci !== 0) bucketLists[bucket]!.push(i);
        }
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        ctx.globalAlpha = 0.1 + (b / (ALPHA_BUCKETS - 1)) * 0.9;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k]!;
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

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const lens = { gx: -1e5, gy: -1e5, has: false, strength: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const target = lens.has ? 1 : 0;
      lens.strength += (target - lens.strength) * Math.min(1, dt / LENS_TAU);
      draw(t, lens.gx, lens.gy, lens.strength);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      lens.gx = (e.clientX - rect.left) / cellW;
      lens.gy = (e.clientY - rect.top) / cellH;
      lens.has = true;
    };
    const onPointerLeave = () => {
      lens.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(t, -1e5, -1e5, 0);
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
        draw(0, -1e5, -1e5, 0);
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
