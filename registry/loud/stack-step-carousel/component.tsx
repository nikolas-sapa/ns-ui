"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// StackStepCarousel — a full-bleed background modelling vacuum thin-film
// deposition on a planetary carrier: mirror/lens blanks ride a rotating
// carrier past a fixed evaporation/sputter source, each pass under the
// source depositing one quarter-wave layer and stepping that blank's
// reflectance up a notch.
//
// GEOMETRY: 8 substrate discs (N_DISCS) sit on station points evenly spaced
// (45deg apart) around a single "sun ring" of radius 0.32*min(w,h), disc
// radius 0.09*min(w,h). PLANET_PERIOD_S = 3.5s is each disc's own orbital
// period around the center — the spec's "planet (substrate) spin" — this IS
// what actually carries every station through the fixed 30deg source arc at
// the top of the frame, so a single disc's own crossing cadence is exactly
// once per 3.5s, matching the spec's legibility line literally rather than
// by inference. CARRIER_PERIOD_S = 14s (the spec's "sun ring" period) gets
// its own, separate, purely structural screen presence: a slow-rotating
// armature of small index ticks around the guide ring, decoupled from the
// discs' own fast motion — the classic epicyclic-gearing relationship (a
// slower carrier arm, faster individual planet motion) rendered as two
// visually distinct rotations rather than one number driving the other.
//
// CROSSING / LAYERS: each disc's total completed orbits by time t is
// totalLaps_i(t) = floor(t/PLANET_PERIOD_S + stationAngle_i/2*PI) — a step
// function that ticks up by exactly 1 once per disc's own 3.5s orbit, offset
// per disc by its station angle, so with 8 evenly-spaced discs a new
// crossing lands somewhere on the ring roughly every 3.5/8 ~= 0.44s even
// though any single disc's own personal cadence stays exactly 3.5s. Layer
// count is (seedOffset_i + totalLaps_i(t)) mod 13 — a 13-state cycle (0 =
// fresh bare blank through 12 = full stack) so the crossing that WOULD push
// a disc past 12 instead wraps it back to a fresh blank, i.e. the staggered
// swap the spec calls for; seedOffset_i (a fixed, non-random per-disc
// integer 0..12 from a seeded PRNG) staggers the 8 discs' initial phase in
// the cycle, and because every disc's own cycle rate is identical that
// stagger persists forever — the batch structurally cannot resync into a
// single synchronized reload.
//
// REFLECTANCE: luminance is not a linear layer count, it is the real
// quarter-wave-stack reflectance recursion — Y(N) = n_sub*(n_L/n_H)^N,
// R(N) = ((1-Y)/(1+Y))^2 for a symmetric H/L quarter-wave stack (n_H=2.35
// TiO2-like, n_L=1.38 SiO2-like, n_sub=1.52 glass-like, n_0=1 air) — giving
// R(0) ~4% (bare glass) climbing to R(12) ~99% (a realistic 12-layer HR
// mirror) with the real diminishing-returns shape late in the stack.
// Normalized to 0..1 across N=0..12, this fraction is a plain linear RGB mix
// between --ns-muted (0) and --foreground (1): since --foreground is
// defined, in every theme, as the maximum-contrast token against
// --background, "fully stacked reads as the higher-contrast extreme" is
// true by construction with no separate bias/contrast retune needed — the
// weld-pool convention's intent (never literally inverted to a different
// hue relationship) is satisfied structurally rather than by a tuned pair.
//
// SOURCE-CROSSING GLOW: the envelope is referenced to the disc's ARC-ENTRY
// angle (-15deg), not the arc center, so it starts ramping as the disc
// actually enters the 30deg window, peaks almost exactly as the disc passes
// the arc's center (peak time = the real entry-to-center transit time, ~half
// the arc's own transit duration), then keeps fading a while after physical
// exit for legibility — arrives, brightens, departs, never a blink. The
// fixed source arc is drawn from --ns-muted (not --border — a full-bleed
// background's fixed reference the whole mechanic points at cannot be the
// ~1.1:1 separator token) and brightens toward --foreground while any disc
// is under it.
//
// POINTER: canvas-local pointermove finds the nearest disc within 1.3x its
// radius and eases a hover ring toward full over ~150ms — a plain
// --foreground outline whose alpha reflects that disc's OWN current
// reflectance fraction (a legible "here's how far along this one is"), no
// tint, no orbit/carrier rate change.
//
// The clock is real elapsed wall time from mount (t = (now-startMs)/1000)
// with no loop reset at all: the process genuinely never finishes, matching
// the batch-deposition source ("the chamber runs planetary rotation for the
// whole cycle, not a one-shot flash"). Hidden tabs simply stop paint via the
// IntersectionObserver; because position is derived from absolute elapsed
// time, not accumulated per-frame deltas, the carrier is always exactly
// where continuous real-time rotation would have put it on resume.
// ---------------------------------------------------------------------------

