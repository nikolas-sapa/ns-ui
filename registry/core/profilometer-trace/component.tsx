"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ProfilometerTrace — a section divider rendered as a live contact
// profilometer readout: a diamond stylus dragged across a surface at
// constant speed, its vertical deflection recorded as a trace that
// decomposes into roughness (short-wavelength) and waviness (longer-
// wavelength) components, per the standard ISO 4287 / ASME B46.1
// roughness-measurement cutoff-filter convention.
//
// A fixed stylus sits near the right edge of the band. The measured
// surface's trace scrolls continuously beneath it, right to left, at a
// constant real-time rate — old excursions exit the left edge, new ones
// enter at the right, forever. The trace itself is NOT a ring buffer of
// discrete samples pushed/shifted every tick: it is a closed-form function
// of world-space x (continuous, seeded, deterministic) sampled fresh at
// whatever scroll offset the clock has reached. That makes a wrap seam
// structurally impossible rather than something to avoid by bookkeeping —
// there is no wrap, no buffer edge, just a sliding window over an infinite
// deterministic field.
//
// height(x) = 0.6 * valueNoise(x, 18px) + 0.4 * valueNoise(x, 54px)   -- roughness, 2 octaves
//           + 0.4 * sin(2*PI*x / 240px)                               -- waviness, 0.4x roughness amplitude
// normalized to peak deflection = 0.35 * band height.
//
// Scroll offset advances by realSpeed * dt every frame (dt = clamped real
// elapsed ms, never raw frame count) so the rate is identical at 30Hz or
// 144Hz displays. Hovering the band eases realSpeed toward 40% of base
// (a 60% slowdown, never a full stop) and eases back to 100% over 400ms
// after the pointer leaves — a global rate change, not a per-x warp, so
// the trace never tears or shows two speeds across one continuous curve.
// ---------------------------------------------------------------------------

const SPEED_PX_S = 24; // base scroll speed, px/s
const SAMPLE_PITCH = 4; // px between polyline vertices (visual resolution, not a buffer)
const STYLUS_X_FRAC = 0.82; // stylus fixed position, fraction of band width
const PEAK_RATIO = 0.35; // peak deflection = PEAK_RATIO * band height
const ROUGH_WL_A = 18; // roughness octave A wavelength, px
const ROUGH_WL_B = 54; // roughness octave B wavelength, px
const WAVE_WL = 240; // waviness wavelength, px
const WAVE_AMP_RATIO = 0.4; // waviness amplitude, relative to roughness amplitude
const ROUGH_WEIGHT_A = 0.6;
const ROUGH_WEIGHT_B = 0.4;
const RAW_ENVELOPE = ROUGH_WEIGHT_A + ROUGH_WEIGHT_B + WAVE_AMP_RATIO; // normalizer

const HOVER_SLOWDOWN = 0.4; // minimum speed multiplier under the pointer
const HOVER_ENGAGE_MS = 150; // ease-in time constant
const HOVER_RELEASE_MS = 400; // ease-out time constant, per spec

const SEED = 0x9e3779b9;

