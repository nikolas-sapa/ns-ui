"use client";

import { useEffect, useRef } from "react";

// KnifeEdgeRackFocus — a card-scale loader substitute built on the Foucault
// knife-edge test: a knife edge is racked (moved axially) through a mirror's
// point of focus, and the shadow pattern cast back across the aperture
// sweeps from one side to a flat uniform grey exactly at the null, then to
// the other side. A local zone that departs from the ideal sphere crosses
// that null at a slightly different knife position than its neighbours, so
// it reads as a ring rising or sinking out of the otherwise-flat field —
// which is the real diagnostic signal a real optician is looking for.
//
// RENDERING: rather than raster a 2D field, the whole pattern collapses to
// ONE function of radius, L(r, t) = clamp(0.5 + K*(t - offset(r)), 0, 1),
// because each of the 4 baked zonal errors is a concentric shell and every
// point at the same radius shares the same optical path. offset(r) is a
// piecewise-linear interpolation between 4 anchor offsets at r = 0.25, 0.5,
// 0.7, 0.9 (of disc radius), spaced 0.12 apart, extrapolated flat beyond the
// anchors. That single 1D function is sampled at 48 points and painted as
// one radial CanvasGradient per frame — cheap, and the smoothness of a real
// shadow front comes for free from the gradient interpolation instead of a
// pixel raster.
//
// THE RACK is a triangle wave in knife position t, [-1, 1], 8s out + 8s
// back (16s full period) — never a reset, a real tester racks back and
// forth to bracket the null repeatedly. Exactly at a null (|t| < 0.05) the
// drive itself PAUSES for ~0.6s before continuing, mirroring how a real
// tester dwells there; that pause, not the sweep, is the clearest single
// followable event.
//
// Colours: the shadow ramp spans --foreground (dark) to --background
// (light) directly — this is a literal light/shadow phenomenon in both
// themes, so the mapping never inverts, only the read stays a shadow.
// --border is never used as a fill/stroke (it is a separator token only).

const RACK_PERIOD_S = 16; // 8s out + 8s back
const NULL_WINDOW = 0.05; // |t| under this counts as "at the null"
const NULL_DWELL_S = 0.6;
const SHADOW_K = 1.8;
const ZONE_ANCHORS = [0.25, 0.5, 0.7, 0.9];
const ZONE_OFFSETS = [-0.18, -0.06, 0.06, 0.18]; // spaced 0.12 apart
const RADIUS_RATIO = 0.42; // disc radius = 0.42 * min(w, h)
const GRADIENT_STEPS = 48;
const GRADIENT_REACH = 1.05; // sample slightly past the rim for a soft edge

// reduced-motion freeze frame: t = 0.3, named "half-sweep-zoned" — clear
// rise/fall banding across all 4 zones is visible here, unlike the null
// itself (t = 0) which is nearly featureless and would under-inform a
// static viewer. Deliberately not t0/the null.
const FREEZE_LABEL = "half-sweep-zoned";
const FREEZE_T = 0.3;

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
  ];
}

function rgbToCss([r, g, b]: RGB): string {
  return `rgb(${r},${g},${b})`;
}

// offset(r): piecewise-linear through the 4 anchors, flat-clamped outside
function zoneOffsetAt(rFrac: number): number {
  if (rFrac <= ZONE_ANCHORS[0]!) return ZONE_OFFSETS[0]!;
  if (rFrac >= ZONE_ANCHORS[ZONE_ANCHORS.length - 1]!) {
    return ZONE_OFFSETS[ZONE_OFFSETS.length - 1]!;
  }
  for (let i = 0; i < ZONE_ANCHORS.length - 1; i++) {
    const a0 = ZONE_ANCHORS[i]!;
    const a1 = ZONE_ANCHORS[i + 1]!;
    if (rFrac >= a0 && rFrac <= a1) {
      const f = (rFrac - a0) / (a1 - a0);
      return ZONE_OFFSETS[i]! + (ZONE_OFFSETS[i + 1]! - ZONE_OFFSETS[i]!) * f;
    }
  }
  return 0;
}

function shadowL(rFrac: number, t: number): number {
  return Math.max(0, Math.min(1, 0.5 + SHADOW_K * (t - zoneOffsetAt(rFrac))));
}

// triangle wave over RACK_PERIOD_S, driveTime -> t in [-1, 1]
function triangleT(driveTime: number): number {
  const ph = ((driveTime / RACK_PERIOD_S) % 1 + 1) % 1;
  return ph < 0.5 ? -1 + 4 * ph : 1 - 4 * (ph - 0.5);
}

