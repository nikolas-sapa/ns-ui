"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// EdgeBurnishGlaze — a full-width section divider modeled on leather-edge
// BURNISHING: a wood or bone slicker swept back and forth along a raw
// leather edge, friction compacting and heat-setting the surface fibers
// until the edge takes on a glassy, translucent slick sheen. The finish is
// not a one-shot "apply and done" — worked spots that go a while without a
// fresh pass lose their sheen (the wax film dries, dust settles) and need
// reburnishing, which is why a real slicker sweeps the whole edge
// repeatedly rather than once.
//
// MODEL. A 1D array of cells spans the measured width (CELL_PX = 6px), each
// holding a scalar gloss in [0,1]. The stroke position is a true triangle
// wave across the full width — constant SWEEP_SPEED, direction flips only
// at the two ends. Every frame, every cell decays continuously
// (GLOSS_DECAY, ambient dulling — the wax film drying regardless of where
// the stroke is), and any cell inside the stroke's ~18px contact zone
// additionally gains (GLOSS_GAIN, applied at a fixed per-second rate so the
// simulation stays frame-rate independent). Below DULL_THRESHOLD a cell
// renders matte (base token only); above it, specular highlight opacity
// scales linearly with gloss.
//
// WHY THE END CELLS RUN DULLEST — DERIVED, NOT ASSERTED: gain saturates a
// freshly-passed cell to ~1.0 within a fraction of a pass (0.18/frame over
// an ~18px/140px-per-s dwell already exceeds 1.0), so what actually shapes
// the gradient is the GAP since each cell's last visit, not dwell time. On
// a true constant-speed triangle wave, an interior cell x is crossed twice
// per period T: once outbound, once on the return, with gaps 2x/speed and
// T-2x/speed between the pair. At the very ends (x near 0 or width) those
// two crossings collapse into one quick back-to-back pass at the reversal,
// followed by a full period T of decay before the next pass — the longest
// gap in the system. At mid-span (x = width/2) the two gaps are equal and
// half as long (T/2 each). Net: mid-sweep cells hold the most gloss on
// average, and the region the stroke is heading BACK toward (the far
// turnaround, longest since its last visit) reads dullest right before the
// stroke arrives to refresh it — the "second, slower cue for where it's
// about to head back to" the spec's legibility line calls for.
//
// DECAY IS PERIOD-RELATIVE, not the flat per-second constant a first pass
// used. With gain saturating every visited cell near 1.0, a flat decay
// rate small enough to be plausible (-0.004/s) only ever eats ~1-6% of the
// range over one full period at typical widths — the field pins near 1.0
// and the sheen gradient becomes imperceptible, exactly the kill criterion
// this spec calls out. Decay is instead sized so a cell left completely
// unvisited for one full sweep period drops comfortably under
// DULL_THRESHOLD (targets ~25% of full range remaining after one period),
// which keeps the gradient legible at any measured width.
//
// PRE-ROLL. Starting every mount from a blank gloss field would read as
// "freshly unwrapped," not "an edge that has been worked before." Three
// full sweep periods are simulated synchronously at mount (cheap — a few
// hundred fixed-dt substeps) before the first paint and before the live
// rAF loop takes over, so t0 already shows an edge with real burnishing
// history: mid-range gloss with a light dulling gradient, not a flat zero.
// Because three periods is an exact multiple, the stroke lands back at one
// end at t0, matching the resting-loop description.
//
// COLOUR. The sweeping stroke and every specular highlight are pure
// luminance — --foreground only, layered over a --ns-muted matte base.
// --ns-accent never appears; this is ambient chrome, not interaction.
// ---------------------------------------------------------------------------

export interface EdgeBurnishGlazeProps {
  /** band height in px. Rule thickness derives from this and the measured width. Default 48. */
  height?: number;
  className?: string;
}

