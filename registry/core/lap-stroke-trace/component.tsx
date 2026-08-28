"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// LapStrokeTrace — an ambient card texture reproducing pitch-lap polishing
// of an optical mirror blank, not a decorative rotating pattern. A pitch lap
// smaller than the workpiece is worked across the blank under pressure in a
// continuously-varying stroke (classically a "W-stroke" or randomised
// Prescott stroke) so no single point of the lap ever repeats the exact same
// path over the glass — repetition would print a ring or zone into the
// figure. Source: classical optical-shop / amateur-telescope-making mirror
// grinding-and-polishing practice (Texereau, "How to Make a Telescope";
// Ceravolo stroke patterns).
//
// The contact point is a single continuously-extended polyline, never a
// particle field, computed as the sum of two rotating vectors — workpiece
// rotation and lap-arm oscillation — at an irrational frequency ratio
// (workpiece rate x golden-ratio conjugate, phi^-1 ~= 0.618) so the traced
// path never closes and never visibly repeats: point(t) = center +
// A*(cos,sin)(2*pi*f_w*t) + B*(cos,sin)(2*pi*f_l*t), f_l = f_w * phi^-1.
// This is exactly the "two superimposed rotations" the real W-stroke
// combines (workpiece spin + lap-arm throw), not a Spirograph invented for
// its own sake — what keeps it reading as process rather than ornament is
// that only a short RECENT window of that path is ever drawn (8s of
// history, oldest 3s fading to nothing) rather than the full closed
// rosette a decorative spirograph shows, plus the disc/chuck framing and
// the pressure-dwell interaction below.
//
// Only one point is appended per animation frame (the parametric curve is
// sampled at display rate, not at a coarser deposit threshold), and points
// older than TRAIL_HISTORY_S are dropped every frame, so the resident trail
// is always a short, continuously-sliding window rather than an
// ever-growing array.
//
// Per-point brightness is age-based, not a flat fade: the freshest point
// (age 0) sits at full "head" brightness, decays to 40% of head brightness
// by TRAIL_FADE_START_S (the real lap's dwell has already moved on by
// then), then continues fading linearly from 40% to 0% over the remaining
// TRAIL_HISTORY_S - TRAIL_FADE_START_S before the point is dropped. Colour
// for a given brightness is a three-stop ramp — foreground (head) through
// ns-muted (the 40% point) to background (fully faded) — read live via
// getComputedStyle(documentElement) and re-derived on a MutationObserver,
// never a literal.
//
// Pointer proximity to a stroke segment (angle measured from disc centre)
// locally boosts that segment's brightness within a +/-15deg window,
// decaying back to baseline over ~500ms after the pointer leaves — the
// same "lap dwelling slightly longer while the operator checks pressure"
// idea as honing-crosshatch's hover-boosted deposit rate, but here it
// brightens EXISTING trail rather than depositing new strokes. This never
// touches --ns-accent, never changes f_w/f_l (that would read as the path
// skipping), and never pauses the base motion.
// ---------------------------------------------------------------------------

