"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// NeonTubeStriation — a horizontal section divider rendered as the positive
// column of a lit glow-discharge (neon) tube.
//
// Real mechanic: in the positive column of a glow-discharge tube — the long
// uniform-looking stretch away from the electrodes — the plasma commonly
// self-organizes into moving striations, an ionization-wave instability that
// produces alternating brighter/dimmer bands drifting along the tube's axis
// at a roughly constant rate for a given gas fill. Separately, electrode
// sputtering slowly darkens the glass near both ends as cathode material
// erodes and deposits on the inside of the tube — the familiar blackened
// ends of an aged neon sign or fluorescent tube.
//
// Rendering is two passes over one capsule path: a blurred halo underlay for
// glow, then a crisp core clipped to the same pill shape and filled column
// by column, each column's luminance the product of a base "lit tube" level,
// the traveling striation modulation, an aperiodic low-frequency current
// flicker, and the end-zone sputtering ramp.
//
// The striation phase is computed directly from elapsed wall-clock time
// (phase = 2π · elapsedMs / 4000), never accumulated per rendered frame —
// that is what keeps the drift rate identical regardless of display refresh
// rate, the aliasing failure a real per-frame increment would risk at high
// Hz. The 4-7Hz current noise is resampled on its own aperiodic timer and
// eased toward, not read straight off the 60Hz paint loop either.
// ---------------------------------------------------------------------------

const WAVELENGTH_FRAC = 0.07; // striation wavelength, fraction of tube length
const DRIFT_PERIOD_MS = 4000; // one full wavelength of phase advance
const STRIATION_RATIO = 1.6; // bright:dark luminance ratio around base
const STRIATION_AMP = (STRIATION_RATIO - 1) / (STRIATION_RATIO + 1); // unclamped multiplicative amplitude

const NOISE_AMP = 0.03; // ±3% whole-tube current flicker
const NOISE_MIN_HZ = 4;
const NOISE_MAX_HZ = 7;
const NOISE_EASE = 0.15; // per-frame ease toward the current resampled target

const END_ZONE_FRAC = 0.06; // each electrode darkening zone, fraction of tube length
const END_DARK_MAX = 0.35; // cap on sputtering darkening
const END_DARK_TAU_S = 30; // 1 - exp(-t/30s) ramp

const BASE_MIX = 0.82; // baseline "lit tube" position between --background (0) and --foreground (1)
const MIN_MIX = 0.42; // floor so the dimmest striation trough stays visibly lit in light theme
const MAX_MIX = 0.99;

const STROKE_FRAC = 0.045; // tube diameter as a fraction of the container's height
const STROKE_MIN = 3;
const STROKE_MAX = 10;

const REDUCED_FREEZE_DEG = 130; // reduced-motion freeze phase
const REDUCED_FREEZE_S = 20; // seconds into the sputter ramp shown at freeze

const COL_STEP = 2; // px per rendered column — striations don't need per-pixel resolution

let swatchCtx: CanvasRenderingContext2D | null = null;
function resolveTokenRGB(token: string): [number, number, number] | null {
  if (!swatchCtx) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    swatchCtx = c.getContext("2d", { willReadFrequently: true });
  }
  const ctx = swatchCtx;
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = token;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  if (r === undefined || g === undefined || b === undefined) return null;
  return [r, g, b];
}