function hash1(i: number): number {
  let t = (i ^ SEED) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return u * 2 - 1; // [-1, 1]
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// deterministic 1D value noise: hashed lattice at `wavelength` spacing,
// smoothstep-interpolated so it is continuous (and therefore seamless at
// any sampling offset) rather than a discrete buffer.
function valueNoise(x: number, wavelength: number): number {
  const p = x / wavelength;
  const i0 = Math.floor(p);
  const f = smooth(p - i0);
  const a = hash1(i0);
  const b = hash1(i0 + 1);
  return a + (b - a) * f;
}

function traceHeight(worldX: number): number {
  const rough =
    ROUGH_WEIGHT_A * valueNoise(worldX, ROUGH_WL_A) +
    ROUGH_WEIGHT_B * valueNoise(worldX, ROUGH_WL_B);
  const wave = WAVE_AMP_RATIO * Math.sin((2 * Math.PI * worldX) / WAVE_WL);
  return (rough + wave) / RAW_ENVELOPE; // normalized to roughly [-1, 1]
}

export interface ProfilometerTraceProps {
  /** band height in px (divider scale). Default 56. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ProfilometerTrace({
  height = 56,
  className = "",
}: ProfilometerTraceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // -- token-derived ink: nothing paints until the first successful read --
    let fg = "";
    let mu = "";
    let ready = false;
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const nfg = cs.getPropertyValue("--foreground").trim();
      const nmu = cs.getPropertyValue("--ns-muted").trim();
      if (nfg) fg = nfg;
      if (nmu) mu = nmu;
      ready = fg.length > 0 && mu.length > 0;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = true;
    let raf = 0;
    let last = 0;

    let scrollX = 0; // world-space offset of the left edge of the visible band
    let speedMult = 1; // current speed multiplier, eased toward hoverTarget
    let hoverTarget = 1;

    const draw = () => {
      if (!ready || w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const midY = h / 2;
      const amp = PEAK_RATIO * h;

      // zero-line reference: a subordinate --ns-muted hairline, never a
      // --border stroke (--border is a separator token, ~1.1:1 contrast in
      // light theme, and would make the trace-vs-baseline read fail exactly
      // where the spec demands separation).
      ctx.strokeStyle = mu;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const zy = Math.round(midY) + 0.5;
      ctx.moveTo(0, zy);
      ctx.lineTo(w, zy);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // trace polyline, sampled at SAMPLE_PITCH from the continuous field —
      // no buffer, no wrap, no seam.
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      let started = false;
      let stylusY = midY;
      const stylusScreenX = w * STYLUS_X_FRAC;
      for (let sx = 0; sx <= w; sx += SAMPLE_PITCH) {
        const worldX = scrollX + sx;
        const y = midY - traceHeight(worldX) * amp;
        if (!started) {
          ctx.moveTo(sx, y);
          started = true;
        } else {
          ctx.lineTo(sx, y);
        }
        if (sx <= stylusScreenX && sx + SAMPLE_PITCH > stylusScreenX) {
          stylusY = y;
        }
      }
      ctx.stroke();

      // stylus: a fixed vertical stroke whose length matches the trace
      // height directly beneath it (the "drop-off" read), plus a tip dot.
      const stylusWorldX = scrollX + stylusScreenX;
      stylusY = midY - traceHeight(stylusWorldX) * amp;
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(Math.round(stylusScreenX) + 0.5, midY);
      ctx.lineTo(Math.round(stylusScreenX) + 0.5, stylusY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(stylusScreenX, stylusY, 2, 0, Math.PI * 2);
      ctx.fill();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      const dt = Math.min(50, last === 0 ? 16.7 : now - last);
      last = now;
      const engageMs = hoverTarget < speedMult ? HOVER_ENGAGE_MS : HOVER_RELEASE_MS;
      speedMult += (hoverTarget - speedMult) * Math.min(1, dt / engageMs);
      scrollX += (SPEED_PX_S / 1000) * dt * speedMult;
      draw();
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (raf === 0 && visible && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    // -- reduced motion: find the deterministic phase where the stylus sits
    // directly over the deepest valley in the visible band, freeze there,
    // never start rAF. Named FREEZE_PHASE = deep-valley-lock. -------------
    const freezeAtDeepValley = () => {
      if (w <= 0) return;
      const stylusScreenX = w * STYLUS_X_FRAC;
      const searchSpan = WAVE_WL * 4; // several waviness periods, deterministic
      let bestOffset = 0;
      let bestVal = Infinity;
      for (let off = 0; off < searchSpan; off += 1) {
        const v = traceHeight(off + stylusScreenX);
        if (v < bestVal) {
          bestVal = v;
          bestOffset = off;
        }
      }
      scrollX = bestOffset;
      speedMult = 1;
      draw();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (reduced) {
        freezeAtDeepValley();
      } else {
        draw();
      }
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) {
        last = 0;
        wake();
      }
    });
    io.observe(root);

    const onVisibility = () => {
      visible = !document.hidden && visible;
      if (!document.hidden) {
        last = 0;
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // -- hover: global speed multiplier only, never a per-x warp (per-x
    // warping would move different parts of one continuous curve at
    // different rates and tear it — the exact seam the spec forbids). -----
    const onEnter = () => {
      if (reduced) return;
      hoverTarget = HOVER_SLOWDOWN;
      wake();
    };
    const onLeave = () => {
      if (reduced) return;
      hoverTarget = 1;
      wake();
    };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointerleave", onLeave);

    document.fonts.ready.then(() => {
      derive();
      if (reduced) freezeAtDeepValley();
      else draw();
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [height]);

  return (
    <div
      ref={rootRef}
      role="separator"
      aria-orientation="horizontal"
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height }}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
