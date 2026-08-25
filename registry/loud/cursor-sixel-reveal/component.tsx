"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// SixelReveal — literalizes the real sixel/kitty-graphics-protocol-vs-ASCII-
// fallback split from terminal graphics: ONE shared scalar field (the same
// three-octave value-noise recipe as background-ascii-plasma), rendered
// TWICE. Everywhere: quantized to glyphs through a density ramp, the ASCII
// fallback a terminal without true graphics support draws. Inside a soft
// circular window: the SAME field redrawn at native backing-pixel
// resolution as a direct grayscale raster, no glyph quantization — what a
// sixel/kitty-capable terminal would actually show. The window doesn't sit
// still: it idles along an incommensurate Lissajous sweep and eases toward
// the pointer on hover, so the boundary between the two renderings is on
// permanent display, not something you have to move the mouse to notice.
//
// Every frame paints an opaque --background fill across the FULL backing
// rect before either pass. The glyph pass composites --foreground glyphs at
// varying alpha over that fill; the raster pass is a literal per-pixel lerp
// between --background and --foreground. Both passes only agree in both
// themes if they share that same base fill — skipping it lets the DOM
// behind the canvas leak through as a theme-dependent seam.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;
const FIELD_SPEED = 1; // t units / s
const FEATHER = 3; // px — glyph<->raster crossfade band width, r to r+3
const WINDOW_EASE = 0.15; // per-frame lerp toward the active target

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