const CELL_PX = 6;
const SWEEP_SPEED = 140; // px/s, constant across the full triangle-wave sweep
const CONTACT_HALF_PX = 9; // ~18px-wide contact zone, centered on the stroke
const GLOSS_GAIN_PER_FRAME = 0.18; // gain applied per ~1/60s frame while under the stroke
const FRAME_REF_HZ = 60;
const GAIN_RATE = GLOSS_GAIN_PER_FRAME * FRAME_REF_HZ; // per-second, frame-rate independent
const DULL_THRESHOLD = 0.35;
// gain saturates a visited cell to ~1.0 within a fraction of a pass, so the
// gradient is shaped entirely by decay across each cell's revisit gap, not
// by dwell time. A flat per-second decay rate reads as invisible at real
// widths (a full period only eats a few percent of range) — decay is
// instead period-relative: a cell left unvisited for one full sweep period
// (T = 2*width/SWEEP_SPEED) drops to ~1-DECAY_FRAC_PER_PERIOD of full gloss,
// comfortably under DULL_THRESHOLD, at ANY measured width.
const DECAY_FRAC_PER_PERIOD = 0.72;
const PRE_ROLL_PERIODS = 3; // exact multiple -> stroke lands back at one end at t0

// reduced-motion freeze: named SWEEP_MIDSPAN — three full pre-roll periods
// (so a real dulling gradient has formed) plus a quarter period more, which
// lands the stroke at the CENTER of a traversal mid-sweep, not at either
// turnaround — the most information-dense single frame available.
const SWEEP_MIDSPAN_EXTRA_PERIODS = 0.25;

function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.trim().replace("#", "");
  if (s.length !== 6 && s.length !== 3) return null;
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbStr = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;

/** Constant-speed triangle wave across [0, width]: 0 -> width -> 0, period = 2*width/speed. */
function strokePosition(t: number, width: number, speed: number): { x: number; period: number } {
  const period = (2 * width) / speed;
  if (period <= 0) return { x: 0, period: 0 };
  const phase = ((t % period) + period) % period; // 0..period
  const half = period / 2;
  const x = phase <= half ? (phase / half) * width : width - ((phase - half) / half) * width;
  return { x, period };
}

/** Per-second decay rate such that one full sweep period (width-dependent)
 * drains a cell down to (1 - DECAY_FRAC_PER_PERIOD) of full gloss. */
function decayRateFor(width: number): number {
  const period = (2 * width) / SWEEP_SPEED;
  if (period <= 0) return 0;
  return -DECAY_FRAC_PER_PERIOD / period;
}

/** Advance the gloss field by dt seconds: continuous decay everywhere, extra
 * gain on cells the stroke's contact zone currently overlaps. */
function stepGloss(gloss: Float32Array, cellPx: number, strokeX: number, dt: number, decayRate: number): void {
  const decay = decayRate * dt;
  const gain = GAIN_RATE * dt;
  const lo = strokeX - CONTACT_HALF_PX;
  const hi = strokeX + CONTACT_HALF_PX;
  const iLo = Math.max(0, Math.floor(lo / cellPx));
  const iHi = Math.min(gloss.length - 1, Math.ceil(hi / cellPx));
  for (let i = 0; i < gloss.length; i++) {
    const v = gloss[i];
    if (v === undefined) continue;
    gloss[i] = Math.max(0, Math.min(1, v + decay));
  }
  for (let i = iLo; i <= iHi; i++) {
    const v = gloss[i];
    if (v === undefined) continue;
    const center = (i + 0.5) * cellPx;
    if (center >= lo && center <= hi) {
      gloss[i] = Math.max(0, Math.min(1, v + gain));
    }
  }
}

/** Run the simulation forward from t=0 to simTime with fixed 1/60s substeps,
 * used both for the live pre-roll and for the reduced-motion static frame. */
function simulateTo(gloss: Float32Array, width: number, simTime: number): number {
  const dt = 1 / FRAME_REF_HZ;
  const decayRate = decayRateFor(width);
  let t = 0;
  while (t < simTime) {
    const step = Math.min(dt, simTime - t);
    const { x } = strokePosition(t, width, SWEEP_SPEED);
    stepGloss(gloss, CELL_PX, x, step, decayRate);
    t += step;
  }
  return simTime;
}

