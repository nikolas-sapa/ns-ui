"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Downpour — a full-bleed ASCII precipitation hero. Unlike a stamped heat grid
// or a sampled scalar field, this is a genuine per-column PARTICLE simulation:
// every column owns one falling "drop" (a float head position in row-units, a
// rows/sec fall speed and a trail length), advancing independently every
// frame and wrapping back above the top once its trail clears the bottom —
// the same treadmill trick a starfield uses, so the loop never resets
// visibly. A column's glyph only gets reassigned the instant the head enters
// a NEW row (not every frame), so a settled trail doesn't flicker; luminance
// is purely a function of distance-from-head, gamma-shaped so the head reads
// bright and the tail fades to ink. The pointer doesn't paint or warp
// individual cells — it drives WIND: a per-column lateral pixel offset,
// gaussian-weighted by horizontal distance to the pointer and gusting on a
// per-column sine so nearby streams bend independently rather than as one
// rigid sheet, with the gust's overall amplitude rising on pointer speed and
// relaxing over ~1s once it stops, so the curtain settles back to falling
// straight down on its own.
// ---------------------------------------------------------------------------

const RAIN_CHARS = "|:.'`,;";
const SPEED_MIN = 9; // rows/s
const SPEED_MAX = 22;
const TRAIL_MIN = 6; // rows
const TRAIL_MAX = 18;
const WIND_RADIUS_COLS = 10; // gaussian falloff sigma, in columns
const WIND_MAX_PX = 14; // max lateral bend at full gust energy
const WIND_GUST_FREQ_MIN = 0.6; // rad/s
const WIND_GUST_FREQ_MAX = 1.4;
const WIND_EASE = 0.1; // per-frame lerp toward target offset
const ENERGY_GAIN = 0.05;
const ENERGY_TAU = 1.0; // s — relaxation time constant
const DT_MAX = 0.05;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DownpourProps {
  /** grid cell size in px */
  cellSize?: number;
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  className?: string;
}

export function Downpour({
  cellSize = 13,
  children,
  className = "",
}: DownpourProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
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

    let headRow = new Float32Array(0);
    let speed = new Float32Array(0);
    let trailLen = new Float32Array(0);
    let lastRow = new Int32Array(0);
    let charBuf = new Uint8Array(0);
    let windOffset = new Float32Array(0);
    let windPhase = new Float32Array(0);
    let windFreq = new Float32Array(0);

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

    const rand = mulberry32(0x5a17a1);

    const seedColumn = (c: number, initial: boolean) => {
      speed[c] = SPEED_MIN + rand() * (SPEED_MAX - SPEED_MIN);
      trailLen[c] = TRAIL_MIN + rand() * (TRAIL_MAX - TRAIL_MIN);
      // stagger restarts: begin above the top by a random multiple of the
      // column's own trail so drops never fall back in visible unison
      headRow[c] = initial
        ? rand() * rows
        : -(rand() * trailLen[c]! * 3);
      lastRow[c] = -1e6;
      windPhase[c] = rand() * Math.PI * 2;
      windFreq[c] = WIND_GUST_FREQ_MIN + rand() * (WIND_GUST_FREQ_MAX - WIND_GUST_FREQ_MIN);
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

      // ceil, not floor — flooring leaves an unpainted strip along the
      // bottom/right edge; the root clips, so overdraw is free.
      cols = Math.max(4, Math.ceil(width / cellW));
      rows = Math.max(4, Math.ceil(height / cellH));

      headRow = new Float32Array(cols);
      speed = new Float32Array(cols);
      trailLen = new Float32Array(cols);
      lastRow = new Int32Array(cols);
      charBuf = new Uint8Array(cols * rows);
      windOffset = new Float32Array(cols);
      windPhase = new Float32Array(cols);
      windFreq = new Float32Array(cols);

      for (let c = 0; c < cols; c++) seedColumn(c, true);
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

    // advance the simulation by dt (no-op for the static reduced-motion frame)
    const step = (dt: number) => {
      for (let c = 0; c < cols; c++) {
        headRow[c]! += speed[c]! * dt;
        if (headRow[c]! - trailLen[c]! > rows) {
          seedColumn(c, false);
          continue;
        }
        const newRow = Math.floor(headRow[c]!);
        if (newRow !== lastRow[c] && newRow >= 0 && newRow < rows) {
          charBuf[newRow * cols + c] = Math.floor(rand() * RAIN_CHARS.length);
          lastRow[c] = newRow;
        }
      }
    };

    const draw = (t: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fg;
      for (let c = 0; c < cols; c++) {
        const head = headRow[c]!;
        const trail = trailLen[c]!;
        const x = c * cellW + cellW / 2 + windOffset[c]!;
        const rFrom = Math.max(0, Math.ceil(head - trail));
        const rTo = Math.min(rows - 1, Math.floor(head));
        for (let r = rFrom; r <= rTo; r++) {
          const dist = head - r;
          const lum = 1 - dist / trail;
          if (lum <= 0.03) continue;
          const alpha = Math.pow(lum, 1.5);
          ctx.globalAlpha = 0.08 + alpha * 0.92;
          const ch = RAIN_CHARS[charBuf[r * cols + c]!] ?? ".";
          ctx.fillText(ch, x, r * cellH + cellH / 2);
        }
      }
      ctx.globalAlpha = 1;
      void t;
    };

    // static reduced-motion frame: fill every column full-height so the
    // silhouette of the effect is legible at rest, no animation, no listeners
    const drawStatic = () => {
      if (!sized) return;
      for (let c = 0; c < cols; c++) {
        headRow[c] = rows - 1;
        trailLen[c] = rows;
        for (let r = 0; r < rows; r++) {
          charBuf[r * cols + c] = Math.floor(rand() * RAIN_CHARS.length);
        }
        windOffset[c] = 0;
      }
      draw(0);
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const pointer = { x: -1e5, y: -1e5, tx: -1e5, ty: -1e5, energy: 0, has: false };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      step(dt);

      pointer.energy *= Math.exp(-dt / ENERGY_TAU);
      const pointerCol = pointer.has ? pointer.x / cellW : -1e5;
      for (let c = 0; c < cols; c++) {
        let target = 0;
        if (pointer.has && pointer.energy > 0.004) {
          const dCols = c - pointerCol;
          const falloff = Math.exp(-(dCols * dCols) / (2 * WIND_RADIUS_COLS * WIND_RADIUS_COLS));
          const gust = Math.sin(t * windFreq[c]! + windPhase[c]!);
          target = falloff * pointer.energy * WIND_MAX_PX * gust;
        }
        windOffset[c]! += (target - windOffset[c]!) * WIND_EASE;
      }

      draw(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (pointer.has) {
        const dx = x - pointer.tx;
        const dy = y - pointer.ty;
        const speedPx = Math.hypot(dx, dy);
        pointer.energy = Math.min(1, pointer.energy + speedPx * ENERGY_GAIN * 0.02);
      }
      pointer.tx = x;
      pointer.ty = y;
      pointer.x = x;
      pointer.y = y;
      pointer.has = true;
    };
    const onPointerLeave = () => {
      pointer.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(t);
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
  }, [cellSize]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate w-full overflow-hidden bg-background font-mono ${
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
