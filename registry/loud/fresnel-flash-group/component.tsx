"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// FresnelFlashGroup — a full-bleed hero/section background modelled on a
// rotating first-order Fresnel lens drum (Chance Brothers / Barbier optics):
// eight glass bullseye panels ring a fixed lamp, the whole drum turns at a
// constant rate, and one panel is built brighter and wider than the rest to
// produce the station's identifying "characteristic" — a single group flash
// once per lap, published in the List of Lights as e.g. Fl 8s.
//
// The drum NEVER stops turning, so the component is alive independently of
// whether the primary flash happens to be firing in any given screenshot:
// every facet sweeps past a fixed 12-o'clock marker in turn (once every
// 1.0s — rotationPeriod / facetCount), each producing its own smaller glint,
// while the primary facet's pass additionally lights a soft outward beam
// lobe. A slow, independent haze drift behind the drum keeps the dark
// interval between flashes from ever reading as a static frame.
//
// Same idiom as arc-ladder-climb: rotation angle is a pure function of
// elapsed ms (never per-frame incremented state), so the reduced-motion
// freeze is just that same function evaluated once at a fixed time, and a
// backgrounded tab resumes at the correct angle instead of restarting.
// ---------------------------------------------------------------------------

const FACET_COUNT = 8;
const FACET_SPACING_DEG = 360 / FACET_COUNT;
const PRIMARY_INDEX = 0;
const ROTATION_PERIOD_MS = 8000; // one lap = the station's characteristic, Fl 8s
const ROTATION_DEG_PER_MS = 360 / ROTATION_PERIOD_MS;

const CAMERA_BEARING_DEG = 0; // 12 o'clock — fixed readout marker

const FACET_GLINT_SIGMA_DEG = 10;
const FACET_GLINT_PEAK_ALPHA = 0.5;

const PRIMARY_SIGMA_DEG = 6;
const PRIMARY_PEAK_ALPHA = 1;
const PRIMARY_WIDTH_MULT = 1.2;
const PRIMARY_HALO_BLUR_PX = 10;
const BEAM_LOBE_MAX_ALPHA = 0.5;

const HAZE_DRIFT_PERIOD_MS = 21000; // slow independent atmospheric drift
const HAZE_DRIFT_AMPL_FRAC = 0.16; // of minDim, offset of the haze glow center
const HAZE_PEAK_ALPHA = 0.06;

const DRUM_RADIUS_FRAC = 0.42; // of minDim
const FACET_RADIUS_FRAC = 0.052; // of minDim, facet dot base radius
const LAMP_RADIUS_FRAC = 0.02; // of minDim, fixed center lamp

const REF_DIM = 640;
const SCALE_MIN = 0.6;
const SCALE_MAX = 1.6;

const STATIC_TIME_MS = 3400; // reduced-motion freeze: 153deg into the 8.0s lap

interface Tokens {
  fg: string;
  muted: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const muted = cs.getPropertyValue("--ns-muted").trim();
  if (!fg || !muted) return null; // not loaded yet — no paint before this
  return { fg, muted };
}

interface Geo {
  W: number;
  H: number;
  minDim: number;
  cx: number;
  cy: number;
  scale: number;
  drumRadius: number;
  facetRadius: number;
  lampRadius: number;
}

function computeGeo(W: number, H: number): Geo {
  const minDim = Math.min(W, H);
  const scale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, minDim / REF_DIM));
  return {
    W,
    H,
    minDim,
    cx: W / 2,
    cy: H / 2,
    scale,
    drumRadius: minDim * DRUM_RADIUS_FRAC,
    facetRadius: minDim * FACET_RADIUS_FRAC,
    lampRadius: minDim * LAMP_RADIUS_FRAC,
  };
}

/** signed angular difference a-b wrapped to [-180, 180] */
function angleDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function gaussian(diffDeg: number, sigmaDeg: number): number {
  return Math.exp(-(diffDeg * diffDeg) / (2 * sigmaDeg * sigmaDeg));
}

/** pure function of elapsed ms — same code path drives the live loop and the
 * reduced-motion freeze, so there is exactly one source of truth for angle. */
function rotationAngleAt(elapsedMs: number): number {
  return (elapsedMs * ROTATION_DEG_PER_MS) % 360;
}