export function EdgeBurnishGlaze({ height = 48, className = "" }: EdgeBurnishGlazeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- tokens: start empty, assigned unconditionally from getComputedStyle,
    // nothing paints before the first read below --
    let mutedRgb: [number, number, number] = [0, 0, 0];
    let foregroundRgb: [number, number, number] = [0, 0, 0];
    let tokensReady = false;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      mutedRgb = hexToRgb(cs.getPropertyValue("--ns-muted")) ?? [0, 0, 0];
      foregroundRgb = hexToRgb(cs.getPropertyValue("--foreground")) ?? [0, 0, 0];
      tokensReady = true;
    };

    let width = 0;
    let midY = height / 2;
    let sized = false;
    let gloss = new Float32Array(0);
    let simClock = 0; // seconds already simulated into `gloss` (pre-roll offset)
    let decayRate = 0; // per-second, recomputed from width on every resize

    const ruleH = () => Math.max(2, Math.min(width, height) * 0.06);

    const seedField = () => {
      const count = Math.max(1, Math.floor(width / CELL_PX));
      gloss = new Float32Array(count);
      decayRate = decayRateFor(width);
      // three exact periods -> stroke lands back at x=0, a real dulling
      // gradient has formed, matches the resting-loop's t0 description
      simClock = simulateTo(gloss, width, PRE_ROLL_PERIODS * (2 * width) / SWEEP_SPEED);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      if (width < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      midY = height / 2;
      seedField();
      sized = true;
    };

    const draw = (strokeX: number) => {
      if (!sized || !tokensReady) return;
      ctx.clearRect(0, 0, width, height);
      const rh = ruleH();
      const cellPx = CELL_PX;

      // -- matte base rule: always present, --ns-muted --
      ctx.fillStyle = rgbStr(mutedRgb, 0.3);
      ctx.fillRect(0, midY - rh / 2, width, rh);

      // -- per-cell specular overlay: cells above DULL_THRESHOLD get a
      // --foreground highlight scaled linearly by gloss; the peak value
      // stays close to raw --foreground (not an intermediate tone) so the
      // distance from DULL_THRESHOLD cells stays large in both themes --
      for (let i = 0; i < gloss.length; i++) {
        const g = gloss[i];
        if (g === undefined || g <= DULL_THRESHOLD) continue;
        const t = (g - DULL_THRESHOLD) / (1 - DULL_THRESHOLD);
        const x = i * cellPx;
        const glowH = rh * (1 + t * 1.6);
        ctx.fillStyle = rgbStr(foregroundRgb, t * 0.85);
        ctx.fillRect(x, midY - glowH / 2, cellPx + 0.5, glowH);
      }

      // -- the sweeping stroke itself: the single bright highlight the eye
      // follows, pure luminance, never --ns-accent --
      const grad = ctx.createRadialGradient(strokeX, midY, 0, strokeX, midY, CONTACT_HALF_PX * 1.4);
      grad.addColorStop(0, rgbStr(foregroundRgb, 0.95));
      grad.addColorStop(0.6, rgbStr(foregroundRgb, 0.35));
      grad.addColorStop(1, rgbStr(foregroundRgb, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(
        strokeX - CONTACT_HALF_PX * 1.4,
        midY - CONTACT_HALF_PX * 1.4,
        CONTACT_HALF_PX * 2.8,
        CONTACT_HALF_PX * 2.8,
      );
    };

    // -- loop, paused offscreen and when the tab is hidden --
    let raf = 0;
    let visible = true;
    let last = 0;

    const loop = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (sized && tokensReady) {
        const { x } = strokePosition(simClock, width, SWEEP_SPEED);
        stepGloss(gloss, CELL_PX, x, dt, decayRate);
        simClock += dt;
        const next = strokePosition(simClock, width, SWEEP_SPEED);
        draw(next.x);
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        if (visible && !document.hidden && !reduced) {
          cancelAnimationFrame(raf);
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visible && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const drawStatic = () => {
      if (!sized || !tokensReady || width <= 0) return;
      const period = (2 * width) / SWEEP_SPEED;
      const target = PRE_ROLL_PERIODS * period + SWEEP_MIDSPAN_EXTRA_PERIODS * period;
      seedField();
      simulateTo(gloss, width, target - simClock);
      const { x } = strokePosition(target, width, SWEEP_SPEED);
      draw(x);
    };

    // debounced: a live resize/reseed on every ResizeObserver tick during a
    // drag would both burn cycles reseeding the field every frame and
    // repeatedly teleport the stroke back to x=0 (seedField resets simClock
    // to the pre-roll offset) mid-drag
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduced) drawStatic();
      }, 120);
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();

    if (reduced) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div
      ref={wrapRef}
      role="separator"
      aria-orientation="horizontal"
      className={`ns-ebg w-full ${className}`}
      style={{ height }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
    </div>
  );
}
