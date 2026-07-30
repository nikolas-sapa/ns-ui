"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GlyphTide — a full-bleed animated ASCII plasma field. Three octaves of
// traveling sine waves (slow isotropic swell, mid-frequency interference
// bands, fast fine ripple) sum into a scalar field, gamma-shaped for tonal
// depth, and mapped through a density ramp to a monospace glyph grid. The
// pointer doesn't paint — it WARPS: at each cell the sample coordinate is
// pushed away from the cursor (falloff by distance, magnitude by a decaying
// "energy" scalar that rises on pointer movement and relaxes over ~1.3s), so
// content from further out gets sampled into the touched cell — the field
// reads as pushed outward, like dragging a finger through liquid, and settles
// back on its own once the cursor stops. Canvas 2D, direct-DOM rAF, no React
// state on the hot path, char+alpha-bucket buffers reused every frame.
// ---------------------------------------------------------------------------

const RAMP = " .'`,:-=+*#%@";
const ALPHA_BUCKETS = 6;
const FIELD_SPEED = 1; // t units / s
const WARP_TAU = 1.3; // s — energy relaxation time constant
const WARP_RADIUS = 9; // grid cells — falloff sigma
const WARP_MAX = 3.2; // grid cells — max sample displacement
const ENERGY_GAIN = 0.09; // energy added per px/frame of pointer speed
const CURSOR_EASE = 0.15; // per-frame lerp toward raw pointer position

function fieldValue(x: number, y: number, t: number): number {
  // octave A — slow, low-frequency isotropic swell (the big drifting bands)
  const a =
    Math.sin(x * 0.045 + t * 0.16) +
    Math.sin(y * 0.05 - t * 0.12) +
    Math.sin((x - y) * 0.03 + t * 0.07);
  // octave B — mid frequency, travels at an angle to A: this is where the
  // two wave sets cross and produce visible interference bands
  const b = Math.sin(x * 0.13 - t * 0.34) + Math.sin(y * 0.11 + t * 0.27);
  // octave C — fast fine ripple, small amplitude, keeps the surface alive
  // up close instead of reading as flat once the eye adapts to A+B
  const c =
    Math.sin(x * 0.29 + y * 0.24 + t * 0.85) +
    Math.sin((x + y) * 0.34 - t * 1.05);
  const v = a * 0.42 + b * 0.34 + c * 0.24;
  return v / 5 + 0.5; // rough-normalize to ~0..1
}

export interface GlyphTideProps {
  /** grid cell size in px */
  cellSize?: number;
  className?: string;
}

export function GlyphTide({ cellSize = 12, className = "" }: GlyphTideProps) {
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
    let charBuf = new Uint8Array(0);
    let bucketBuf = new Uint8Array(0);
    let sized = false;
    let ready = false;
    let disposed = false;
    let raf = 0;
    let last = 0;
    let t = 0;

    const cursor = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, energy: 0 };

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    // measured post-fonts.ready — a fallback-font advance width bakes in the
    // wrong grid ratio otherwise, since GeistMono's metrics differ from the
    // system mono fallback used before the webfont resolves.
    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize; // control the row pitch directly — no inherited line-height
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
      cols = Math.max(1, Math.floor(width / cellW));
      rows = Math.max(1, Math.floor(height / cellH));
      charBuf = new Uint8Array(cols * rows);
      bucketBuf = new Uint8Array(cols * rows);
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
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fg;

      const cgx = cursor.x / cellW;
      const cgy = cursor.y / cellH;
      const r2 = WARP_RADIUS * WARP_RADIUS;
      const energy = cursor.energy;

      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++, i++) {
          let sx = gx;
          let sy = gy;
          if (energy > 0.002) {
            const dx = gx - cgx;
            const dy = gy - cgy;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2 * 6) {
              const falloff = Math.exp(-d2 / r2);
              const push = energy * falloff * WARP_MAX;
              const dist = Math.sqrt(d2) || 1e-4;
              sx = gx + (dx / dist) * push;
              sy = gy + (dy / dist) * push;
            }
          }
          let v = fieldValue(sx, sy, t);
          v = v < 0 ? 0 : v > 1 ? 1 : v;
          const lum = Math.pow(v, 1.6); // gamma: deepens the floor, crests pop
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(lum * ALPHA_BUCKETS)
          );
          const ci = Math.floor(lum * (RAMP.length - 1));
          bucketBuf[i] = bucket;
          charBuf[i] = RAMP[ci] === " " ? 0 : ci;
        }
      }

      // one globalAlpha set per bucket instead of per glyph
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const alpha = 0.18 + (b / (ALPHA_BUCKETS - 1)) * 0.82;
        ctx.globalAlpha = alpha;
        let j = 0;
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++, j++) {
            if (charBuf[j] === 0 || bucketBuf[j] !== b) continue;
            ctx.fillText(
              RAMP[charBuf[j]],
              gx * cellW + cellW / 2,
              gy * cellH + cellH / 2
            );
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt * FIELD_SPEED;
      cursor.x += (cursor.tx - cursor.x) * CURSOR_EASE;
      cursor.y += (cursor.ty - cursor.y) * CURSOR_EASE;
      cursor.energy *= Math.exp(-dt / WARP_TAU);
      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = e.clientX - rect.left;
      const ny = e.clientY - rect.top;
      if (cursor.tx > -1e4) {
        const dx = nx - cursor.tx;
        const dy = ny - cursor.ty;
        const speed = Math.hypot(dx, dy);
        cursor.energy = Math.min(1, cursor.energy + speed * ENERGY_GAIN * 0.02);
      }
      cursor.tx = nx;
      cursor.ty = ny;
    };
    const onLeave = () => {
      cursor.tx = -1e5;
      cursor.ty = -1e5;
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

    // rasterize only once the mono webfont is loaded — a fallback-font
    // measurement would bake in the wrong cell aspect ratio
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
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
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