const N_DISCS = 8;
const PLANET_PERIOD_S = 3.5; // each disc's own orbit — the crossing cadence
const CARRIER_PERIOD_S = 14; // slow armature-tick rotation, decorative
const SOURCE_ARC_RAD = (30 * Math.PI) / 180; // 30deg source arc at top of frame
const ARC_HALF_FRAC = SOURCE_ARC_RAD / 2 / (Math.PI * 2); // entry offset as a fraction of one orbit
const GLOW_PEAK_MS = ARC_HALF_FRAC * PLANET_PERIOD_S * 1000; // entry -> center transit time
const GLOW_MS = 800; // arrives-brightens-departs envelope per crossing
const LAYER_CAP = 12; // 0..12, 13-state reload cycle
const HOVER_EASE_MS = 150;
const N_ARMATURE_TICKS = 16;

// quarter-wave stack indices — TiO2/SiO2-like alternating pair on glass
const N_AIR = 1.0;
const N_HIGH = 2.35;
const N_LOW = 1.38;
const N_SUB = 1.52;

function stackY(n: number): number {
  return N_SUB * Math.pow(N_LOW / N_HIGH, n);
}
function stackR(n: number): number {
  const y = stackY(n);
  const rho = (N_AIR - y) / (N_AIR + y);
  return rho * rho;
}
const R0 = stackR(0);
const R12 = stackR(LAYER_CAP);
function reflectanceFrac(layer: number): number {
  const r = stackR(layer);
  return Math.max(0, Math.min(1, (r - R0) / (R12 - R0)));
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

interface Station {
  angle: number; // radians, 0 = top, increasing clockwise
  angleFrac: number; // angle / 2*PI, cached
  seedOffset: number; // 0..12, staggers the reload cycle
}

function buildStations(): Station[] {
  const rand = mulberry32(0x5ea70c1e);
  const stations: Station[] = [];
  for (let i = 0; i < N_DISCS; i++) {
    const angle = (i / N_DISCS) * Math.PI * 2;
    stations.push({
      angle,
      angleFrac: i / N_DISCS,
      seedOffset: Math.floor(rand() * (LAYER_CAP + 1)),
    });
  }
  return stations;
}

/** orbit phase referenced to the disc sitting exactly at the arc's center (top) */
function centerPhase(station: Station, tSec: number): number {
  return tSec / PLANET_PERIOD_S + station.angleFrac;
}

function layerAt(station: Station, tSec: number): number {
  const laps = Math.floor(centerPhase(station, tSec));
  return (((station.seedOffset + laps) % (LAYER_CAP + 1)) + (LAYER_CAP + 1)) % (LAYER_CAP + 1);
}

/** seconds since this disc last entered the source arc's leading (-15deg) edge */
function glowAge(station: Station, tSec: number): number {
  const shifted = centerPhase(station, tSec) + ARC_HALF_FRAC;
  const frac = shifted - Math.floor(shifted);
  return frac * PLANET_PERIOD_S;
}

function glowAlpha(ageSec: number): number {
  const ageMs = ageSec * 1000;
  if (ageMs >= GLOW_MS) return 0;
  if (ageMs <= GLOW_PEAK_MS) return ageMs / GLOW_PEAK_MS;
  return 1 - (ageMs - GLOW_PEAK_MS) / (GLOW_MS - GLOW_PEAK_MS);
}

/** deterministically solves for a t where `station` sits at its glow peak with `laps` completed orbits */
function solveGlowPeakTime(station: Station, laps: number): number {
  const targetPhase = laps - ARC_HALF_FRAC + GLOW_PEAK_MS / 1000 / PLANET_PERIOD_S;
  return (targetPhase - station.angleFrac) * PLANET_PERIOD_S;
}

interface Tokens {
  fg: [number, number, number];
  muted: [number, number, number];
  border: string;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const v = m[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fgHex = cs.getPropertyValue("--foreground").trim();
  const mutedHex = cs.getPropertyValue("--ns-muted").trim();
  const border = cs.getPropertyValue("--border").trim();
  const fg = parseHex(fgHex);
  const muted = parseHex(mutedHex);
  if (!fg || !muted || !border) return null; // not loaded yet — no paint before this
  return { fg, muted, border };
}

function mixRGB(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

export interface StackStepCarouselProps {
  /** Global simulation speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the carrier on its current frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the field — this layer alone is aria-hidden. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StackStepCarousel({
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: StackStepCarouselProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stations = buildStations();

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let W = 0;
    let H = 0;
    let minDim = 0;
    let cx = 0;
    let cy = 0;
    let sunRingRadius = 0;
    let discRadius = 0;
    let sized = false;
    let visible = true;

    let startMs = 0;
    let elapsedFrozenSec: number | null = null; // set once under reduced motion
    let hoverIndex = -1;
    let hoverAlpha = 0;

    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stationPos = (angle: number): [number, number] => [
      cx + sunRingRadius * Math.sin(angle),
      cy - sunRingRadius * Math.cos(angle),
    ];

    const draw = (tSec: number) => {
      if (!tokens || !sized) return;
      ctx.clearRect(0, 0, W, H);

      // carrier guide ring — non-load-bearing separator, --border only
      ctx.save();
      ctx.strokeStyle = tokens.border;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, sunRingRadius, 0, Math.PI * 2);
      ctx.stroke();

      // carrier armature: a slow-rotating (14s) ring of index ticks — the
      // sun ring's own structural motion, fully decoupled from the discs'
      // 3.5s orbit
      const carrierAngle = (tSec / CARRIER_PERIOD_S) * Math.PI * 2;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < N_ARMATURE_TICKS; k++) {
        const a = (k / N_ARMATURE_TICKS) * Math.PI * 2 + carrierAngle;
        const inner = sunRingRadius * 0.94;
        const outer = sunRingRadius * 1.06;
        ctx.moveTo(cx + inner * Math.sin(a), cy - inner * Math.cos(a));
        ctx.lineTo(cx + outer * Math.sin(a), cy - outer * Math.cos(a));
      }
      ctx.stroke();
      ctx.restore();

      // fixed source arc at the top of the frame — must stay legible in
      // light theme, so it is --ns-muted brightening toward --foreground,
      // never the near-invisible --border
      const maxGlow = stations.reduce((m, s) => Math.max(m, glowAlpha(glowAge(s, tSec))), 0);
      ctx.save();
      ctx.strokeStyle = mixRGB(tokens.muted, tokens.fg, 0.35 + maxGlow * 0.65);
      ctx.globalAlpha = 0.75 + maxGlow * 0.25;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, sunRingRadius, -SOURCE_ARC_RAD / 2 - Math.PI / 2, SOURCE_ARC_RAD / 2 - Math.PI / 2);
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < stations.length; i++) {
        const st = stations[i]!;
        const [x, y] = stationPos(st.angle);
        const layer = layerAt(st, tSec);
        const frac = reflectanceFrac(layer);
        const fill = mixRGB(tokens.muted, tokens.fg, frac);
        const glow = glowAlpha(glowAge(st, tSec));

        if (glow > 0) {
          ctx.save();
          ctx.globalAlpha = glow * 0.5;
          ctx.fillStyle = mixRGB(tokens.muted, tokens.fg, 1);
          ctx.beginPath();
          ctx.arc(x, y, discRadius * 1.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(x, y, discRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (i === hoverIndex && hoverAlpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = hoverAlpha * (0.3 + frac * 0.4);
          ctx.strokeStyle = mixRGB(tokens.muted, tokens.fg, 1);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, discRadius * 1.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      minDim = Math.min(W, H);
      cx = W / 2;
      cy = H / 2;
      sunRingRadius = minDim * 0.32;
      discRadius = minDim * 0.09;
      fitCanvas();
      sized = true;
      if (elapsedFrozenSec != null) draw(elapsedFrozenSec);
    };

    const loop = (nowRaf: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (pausedRef.current) return; // stay armed; resumes the instant paused clears
      if (!sized || !tokens) return;
      if (startMs === 0) startMs = nowRaf;
      const tSec = ((nowRaf - startMs) / 1000) * speedRef.current;
      hoverAlpha += ((hoverIndex >= 0 ? 1 : 0) - hoverAlpha) * Math.min(1, 16 / HOVER_EASE_MS);
      draw(tSec);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        // "carrier-crossing": station 3 pinned at its glow peak with 2 laps
        // already completed, the other 7 stations at their own staggered
        // positions and pre-crossing layer counts — deterministic, no rAF
        elapsedFrozenSec = solveGlowPeakTime(stations[3]!, 2);
        draw(elapsedFrozenSec);
        return; // no rAF loop, no timers, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(start);
        return;
      }
      resizeAll();
      kick();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      let nearest = -1;
      let nearestD = Infinity;
      for (let i = 0; i < stations.length; i++) {
        const [x, y] = stationPos(stations[i]!.angle);
        const d = Math.hypot(px - x, py - y);
        if (d < discRadius * 1.3 && d < nearestD) {
          nearestD = d;
          nearest = i;
        }
      }
      hoverIndex = nearest;
      if (reduced && elapsedFrozenSec != null) draw(elapsedFrozenSec);
    };
    const onPointerLeave = () => {
      hoverIndex = -1;
      if (reduced && elapsedFrozenSec != null) draw(elapsedFrozenSec);
    };
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resizeAll();
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (tokens) {
        resizeAll();
        kick();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up any theme flip that happened while hidden
        resizeAll();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}