function mixRGB(bg: [number, number, number], fg: [number, number, number], t: number): string {
  const r = Math.round(bg[0] + (fg[0] - bg[0]) * t);
  const g = Math.round(bg[1] + (fg[1] - bg[1]) * t);
  const b = Math.round(bg[2] + (fg[2] - bg[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  }
  ctx.closePath();
}

/** column luminance mix-fraction (0..1, background..foreground) at local
 * x (0..tubeLength) and elapsed real time t (ms), given the current sputter
 * ramp seconds and aperiodic noise offset already resolved for this frame */
function columnMix(x: number, tubeLength: number, phase: number, noise: number, rampT: number): number {
  const wavelength = Math.max(1, WAVELENGTH_FRAC * tubeLength);
  const striation = 1 + STRIATION_AMP * Math.sin((2 * Math.PI * x) / wavelength - phase);

  const zone = END_ZONE_FRAC * tubeLength;
  const ramp = 1 - Math.exp(-rampT / END_DARK_TAU_S);
  const leftFrac = zone > 0 ? Math.max(0, 1 - x / zone) : 0;
  const rightFrac = zone > 0 ? Math.max(0, 1 - (tubeLength - x) / zone) : 0;
  const sputter = END_DARK_MAX * ramp * Math.max(leftFrac, rightFrac);

  const raw = BASE_MIX * striation * (1 + noise) * (1 - sputter);
  return Math.min(MAX_MIX, Math.max(MIN_MIX, raw));
}

export interface NeonTubeStriationProps {
  /** divider height in px — the container's smaller dimension geometry derives from. Default 96. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function NeonTubeStriation({ height = 96, className = "" }: NeonTubeStriationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let sized = false;
    let tokensRead = false;
    let width = 0;
    let strokeW = STROKE_MIN;
    let bgRGB: [number, number, number] | null = null;
    let fgRGB: [number, number, number] | null = null;

    // no fallback colour literals — if the tokens aren't resolvable yet,
    // tokensRead stays false and draw() simply doesn't paint this pass
    const readTokens = () => {
      const styles = getComputedStyle(document.documentElement);
      const bgTok = styles.getPropertyValue("--background").trim();
      const fgTok = styles.getPropertyValue("--foreground").trim();
      if (!bgTok || !fgTok) return;
      const bg = resolveTokenRGB(bgTok);
      const fg = resolveTokenRGB(fgTok);
      if (!bg || !fg) return;
      bgRGB = bg;
      fgRGB = fg;
      tokensRead = true;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = rect.width;
      strokeW = Math.min(STROKE_MAX, Math.max(STROKE_MIN, rect.height * STROKE_FRAC));
      sized = true;
      if (!tokensRead) readTokens();
    };

    // -- aperiodic 4-7Hz current noise: resampled on its own timer, eased
    // toward each frame — never a value read straight off the 60Hz loop ---
    let noiseTarget = 0;
    let noiseCurrent = 0;
    let noiseTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNoise = () => {
      const hz = NOISE_MIN_HZ + Math.random() * (NOISE_MAX_HZ - NOISE_MIN_HZ);
      const ms = 1000 / hz;
      noiseTimer = setTimeout(() => {
        noiseTarget = (Math.random() * 2 - 1) * NOISE_AMP;
        scheduleNoise();
      }, ms);
    };

    const draw = (phase: number, rampT: number, noise: number) => {
      if (!sized || !tokensRead || !bgRGB || !fgRGB) return;
      const bg = bgRGB;
      const fg = fgRGB;
      const cy = height / 2 - strokeW / 2;

      ctx.clearRect(0, 0, width, height);

      // pass 1: blurred halo underlay
      ctx.save();
      ctx.filter = `blur(${Math.max(2, strokeW * 1.6)}px)`;
      ctx.globalAlpha = 0.4;
      pillPath(ctx, 0, cy, width, strokeW);
      ctx.fillStyle = mixRGB(bg, fg, BASE_MIX);
      ctx.fill();
      ctx.restore();

      // pass 2: crisp core, clipped to the tube, column by column
      ctx.save();
      pillPath(ctx, 0, cy, width, strokeW);
      ctx.clip();
      for (let x = 0; x < width; x += COL_STEP) {
        const mix = columnMix(x, width, phase, noise, rampT);
        ctx.fillStyle = mixRGB(bg, fg, mix);
        ctx.fillRect(x, cy, COL_STEP + 1, strokeW);
      }
      ctx.restore();
    };

    let raf = 0;
    let start = 0;

    const loop = (now: number) => {
      if (!visible) {
        raf = 0;
        return;
      }
      if (!start) start = now;
      const elapsedMs = now - start;
      noiseCurrent += (noiseTarget - noiseCurrent) * NOISE_EASE;
      // phase derived directly from elapsed real time, not per-frame steps —
      // the decoupling that keeps drift rate independent of display Hz
      const phase = (2 * Math.PI * elapsedMs) / DRIFT_PERIOD_MS;
      const rampT = elapsedMs / 1000;
      draw(phase, rampT, noiseCurrent);
      raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawReducedFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) drawReducedFrame();
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && sized && !raf) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(canvas);

    const onVis = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!document.hidden && visible && !reduced && sized) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const drawReducedFrame = () => {
      // freeze at striation phase 130° into the cycle — an asymmetric band
      // arrangement, more legible than the near-symmetric phase-0 frame —
      // with the sputter ramp partway in so both mechanics read at a glance
      const freezePhase = (REDUCED_FREEZE_DEG / 360) * 2 * Math.PI;
      draw(freezePhase, REDUCED_FREEZE_S, 0);
    };

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();

      if (reduced) {
        drawReducedFrame();
        return;
      }

      scheduleNoise();
      raf = requestAnimationFrame(loop);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (noiseTimer) clearTimeout(noiseTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div role="separator" aria-orientation="horizontal" className={`ns-nts w-full ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
    </div>
  );
}