export interface LapStrokeTraceProps {
  /** card heading */
  title?: string;
  /** card body copy */
  description?: string;
  /** trailing link label; omit to render the card with no link */
  linkLabel?: string;
  /** link href, used only when linkLabel is set */
  href?: string;
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

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function rgbaString([r, g, b]: RGB, a: number): string {
  return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
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

const TWO_PI = Math.PI * 2;
const PHI_INV = (Math.sqrt(5) - 1) / 2; // ~0.618, irrational stroke ratio

const RADIUS_RATIO = 0.42; // disc radius = 0.42 * min(w, h)
const STROKE_WIDTH_DIVISOR = 180; // strokeWidth = min(w,h) / 180
const WORKPIECE_HZ = 0.05; // workpiece rev/s (slowed from real ~0.3-1 rev/s)
const LAP_HZ = WORKPIECE_HZ * PHI_INV; // lap-arm oscillation rate
const STROKE_THROW_RATIO = 0.78; // lap throw envelope, fraction of disc radius
const A_FRAC = 0.55; // workpiece-vector share of the stroke throw
const B_FRAC = 0.45; // lap-arm-vector share of the stroke throw

const TRAIL_HISTORY_S = 8; // total retained path
const TRAIL_FADE_START_S = 5; // fully-bright-window boundary -> 40% point
const FADE_TAIL_S = TRAIL_HISTORY_S - TRAIL_FADE_START_S; // 3s tail to 0%
const HEAD_BRIGHTNESS = 1;
const MID_BRIGHTNESS = 0.4; // peak trail luminance at the fade point

const HOVER_WINDOW_RAD = 15 * (Math.PI / 180); // +/-15deg local dwell window
const HOVER_DECAY_MS = 500;
const HOVER_TAU_MS = HOVER_DECAY_MS / 3;

// Reduced-motion freeze: run the deterministic (zero-phase) simulation
// forward to a fixed sim time and stop, rather than seeding a snapshot —
// "half-lap" is the named, deliberately non-t0 most-structured frame.
const STATIC_T_S = 6.0;
const FREEZE_PHASE = "half-lap";

interface TrailPoint {
  x: number;
  y: number;
  t: number; // sim-clock seconds
  angle: number; // angle from disc centre, for the hover window test
}

function wrapPi(a: number) {
  a = ((a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI;
  return a - Math.PI;
}

function brightnessForAge(age: number): number {
  if (age <= TRAIL_FADE_START_S) {
    const t = age / TRAIL_FADE_START_S;
    return HEAD_BRIGHTNESS + (MID_BRIGHTNESS - HEAD_BRIGHTNESS) * t;
  }
  const t = (age - TRAIL_FADE_START_S) / FADE_TAIL_S;
  return MID_BRIGHTNESS * Math.max(0, 1 - t);
}

export function LapStrokeTrace({
  title = "Mirror blank, pitch-lap polish",
  description = "A lap traces an unrepeating golden-ratio stroke across the blank, glowing brightest at its most recent pass so no zone ever prints twice.",
  linkLabel = "Read the stroke pattern",
  href = "#",
  className = "",
  style,
}: LapStrokeTraceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived colour, re-read on any theme class flip, never a literal --
    let background: RGB = [10, 10, 10];
    let muted: RGB = [143, 143, 143];
    let foreground: RGB = [237, 237, 237];
    let headColor: RGB = foreground;
    let midColor: RGB = muted;
    let baseColor: RGB = background;
    const relLuminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      background = parseColor(cs.getPropertyValue("--background")) ?? background;
      muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? muted;
      foreground = parseColor(cs.getPropertyValue("--foreground")) ?? foreground;
      baseColor = background;
      const isDark = relLuminance(background) < 0.5;
      if (isDark) {
        headColor = foreground;
        midColor = muted;
      } else {
        // light theme: same ramp direction, bias/contrast retuned (weld-pool
        // convention) rather than inverted, so the disc stays a coherent
        // value field in both themes.
        headColor = mixRGB(muted, foreground, 0.85);
        midColor = mixRGB(muted, foreground, 0.4);
      }
    };
    deriveColors();

    const colorForBrightness = (b: number): RGB => {
      if (b >= MID_BRIGHTNESS) {
        const t = (b - MID_BRIGHTNESS) / (HEAD_BRIGHTNESS - MID_BRIGHTNESS);
        return mixRGB(midColor, headColor, t);
      }
      const t = b / MID_BRIGHTNESS;
      return mixRGB(baseColor, midColor, t);
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cx = 0;
    let cy = 0;
    let discRadius = 0;
    let strokeWidth = 1;
    let A = 0;
    let B = 0;
    let visible = true;
    let raf = 0;
    let simTime = 0; // seconds, advances only while the loop actually runs
    let lastNow = 0;

    let trail: TrailPoint[] = [];

    // -- random initial phase per mount so two page loads don't trace an
    // identical arc; the reduced-motion path below deliberately ignores
    // this and always starts from zero phase for a reproducible freeze. --
    const rand = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
    const phaseW0 = rand() * TWO_PI;
    const phaseL0 = rand() * TWO_PI;

    let hovering = false;
    let hoverAngle = 0;
    let hoverEnvelope = 0;

    const pointAt = (t: number, pw0: number, pl0: number) => {
      const thetaW = TWO_PI * WORKPIECE_HZ * t + pw0;
      const thetaL = TWO_PI * LAP_HZ * t + pl0;
      const x = cx + A * Math.cos(thetaW) + B * Math.cos(thetaL);
      const y = cy + A * Math.sin(thetaW) + B * Math.sin(thetaL);
      return { x, y, angle: Math.atan2(y - cy, x - cx) };
    };

    const pruneTrail = () => {
      if (trail.length === 0) return;
      const cutoff = simTime - TRAIL_HISTORY_S;
      let i = 0;
      while (i < trail.length && (trail[i]?.t ?? Infinity) < cutoff) i++;
      if (i > 0) trail = trail.slice(i);
    };

    const hoverMultiplier = () => hoverEnvelope;

    const localBoost = (angle: number, mult: number): number => {
      if (mult <= 0.001) return 0;
      const d = Math.abs(wrapPi(angle - hoverAngle));
      if (d >= HOVER_WINDOW_RAD) return 0;
      const falloff = 0.5 * (1 + Math.cos((Math.PI * d) / HOVER_WINDOW_RAD));
      return mult * falloff;
    };

    const drawFrame = () => {
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, discRadius, 0, TWO_PI);
      ctx.clip();

      // blank surface: a faint radial value shift reading as glass, no hue.
      const blankGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, discRadius);
      blankGrad.addColorStop(0, rgbaString(mixRGB(baseColor, midColor, 0.05), 1));
      blankGrad.addColorStop(1, rgbaString(mixRGB(baseColor, midColor, 0.14), 1));
      ctx.fillStyle = blankGrad;
      ctx.fillRect(cx - discRadius, cy - discRadius, discRadius * 2, discRadius * 2);

      const mult = hoverMultiplier();
      ctx.lineCap = "round";
      ctx.lineWidth = strokeWidth;
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const cur = trail[i];
        if (!prev || !cur) continue;
        const age = simTime - cur.t;
        if (age < 0 || age >= TRAIL_HISTORY_S) continue;
        let brightness = brightnessForAge(age);
        const boost = localBoost(cur.angle, mult);
        if (boost > 0) brightness = brightness + (HEAD_BRIGHTNESS - brightness) * boost;
        const rgb = colorForBrightness(brightness);
        ctx.strokeStyle = rgbaString(rgb, 1);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
      }

      ctx.restore();

      // chuck framing: edge ring + centre mark, muted-derived, never --border.
      const ringColor = mixRGB(baseColor, midColor, 0.6);
      ctx.strokeStyle = rgbaString(ringColor, 0.55);
      ctx.lineWidth = Math.max(1, strokeWidth * 0.6);
      ctx.beginPath();
      ctx.arc(cx, cy, discRadius, 0, TWO_PI);
      ctx.stroke();

      ctx.fillStyle = rgbaString(ringColor, 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, strokeWidth * 0.9), 0, TWO_PI);
      ctx.fill();
    };