function parseColor(raw: string): [number, number, number] | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export interface SixelRevealProps {
  /** grid cell size in px */
  cellSize?: number;
  /** radius of the raw-pixel raster window, in px */
  windowRadius?: number;
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SixelReveal({
  cellSize = 13,
  windowRadius = 90,
  children,
  className = "",
}: SixelRevealProps) {
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

    // placeholder values only — draw() never runs before readTokens() has
    // assigned the real getComputedStyle-derived values (see the `ready`
    // guard on the ResizeObserver callback below), so these are never
    // painted; kept token-neutral rather than a literal to match house
    // convention (background-ascii-plasma, hero-ascii-eclipse).
    let bgStr = "currentColor";
    let fgStr = "currentColor";
    let mutedStr = "currentColor";
    let bgRGB: [number, number, number] = [0, 0, 0];
    let fgRGB: [number, number, number] = [255, 255, 255];

    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    // per-bucket lists of lit cell indices outside the window, rebuilt each
    // frame in pass 1 and walked once each in pass 2 (same discipline as
    // background-ascii-plasma's bucketed draw)
    const bucketLists: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);
    let charBuf = new Uint8Array(0);

    // reusable offscreen raster canvas for the window's native-pixel pass
    const rasterCanvas = document.createElement("canvas");
    const rasterCtx = rasterCanvas.getContext("2d", { willReadFrequently: false });
    let rasterImage: ImageData | null = null;
    let rasterSideBacking = 0;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bgStr = cs.getPropertyValue("--background").trim() || bgStr;
      fgStr = cs.getPropertyValue("--foreground").trim() || fgStr;
      mutedStr = cs.getPropertyValue("--ns-muted").trim() || mutedStr;
      bgRGB = parseColor(bgStr) ?? bgRGB;
      fgRGB = parseColor(fgStr) ?? fgRGB;
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
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.max(1, Math.ceil(width / cellW));
      rows = Math.max(1, Math.ceil(height / cellH));
      charBuf = new Uint8Array(cols * rows);
      sized = true;
    };

    let ro: ResizeObserver | null = null;

    // -- window position: idle Lissajous, overridden by pointer ------------
    const win = { x: 0, y: 0 };
    const pointer = { has: false, x: 0, y: 0 };

    const lissajousAt = (t: number) => {
      const w = cols * cellW;
      const h = rows * cellH;
      const cx = w / 2;
      const cy = h / 2;
      return {
        x: cx + 0.18 * w * Math.sin(0.07 * t),
        y: cy + 0.14 * h * Math.sin(0.11 * t + 1.3),
      };
    };

    const ensureRasterBuffer = (sideBacking: number) => {
      if (sideBacking === rasterSideBacking && rasterImage) return;
      rasterSideBacking = sideBacking;
      rasterCanvas.width = sideBacking;
      rasterCanvas.height = sideBacking;
      rasterImage = rasterCtx
        ? new ImageData(sideBacking, sideBacking)
        : null;
    };

    const draw = (t: number, winX: number, winY: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;

      // paint the FULL backing rect with --background, every frame, in raw
      // backing-pixel space (bypassing the dpr-scaled transform) so the
      // glyph alpha-composite and the raster lerp share one base color in
      // both themes regardless of what sits behind the canvas in the DOM.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bgStr;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const r2 = windowRadius * windowRadius;
      const rf = windowRadius + FEATHER;
      const rf2 = rf * rf;

      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b].length = 0;
      const windowed: number[] = [];

      // -- pass 1a: classify every cell, bucket the ones outside the window
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const py = gy * cellH + cellH / 2;
        for (let gx = 0; gx < cols; gx++, i++) {
          const v = fieldValue(gx, gy, t);
          const lum = Math.pow(Math.min(1, Math.max(0, v)), 1.6);
          const ci = Math.floor(lum * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci === 0) continue;

          const px = gx * cellW + cellW / 2;
          const dx = px - winX;
          const dy = py - winY;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) continue; // fully inside — the raster pass owns it
          if (d2 <= rf2) {
            windowed.push(i); // feather band — drawn individually below
            continue;
          }
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(lum * ALPHA_BUCKETS)
          );
          bucketLists[bucket].push(i);
        }
      }

      // -- pass 1b: bulk glyph draw, one globalAlpha set per bucket -------
      ctx.fillStyle = fgStr;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b];
        ctx.globalAlpha = 0.18 + (b / (ALPHA_BUCKETS - 1)) * 0.82;
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

      // -- pass 1c: feather-band cells, alpha ramps 0 (at r) -> 1 (at r+FEATHER)
      for (let k = 0; k < windowed.length; k++) {
        const idx = windowed[k]!;
        const gx = idx % cols;
        const gy = (idx - gx) / cols;
        const px = gx * cellW + cellW / 2;
        const py = gy * cellH + cellH / 2;
        const d = Math.hypot(px - winX, py - winY);
        const s = Math.min(1, Math.max(0, (d - windowRadius) / FEATHER));
        const lum = Math.pow(charBuf[idx]! / (RAMP.length - 1), 1 / 1.6);
        const bucketAlpha = 0.18 + Math.min(1, lum) * 0.82;
        ctx.globalAlpha = bucketAlpha * s;
        ctx.fillText(RAMP[charBuf[idx]!]!, px, py);
      }
      ctx.globalAlpha = 1;

      // -- pass 2: true raw-pixel raster inside the window, native res ----
      const sideCss = 2 * rf;
      const sideBacking = Math.max(2, Math.ceil(sideCss * dpr));
      if (rasterCtx) {
        ensureRasterBuffer(sideBacking);
        if (rasterImage) {
          const data = rasterImage.data;
          const half = sideBacking / 2;
          let p = 0;
          for (let by = 0; by < sideBacking; by++) {
            const oy = by - half;
            for (let bx = 0; bx < sideBacking; bx++, p += 4) {
              const ox = bx - half;
              const dCss = Math.hypot(ox, oy) / dpr;
              if (dCss > rf) {
                data[p + 3] = 0;
                continue;
              }
              const fieldX = (winX + ox / dpr) / cellW;
              const fieldY = (winY + oy / dpr) / cellH;
              const v = fieldValue(fieldX, fieldY, t);
              const lum = Math.pow(Math.min(1, Math.max(0, v)), 1.6);
              data[p] = bgRGB[0] + (fgRGB[0] - bgRGB[0]) * lum;
              data[p + 1] = bgRGB[1] + (fgRGB[1] - bgRGB[1]) * lum;
              data[p + 2] = bgRGB[2] + (fgRGB[2] - bgRGB[2]) * lum;
              const alpha = dCss <= windowRadius
                ? 1
                : 1 - (dCss - windowRadius) / FEATHER;
              data[p + 3] = Math.max(0, Math.min(1, alpha)) * 255;
            }
          }
          rasterCtx.putImageData(rasterImage, 0, 0);
          ctx.drawImage(
            rasterCanvas,
            winX - sideCss / 2,
            winY - sideCss / 2,
            sideCss,
            sideCss
          );
        }
      }

      // -- optional 1px ring tracing the crisp inner window edge ----------
      // --border is a separator token (near-zero contrast against
      // --background in light theme) and would be invisible here; --ns-muted
      // sits strictly between --background and --foreground in both themes,
      // so a hairline ring in --ns-muted reads as an object in both.
      ctx.beginPath();
      ctx.arc(winX, winY, windowRadius, 0, Math.PI * 2);
      ctx.strokeStyle = mutedStr;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt * FIELD_SPEED;

      const target = pointer.has ? pointer : lissajousAt(t);
      win.x += (target.x - win.x) * WINDOW_EASE;
      win.y += (target.y - win.y) * WINDOW_EASE;

      draw(t, win.x, win.y);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
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
      if (reduced) {
        const p = lissajousAt(0);
        draw(0, p.x, p.y);
      }
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
      const p = lissajousAt(0);
      win.x = p.x;
      win.y = p.y;
      if (reduced) {
        draw(0, p.x, p.y);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    ro = new ResizeObserver(() => {
      resize();
      // guard on `ready`: a resize can fire before document.fonts.ready
      // resolves, and draw() must never run before readTokens() has
      // assigned real getComputedStyle values.
      if (reduced && ready) {
        const p = lissajousAt(0);
        draw(0, p.x, p.y);
      }
    });
    ro.observe(canvas);

    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, windowRadius]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
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
