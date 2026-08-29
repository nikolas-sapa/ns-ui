"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// BitplaneCascade — a full-bleed background modeling Amiga-class planar
// framebuffers (and 1-bit fax/plotter graphics before them): an N-bit image
// isn't stored as one array of pixel values, it's N separate 1-bit bitplanes,
// each full-resolution, composited by adding each plane's binary contribution
// at its place value (plane weighted 8, 4, 2, 1 for a 4-bit / 16-level image).
// This component samples ONE static scalar field once per size, quantizes it
// to a 16-level (4-bit) value per grid cell, and reveals that value's bits one
// plane at a time — MOST significant place value first. That ordering is the
// deliberate, historically-accurate choice: real progressive bit-plane
// transmission (fax/plotter preview passes, progressive image codecs) sends
// the MSB plane first because it alone reconstructs a legible coarse
// silhouette; sending the LSB first would just be spatial noise with no
// silhouette to build on. So "plane 0" here is place value 8 (arrives first,
// t=0), "plane 1" is place value 4 (t=350ms), "plane 2" is place value 2
// (t=700ms), "plane 3" is place value 1, the finest bit (t=1050ms) — each
// arrival ANDs one more high bit into the visible reconstruction, so the
// already-revealed hard silhouette edge never moves, only finer bands appear
// inside/around it. Full stack holds 900ms, then the accumulator clears and
// plane 0 lands again: 350*4 + 900 = 2300ms per cycle, forever.
//
// Differentiation: background-halftone-rosette is also a full-bleed canvas
// reveal, but its identity is continuous same-ink dot-angle drift with no
// discrete steps — pick that for a texture that's always mid-motion. Pick
// bitplane-cascade when the point is a countable, steppy "one more layer just
// landed" beat with a held clean frame, not a continuous drift.
//
// ALIVE AT REST, not aliased to the checkpoint clock: within any single
// plane's 350ms window the cell states are static (a real bitplane compositor
// doesn't blend), so a bare step function would make t0 and any other time
// that lands in the same window of a later cycle read as pixel-identical.
// Instead, every cell touched by the most-recently-landed plane carries a
// short landing flash (an extra brightness pop that decays over ~220ms) — the
// legibility cue for "a layer just arrived", and it also means elapsed time
// since that landing (not just which plane is current) is always part of the
// rendered frame, so no two real-time samples within a cycle are identical.
//
// Tokens: --foreground is the only ink (mixed toward --background by opacity,
// never a literal color); --background clears the frame each draw. No
// --ns-accent anywhere — this is a resting ambient surface, not an
// interaction moment.
// ---------------------------------------------------------------------------

const STEP_MS = 350; // per-plane arrival interval
const HOLD_MS = 900; // full-stack clean-image hold after the last plane lands
const CYCLE_MS = STEP_MS * 4 + HOLD_MS; // 2300ms
const FLASH_MS = 220; // landing-flash decay window, inside one 350ms step
const PLANE_BITS = [8, 4, 2, 1]; // MSB-first arrival order (place values)

function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

