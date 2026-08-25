"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// HeroFaradayWaveCell — a full-bleed hero background reproducing Faraday's
// 1831 observation: a fluid layer vibrated VERTICALLY above a critical
// driving amplitude develops standing surface waves that oscillate at HALF
// the driving frequency (a parametric, subharmonic response — not a driven
// resonance at the forcing frequency itself), and above threshold the free
// surface tessellates into cellular patterns whose SYMMETRY (stripes,
// squares, hexagons) is set by which resonant wave triads the drive selects,
// not by the drive frequency alone. Below threshold the surface stays flat.
//
// DISTINCT FROM slider-chladni-tune: Chladni figures are sand collecting
// along the NODAL LINES of a vibrating SOLID plate — a 2D eigenmode of a
// rigid boundary, static once locked. This is a free FLUID surface: the
// standing wave itself is the visible thing (no grains, no boundary
// eigenmode), it never locks — it oscillates every drive cycle by
// definition — and its cellular symmetry keeps reorganizing at a threshold
// that is fluid, not sand settling into place.
//
// MECHANISM (analytic sum of standing-wave modes, not a PDE solve — cheap
// enough to run on a coarse grid every frame). A resonant triad of plane
// waves at the same |k| but different orientations is the real mechanism
// behind pattern selection in parametric surface waves: one wavevector
// gives stripes, two orthogonal wavevectors give a square lattice, three at
// 60 degrees give a hexagonal lattice (a standard three-wave resonance).
// Height at a point is the WEIGHTED SUM of all three families' spatial
// patterns, modulated by ONE shared subharmonic time factor
// cos(omega_sub * t) where omega_sub = pi * drivingFrequencyHz (i.e. HALF
// the driving angular frequency) — this is what makes the whole field
// invert in sync every drive period, the defining subharmonic signature.
// A slow driving-amplitude envelope (period `amplitudeDriftPeriod`) sweeps
// through and occasionally below the critical threshold: above it the
// pattern amplitude ramps to full strength, below it the surface smoothly
// flattens — real Faraday-wave behavior, not an invented fade. Three
// independent, incommensurate-period sinusoids weight how much of the
// stripe/square/hexagon family is present at any moment (sharpened by a
// power curve so one family usually dominates, the way a real cell
// tessellation reorganizes rather than blending three lattices evenly), and
// the shared base wavevector angle keeps rotating slowly, so the pattern
// never settles into a repeating loop.
//
// GRID + BUDGET. The field is evaluated on a small offscreen buffer (~35
// samples across the container's SMALLER dimension, aspect-scaled on the
// other axis, capped around 6500 total cells) and upscaled onto the
// full-bleed backing canvas with the canvas's own bilinear image smoothing
// — an interpolated coarse grid, not a per-pixel evaluation, and far
// cheaper than a wave-equation solve. Per cell the inner loop is 4 dot
// products against frame-constant wavevectors (recomputed once per frame,
// not per cell) and 4 cos() calls — at the capped cell budget that's under
// 30k trig evaluations per frame, the same order of magnitude as
// slider-chladni-tune's per-frame grain pass.
//
// SCALE. Wavelength is derived from the container's smaller dimension
// (`cyclesAcrossMin` wave cycles across it), never a fixed pixel size, so
// the cell tessellation reads at the same relative scale whether the hero
// fills a viewport or a small preview card.
//
// LEGIBILITY. A full-frame tessellation fights headline/CTA type sitting in
// the usual centered hero position, the same problem
// background-halftone-rosette solved with an explicit coverage gradient —
// here inverted spatially to match a centered content block instead of a
// centered visual: an elliptical amplitude mask damps the field to ~15% of
// full amplitude behind the content (still visibly live, never fully flat)
// and grows to 100% toward the frame edges, so density is bought at the
// edges instead of behind the type.
//
// TOKENS. Trough -> --background, mid -> --ns-muted, crest -> --foreground,
// a three-stop ramp read via getComputedStyle(document.documentElement) at
// mount and re-read on a MutationObserver watching documentElement's class.
// Because the ramp is always background -> muted -> foreground regardless
// of which theme is active, crest and trough stay distinguishable under
// both polarities without ever inverting which token means "crest." No
// --ns-accent anywhere — this is a resting ambient background, not
// interaction chrome, and --border never fills a cell (it's a 1px
// separator token, near-invisible in light theme at cell scale).
//
// REDUCED MOTION. Freezes on a fully-formed pure-hexagon frame (weights
// forced to [0,0,1], amplitude at full strength, subharmonic factor at its
// peak +1) rather than sampling the live time formula at some t — a
// numeric coincidence with the live formula could land on a transitional
// blend or a below-threshold dip. The pure-hex frame is deliberately
// chosen over stripes/squares because hexagonal cells are the most
// legible tessellation at a glance. No rAF runs in this mode.
// ---------------------------------------------------------------------------