function drawHaze(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, elapsedMs: number) {
  const t = (elapsedMs % HAZE_DRIFT_PERIOD_MS) / HAZE_DRIFT_PERIOD_MS;
  const driftX = Math.sin(t * Math.PI * 2) * geo.minDim * HAZE_DRIFT_AMPL_FRAC;
  const driftY = Math.cos(t * Math.PI * 2) * geo.minDim * HAZE_DRIFT_AMPL_FRAC * 0.4;
  const grad = ctx.createRadialGradient(
    geo.cx + driftX,
    geo.cy + driftY,
    0,
    geo.cx + driftX,
    geo.cy + driftY,
    geo.drumRadius * 2.4,
  );
  grad.addColorStop(0, tokens.fg);
  grad.addColorStop(1, tokens.muted);
  ctx.save();
  ctx.globalAlpha = HAZE_PEAK_ALPHA;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(geo.cx + driftX, geo.cy + driftY, geo.drumRadius * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, geo: Geo, tokens: Tokens, elapsedMs: number) {
  ctx.clearRect(0, 0, geo.W, geo.H);
  drawHaze(ctx, geo, tokens, elapsedMs);

  // drum housing ring — a separator-weight structural ring, never a fill
  ctx.save();
  ctx.strokeStyle = tokens.muted;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.25 * geo.scale;
  ctx.beginPath();
  ctx.arc(geo.cx, geo.cy, geo.drumRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const rotation = rotationAngleAt(elapsedMs);
  let primaryAlpha = 0;

  for (let i = 0; i < FACET_COUNT; i++) {
    const baseAngle = i * FACET_SPACING_DEG;
    const angle = (baseAngle + rotation) % 360;
    const diff = angleDiff(angle, CAMERA_BEARING_DEG);
    const isPrimary = i === PRIMARY_INDEX;
    const sigma = isPrimary ? PRIMARY_SIGMA_DEG : FACET_GLINT_SIGMA_DEG;
    const peak = isPrimary ? PRIMARY_PEAK_ALPHA : FACET_GLINT_PEAK_ALPHA;
    const intensity = gaussian(diff, sigma) * peak;
    if (isPrimary) primaryAlpha = intensity;

    const rad = (angle * Math.PI) / 180;
    // 0deg = up (12 o'clock), clockwise
    const fx = geo.cx + Math.sin(rad) * geo.drumRadius;
    const fy = geo.cy - Math.cos(rad) * geo.drumRadius;
    const r = geo.facetRadius * (isPrimary ? PRIMARY_WIDTH_MULT : 1) * geo.scale;
    const restAlpha = isPrimary ? 0.22 : 0.14;

    ctx.save();
    ctx.fillStyle = tokens.fg;
    if (isPrimary && intensity > 0.02) {
      ctx.shadowColor = tokens.fg;
      ctx.shadowBlur = PRIMARY_HALO_BLUR_PX * geo.scale * intensity;
    }
    ctx.globalAlpha = Math.max(restAlpha, intensity);
    ctx.beginPath();
    ctx.arc(fx, fy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // the primary beam lobe: a soft cone from the drum edge toward the camera
  // marker (up), only visible while the primary facet is aligned — ramps in
  // and out with primaryAlpha rather than ever snapping on/off.
  if (primaryAlpha > 0.01) {
    const grad = ctx.createLinearGradient(geo.cx, geo.cy - geo.drumRadius, geo.cx, 0);
    grad.addColorStop(0, tokens.fg);
    grad.addColorStop(1, tokens.muted);
    ctx.save();
    ctx.globalAlpha = primaryAlpha * BEAM_LOBE_MAX_ALPHA;
    ctx.fillStyle = grad;
    const halfSpread = geo.drumRadius * 0.55;
    ctx.beginPath();
    ctx.moveTo(geo.cx - geo.facetRadius * geo.scale, geo.cy - geo.drumRadius);
    ctx.lineTo(geo.cx + geo.facetRadius * geo.scale, geo.cy - geo.drumRadius);
    ctx.lineTo(geo.cx + halfSpread, 0);
    ctx.lineTo(geo.cx - halfSpread, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // fixed central lamp — constant, unrelated to rotation
  ctx.save();
  ctx.fillStyle = tokens.fg;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(geo.cx, geo.cy, geo.lampRadius * geo.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface FresnelFlashGroupProps {
  /** content rendered over the field (headline, section label, CTA) */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FresnelFlashGroup({ children, className = "" }: FresnelFlashGroupProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let geo: Geo = computeGeo(1, 1);
    let sized = false;
    let visible = true;

    let startMs = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(geo.W * dpr));
      canvas.height = Math.max(1, Math.round(geo.H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const render = (elapsedMs: number) => {
      if (!tokens || !sized) return;
      drawScene(ctx, geo, tokens, elapsedMs);
    };

    const resizeAll = () => {
      if (!tokens) return;
      const rect = root.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      geo = computeGeo(rect.width, rect.height);
      fitCanvas();
      sized = true;
    };

    const loop = (nowRaf: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // IntersectionObserver re-arms this on re-entering view
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (startMs === 0) startMs = nowRaf;
      render(nowRaf - startMs);
    };

    const buildReducedFrame = () => {
      if (!tokens || !sized) return;
      drawScene(ctx, geo, tokens, STATIC_TIME_MS);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        buildReducedFrame();
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

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resizeAll();
      if (reduced) buildReducedFrame();
      kick();
    });
    ro.observe(root);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (tokens) {
        resizeAll();
        if (reduced) buildReducedFrame();
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
    io.observe(root);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={rootRef} className={`relative isolate min-h-[420px] w-full overflow-hidden bg-background ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      {children ? (
        <div className="relative z-10 mx-auto flex h-full min-h-[420px] w-full max-w-5xl flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          {children}
        </div>
      ) : null}
    </section>
  );
}
