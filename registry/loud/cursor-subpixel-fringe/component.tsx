"use client";

import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// SubpixelFringe — sourced from real LCD subpixel rendering (ClearType and
// its relatives): an LCD pixel is physically three vertical stripes, and
// subpixel antialiasing exploits that by addressing each stripe
// independently for ~3x the effective horizontal resolution. This field
// takes that geometry literally: every grid cell carries three thin
// vertical luminance slivers standing in for the three stripes. Near the
// cursor (or the idle sweep target when nothing is pointing at it) the
// three slivers of a cell splay apart and diverge in value, as if a
// renderer were locally re-hinting glyphs to the pixel grid right there.
//
// Distinct from this registry's other sub-cell mechanics: hero-404-
// quadrant-occlusion addresses a cell as a 2x2 block, and empty-state-
// braille-orbit / loader-braille address it as a 2x4 dot grid — both are
// grids of discrete POINTS. This is three parallel VERTICAL STRIPS, the
// one-dimensional stripe geometry unique to LCD hardware, not glyph
// hinting or printmaking.
//
// Adaptation, stated plainly: real subpixel rendering produces COLOUR
// fringes (a stripe reads red, green or blue). This registry is strictly
// monochrome, so the fringe here is a VALUE fringe only — the three
// slivers of a cell differ in luminance, never hue. This is a deliberate
// substitution, not a fidelity claim.
//
// Every frame paints an opaque --background fill across the full backing
// rect before drawing slivers, so the --foreground alpha composite reads
// identically regardless of what sits behind the canvas in the DOM.
// ---------------------------------------------------------------------------

const FIELD_SPEED = 1; // t units / s
const SPLAY_EASE = 0.15; // per-frame lerp toward the active influence target
// reduced-motion freeze frame: t where the idle Lissajous's x-term
// (sin(0.065t)) sits at its +1 amplitude extreme — a genuine characteristic
// excursion, not an arbitrary mid-sweep guess (solve 0.065t = pi/2).
const STATIC_TIME = Math.PI / 2 / 0.065;

function fieldValue(gx: number, gy: number, t: number): number {
  // three summed octaves in GRID-CELL units (not pixels), same house shape
  // and frequencies as background-ascii-plasma / cursor-sixel-reveal (slow
  // isotropic swell + angled mid-frequency cross ~2.5x A's frequency +
  // fast fine ripple) — sampling in cell space keeps the field's character
  // identical regardless of how big a cell renders on screen; sampling in
  // pixel space would fold octave B/C past Nyquist per cell and turn the
  // field into per-cell hash the moment cellPx changed.
  // spatial constants are ~2.5x background-ascii-plasma's pixel-space ones:
  // this field is sampled once per CELL rather than once every ~13px, so
  // it needs a proportionally higher grid-cell frequency to still cross
  // several periods of octave A across a typical cell count (~60-100
  // cols) instead of reading as a near-DC wash across the whole grid.
  const a =
    Math.sin(gx * 0.12 + t * 0.15) +
    Math.sin(gy * 0.13 - t * 0.11) +
    Math.sin((gx + gy) * 0.075 + t * 0.07);
  const b = Math.sin(gx * 0.3 - t * 0.3) + Math.sin(gy * 0.25 + t * 0.25);
  const c =
    Math.sin(gx * 0.7 + gy * 0.55 + t * 0.9) +
    Math.sin((gx - gy) * 0.8 - t * 1.05);
  const v = a * 0.42 + b * 0.34 + c * 0.24;
  return v / 5 + 0.5; // rough-normalize to ~0..1 around a nominal 0.5 — the
  // ACTUAL per-frame mean still drifts with the slow octave (the field's
  // "bands"), which is why draw() re-derives exposure from this frame's
  // real mean rather than assuming 0.5
}

export interface SubpixelFringeProps {
  /** upper bound on grid cell size in px — shrinks below this for small containers so the stripe grid stays fine, never coarse */
  cellSize?: number;
  /** px radius of cursor/idle influence that splays and darkens a cell's three slivers */
  influenceRadius?: number;
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SubpixelFringe({
  cellSize = 20,
  influenceRadius = 130,
  children,
  className = "",
}: SubpixelFringeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // placeholder only — never painted, draw() is gated behind `ready`,
    // which flips true only after readTokens() has run once
    let bgStr = "currentColor";
    let fgStr = "currentColor";

    let cellPx = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;

    // per-cell base/slope buffers — allocated once per resize, overwritten
    // every frame in pass 1 of draw() (same discipline as background-
    // ascii-plasma's Uint8Arrays), never reallocated on the hot path
    let baseBuf = new Float32Array(0);
    let slopeBuf = new Float32Array(0);

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bgStr = cs.getPropertyValue("--background").trim() || bgStr;
      fgStr = cs.getPropertyValue("--foreground").trim() || fgStr;
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

      // scale proportional to the container's SMALLER dimension, clamped,
      // so the stripe grid stays fine in a small preview card instead of
      // collapsing into a handful of coarse stripes
      const minDim = Math.min(width, height);
      cellPx = Math.max(8, Math.min(cellSize, minDim / 34));

      cols = Math.max(1, Math.ceil(width / cellPx));
      rows = Math.max(1, Math.ceil(height / cellPx));
      baseBuf = new Float32Array(cols * rows);
      slopeBuf = new Float32Array(cols * rows);
      sized = true;
    };

    let ro: ResizeObserver | null = null;

    // -- influence target: idle Lissajous, overridden by pointer -----------
    const target = { x: 0, y: 0 };
    const pointer = { has: false, x: 0, y: 0 };

