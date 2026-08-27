"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// FilmGateWeave — a full-bleed ambient background modeling projector gate
// weave and bounce: a 35mm/16mm frame held against the aperture plate is not
// rigidly fixed there, sprocket-hole play and friction-drive slop let each
// frame sit a few hundredths of a millimeter off true from frame to frame.
// "Weave" is the slow lateral/vertical drift across many frames; "bounce" is
// the faster, snappier vertical jitter from sprocket-hole slack settling
// each time the claw pulls a new frame down.
//
// The load-bearing relationship is RIGID MASK vs DRIFTING CONTENT: the gate
// (aperture) rectangle is drawn once per size and never displaced — full
// --foreground opacity, 2px, deliberately never --border (which vanishes at
// ~1.1:1 in light theme and would remove the fixed reference the whole
// concept reads against). Frame content — an academy-leader style crosshair
// + concentric-circle test pattern, no countdown numerals (curtain-leader-
// countdown already owns those) — is translated by weave+bounce every
// frame and clipped to the gate rectangle, so the misalignment against the
// static edge is always directly visible, never inferred. A small fixed "+"
// registration tick sits at the gate's true, undisplaced center as a second
// rigid reference the drifting crosshair never sits flush against.
//
// Distinguished from two existing film-family components: registry/core/
// pin-register treats z-order as a draggable stack of acetate separations —
// no weave, pointer-toggled, no idle drift. registry/core/scrubber-film-
// strip (SprocketScrub) is a scrubber with sprocket-hole chrome and a claw
// playhead driven by pointer position. Neither renders content weaving
// inside a fixed aperture at rest, which is this concept's entire identity
// — this component has no sprocket-hole chrome at all, so it never reads as
// SprocketScrub's UI at a glance.
//
// Weave: two independent, mutually non-resonant sinusoids (periods 3.1s and
// 4.7s deliberately non-round so the combined path never visibly loops).
// Bounce: a real critically-damped-ish spring (k~5200, damping ratio 0.95 —
// slightly under 1, which is what gives the motion its snap/overshoot
// character rather than a smooth glide), snap-kicked by a vertical impulse
// every 41.7ms (the 24fps claw-pull interval) and otherwise left to relax.
// The spring is integrated continuously (semi-implicit Euler, real dt) so
// it never resets to a canned curve — only the impulse SCHEDULE is fixed
// (every 41.7ms of simulated time), the settle itself is genuine ODE state.
// Because a fresh impulse lands every 41.7ms regardless of where the slow
// drift terms are, the frame is guaranteed local motion even at an instant
// the weave sinusoids happen to cross zero.
//
// Mount and every resize WARM-START the spring (deterministically replay
// the same fixed-step simulation up to STATIC_TIME_S) rather than resetting
// it to pos=0 — a bare zero spring lands the content exactly flush with the
// gate, the one picture this component exists to never show.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

const GATE_INSET_RATIO = 0.08; // of the container's smaller dimension
const DPR_CAP = 1.5;

const DRIFT_X_AMP_RATIO = 0.018; // of frame width
const DRIFT_X_PERIOD_S = 3.1;
const DRIFT_Y_AMP_RATIO = 0.011; // of frame height
const DRIFT_Y_PERIOD_S = 4.7;

const BOUNCE_TICK_S = 1 / 24; // 41.7ms claw-pull interval
const BOUNCE_AMP_RATIO = 0.004; // of frame height, per impulse
const SPRING_K = 5200;
const SPRING_DAMPING_RATIO = 0.95; // slightly under 1 — snap + tiny overshoot
const SPRING_C = 2 * SPRING_DAMPING_RATIO * Math.sqrt(SPRING_K);
const SPRING_SUBSTEP_S = 1 / 480; // fine fixed sub-step for stable integration

const HOVER_DAMP_MS = 600;

// reduced-motion freeze: t where the combined weave offset is clearly
// non-zero/off-center and a bounce is mid-settle, so the spring's snap
// character reads even as a single frame.
const STATIC_TIME_S = 2.15;

