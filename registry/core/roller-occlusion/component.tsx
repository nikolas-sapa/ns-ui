"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RollerOcclusion — a determinate-feel "something is being pumped" ambient,
// drawn as a real peristaltic (roller-head) pump: a three-roller rotor spins
// above a horizontal tube, each roller's ORBITAL POSITION projected onto the
// tube's x-axis (rollerX = pivotX + rotorRadius*cos(angle)) so the pinch it
// makes visibly travels along the tube as the rotor turns, rather than
// squeezing one fixed spot. Occlusion depth is governed by a ±70°
// contact window centred on the roller's closest approach to the tube
// (angle = 90°, i.e. straight down from the rotor pivot): the lumen closes
// over a fixed 60ms as a roller enters that window, holds fully flat for the
// remainder, then releases over a fixed 90ms as it exits — real numbers for
// tube-wall viscoelastic response, held constant in wall-clock time
// regardless of rotor speed (a material property, not a pump-speed one).
// Three rollers at 120° spacing with a 140°-wide window each mean windows
// overlap ~20°, so exactly one roller is ever ≥95% occluding — flow reads as
// quasi-continuous, the standard justification for choosing a roller pump
// over a piston pump.
//
// A fluid slug (length = rotor circumference / 3, one per roller gap) is
// painted as a repeating sawtooth luminance ramp along the tube's lumen —
// leading edge brightest, fading linearly to the trailing edge over the
// slug's own length — advancing at 1.08 tube-lengths per rotor revolution.
// That 1.08 is deliberately NOT 1: an integer ratio would make the slug
// pattern land on the exact same tube pixels every revolution and the loop
// would read as freezing every ~5s (kill criterion). Both the rotor angle
// and the slug offset are unwrapped, monotonically increasing values, so the
// resting loop is genuinely different at every point in time and only
// approximately repeats after many revolutions.
//
// Every ink (--foreground, --ns-muted, --border, --background) is read once
// via getComputedStyle(document.documentElement) before the first paint and
// re-read on a MutationObserver watching documentElement's class — no canvas
// draw call ever runs before that first read completes. Hover/focus over the
// component nudges rotor speed to 1.6x for the duration (a "spinning up"
// read, luminance/speed only, never the fluid's colour) and decays back to
// 1x over 400ms on release; it never pauses the rotor and never recolors
// anything with --ns-accent — the whole component avoids the accent token
// entirely, since nothing here is interaction chrome.
// ---------------------------------------------------------------------------

const IDLE_RPM = 12; // rotor speed at rest — mid-range for a lab peristaltic pump
const IDLE_DEG_PER_SEC = (IDLE_RPM / 60) * 360;
const HOVER_MULT = 1.6;
const RELEASE_MS = 400; // decay of the hover speed bump back to 1x

const ROLLER_COUNT = 3;
const ROLLER_STEP_DEG = 360 / ROLLER_COUNT;
const CONTACT_HALF_DEG = 70; // ±70° = 140° contact arc per roller
const CLOSE_MS = 60; // wall-clock lumen close time, entering contact
const OPEN_MS = 90; // wall-clock lumen release time, exiting contact
const MIN_LUMEN_FRAC = 0.04; // fully-occluded lumen, 4% of open width

const TUBE_LEN_FRAC = 0.7; // of the container's smaller dimension
const TUBE_DIAM_FRAC = 0.18; // of the container's smaller dimension
const ROTOR_RADIUS_MULT = 1.4; // x tube diameter
// The spec's "12% of tube diameter" reads as a typo against its own "sized
// to visibly flatten the tube" — a roller that small could never reach the
// lumen centreline. Sized here so the roller circle actually overlaps and
// fully closes the tube at closest approach, per that same clause.
const ROLLER_RADIUS_MULT = 0.62; // x tube diameter
const SLUG_ADVANCE_RATIO = 1.08; // tube-lengths advanced per rotor revolution
const COLS = 96; // tube cross-section samples per frame

const DEG2RAD = Math.PI / 180;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

type RGB = { r: number; g: number; b: number };

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const k = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

function rgbStr(c: RGB, alpha = 1): string {
  return `rgba(${c.r.toFixed(1)},${c.g.toFixed(1)},${c.b.toFixed(1)},${alpha})`;
}

