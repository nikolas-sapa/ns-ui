"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Mezzotint — a small ambient icon for empty states, built on the real
// intaglio printmaking process of the same name. A mezzotint plate is first
// "rocked" all over with a toothed rocker until it would print solid black,
// then the image is made SUBTRACTIVELY: the printmaker scrapes and burnishes
// the burr smooth wherever light is wanted, working from dark to light. That
// inversion is the entire point of this component — every other glyph
// component in this registry builds density UP from an empty grid; this one
// starts near-solid ink and takes it away. It is the registry's only
// subtractive glyph mechanic.
//
// Two fields drive every cell, both in grid-cell space so they read
// correctly at any cellSize:
//
// 1. A slow, low-frequency scrape boundary (three summed sine terms, same
//    family as the registry's plasma/flow fields but run an order of
//    magnitude slower) that decides how much of the original burr survives
//    at that cell — 0 once well inside the scraped/burnished region, ramping
//    up over a soft edge (a burnisher doesn't leave a hard vector line, it
//    leaves a graded tone) to full burr density deep in the untouched
//    corner. Calibrated so roughly a quarter to a third of the grid ever
//    carries any ink at rest — the scraped, light region dominates, the
//    surviving burr is a minority, never a full-frame black slab.
// 2. A per-cell grain hash (classic sin-dot-hash pseudo-random, seeded by
//    grid position and a slowly-stepping time bucket, crossfaded between
//    consecutive buckets by smoothstep) standing in for the toothed rocker's
//    texture: within the surviving-burr region, ink density trembles cell by
//    cell a few times a second, as if the rocker were still working the
//    plate. This is what keeps the icon alive at rest without the scrape
//    boundary itself needing to move far.
//
// Rendering is a two-pass crossfade, same idiom as empty-state-braille-orbit:
// a --ns-muted base at fixed alpha under every surviving-burr cell (the
// lower-contrast bulk of the burr), then a --foreground overlay at alpha
// equal to that cell's live density (the deepest, most-recently-rocked
// ink). Scraped cells get no fill at all — the empty canvas background IS
// the scraped plate, exactly as it is in the real process.
// ---------------------------------------------------------------------------

const RAMP = " .'`,:-=+*#%@";
const FIELD_SPEED = 1; // t units / s, drives the slow scrape-boundary drift
const GRAIN_HZ = 3; // grain re-hash rate, Hz — the rocker's tremble cadence
const BURR_START = 0.704; // scrape-field value above which any burr survives
const BURR_EDGE = 0.12; // soft-edge width from bare survival to full density
const GRAIN_FLOOR = 0.3; // min density fraction inside surviving burr
const GRAIN_SPAN = 0.7; // remaining density range driven by the grain hash
const DT_MAX = 0.05;
const STATIC_TIME = 8; // reduced-motion freeze — see component doc below

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smoothstep(f: number): number {
  return f * f * (3 - 2 * f);
}

// deterministic per-cell pseudo-random in [0,1), classic sin-dot-hash —
// cheap, no lookup table, stable across the same (gx, gy, seed) triple.
function hash01(gx: number, gy: number, seed: number): number {
  const s = Math.sin(gx * 127.1 + gy * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

// scrape-field value at a cell: three slow sine terms, same family as the
// registry's plasma/flow fields but run roughly 3-5x slower — the plate is
// still being worked, but the boundary itself wanders gradually, not
// urgently. Range is a soft bell centered near 0.5, not a hard 0..1 uniform.
function scrapeField(gx: number, gy: number, t: number): number {
  const a =
    Math.sin(gx * 0.09 + t * 0.045) +
    Math.sin(gy * 0.11 - t * 0.035) +
    Math.sin((gx - gy) * 0.07 + t * 0.02);
  return a / 3 + 0.5;
}

// final 0..1 ink density at a cell: burrAmt (how much of the original burr
// survives here, from the scrape field) times a trembling grain fraction —
// zero outside the surviving-burr region, textured and lively within it.
function fieldValue(gx: number, gy: number, t: number): number {
  const n = scrapeField(gx, gy, t);
  const burrAmt = clamp01((n - BURR_START) / BURR_EDGE);
  if (burrAmt <= 0) return 0;
  const tg = t * GRAIN_HZ;
  const i0 = Math.floor(tg);
  const f = tg - i0;
  const sf = smoothstep(f);
  const h0 = hash01(gx, gy, i0);
  const h1 = hash01(gx, gy, i0 + 1);
  const grain = h0 + (h1 - h0) * sf;
  return clamp01(burrAmt * (GRAIN_FLOOR + GRAIN_SPAN * grain));
}

export interface MezzotintProps {
  /** glyph cell size in px */
  cellSize?: number;
  /** icon box size in px (square) */
  size?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function Mezzotint({ cellSize = 14, size = 140, className = "" }: MezzotintProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let sized = false;
    let ready = false;
    let disposed = false;

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      fg = s.getPropertyValue("--foreground").trim() || "currentColor";
      muted = s.getPropertyValue("--ns-muted").trim() || fg;
    };

    // measured post-fonts.ready — a fallback-font advance width bakes in the
    // wrong grid ratio otherwise.
    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
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
      cols = Math.max(4, Math.round(width / cellW));
      rows = Math.max(4, Math.round(height / cellH));
      sized = true;
    };

    const draw = (t: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      // pass 1 — muted base: the lower-contrast bulk of the surviving burr
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.55;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const v = fieldValue(gx, gy, t);
          const idx = Math.floor(v * (RAMP.length - 1));
          if (idx <= 0) continue;
          ctx.fillText(RAMP[idx]!, gx * cellW + cellW / 2, gy * cellH + cellH / 2);
        }
      }

      // pass 2 — foreground overlay: the deepest, freshest-rocked ink,
      // crossfaded in by each cell's own live density
      ctx.fillStyle = fg;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const v = fieldValue(gx, gy, t);
          const idx = Math.floor(v * (RAMP.length - 1));
          if (idx <= 0) continue;
          ctx.globalAlpha = v;
          ctx.fillText(RAMP[idx]!, gx * cellW + cellW / 2, gy * cellH + cellH / 2);
        }
      }
      ctx.globalAlpha = 1;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(STATIC_TIME);
      }, 150);
    };

    let raf = 0;
    let last = 0;
    let t = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt * FIELD_SPEED;
      draw(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(STATIC_TIME);
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
        // Reduced motion freezes on STATIC_TIME = 8s of simulated drift, not
        // t=0: at t=0 the scrape boundary sits closer to its long-run mean
        // and the surviving burr region is comparatively thin (~23% of
        // cells lit vs ~35% at t=8), so t=0 under-shows the mechanic. t=8
        // lands on a wider, still soft-edged burr region with clearly mixed
        // muted/foreground tone — the most legible single scrape/burr frame
        // in the field's slow cycle. No ring buffer, no rAF once frozen.
        draw(STATIC_TIME);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`block font-mono ${className}`}
    />
  );
}
