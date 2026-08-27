"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// GravureCellWipe — a divider / texture strip driven by rotogravure cylinder
// engraving and doctor-blade ink metering, the standard packaging/publication
// print process. An engraved cylinder carries a matrix of ink-retaining cells
// whose DEPTH sets tonal value (deeper cell, more ink, darker print). Every
// rotation the cylinder floods with ink, then a steel doctor blade wipes the
// land area clean, leaving ink only inside the cells.
//
// Cell depth comes from a single low-frequency value-noise field, generated
// ONCE per grid size from a FIXED seed — the engraving never changes shape
// even when a theme flip forces a re-derive of colour tokens, only the wipe
// cycle moves.
//
// The doctor blade is a vertical band (BLADE_WIDTH_CELLS wide) sweeping
// left-to-right and wrapping at the grid edge — the cylinder is
// circumferential, column W-1 is adjacent to column 0 — completing one full
// rotation every ROTATION_S seconds. Because the ink pan floods a different
// angular position on the cylinder than the blade wipes, at any instant the
// grid is genuinely split into three regions measured by `behind`, the
// wrap-safe cell-count since the blade's leading edge reached a column:
//   - `behind < BLADE_WIDTH_CELLS`      — currently under the blade: RAW
//     ink (undamped, theme-aware multiplier) plus a small per-cell flicker
//     standing in for ink still wet from the flood pass.
//   - `BLADE_WIDTH_CELLS <= behind <= FLOOD_OFFSET_FRAC * cols` — already
//     wiped this rotation: settled steady state (depth * cap, cap = 0.85
//     dark / 0.7 light) plus a decaying +0.12 luminance boost (tau 900ms)
//     for the freshly-wiped brightening that trails every pass.
//   - beyond that — re-flooded ahead of the blade's next pass: RAW again.
// The settled/raw boundary opposite the blade translates smoothly with
// rotation (never a hard once-per-cycle reset), so at any moment roughly
// half the strip reads unwiped-dense and half reads settled — exactly the
// simultaneous "ahead vs behind" picture the resting loop and the reduced-
// motion freeze frame (blade at 50% across the grid) both depend on.
//
// Pointer proximity (within 3 cell-pitches) nudges the LOCAL displayed depth
// +0.15 — a "peek" at more ink under the cursor — decaying linearly over
// 600ms once the pointer leaves the canvas. Luminance-only: it modulates the
// same --foreground alpha everything else uses, never --ns-accent, and
// leaves nothing behind once it decays to zero.
//
// Rendering is bucketed, not per-cell: alpha is quantized into ALPHA_BUCKETS
// levels and every cell's arc is appended to that bucket's Path2D, so a
// frame costs one fill() per occupied bucket (~24 max) instead of one per
// cell.
// ---------------------------------------------------------------------------