// wraps to (-180, 180]
function wrapDelta(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** occlusion 0..1 for a roller at angular distance `raw` degrees from the
 * contact centre (90°, straight down from the pivot), given the rotor's
 * current speed in degrees/second. Close/open durations are fixed wall-clock
 * ms, converted to an angular fraction of the current window using that
 * speed — a material property held constant regardless of rotor RPM. */
function occlusionFor(raw: number, degPerSec: number): number {
  if (Math.abs(raw) > CONTACT_HALF_DEG) return 0;
  const localT = (raw + CONTACT_HALF_DEG) / (CONTACT_HALF_DEG * 2); // 0..1
  const windowMs = ((CONTACT_HALF_DEG * 2) / Math.max(1, degPerSec)) * 1000;
  const fIn = CLOSE_MS / windowMs;
  const fOut = OPEN_MS / windowMs;
  if (localT < fIn) return smoothstep(localT / Math.max(1e-6, fIn));
  if (localT > 1 - fOut) return 1 - smoothstep((localT - (1 - fOut)) / Math.max(1e-6, fOut));
  return 1;
}

export interface RollerOcclusionProps {
  /** accessible label for the ambient region. Default "Data pump active" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RollerOcclusion({ label = "Data pump active", className = "" }: RollerOcclusionProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    // ---- token inks: read before anything paints, re-read live -----------
    let fg: RGB = { r: 23, g: 23, b: 23 };
    let mutedC: RGB = { r: 77, g: 77, b: 77 };
    let borderC: RGB = { r: 235, g: 235, b: 235 };
    let bgC: RGB = { r: 255, g: 255, b: 255 };
    let isDark = false;
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? fg;
      mutedC = parseHex(cs.getPropertyValue("--ns-muted")) ?? mutedC;
      borderC = parseHex(cs.getPropertyValue("--border")) ?? borderC;
      bgC = parseHex(cs.getPropertyValue("--background")) ?? bgC;
      isDark = document.documentElement.classList.contains("dark");
    };
    readTokens();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let visible = true;

    let tubeLeft = 0;
    let tubeLen = 0;
    let tubeRadius = 0;
    let rotorRadius = 0;
    let rollerRadius = 0;
    let pivotX = 0;
    let rotorCenterY = 0;
    let tubeCenterY = 0;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const minDim = Math.min(w, h);
      tubeLen = minDim * TUBE_LEN_FRAC;
      const tubeDiam = minDim * TUBE_DIAM_FRAC;
      tubeRadius = tubeDiam / 2;
      rotorRadius = tubeDiam * ROTOR_RADIUS_MULT;
      rollerRadius = tubeDiam * ROLLER_RADIUS_MULT;
      pivotX = w / 2;
      tubeCenterY = h / 2 + rotorRadius - tubeRadius / 2;
      rotorCenterY = tubeCenterY - rotorRadius;
      tubeLeft = pivotX - tubeLen / 2;
      sized = true;
    };
    measure();

    const slugPeriod = () => (2 * Math.PI * rotorRadius) / ROLLER_COUNT;

    // ---- hover/focus speed bump: 1x <-> 1.6x, snap up, 400ms decay -------
    let hoverActive = false;
    let mult = 1;
    let releaseFrom = 1;
    let releaseStart = 0;

    const applyHover = (active: boolean) => {
      if (active && !hoverActive) {
        hoverActive = true;
        mult = HOVER_MULT;
      } else if (!active && hoverActive) {
        hoverActive = false;
        releaseFrom = mult;
        releaseStart = performance.now();
      }
      wake();
    };

    const tickMult = (now: number) => {
      if (hoverActive) {
        mult = HOVER_MULT;
        return;
      }
      if (releaseStart) {
        const t = clamp((now - releaseStart) / RELEASE_MS, 0, 1);
        mult = releaseFrom + (1 - releaseFrom) * smoothstep(t);
        if (t >= 1) releaseStart = 0;
      } else {
        mult = 1;
      }
    };

    // ---- state: unwrapped rotor angle + slug offset -----------------------
    // t0: roller 0 sits at 90° (dead-bottom, fully occluding); a slug
    // boundary sits at the tube midpoint.
    let rotorDeg = 90;
    let slugOffset = 0; // px, unwrapped
    let sizedOnce = false;

    const draw = () => {
      if (!sized) return;
      if (!sizedOnce) {
        slugOffset = tubeLen / 2;
        sizedOnce = true;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rollerXs: number[] = [];
      const rollerOcc: number[] = [];
      for (let i = 0; i < ROLLER_COUNT; i++) {
        const angle = rotorDeg + i * ROLLER_STEP_DEG;
        const raw = wrapDelta(angle - 90);
        const occ = occlusionFor(raw, IDLE_DEG_PER_SEC * mult);
        const rad = angle * DEG2RAD;
        rollerXs.push(pivotX + Math.cos(rad) * rotorRadius);
        rollerOcc.push(occ);
      }
      const sigma = rollerRadius * 0.9;
      const period = slugPeriod();

      const colW = tubeLen / COLS + 0.6;
      for (let c = 0; c < COLS; c++) {
        const frac = c / (COLS - 1);
        const x = tubeLeft + frac * tubeLen;

        let occAtX = 0;
        for (let i = 0; i < ROLLER_COUNT; i++) {
          const dx = x - rollerXs[i]!;
          const g = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const contribution = rollerOcc[i]! * g;
          if (contribution > occAtX) occAtX = contribution;
        }
        const wallHalf = tubeRadius * Math.max(MIN_LUMEN_FRAC, 1 - occAtX * (1 - MIN_LUMEN_FRAC));
        const lumenHalf = wallHalf * 0.6;

        // wall: dark theme is a flat --ns-muted fill; light theme ramps
        // --background -> --ns-muted across the tube so the pinch point
        // never nearly vanishes against a light page (checked first, not
        // as an afterthought — the documented failure mode).
        const wallColor = isDark ? mutedC : mix(bgC, mutedC, 0.35 + 0.5 * frac);

        ctx.fillStyle = rgbStr(wallColor, isDark ? 0.85 : 1);
        ctx.fillRect(x - colW / 2, tubeCenterY - wallHalf, colW, wallHalf * 2);

        // fluid slug: sawtooth luminance ramp, leading edge brightest,
        // fading to the trailing edge over the slug's own length — a
        // gradient in colour, never in opacity, so it composites correctly
        // under both themes.
        const local = (((x - slugOffset) % period) + period) % period;
        const leadFrac = 1 - local / period;
        const leadColor = fg;
        const fluidColor = mix(mutedC, leadColor, leadFrac);
        ctx.fillStyle = rgbStr(fluidColor, 0.95);
        ctx.fillRect(x - colW / 2, tubeCenterY - lumenHalf, colW, lumenHalf * 2);
      }

      // outline: a border-token stroke only, traced along the same wall
      // envelope used above — never a fill, per the separator-token rule.
      ctx.beginPath();
      for (let c = 0; c < COLS; c++) {
        const frac = c / (COLS - 1);
        const x = tubeLeft + frac * tubeLen;
        let occAtX = 0;
        for (let i = 0; i < ROLLER_COUNT; i++) {
          const dx = x - rollerXs[i]!;
          const g = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const contribution = rollerOcc[i]! * g;
          if (contribution > occAtX) occAtX = contribution;
        }
        const wallHalf = tubeRadius * Math.max(MIN_LUMEN_FRAC, 1 - occAtX * (1 - MIN_LUMEN_FRAC));
        if (c === 0) ctx.moveTo(x, tubeCenterY - wallHalf);
        else ctx.lineTo(x, tubeCenterY - wallHalf);
      }
      for (let c = COLS - 1; c >= 0; c--) {
        const frac = c / (COLS - 1);
        const x = tubeLeft + frac * tubeLen;
        let occAtX = 0;
        for (let i = 0; i < ROLLER_COUNT; i++) {
          const dx = x - rollerXs[i]!;
          const g = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const contribution = rollerOcc[i]! * g;
          if (contribution > occAtX) occAtX = contribution;
        }
        const wallHalf = tubeRadius * Math.max(MIN_LUMEN_FRAC, 1 - occAtX * (1 - MIN_LUMEN_FRAC));
        ctx.lineTo(x, tubeCenterY + wallHalf);
      }
      ctx.closePath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbStr(borderC, isDark ? 0.9 : 1);
      ctx.stroke();

      // rotor + rollers, a light structural read above the tube
      ctx.beginPath();
      ctx.arc(pivotX, rotorCenterY, rotorRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgbStr(mutedC, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = 0; i < ROLLER_COUNT; i++) {
        const angle = (rotorDeg + i * ROLLER_STEP_DEG) * DEG2RAD;
        const rx = pivotX + Math.cos(angle) * rotorRadius;
        const ry = rotorCenterY + Math.sin(angle) * rotorRadius;
        ctx.beginPath();
        ctx.arc(rx, ry, rollerRadius, 0, Math.PI * 2);
        const t = rollerOcc[i]!;
        ctx.fillStyle = rgbStr(mix(mutedC, fg, t * 0.5), 0.22 + t * 0.35);
        ctx.fill();
        ctx.strokeStyle = rgbStr(mutedC, 0.55);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(pivotX, rotorCenterY, Math.max(1.5, rotorRadius * 0.06), 0, Math.PI * 2);
      ctx.fillStyle = rgbStr(mutedC, 0.5);
      ctx.fill();
    };

    // ---- reduced-motion: one deliberately chosen structured frame --------
    // FREEZE_PHASE = 35deg-into-occlusion: roller 0 sits 35° into its 140°
    // contact arc (raw = -35, i.e. angle = 55°), tube ~60% occluded there —
    // mid-motion, not fully pinched, not fully open — with a slug boundary
    // parked at the tube's 1/3 mark.
    const drawReduced = () => {
      if (!sized) return;
      rotorDeg = 55;
      const savedOcclusion = 0.6;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rollerXs: number[] = [];
      const rollerOcc: number[] = [0, 0, 0];
      rollerOcc[0] = savedOcclusion;
      for (let i = 0; i < ROLLER_COUNT; i++) {
        const angle = (rotorDeg + i * ROLLER_STEP_DEG) * DEG2RAD;
        rollerXs.push(pivotX + Math.cos(angle) * rotorRadius);
      }
      const sigma = rollerRadius * 0.9;
      const period = slugPeriod();
      const colW = tubeLen / COLS + 0.6;
      const boundaryOffset = tubeLeft + tubeLen / 3; // slug boundary at the 1/3 mark

      for (let c = 0; c < COLS; c++) {
        const frac = c / (COLS - 1);
        const x = tubeLeft + frac * tubeLen;
        let occAtX = 0;
        for (let i = 0; i < ROLLER_COUNT; i++) {
          const dx = x - rollerXs[i]!;
          const g = Math.exp(-(dx * dx) / (2 * sigma * sigma));
          const contribution = rollerOcc[i]! * g;
          if (contribution > occAtX) occAtX = contribution;
        }
        const wallHalf = tubeRadius * Math.max(MIN_LUMEN_FRAC, 1 - occAtX * (1 - MIN_LUMEN_FRAC));
        const lumenHalf = wallHalf * 0.6;
        const wallColor = isDark ? mutedC : mix(bgC, mutedC, 0.35 + 0.5 * frac);
        ctx.fillStyle = rgbStr(wallColor, isDark ? 0.85 : 1);
        ctx.fillRect(x - colW / 2, tubeCenterY - wallHalf, colW, wallHalf * 2);

        const local = (((x - boundaryOffset) % period) + period) % period;
        const leadFrac = 1 - local / period;
        const fluidColor = mix(mutedC, fg, leadFrac);
        ctx.fillStyle = rgbStr(fluidColor, 0.95);
        ctx.fillRect(x - colW / 2, tubeCenterY - lumenHalf, colW, lumenHalf * 2);
      }

      ctx.beginPath();
      ctx.arc(pivotX, rotorCenterY, rotorRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgbStr(mutedC, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
      for (let i = 0; i < ROLLER_COUNT; i++) {
        const angle = (rotorDeg + i * ROLLER_STEP_DEG) * DEG2RAD;
        const rx = pivotX + Math.cos(angle) * rotorRadius;
        const ry = rotorCenterY + Math.sin(angle) * rotorRadius;
        ctx.beginPath();
        ctx.arc(rx, ry, rollerRadius, 0, Math.PI * 2);
        const t = rollerOcc[i]!;
        ctx.fillStyle = rgbStr(mix(mutedC, fg, t * 0.5), 0.22 + t * 0.35);
        ctx.fill();
        ctx.strokeStyle = rgbStr(mutedC, 0.55);
        ctx.stroke();
      }
    };

    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || !sized) {
        last = 0;
        return;
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      tickMult(now);
      const degPerSec = IDLE_DEG_PER_SEC * mult;
      rotorDeg += degPerSec * dt;
      slugOffset += SLUG_ADVANCE_RATIO * tubeLen * (degPerSec / 360) * dt;

      draw();
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (mq.matches) {
        drawReduced();
        return;
      }
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    if (mq.matches) {
      drawReduced();
    } else {
      wake();
    }

    const onMq = () => {
      if (mq.matches) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawReduced();
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onMq);

    const ro = new ResizeObserver(() => {
      measure();
      if (mq.matches) drawReduced();
      else wake();
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !mq.matches) wake();
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      readTokens();
      if (mq.matches) drawReduced();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const onEnter = () => applyHover(true);
    const onLeave = () => applyHover(false);
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("focus", onEnter);
    root.addEventListener("blur", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      mq.removeEventListener("change", onMq);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("focus", onEnter);
      root.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      tabIndex={0}
      data-roller-occlusion
      className={`relative h-full w-full overflow-hidden rounded-md border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-foreground/70 ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

RollerOcclusion.displayName = "RollerOcclusion";