export interface HeroFaradayWaveCellProps {
  /** wave cycles across the container's smaller dimension. @default 5 */
  cyclesAcrossMin?: number;
  /** driving frequency in Hz; the visible standing wave runs at half this. @default 0.42 */
  drivingFrequencyHz?: number;
  /** period, in seconds, of the driving-amplitude envelope sweeping across the critical threshold. @default 46 */
  amplitudeDriftPeriod?: number;
  /** freezes the field on the same frame prefers-reduced-motion uses. @default false */
  paused?: boolean;
  /** rendered over the wave field — eyebrow, headline, CTA. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type RGB = readonly [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerpRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// three-stop token ramp: trough -> mid -> crest
function rampColor(t01: number, bg: RGB, muted: RGB, fg: RGB): RGB {
  return t01 < 0.5 ? lerpRGB(bg, muted, t01 * 2) : lerpRGB(muted, fg, (t01 - 0.5) * 2);
}

function useReducedMotionPref(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const THRESHOLD = 0.34; // critical driving amplitude, normalized 0..1
const THRESHOLD_RAMP = 0.14; // smoothstep width above threshold to full pattern strength
const ENV_PHASE = 1.55; // phase offset so the default envelope starts well above threshold
const ANGLE_RATE = (2 * Math.PI) / 240; // base wavevector orientation, one full turn per 4min
const WEIGHT_PERIODS: readonly [number, number, number] = [27, 33, 41]; // incommensurate, seconds
const WEIGHT_PHASES: readonly [number, number, number] = [0, 2.1, 4.4];
const WEIGHT_POW = 4; // sharpens family dominance so one tessellation usually leads
const MAX_CELLS = 6500;
const MIN_SAMPLES_ACROSS_MIN_DIM = 35;

// elliptical legibility mask: damped near the centered content block, full
// strength toward the frame edges (inverse of background-halftone-rosette's
// radial gradient, matched to a centered-content hero instead of a
// centered-visual one).
const MASK_CENTER_AMP = 0.15;
const MASK_EDGE_AMP = 1.0;
const MASK_INNER = 0.15;
const MASK_OUTER = 0.85;
const MASK_ELLIPSE_X = 0.62; // wider than tall, matching a typical headline block's aspect

export function HeroFaradayWaveCell({
  cyclesAcrossMin = 5,
  drivingFrequencyHz = 0.42,
  amplitudeDriftPeriod = 46,
  paused = false,
  children,
  className = "",
  style,
}: HeroFaradayWaveCellProps) {
  const reduced = useReducedMotionPref();
  const isStatic = paused || reduced;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink, read at mount and re-derived on theme flips --
    let bg: RGB = [255, 255, 255];
    let muted: RGB = [128, 128, 128];
    let fg: RGB = [23, 23, 23];
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    deriveColors();

    // offscreen low-res field buffer, upscaled with the main canvas's own
    // bilinear image smoothing
    const buffer = document.createElement("canvas");
    const bctx = buffer.getContext("2d");
    if (!bctx) return;

    let cols = 1;
    let rows = 1;
    let imgData: ImageData | null = null;
    let pixels: Uint8ClampedArray | null = null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let sized = false;
    let raf = 0;
    let visible = true;
    let kUnit = 0.02; // radians per px, derived from container's smaller dimension

    const resizeBuffer = () => {
      const minDim = Math.max(1, Math.min(width, height));
      const cellPx = minDim / (MIN_SAMPLES_ACROSS_MIN_DIM * 1.4);
      let c = Math.max(8, Math.round(width / cellPx));
      let r = Math.max(8, Math.round(height / cellPx));
      const total = c * r;
      if (total > MAX_CELLS) {
        const scale = Math.sqrt(MAX_CELLS / total);
        c = Math.max(8, Math.round(c * scale));
        r = Math.max(8, Math.round(r * scale));
      }
      cols = c;
      rows = r;
      buffer.width = cols;
      buffer.height = rows;
      imgData = bctx.createImageData(cols, rows);
      pixels = imgData.data;
      kUnit = (2 * Math.PI * cyclesAcrossMin) / minDim;
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      resizeBuffer();
      sized = true;
    };
    resize();

    const startTime = performance.now();

    const computeField = (t: number) => {
      if (!pixels) return;

      // driving-amplitude envelope, sweeping across the critical threshold
      const drive = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / amplitudeDriftPeriod + ENV_PHASE);
      const patternAmp = smoothstep(THRESHOLD, THRESHOLD + THRESHOLD_RAMP, drive);

      // subharmonic time factor: HALF the driving frequency, the defining
      // parametric signature — the whole field inverts in sync each cycle
      const omegaSub = Math.PI * drivingFrequencyHz;
      const subCos = Math.cos(omegaSub * t);

      // three incommensurate slow sinusoids -> sharpened, normalized family weights
      let w0 = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / WEIGHT_PERIODS[0] + WEIGHT_PHASES[0]);
      let w1 = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / WEIGHT_PERIODS[1] + WEIGHT_PHASES[1]);
      let w2 = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / WEIGHT_PERIODS[2] + WEIGHT_PHASES[2]);
      w0 = Math.pow(w0, WEIGHT_POW);
      w1 = Math.pow(w1, WEIGHT_POW);
      w2 = Math.pow(w2, WEIGHT_POW);
      const wSum = Math.max(1e-9, w0 + w1 + w2);
      const wStripe = w0 / wSum;
      const wSquare = w1 / wSum;
      const wHex = w2 / wSum;

      // frame-constant wavevectors (orientation only changes once per
      // frame, not per cell): stripe/square/hex share a rotating base angle
      const theta0 = ANGLE_RATE * t;
      const kx0 = kUnit * Math.cos(theta0);
      const ky0 = kUnit * Math.sin(theta0);
      const a90 = theta0 + Math.PI / 2;
      const kx90 = kUnit * Math.cos(a90);
      const ky90 = kUnit * Math.sin(a90);
      const a60 = theta0 + Math.PI / 3;
      const kx60 = kUnit * Math.cos(a60);
      const ky60 = kUnit * Math.sin(a60);
      const a120 = theta0 + (2 * Math.PI) / 3;
      const kx120 = kUnit * Math.cos(a120);
      const ky120 = kUnit * Math.sin(a120);

      let idx = 0;
      for (let j = 0; j < rows; j++) {
        const ny = rows > 1 ? j / (rows - 1) : 0.5;
        const worldY = ny * height - height / 2;
        const dy = (ny - 0.5) * 2;
        for (let i = 0; i < cols; i++) {
          const nx = cols > 1 ? i / (cols - 1) : 0.5;
          const worldX = nx * width - width / 2;
          const dx = (nx - 0.5) * 2;

          const c0 = Math.cos(kx0 * worldX + ky0 * worldY);
          const c90 = Math.cos(kx90 * worldX + ky90 * worldY);
          const c60 = Math.cos(kx60 * worldX + ky60 * worldY);
          const c120 = Math.cos(kx120 * worldX + ky120 * worldY);

          const patternStripe = c0;
          const patternSquare = (c0 + c90) / 2;
          const patternHex = (c0 + c60 + c120) / 3;
          const spatial = wStripe * patternStripe + wSquare * patternSquare + wHex * patternHex;

          const ellipseR = Math.sqrt(Math.pow(dx * MASK_ELLIPSE_X, 2) + Math.pow(dy, 2));
          const mask = MASK_CENTER_AMP + (MASK_EDGE_AMP - MASK_CENTER_AMP) * smoothstep(MASK_INNER, MASK_OUTER, ellipseR);

          const h = patternAmp * spatial * subCos * mask;
          const t01 = clamp((h + 1) / 2, 0, 1);
          const [r, g, b] = rampColor(t01, bg, muted, fg);

          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = 255;
          idx += 4;
        }
      }
    };

    const computeStaticField = () => {
      if (!pixels) return;
      // pure-hexagon, full-strength, peak-subharmonic frame — see the
      // REDUCED MOTION note above for why this isn't a live-formula sample.
      const theta0 = 0.3; // a mild fixed tilt so the lattice doesn't align to the frame axes
      const kx0 = kUnit * Math.cos(theta0);
      const ky0 = kUnit * Math.sin(theta0);
      const a60 = theta0 + Math.PI / 3;
      const kx60 = kUnit * Math.cos(a60);
      const ky60 = kUnit * Math.sin(a60);
      const a120 = theta0 + (2 * Math.PI) / 3;
      const kx120 = kUnit * Math.cos(a120);
      const ky120 = kUnit * Math.sin(a120);

      let idx = 0;
      for (let j = 0; j < rows; j++) {
        const ny = rows > 1 ? j / (rows - 1) : 0.5;
        const worldY = ny * height - height / 2;
        const dy = (ny - 0.5) * 2;
        for (let i = 0; i < cols; i++) {
          const nx = cols > 1 ? i / (cols - 1) : 0.5;
          const worldX = nx * width - width / 2;
          const dx = (nx - 0.5) * 2;

          const c0 = Math.cos(kx0 * worldX + ky0 * worldY);
          const c60 = Math.cos(kx60 * worldX + ky60 * worldY);
          const c120 = Math.cos(kx120 * worldX + ky120 * worldY);
          const patternHex = (c0 + c60 + c120) / 3;

          const ellipseR = Math.sqrt(Math.pow(dx * MASK_ELLIPSE_X, 2) + Math.pow(dy, 2));
          const mask = MASK_CENTER_AMP + (MASK_EDGE_AMP - MASK_CENTER_AMP) * smoothstep(MASK_INNER, MASK_OUTER, ellipseR);

          const h = patternHex * mask; // amplitude 1, subCos at its peak (+1)
          const t01 = clamp((h + 1) / 2, 0, 1);
          const [r, g, b] = rampColor(t01, bg, muted, fg);

          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = 255;
          idx += 4;
        }
      }
    };

    const paint = () => {
      if (!sized || !imgData) return;
      bctx.putImageData(imgData, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(buffer, 0, 0, cols, rows, 0, 0, width, height);
    };

    const renderStatic = () => {
      computeStaticField();
      paint();
    };

    const loop = () => {
      const t = (performance.now() - startTime) / 1000;
      computeField(t);
      paint();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (isStatic) return;
      if (!raf && sized && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    if (isStatic) {
      renderStatic();
    } else {
      computeField(0);
      paint();
      wake();
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (isStatic) renderStatic();
      else paint();
    });
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (isStatic) return;
      if (visible) wake();
      else sleep();
    });
    io.observe(container);

    const mo = new MutationObserver(() => {
      deriveColors();
      if (isStatic) renderStatic();
      else paint();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onVis = () => {
      if (isStatic) return;
      if (document.hidden) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      sleep();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // cyclesAcrossMin/drivingFrequencyHz/amplitudeDriftPeriod are read
    // fresh each frame from closure, and isStatic fully determines which
    // branch runs, so this effect only needs to re-run on those inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStatic, cyclesAcrossMin, drivingFrequencyHz, amplitudeDriftPeriod]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {children && <div className="pointer-events-none relative z-10 h-full w-full">{children}</div>}
    </div>
  );
}

HeroFaradayWaveCell.displayName = "HeroFaradayWaveCell";