    const loop = (now: number) => {
      const dt = lastNow === 0 ? 0 : Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;
      simTime += dt;

      hoverEnvelope += ((hovering ? 1 : 0) - hoverEnvelope) * (1 - Math.exp(-dt * 1000 / HOVER_TAU_MS));

      const p = pointAt(simTime, phaseW0, phaseL0);
      trail.push({ x: p.x, y: p.y, t: simTime, angle: p.angle });
      pruneTrail();

      drawFrame();

      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };

    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        lastNow = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const buildStaticTrail = () => {
      // deterministic zero-phase run to STATIC_T_S, sampled at 60Hz to match
      // the live cadence, then rendered once with no loop.
      trail = [];
      const dt = 1 / 60;
      for (let t = 0; t <= STATIC_T_S; t += dt) {
        const p = pointAt(t, 0, 0);
        trail.push({ x: p.x, y: p.y, t, angle: p.angle });
      }
      simTime = STATIC_T_S;
      pruneTrail();
      drawFrame();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      cx = w / 2;
      cy = h / 2;
      const minDim = Math.min(w, h);
      discRadius = RADIUS_RATIO * minDim;
      strokeWidth = Math.max(1, minDim / STROKE_WIDTH_DIVISOR);
      const throw_ = STROKE_THROW_RATIO * discRadius;
      A = A_FRAC * throw_;
      B = B_FRAC * throw_;

      if (reduced) {
        buildStaticTrail();
      } else {
        drawFrame();
      }
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      deriveColors();
      drawFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        buildStaticTrail();
      } else {
        lastNow = 0;
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        wake();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const toLocal = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const { x, y } = toLocal(e.clientX, e.clientY);
      hovering = true;
      hoverAngle = Math.atan2(y - cy, x - cx);
    };
    const onPointerLeave = () => {
      hovering = false;
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointercancel", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointercancel", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-reduced-motion-freeze={FREEZE_PHASE}
      className={`ns-lap-stroke relative w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-auto absolute inset-0 h-full w-full" />
      <div ref={contentRef} className="pointer-events-none relative flex flex-col gap-3 p-6">
        <h3 className="text-balance font-sans text-lg font-medium text-foreground">{title}</h3>
        <p className="text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
        {linkLabel ? (
          <a
            href={href}
            className="pointer-events-auto mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-mono text-xs font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

LapStrokeTrace.displayName = "LapStrokeTrace";

export default LapStrokeTrace;
export { FREEZE_PHASE };