// nearest null (t = 0) as a driveTime value, mod RACK_PERIOD_S: nulls occur
// at ph = 0.25 and ph = 0.75
function nearestNullDriveTime(driveTime: number): number {
  const period = RACK_PERIOD_S;
  const ph = ((driveTime / period) % 1 + 1) % 1;
  const candidates = [0.25, 0.75];
  let best = candidates[0]!;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.min(Math.abs(ph - c), 1 - Math.abs(ph - c));
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  const base = Math.floor(driveTime / period) * period;
  return base + best * period;
}

export interface KnifeEdgeRackFocusProps {
  /** accessible status text announced to assistive tech */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function KnifeEdgeRackFocus({
  label = "Testing",
  className = "",
}: KnifeEdgeRackFocusProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let radius = 0;

    let fg: RGB = [23, 23, 23];
    let bg: RGB = [255, 255, 255];

    // no paint before this first read
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? fg;
      bg = parseHex(cs.getPropertyValue("--background")) ?? bg;
    };

    const build = () => {
      const rect = container.getBoundingClientRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      radius = RADIUS_RATIO * Math.min(w, h);
    };

    // the shadow pattern is one function of radius, painted as a single
    // radial gradient — the smoothness of a real shadow front comes free
    // from gradient interpolation rather than a pixel raster
    const drawDisc = (t: number, showPausedRing: boolean) => {
      if (w < 2 || h < 2 || radius <= 0) return;
      const cx = w / 2;
      const cy = h / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * GRADIENT_REACH);
      for (let i = 0; i <= GRADIENT_STEPS; i++) {
        const stop = i / GRADIENT_STEPS;
        const rFrac = stop / GRADIENT_REACH;
        const L = shadowL(Math.min(1, rFrac), t);
        grad.addColorStop(stop, rgbToCss(mixRGB(fg, bg, L)));
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // a manual "hold" affordance while the user is pausing the rack at a
      // null — foreground only, never --border as a stroke and never accent
      if (showPausedRing) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},0.4)`;
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawReduced = () => {
      drawDisc(FREEZE_T, false);
    };

    let driveTime = 0;
    let dwelling = false;
    let dwellElapsed = 0;
    let userPaused = false;
    let pausedDriveTime = 0;
    let last = 0;

    const loop = (now: number) => {
      if (disposed || !visible) {
        raf = 0;
        return;
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      let t: number;
      if (userPaused) {
        t = triangleT(pausedDriveTime);
      } else if (dwelling) {
        dwellElapsed += dt;
        t = triangleT(driveTime);
        if (dwellElapsed >= NULL_DWELL_S) {
          dwelling = false;
          dwellElapsed = 0;
        }
      } else {
        driveTime += dt;
        t = triangleT(driveTime);
        if (Math.abs(t) < NULL_WINDOW) {
          dwelling = true;
          dwellElapsed = 0;
        }
      }

      drawDisc(t, userPaused);
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // press pauses the rack at the nearest null and holds it there; release
    // resumes the sweep from where it paused. Never alters the baked zone
    // profile, never touches SHADOW_K or the offsets.
    const onPointerDown = () => {
      pausedDriveTime = nearestNullDriveTime(driveTime);
      userPaused = true;
      drawDisc(triangleT(pausedDriveTime), true);
    };
    const endPause = () => {
      if (!userPaused) return;
      userPaused = false;
      driveTime = pausedDriveTime;
      dwelling = false;
      dwellElapsed = 0;
    };

    deriveColors();
    build();
    if (reduced) {
      drawReduced();
    } else {
      startLoop();
    }

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) drawReduced();
    });
    ro.observe(container);

    const mo = new MutationObserver(() => {
      deriveColors();
      if (reduced) {
        drawReduced();
      } else if (userPaused) {
        drawDisc(triangleT(pausedDriveTime), true);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced) startLoop();
    });
    io.observe(container);

    if (!reduced) {
      container.addEventListener("pointerdown", onPointerDown);
      container.addEventListener("pointerup", endPause);
      container.addEventListener("pointercancel", endPause);
      container.addEventListener("pointerleave", endPause);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointerup", endPause);
      container.removeEventListener("pointercancel", endPause);
      container.removeEventListener("pointerleave", endPause);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      className={`relative aspect-square w-full max-w-[280px] touch-none overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      <span className="sr-only">{label}</span>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export { FREEZE_LABEL };
