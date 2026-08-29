"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DeltaFrameMacroblock — a quiet full-width band that visualizes a video
// codec's own P-frame change-detection decision, not the pixels it redraws.
//
// After an MPEG/H.26x-class codec sends one full (I-)frame, every frame after
// that only encodes the macroblocks that actually changed; each block carries
// a "redraw" or "skip, unchanged" flag, and a decoder leaves every skipped
// block's pixels exactly as they were in the frame buffer. Scrub a real
// codec's per-block change map and you see a sparse, shifting set of flagged
// blocks against a mostly static field — the compression artifact visible as
// blockiness in low-bitrate video, made deliberate here instead of a defect.
//
// A uniform grid of macroblocks is sized off the container's SMALLER
// dimension: block = clamp(round(minDim / 16), 12, 24) px, then cols/rows are
// rounded so the grid fills the container exactly (a 320px band at 16px
// blocks holds a 20-block-wide row). Each block carries a fixed per-block
// seed tone (drawn once, never reseeded) plus a bounded, reflecting
// toneOffset that only moves the tick a block is flagged — that is the
// "slightly shifted tone" of a motion-compensated redraw, and reflecting the
// offset at its amplitude ceiling keeps the drift visible forever without
// ever saturating into salt-and-pepper noise (an unbounded random walk would
// eventually finish, which fails the always-different-at-rest rule).
//
// A fixed 220ms tick — the visualized P-frame interval, deliberately slower
// than a real ~30fps codec tick per the round 9 decoupling rule, so each
// delta event stays an individually followable discrete flash rather than a
// strobe — flags a SMALL, capped number of blocks as "changed" (2-4 blocks
// regardless of grid size, not the raw 6-10% the source ratio would suggest:
// at typical card-scale grids of 150-400 blocks, 6-10% is 10-30 simultaneous
// flags, and against a 340ms outline lifetime that overlaps into a
// continuous shimmer rather than discrete countable events — the spec's own
// kill criteria pre-authorizes making the timing more aggressive rather than
// shipping that). A flagged block's outline appears instantly, holds at full
// --foreground-weight stroke for 140ms, then fades over the next 200ms back
// to unoutlined — 340ms total, comfortably inside the 220ms-spaced ticks so
// at most two flash generations ever overlap.
//
// The whole board is redrawn every animation frame from typed-array state
// (tone + toneOffset + per-block last-flagged time) rather than painted into
// a persistent buffer, so a theme flip or resize repaints every block
// identically instead of leaving stale pixels from the old theme behind.
// ---------------------------------------------------------------------------

const MIN_BLOCK = 12;
const MAX_BLOCK = 24;
const TICK_MS = 220; // visualized P-frame interval
const HOLD_MS = 140; // outline holds at full strength
const FADE_MS = 200; // then fades back to unoutlined
const FLASH_MS = HOLD_MS + FADE_MS;
const FLAG_FRACTION = 0.08; // codec's typical sparse P-frame update ratio
const FLAG_MIN = 2;
const FLAG_MAX = 4; // capped for legibility — see header note
const TONE_AMP = 0.05; // reflecting bound on toneOffset
const TONE_STEP = 0.018; // per-flag nudge, before reflection
const BASE_ALPHA = 0.05; // narrow luminance band floor
const BASE_NOISE = 0.045; // per-block fixed-seed spread, dark theme
const LIGHT_NOISE_MULT = 1.6; // widened on a light background — see below
const WARMUP_TICKS = 16; // pre-drifts the field so mount isn't a bare I-frame
const RM_WARMUP_TICKS = 24;

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

function reflect(v: number, amp: number): number {
  let x = v;
  if (x > amp) x = 2 * amp - x;
  else if (x < -amp) x = -2 * amp - x;
  if (x > amp) x = amp;
  else if (x < -amp) x = -amp;
  return x;
}

/** parses a getComputedStyle "rgb(r, g, b)" / "rgba(r, g, b, a)" string */
function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return [128, 128, 128];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export interface DeltaFrameMacroblockProps {
  /** extra classes merged onto the rendered canvas element */
  className?: string;
}

