"use client";

import { useEffect, useRef } from "react";

// GrindingChatterLobes — a card-scale loader substitute built on regenerative
// chatter in cylindrical (OD) grinding (Tobias/Merritt theory as applied to
// grinding-process control): the wheel re-cuts the wavy profile its own
// previous pass left on the workpiece, and under the right speed ratio that
// wave self-amplifies into a stable N-lobed pattern before saturating against
// contact stiffness. A dress event clears the regenerative memory and a new
// lobe count begins. Canvas 2D, DPR clamp 2, direct-DOM rAF, sleeps for
// nothing (the loop is unbounded by design — this stands in for "busy").
// The rim profile is recomputed from a coefficient (N, amplitude, phase)
// every frame, never accumulated pixel history, so cost stays flat.

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

const LOBE_COUNTS = [5, 6, 7, 8, 9, 10, 11];
const WORKPIECE_REV_PER_S = 0.15; // slowed from real 1-5 rev/s wheelhead speeds
const RADIUS_RATIO = 0.38; // disc radius = 0.38 * min(w, h)
const AMAX_RATIO = 0.06; // Amax = 0.06 * radius
const GROWTH_S = 40; // dress event every 40s
const DRESS_MS = 1200; // lobes fade to a smooth circle over 1.2s
const PERIOD_S = GROWTH_S + DRESS_MS / 1000;
// logistic center + rate chosen so amplitude visibly ramps ~5% -> ~95% of
// Amax over the first 6s of a growth cycle, then plateaus (self-limiting
// saturation against contact stiffness, not unbounded growth).
const LOGISTIC_CENTER_S = 3;
const LOGISTIC_RATE = Math.log(19) / 3;

const BOOST_WINDOW_RAD = 15 * DEG; // half-width of the 30deg pointer window
const BOOST_MULT = 1.5; // local amplitude growth boost while pointer is near
const BOOST_TAU_MS = 500 / 3; // ~3 tau to settle within the spec's 500ms decay

// reduced-motion freeze frame: a static mid-growth profile, not tied to the
// live logistic curve's exact constants — deliberately the most structured
// single frame, named explicitly per the round 9 rule.
const FREEZE_PHASE = "lobe-70pct";
const FREEZE_AMPLITUDE_RATIO = 0.7;
const FREEZE_LOBE_COUNT = 8;
const FREEZE_ROTATION_RAD = -20 * DEG;

const BINS = 360;