function driftX(t: number, frameW: number): number {
  return DRIFT_X_AMP_RATIO * frameW * Math.sin((TAU * t) / DRIFT_X_PERIOD_S);
}
function driftY(t: number, frameH: number): number {
  return DRIFT_Y_AMP_RATIO * frameH * Math.sin((TAU * t) / DRIFT_Y_PERIOD_S);
}

// deterministic per-tick sign so the impulse schedule (not just its period)
// is reproducible — required for the reduced-motion freeze to land on the
// same spring state every mount.
function tickSign(tickIndex: number): number {
  const h = Math.sin(tickIndex * 12.9898) * 43758.5453123;
  return h - Math.floor(h) > 0.5 ? 1 : -1;
}

interface SpringState {
  pos: number;
  vel: number;
  simTime: number; // total simulated seconds, drives the impulse schedule
  nextTickAt: number;
  tickIndex: number;
}

function newSpring(): SpringState {
  return { pos: 0, vel: 0, simTime: 0, nextTickAt: 0, tickIndex: 0 };
}

// advance the spring by dtS seconds of simulated time, applying a snap
// impulse at every 41.7ms boundary crossed, then relaxing via a real
// (slightly under-damped) spring ODE — semi-implicit Euler at a fixed fine
// sub-step so the integration is stable regardless of the caller's dt.
function stepSpring(s: SpringState, dtS: number, frameH: number, ampMul: number): void {
  let remaining = dtS;
  while (remaining > 0) {
    const sub = Math.min(SPRING_SUBSTEP_S, remaining);
    remaining -= sub;
    s.simTime += sub;
    while (s.simTime >= s.nextTickAt) {
      s.pos += BOUNCE_AMP_RATIO * frameH * tickSign(s.tickIndex) * ampMul;
      s.tickIndex += 1;
      s.nextTickAt += BOUNCE_TICK_S;
    }
    const accel = -SPRING_K * s.pos - SPRING_C * s.vel;
    s.vel += accel * sub;
    s.pos += s.vel * sub;
  }
}