    const lissajousAt = (t: number) => {
      const w = cols * cellPx;
      const h = rows * cellPx;
      const cx = w / 2;
      const cy = h / 2;
      return {
        x: cx + 0.2 * w * Math.sin(0.065 * t),
        y: cy + 0.16 * h * Math.sin(0.09 * t + 0.9),
      };
    };

    const draw = (t: number, tx: number, ty: number) => {
      if (!sized) return;

      // paint the full backing rect with --background, in raw backing-pixel
      // space, before any sliver is drawn — the sliver alpha-composite must
      // agree with the token in both themes, not with whatever sits behind
      // the canvas in the DOM.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = bgStr;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const r2 = influenceRadius * influenceRadius;
      // sliver width and lane spacing are tuned so the gap WITHIN a triad
      // and the gutter BETWEEN triads are comparable (~1.4:1) — a wider
      // intra-gap than gutter (the naive cellPx/3 split) antialiases into
      // one solid bar per cell at small sizes/DPR and the stripe triad
      // stops reading as three stripes at all
      const sliverW = cellPx / 6;
      const sliverH = cellPx * 0.82;
      const baseGap = cellPx / 3.2; // resting sliver-to-sliver spacing
      // a lane can never carry the cell's stripe outside the cell's own
      // footprint — three splayed slivers of ONE pixel, never bleeding
      // into the neighbour's
      const maxGap = cellPx / 2 - sliverW / 2;
      const EXPOSURE = 0.5; // mid-grey pivot the frame is re-centered on, see pass 1 (raised from 0.45: narrower slivers mean lower ink coverage overall, needs re-centering)
      const CONTRAST = 2.4; // stretches the field's per-frame std toward the 0..1 ends so cells reach near-empty / near-full, not uniform mid-grey
      const FRINGE_GAIN = 7; // resting lane-value fringe strength (ambient shimmer everywhere)
      const FRINGE_GAIN_NEAR = 22; // additional gain applied at full cursor/idle-target influence

      // -- pass 1: sample base value + local horizontal slope per cell,
      // accumulate the frame's mean. The slow octave drifts this mean over
      // time (that's the "big drifting bands"), so a fixed 0.5 pivot
      // saturates roughly half the field to solid ink whenever the bands
      // sit off-center — re-deriving exposure from THIS frame's real mean
      // keeps every cell's lane modulation visible regardless of where the
      // bands currently sit.
      let sum = 0;
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++, i++) {
          const v = fieldValue(gx, gy, t);
          baseBuf[i] = v;
          slopeBuf[i] = fieldValue(gx + 0.5, gy, t) - fieldValue(gx - 0.5, gy, t);
          sum += v;
        }
      }
      const mean = sum / (cols * rows);

      ctx.fillStyle = fgStr;

      // -- pass 2: draw. Each lane's luminance is the cell's mean-pivoted
      // value plus lane_index times the local slope times a gain — real
      // subpixel AA fringes appear where coverage is CHANGING across a
      // pixel, not uniformly, so flat stretches of the field read as three
      // near-equal slivers and only the drifting field's edges fringe.
      i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const cy = gy * cellPx + cellPx / 2;
        for (let gx = 0; gx < cols; gx++, i++) {
          const cx = gx * cellPx + cellPx / 2;

          const dx = cx - tx;
          const dy = cy - ty;
          const d2 = dx * dx + dy * dy;
          const influence = d2 >= r2 ? 0 : Math.pow(1 - Math.sqrt(d2) / influenceRadius, 2);

          const gap = Math.min(baseGap * (1 + influence * 1.6), maxGap);
          const gain = FRINGE_GAIN + influence * FRINGE_GAIN_NEAR;
          const stretched = EXPOSURE + (baseBuf[i]! - mean) * CONTRAST;
          const slope = slopeBuf[i]!;

          for (let s = 0; s < 3; s++) {
            const lane = s - 1; // -1, 0, 1
            const v = stretched + lane * slope * gain;
            const lum = Math.pow(Math.min(1, Math.max(0, v)), 1.4);
            const drawX = cx + lane * gap;
            ctx.globalAlpha = lum;
            ctx.fillRect(
              drawX - sliverW / 2,
              cy - sliverH / 2,
              sliverW,
              sliverH
            );
          }
        }
      }
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

      const active = pointer.has ? pointer : lissajousAt(t);
      target.x += (active.x - target.x) * SPLAY_EASE;
      target.y += (active.y - target.y) * SPLAY_EASE;

      draw(t, target.x, target.y);
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
      if (reduced && ready) {
        const p = lissajousAt(STATIC_TIME);
        draw(STATIC_TIME, p.x, p.y);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    readTokens();
    resize();
    ready = true;
    if (reduced) {
      const p = lissajousAt(STATIC_TIME);
      draw(STATIC_TIME, p.x, p.y);
    } else {
      const p = lissajousAt(0);
      target.x = p.x;
      target.y = p.y;
      raf = requestAnimationFrame(loop);
    }

    ro = new ResizeObserver(() => {
      resize();
      // guard on `ready`: a resize observer can in principle fire before
      // the initial readTokens()/resize() pass above has run — draw() must
      // never run before bgStr/fgStr hold real getComputedStyle values.
      if (reduced && ready) {
        const p = lissajousAt(STATIC_TIME);
        draw(STATIC_TIME, p.x, p.y);
      }
    });
    ro.observe(canvas);

    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, influenceRadius]);

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
        className="pointer-events-none absolute inset-0 block h-full w-full text-foreground"
      />
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