function wrapPi(a: number) {
  a = ((a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI;
  return a - Math.PI;
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

function logisticAmplitude(t: number, amax: number) {
  const f = 1 / (1 + Math.exp(-LOGISTIC_RATE * (t - LOGISTIC_CENTER_S)));
  return f * amax;
}

function easeOutCubic(x: number) {
  const inv = 1 - x;
  return 1 - inv * inv * inv;
}

export interface GrindingChatterLobesProps {
  /** accessible status text announced to assistive tech */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GrindingChatterLobes({
  label = "Loading",
  className = "",
}: GrindingChatterLobesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let disposed = false;
    let visible = true;
    let raf = 0;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let radius = 0;

    let fgColor = "#171717";
    let bgColor = "#ffffff";
    let mutedRGBA = "rgba(140,140,140,0.55)";

    // -- token read: no paint happens before this runs at least once. -----
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const fg = cs.getPropertyValue("--foreground").trim();
      const bg = cs.getPropertyValue("--background").trim();
      const muted = cs.getPropertyValue("--ns-muted").trim();
      if (fg) fgColor = fg;
      if (bg) bgColor = bg;
      if (muted) {
        const probe = document.createElement("canvas").getContext("2d");
        if (probe) {
          probe.fillStyle = muted;
          const [r, g, b] = probe.fillStyle.match(/\d+/g)?.map(Number) ?? [];
          // alpha 0.55 compresses the gradient's contrast so scalloping
          // stays legible in light theme without approaching border-adjacent
          // values (checked against --border #ebebeb at the light tokens).
          if (r !== undefined) mutedRGBA = `rgba(${r},${g},${b},0.55)`;
        }
      }
    };

    // -- per-cycle state, reseeded from the mount clock so a phase-desynced
    // start (not always t=0) means any two page loads show different
    // states, per spec. --------------------------------------------------
    const seedBase = Math.floor(Date.now()) >>> 0;
    const mountOffsetS = (Date.now() / 1000) % PERIOD_S;
    const startPerf = performance.now();

    let cycleIndex = -1;
    let lobeCount = LOBE_COUNTS[0]!;
    let basePhase = 0;

    const loadCycle = (idx: number) => {
      if (idx === cycleIndex) return;
      cycleIndex = idx;
      const rand = mulberry32(seedBase + idx * 0x9e3779b1);
      lobeCount = LOBE_COUNTS[Math.floor(rand() * LOBE_COUNTS.length)]!;
      basePhase = rand() * TWO_PI;
    };

    let rotationAngle = 0;

    // -- pointer boost: locally applied contact pressure. Angle is tracked
    // in screen space (the contact point stays put while the disc spins
    // under it), decays to 0 over ~500ms after the pointer leaves. Never
    // touches the global dress-event clock. --------------------------------
    let pointerActive = false;
    let pointerAngleScreen = 0;
    let boostEnvelope = 0;

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

    const localAmpMult = (thetaLocal: number, pointerAngleLocal: number) => {
      if (boostEnvelope <= 0.001) return 1;
      const d = Math.abs(wrapPi(thetaLocal - pointerAngleLocal));
      if (d >= BOOST_WINDOW_RAD) return 1;
      const falloff = 0.5 * (1 + Math.cos((Math.PI * d) / BOOST_WINDOW_RAD));
      return 1 + (BOOST_MULT - 1) * boostEnvelope * falloff;
    };

    const drawRim = (
      amplitude: number,
      lobes: number,
      phase: number,
      rotation: number,
      pointerAngleLocal: number
    ) => {
      const cx = w / 2;
      const cy = h / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);

      ctx.beginPath();
      for (let i = 0; i <= BINS; i++) {
        const theta = (i % BINS) * DEG;
        const mult = localAmpMult(theta, pointerAngleLocal);
        const r = radius + amplitude * Math.cos(lobes * theta + phase) * mult;
        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(
        0,
        0,
        0,
        0,
        0,
        radius * (1 + AMAX_RATIO)
      );
      grad.addColorStop(0, bgColor);
      grad.addColorStop(1, mutedRGBA);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = fgColor;
      ctx.stroke();
      ctx.restore();
    };

    // -- static reduced-motion frame: freeze on the named, deliberately
    // chosen most-structured frame, not t0. No loop, no listeners beyond
    // resize/theme so colours still stay correct. -------------------------
    const drawReduced = () => {
      if (w < 2 || h < 2 || radius <= 0) return;
      const amax = AMAX_RATIO * radius;
      drawRim(
        FREEZE_AMPLITUDE_RATIO * amax,
        FREEZE_LOBE_COUNT,
        0,
        FREEZE_ROTATION_RAD,
        0
      );
    };

    let last = 0;

    const loop = (now: number) => {
      if (disposed || !visible) {
        raf = 0;
        return;
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      rotationAngle = (rotationAngle + TWO_PI * WORKPIECE_REV_PER_S * dt) % TWO_PI;

      boostEnvelope +=
        ((pointerActive ? 1 : 0) - boostEnvelope) *
        (1 - Math.exp(-dt * 1000 / BOOST_TAU_MS));

      const elapsed = (now - startPerf) / 1000 + mountOffsetS;
      const idx = Math.floor(elapsed / PERIOD_S);
      const tc = elapsed - idx * PERIOD_S;
      loadCycle(idx);

      const amax = AMAX_RATIO * radius;
      let amplitude: number;
      if (tc < GROWTH_S) {
        amplitude = logisticAmplitude(tc, amax);
      } else {
        const plateau = logisticAmplitude(GROWTH_S, amax);
        const dressT = Math.min(1, (tc - GROWTH_S) / (DRESS_MS / 1000));
        amplitude = plateau * (1 - easeOutCubic(dressT));
      }

      const pointerAngleLocal = wrapPi(pointerAngleScreen - rotationAngle);
      if (w >= 2 && h >= 2 && radius > 0) {
        drawRim(amplitude, lobeCount, basePhase, rotationAngle, pointerAngleLocal);
      }

      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const pointerAngleFromEvent = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      return Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      );
    };
    const onPointerMove = (e: PointerEvent) => {
      pointerActive = true;
      pointerAngleScreen = pointerAngleFromEvent(e);
    };
    const onPointerLeave = () => {
      pointerActive = false;
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
      if (reduced) drawReduced();
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
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      className={`relative aspect-square w-full max-w-[280px] touch-none overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      <span className="sr-only">{label}</span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

export { FREEZE_PHASE };