export interface GravureCellWipeProps {
  /** strip height in px; short axis geometry (cell pitch) derives from this */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// wrap-safe positive modulo
function wrapMod(a: number, m: number): number {
  return ((a % m) + m) % m;
}

const ROTATION_S = 20; // one full wipe pass (18deg/s equivalent)
const BLADE_WIDTH_CELLS = 3;
const FLOOD_OFFSET_FRAC = 0.5; // ink pan sits opposite the blade on the cylinder
const CELL_RADIUS_FACTOR = 0.75; // of pitch — leaves visible land/gutter
const CAP_DARK = 0.85;
const CAP_LIGHT = 0.7;
const RAW_MUL_DARK = 1;
const RAW_MUL_LIGHT = 0.85; // undamped ink over half the strip is too heavy at 1.0 in light theme
const WIPE_BOOST = 0.12;
const WIPE_BOOST_TAU_S = 0.9;
const PEEK_RADIUS_CELLS = 3;
const PEEK_DEPTH_BOOST = 0.15;
const PEEK_DECAY_MS = 600;
const NOISE_RES_DIVISOR = 6; // coarse noise-lattice cell spans this many grid cells
const NOISE_SEED = 0x6b7a11e; // fixed — the engraving must not reshuffle on theme flips
const FLICKER_AMP = 0.05; // raw-region "unsettled wet ink" wobble
const ALPHA_BUCKETS = 24;

// reduced-motion freeze: blade at 50% across the grid — the one frame that
// shows both the unwiped field ahead and the wiped/settled field behind at
// once
const FREEZE_PHASE = 0.5;

export function GravureCellWipe({ height = 192, className = "", style }: GravureCellWipeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived ink: no paint before the first successful read --
    let fg: RGB | null = null;
    let dark = true;
    const derive = () => {
      dark = document.documentElement.classList.contains("dark");
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitch = 8;
    let cols = 0;
    let rows = 0;
    let depth = new Float32Array(0); // static engraving, rebuilt only on resize
    let raf = 0;
    let visible = true;

    // pointer "peek" state — canvas-local coords, frozen at the moment the
    // pointer leaves so the decay has something to fade from
    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;
    let leaveAt = 0;
    let peekTailRaf = 0;

    // -- low-frequency value noise: bilinear lattice built once per grid
    // size from a FIXED seed, never regenerated per frame and never
    // reshuffled by a colour re-derive. -----------------------------------
    const buildDepth = () => {
      const rand = mulberry32(NOISE_SEED);
      const latCols = Math.max(2, Math.ceil(cols / NOISE_RES_DIVISOR) + 1);
      const latRows = Math.max(2, Math.ceil(rows / NOISE_RES_DIVISOR) + 1);
      const lattice = new Float32Array(latCols * latRows);
      for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
      depth = new Float32Array(cols * rows);
      for (let ry = 0; ry < rows; ry++) {
        const ly = ry / NOISE_RES_DIVISOR;
        const y0 = Math.min(latRows - 2, Math.floor(ly));
        const fy = ly - y0;
        for (let rx = 0; rx < cols; rx++) {
          const lx = rx / NOISE_RES_DIVISOR;
          const x0 = Math.min(latCols - 2, Math.floor(lx));
          const fx = lx - x0;
          const v00 = lattice[y0 * latCols + x0] ?? 0;
          const v10 = lattice[y0 * latCols + x0 + 1] ?? 0;
          const v01 = lattice[(y0 + 1) * latCols + x0] ?? 0;
          const v11 = lattice[(y0 + 1) * latCols + x0 + 1] ?? 0;
          const top = v00 + (v10 - v00) * fx;
          const bot = v01 + (v11 - v01) * fx;
          depth[ry * cols + rx] = top + (bot - top) * fy;
        }
      }
    };

    const draw = (now: number) => {
      if (!fg || w <= 0 || h <= 0 || cols <= 0 || rows <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = reduced ? FREEZE_PHASE * ROTATION_S : now / 1000;
      const cap = dark ? CAP_DARK : CAP_LIGHT;
      const rawMul = dark ? RAW_MUL_DARK : RAW_MUL_LIGHT;
      const dwell = (BLADE_WIDTH_CELLS / cols) * ROTATION_S;
      const bandLead = wrapMod((t / ROTATION_S) * cols, cols);
      const floodBoundaryCells = FLOOD_OFFSET_FRAC * cols;

      // peek: distance-based falloff live while the pointer is present,
      // frozen position + linear decay for 600ms after it leaves
      let peekActive = pointerActive;
      let peekFrac = 1;
      if (!pointerActive && leaveAt > 0) {
        const sinceLeave = now - leaveAt;
        if (sinceLeave >= 0 && sinceLeave < PEEK_DECAY_MS) {
          peekActive = true;
          peekFrac = Math.min(1, Math.max(0, 1 - sinceLeave / PEEK_DECAY_MS));
        }
      }
      const peekRadiusPx = PEEK_RADIUS_CELLS * pitch;

      const r = pitch * CELL_RADIUS_FACTOR * 0.5;
      const buckets: (Path2D | null)[] = new Array(ALPHA_BUCKETS + 1).fill(null);

      for (let ry = 0; ry < rows; ry++) {
        const cy = ry * pitch + pitch / 2;
        for (let rx = 0; rx < cols; rx++) {
          const cx = rx * pitch + pitch / 2;
          let d = depth[ry * cols + rx] ?? 0;

          if (peekActive) {
            const dx = cx - pointerX;
            const dy = cy - pointerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < peekRadiusPx) {
              const falloff = 1 - smoothstep(0, peekRadiusPx, dist);
              d = Math.min(1, d + PEEK_DEPTH_BOOST * falloff * peekFrac);
            }
          }

          // wrap-safe cell count since the blade's leading edge passed here
          const behind = wrapMod(bandLead - rx, cols);
          let alpha: number;
          if (behind < BLADE_WIDTH_CELLS) {
            // under the blade right now — raw, unsettled
            const flicker = Math.sin(rx * 12.9898 + ry * 78.233 + t * 9) * 0.5 * FLICKER_AMP;
            alpha = Math.min(1, Math.max(0, d * rawMul + flicker));
          } else if (behind <= floodBoundaryCells) {
            // wiped this rotation — settled, with a decaying just-wiped flash
            const sinceWipeS = ((behind - BLADE_WIDTH_CELLS) / cols) * ROTATION_S;
            const boost = WIPE_BOOST * Math.exp(-sinceWipeS / WIPE_BOOST_TAU_S);
            alpha = Math.min(1, d * cap + boost);
          } else {
            // re-flooded ahead of the blade's next pass — raw again
            const flicker = Math.sin(rx * 12.9898 + ry * 78.233 + t * 9) * 0.5 * FLICKER_AMP;
            alpha = Math.min(1, Math.max(0, d * rawMul + flicker));
          }
          if (alpha <= 0.008) continue;

          const bi = Math.min(ALPHA_BUCKETS, Math.max(1, Math.round(alpha * ALPHA_BUCKETS)));
          let path = buckets[bi];
          if (!path) {
            path = new Path2D();
            buckets[bi] = path;
          }
          path.moveTo(cx + r, cy);
          path.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }

      ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      for (let bi = 1; bi <= ALPHA_BUCKETS; bi++) {
        const path = buckets[bi];
        if (!path) continue;
        ctx.globalAlpha = bi / ALPHA_BUCKETS;
        ctx.fill(path);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      pitch = Math.min(14, Math.max(6, Math.min(w, h) / 48));
      cols = Math.max(1, Math.floor(w / pitch));
      rows = Math.max(1, Math.floor(h / pitch));
      buildDepth();
      draw(performance.now());
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    // theme flips re-derive colour + the light/dark cap only — the
    // engraving itself is fixed per grid size and must not reshuffle
    const mo = new MutationObserver(() => {
      derive();
      draw(performance.now());
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(performance.now());
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      pointerActive = true;
      leaveAt = 0;
      if (peekTailRaf) {
        cancelAnimationFrame(peekTailRaf);
        peekTailRaf = 0;
      }
      if (reduced) draw(performance.now());
    };
    const onPointerLeave = () => {
      pointerActive = false;
      leaveAt = performance.now();
      if (reduced) {
        // let the decay play out once even under reduced motion, then
        // settle back to the frozen frame with the peek fully gone
        const start = leaveAt;
        const tick = () => {
          const now = performance.now();
          draw(now);
          if (now - start < PEEK_DECAY_MS) {
            peekTailRaf = requestAnimationFrame(tick);
          } else {
            leaveAt = 0;
            peekTailRaf = 0;
            draw(performance.now());
          }
        };
        peekTailRaf = requestAnimationFrame(tick);
      }
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (peekTailRaf) cancelAnimationFrame(peekTailRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="separator"
      aria-orientation="horizontal"
      className={`ns-gcw relative w-full overflow-hidden bg-background ${className}`}
      style={{ height, ...style }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

GravureCellWipe.displayName = "GravureCellWipe";

export default GravureCellWipe;