export interface FilmGateWeaveProps {
  /** freeze the field at its reduced-motion frame regardless of user preference. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function FilmGateWeave({ paused = false, children, className = "", style }: FilmGateWeaveProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived ink: no paint before the first successful read --
    let fg = "";
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
    };
    derive();

    let disposed = false;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let visible = true;

    let spring = newSpring();
    let simClock = 0; // seconds, drives both weave and the live spring
    let last = 0;
    let raf = 0;

    let hovering = false;
    let hoverSince = 0; // performance.now() the hover state last changed
    let hoverFromMul = 1;

    const hoverAmpMul = (now: number): number => {
      const elapsed = now - hoverSince;
      const target = hovering ? 0 : 1;
      if (elapsed >= HOVER_DAMP_MS) return target;
      const frac = elapsed / HOVER_DAMP_MS;
      return hoverFromMul + (target - hoverFromMul) * frac;
    };

    const drawFrame = (t: number, bouncePos: number) => {
      if (!fg || w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const minDim = Math.min(w, h);
      const inset = minDim * GATE_INSET_RATIO;
      const gateX = inset;
      const gateY = inset;
      const gateW = w - inset * 2;
      const gateH = h - inset * 2;
      const gateCx = gateX + gateW / 2;
      const gateCy = gateY + gateH / 2;

      const offX = driftX(t, gateW);
      const offY = driftY(t, gateH) + bouncePos;

      // -- frame content: crosshair + concentric circles, offset, clipped
      // to the fixed gate rectangle so drift/bounce reads directly against
      // a rigid edge rather than being inferred from empty space. -------
      ctx.save();
      ctx.beginPath();
      ctx.rect(gateX, gateY, gateW, gateH);
      ctx.clip();

      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5;

      const cx = gateCx + offX;
      const cy = gateCy + offY;
      ctx.beginPath();
      ctx.moveTo(gateX - inset, cy);
      ctx.lineTo(gateX + gateW + inset, cy);
      ctx.moveTo(cx, gateY - inset);
      ctx.lineTo(cx, gateY + gateH + inset);
      ctx.stroke();

      const maxR = Math.min(gateW, gateH) / 2;
      for (const frac of [0.32, 0.6, 0.88]) {
        ctx.beginPath();
        ctx.arc(cx, cy, maxR * frac, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();

      // -- gate mask: the rigid reference edge. Always --foreground at
      // full opacity in both themes — never --border, which would vanish
      // in light theme and remove the fixed reference the mechanic reads
      // against. ----------------------------------------------------------
      ctx.globalAlpha = 1;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2;
      ctx.strokeRect(gateX, gateY, gateW, gateH);

      // fixed registration tick at the gate's true, undisplaced center —
      // a second rigid reference the drifting crosshair never sits flush
      // against.
      const tick = Math.max(6, minDim * 0.018);
      ctx.beginPath();
      ctx.moveTo(gateCx - tick, gateCy);
      ctx.lineTo(gateCx + tick, gateCy);
      ctx.moveTo(gateCx, gateCy - tick);
      ctx.lineTo(gateCx, gateCy + tick);
      ctx.stroke();

      ctx.globalAlpha = 1;
    };

    // deterministically replay the spring from t=0 up to targetS so the
    // reduced-motion frame — and the very first live paint after mount or
    // any resize — land on a real, reproducible mid-settle state instead of
    // a bare pos=0 spring sitting exactly flush with the gate (the one
    // picture this component exists to never show).
    const warmSpring = (targetS: number, frameH: number): SpringState => {
      const s = newSpring();
      let remaining = targetS;
      while (remaining > 0) {
        const step = Math.min(0.25, remaining);
        stepSpring(s, step, frameH, 1);
        remaining -= step;
      }
      return s;
    };

    const drawReduced = () => {
      const minDim = Math.min(w, h);
      const inset = minDim * GATE_INSET_RATIO;
      const gateH = h - inset * 2;
      const bouncePos = warmSpring(STATIC_TIME_S, gateH).pos;
      drawFrame(STATIC_TIME_S, bouncePos);
    };

    const loop = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      simClock += dt;
      const minDim = Math.min(w, h);
      const inset = minDim * GATE_INSET_RATIO;
      const gateH = h - inset * 2;
      const ampMul = hoverAmpMul(now);
      stepSpring(spring, dt, gateH, ampMul);
      drawFrame(simClock, spring.pos);
      if (visible && !reduced && !paused) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && visible && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      sized = w > 1 && h > 1;
      if (!sized) return;
      if (reduced || paused) {
        drawReduced();
      } else {
        // warm-start the live spring against the new frame height (rather
        // than resetting to pos=0) so the first paint after mount or any
        // resize already shows genuine drift + a mid-settle bounce, never
        // a frame sitting flush with the gate
        const inset = Math.min(w, h) * GATE_INSET_RATIO;
        const gateH = h - inset * 2;
        spring = warmSpring(STATIC_TIME_S, gateH);
        simClock = STATIC_TIME_S;
        last = 0;
        drawFrame(simClock, spring.pos);
      }
    };

    resize();
    if (!reduced && !paused) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      if (reduced || paused) drawReduced();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawReduced();
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    // hover damps the bounce amplitude toward zero over ~600ms (a claw
    // stall), never the slow weave drift — the background stays alive
    // under hover. Luminance-neutral: no colour change, no --ns-accent.
    const onPointerEnter = () => {
      hoverFromMul = hoverAmpMul(performance.now());
      hovering = true;
      hoverSince = performance.now();
    };
    const onPointerLeave = () => {
      hoverFromMul = hoverAmpMul(performance.now());
      hovering = false;
      hoverSince = performance.now();
    };
    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);

    document.fonts.ready.then(() => {
      if (disposed) return;
      derive();
      resize();
      if (!reduced && !paused) wake();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [paused]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

FilmGateWeave.displayName = "FilmGateWeave";

export default FilmGateWeave;