export function DeltaFrameMacroblock({ className = "" }: DeltaFrameMacroblockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokensRead = false;
    let fg: [number, number, number] = [128, 128, 128];
    let bg: [number, number, number] = [255, 255, 255];
    let lightMult = 1;

    let width = 0;
    let height = 0;
    let sized = false;
    let cols = 0;
    let rows = 0;
    let blockW = 0;
    let blockH = 0;
    let count = 0;

    let baseTone = new Float32Array(0);
    let toneOffset = new Float32Array(0);
    let flagTime = new Float32Array(0);
    let rng = mulberry32(0x0dfa11e);

    let simNow = 0;
    let acc = 0;
    let last = 0;
    let raf = 0;
    let visible = true;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseRgb(cs.getPropertyValue("--foreground") || getComputedStyle(canvas).color);
      bg = parseRgb(cs.getPropertyValue("--background") || "rgb(255,255,255)");
      // light theme washes out subtle per-block variance faster than dark —
      // widen the fixed-seed noise amplitude, still purely a multiplier on
      // token-derived alpha, never a new colour.
      lightMult = relativeLuminance(bg) > 0.5 ? LIGHT_NOISE_MULT : 1;
      tokensRead = true;
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const minDim = Math.min(width, height);
      const block = Math.min(MAX_BLOCK, Math.max(MIN_BLOCK, Math.round(minDim / 16)));
      cols = Math.max(1, Math.round(width / block));
      rows = Math.max(1, Math.round(height / block));
      blockW = width / cols;
      blockH = height / rows;
      count = cols * rows;

      rng = mulberry32(0x0dfa11e);
      baseTone = new Float32Array(count);
      toneOffset = new Float32Array(count);
      flagTime = new Float32Array(count).fill(-Infinity);
      for (let i = 0; i < count; i++) baseTone[i] = rng() * 2 - 1;

      simNow = 0;
      acc = 0;
      sized = true;
    };

    /** one tick: flags a small capped subset of blocks as "changed" */
    const tick = (t: number) => {
      const n = Math.min(count, Math.max(FLAG_MIN, Math.min(FLAG_MAX, Math.round(count * FLAG_FRACTION))));
      const chosen = new Set<number>();
      let guard = 0;
      while (chosen.size < n && guard < n * 20) {
        guard++;
        chosen.add(Math.floor(rng() * count));
      }
      for (const i of chosen) {
        flagTime[i] = t;
        const step = (rng() - 0.5) * 2 * TONE_STEP;
        toneOffset[i] = reflect((toneOffset[i] ?? 0) + step, TONE_AMP);
      }
    };

    const draw = (t: number) => {
      if (!sized) return;
      if (!tokensRead) readTokens();

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
      ctx.fillRect(0, 0, width, height);

      const fgStyle = `rgb(${fg[0]}, ${fg[1]}, ${fg[2]})`;
      ctx.fillStyle = fgStyle;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const noise = (baseTone[i] ?? 0) * BASE_NOISE * lightMult;
          const drift = toneOffset[i] ?? 0;
          let alpha = BASE_ALPHA + noise + drift;
          if (alpha < 0.015) alpha = 0.015;
          else if (alpha > 0.22) alpha = 0.22;
          ctx.globalAlpha = alpha;
          ctx.fillRect(c * blockW, r * blockH, blockW, blockH);
        }
      }

      ctx.strokeStyle = fgStyle;
      ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const age = t - (flagTime[i] ?? -Infinity);
          if (age < 0 || age > FLASH_MS) continue;
          const strength = age <= HOLD_MS ? 1 : 1 - (age - HOLD_MS) / FADE_MS;
          ctx.globalAlpha = strength;
          ctx.strokeRect(c * blockW + 0.5, r * blockH + 0.5, blockW - 1, blockH - 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    const warm = (ticks: number) => {
      let t = 0;
      for (let k = 0; k < ticks; k++) {
        t += TICK_MS;
        tick(t);
      }
      simNow = t;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      simNow += dt;
      acc += dt;
      while (acc >= TICK_MS) {
        acc -= TICK_MS;
        tick(simNow - acc);
      }
      draw(simNow);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      layout();
      if (!sized) return;
      readTokens();
      if (reduced) {
        warm(RM_WARMUP_TICKS);
        // freeze on the freshly-flagged frame itself — 0ms into the 140ms
        // hold, before any fade softens which blocks are flagged.
        draw(simNow);
        return;
      }
      warm(WARMUP_TICKS);
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        cancelAnimationFrame(raf);
        raf = 0;
        start();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const mo = new MutationObserver(() => {
      tokensRead = false;
      if (reduced) draw(simNow);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && sized && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    document.fonts.ready.then(() => {
      if (!disposed) onResize();
    });

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full text-foreground ${className}`}
    />
  );
}