export interface BitplaneCascadeProps {
  /** field cell pitch as a fraction of the container's smaller dimension, before clamping. @default 1/96 */
  cellRatio?: number;
  /** freeze the field at its reduced-motion frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BitplaneCascade({
  cellRatio = 1 / 96,
  paused = false,
  children,
  className = "",
  style,
}: BitplaneCascadeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty and are assigned unconditionally from
    // getComputedStyle before any draw path can run — no literal fallback.
    let ink = "";
    let bg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--foreground").trim();
      bg = cs.getPropertyValue("--background").trim();
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;

    let cols = 0;
    let rows = 0;
    let cell = 8;
    let field: Uint8Array = new Uint8Array(0); // per-cell quantized 0..15 value
    // deterministic fixed seed; the field is sampled once per size and never
    // rerolled, so no per-mount randomization is needed here.
    const FIELD_SEED = 0x51ed270b;

    let startTime = 0;

    const buildField = () => {
      const minDim = Math.min(width, height) || 1;
      // clamp per spec: clamp(round(minDim/96), 4, 12)
      cell = Math.max(4, Math.min(12, Math.round(minDim * cellRatio)));
      cols = Math.max(1, Math.ceil(width / cell));
      rows = Math.max(1, Math.ceil(height / cell));
      field = new Uint8Array(cols * rows);

      const s = FIELD_SEED;
      const minGrid = Math.max(1, Math.min(cols, rows));
      // two octaves of hashed value noise -> large soft shapes, not fine grain
      const wave1 = minGrid / 3.2;
      const wave2 = minGrid / 9;
      const raw = new Float32Array(cols * rows);
      let minV = Infinity;
      let maxV = -Infinity;
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const n1 = valueNoise(rx / wave1, ry / wave1, s);
          const n2 = valueNoise(rx / wave2, ry / wave2, s + 97);
          const v = n1 * 0.7 + n2 * 0.3;
          raw[ry * cols + rx] = v;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      // stretch to the field's own full observed range before quantizing —
      // two blended octaves cluster toward the middle, and without this the
      // 16-level output never reaches its low/high bins, so the "full
      // luminance gradient" the cascade builds toward would never arrive.
      const range = Math.max(1e-6, maxV - minV);
      for (let i = 0; i < raw.length; i++) {
        field[i] = Math.max(0, Math.min(15, Math.floor(((raw[i] - minV) / range) * 15.999)));
      }
    };

    // returns { count: 1..4, mask: bits revealed so far, sinceLanding: ms }
    const phaseAt = (elapsed: number) => {
      const t = ((elapsed % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
      let count: number;
      let landAt: number;
      if (t < STEP_MS) {
        count = 1;
        landAt = 0;
      } else if (t < STEP_MS * 2) {
        count = 2;
        landAt = STEP_MS;
      } else if (t < STEP_MS * 3) {
        count = 3;
        landAt = STEP_MS * 2;
      } else {
        count = 4;
        landAt = STEP_MS * 3;
      }
      let mask = 0;
      for (let i = 0; i < count; i++) mask |= PLANE_BITS[i];
      const newestBit = PLANE_BITS[count - 1];
      const sinceLanding = t - landAt;
      return { count, mask, newestBit, sinceLanding };
    };

    // reused across draws, sized to the largest possible bucket count so a
    // resize never reallocates mid-frame: 16 reconstructed values x 2
    // (flashed / not) = 32 buckets, each a flat list of cell coordinate pairs.
    const bucketCells: number[][] = Array.from({ length: 32 }, () => []);
    const bucketAlpha = new Float32Array(32);

    const draw = (elapsed: number, forceFlash?: number) => {
      // no paint before the first token read — an empty getPropertyValue
      // string would otherwise leave ctx.fillStyle at its default black.
      if (!sized || !ink || !bg) return;
      const { mask, newestBit, sinceLanding } = phaseAt(elapsed);
      const flashT = forceFlash !== undefined ? forceFlash : sinceLanding;
      const flashAmt = Math.max(0, 1 - flashT / FLASH_MS);

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // bucket cells by their exact alpha (at most 32 distinct values per
      // frame: 16 reconstructed levels x flashed/not) so globalAlpha is only
      // set once per bucket instead of once per cell.
      let bucketCount = 0;
      for (let b = 0; b < bucketCells.length; b++) bucketCells[b].length = 0;

      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          const v = field[ry * cols + rx];
          const reconstructed = v & mask; // only already-arrived bits count
          if (reconstructed <= 0) continue;
          const flashed = flashAmt > 0 && (v & newestBit) !== 0;
          let alpha = reconstructed / 15;
          // plane-0-only: raise the contrast floor so the first silhouette
          // never washes out against a light background.
          if (mask === PLANE_BITS[0]) alpha = Math.max(alpha, 0.25);
          if (flashed) alpha = Math.min(1, alpha + flashAmt * 0.35);

          const key = (reconstructed - 1) * 2 + (flashed ? 1 : 0);
          if (bucketCells[key].length === 0) {
            bucketAlpha[key] = alpha;
            bucketCount++;
          }
          bucketCells[key].push(rx, ry);
        }
      }

      if (bucketCount > 0) {
        ctx.fillStyle = ink;
        for (let b = 0; b < bucketCells.length; b++) {
          const coords = bucketCells[b];
          if (coords.length === 0) continue;
          ctx.globalAlpha = bucketAlpha[b];
          for (let i = 0; i < coords.length; i += 2) {
            ctx.fillRect(coords[i] * cell, coords[i + 1] * cell, cell, cell);
          }
        }
        ctx.globalAlpha = 1;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField();
      sized = true;
    };

    // last plane-count actually painted — a static window (no new landing,
    // flash fully decayed) redraws nothing, since the frame is provably
    // unchanged: same field, same mask, same zero flash contribution.
    let lastDrawnCount = -1;

    const loop = (now: number) => {
      if (!visible) return;
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const { count, sinceLanding } = phaseAt(elapsed);
      if (count !== lastDrawnCount || sinceLanding < FLASH_MS) {
        draw(elapsed);
        lastDrawnCount = count;
      }
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        ready = true;
        if (reduced || paused) {
          // frame: plane 2 of 4 just landed (3 bits revealed, MSB-first),
          // flash near-max — "just landed", not settled.
          draw(STEP_MS * 2, 10);
        } else {
          startTime = 0;
          lastDrawnCount = -1;
          if (visible && !raf) raf = requestAnimationFrame(loop);
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          startTime = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        startTime = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) draw(STEP_MS * 2, 10);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      ready = true;
      if (reduced || paused) {
        draw(STEP_MS * 2, 10);
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellRatio, paused]);

  return (
    <div
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

BitplaneCascade.displayName = "BitplaneCascade";
