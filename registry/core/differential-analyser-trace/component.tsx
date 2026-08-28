"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DifferentialAnalyserTrace — the wheel-and-disc integrator unit of a Bush-
// type mechanical differential analyser (1930s). A disc spins at a constant
// real rate; a small friction wheel rides the disc face at a radius set by
// an input variable, so the wheel's own spin rate is proportional to (disc
// rate x radius) — the wheel is continuously integrating the input, and its
// cumulative rotation is the output shaft's value. Sourced from the
// integrator unit alone, not the analyser's full gear-train.
//
// Two panels share one canvas: a square disc on the left (side = the
// container's smaller dimension x 0.8, centered in a smaller-dimension-wide
// bay) and a scrolling trace panel on the right (width = container width -
// disc bay) plotting the wheel's cumulative rotation.
//
// A literal infinite integral of a radius fraction that is always positive
// (clamped [0.05, 0.95], never crosses the disc's center) only ever climbs —
// plotted raw over a fixed-height panel it is a straight line off the top
// within seconds. Real strip-chart recorders solve exactly this with an
// AC-coupled zero return: the pen tracks deviation from the trace's own
// recent mean, not its absolute total. The trace panel does the same thing
// here — each frame subtracts the visible 12s window's own mean from the
// cumulative value before plotting — so the panel shows the wheel's
// wandering *rate* of integration (rising while the wheel sits out toward
// the rim, falling while it drifts toward the hub) rather than a number that
// only ever grows. The underlying accumulator itself never resets.
//
// One shared clock drives everything: t = performance.now() / 1000, seconds
// since the page's own navigation origin. prefers-reduced-motion freezes at
// t = STATIC_PHASE by simulating the 12.5s of history that would have
// preceded it (the formulas are well-defined for any real t, including
// negative) and drawing that one frame — no rAF, no live clock.
// ---------------------------------------------------------------------------

const DISC_REV_PER_SEC = 0.5; // constant, real rate — never stops
const SAMPLE_HZ = 20; // output trace sample rate
const SAMPLE_DT = 1 / SAMPLE_HZ;
const SCROLL_PX_PER_SEC = 24;
const HISTORY_SEC = 12;
const WHEEL_SPIN_CAP_REV = 3; // visual cap on the disc-face spin render
const STATIC_PHASE = 3.14; // reduced-motion freeze, t seconds since epoch

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
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

function rgba(c: Vec3, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

/** the one pseudo-input signal — sum of two incommensurate sines, never
 * exactly repeats, clamped to a valid radius fraction of the disc. */
function radiusFraction(t: number): number {
  const v = 0.5 + 0.35 * Math.sin(t / 4.7) + 0.15 * Math.sin(t / 1.3);
  return Math.min(0.95, Math.max(0.05, v));
}

interface Sample {
  t: number;
  cum: number; // raw cumulative integral, never reset
}

/** Advance the integrator from `fromT` (exclusive) to `toT` (inclusive) on
 * fixed 50ms steps, appending samples and carrying the running cumulative
 * value forward. Used identically by the live rAF loop and the reduced-
 * motion synchronous history build. */
function integrate(samples: Sample[], fromT: number, toT: number, cumStart: number): number {
  let cum = cumStart;
  let t = fromT;
  while (t < toT - 1e-9) {
    t = Math.min(toT, t + SAMPLE_DT);
    cum += radiusFraction(t) * DISC_REV_PER_SEC * SAMPLE_DT;
    samples.push({ t, cum });
  }
  return cum;
}

export interface DifferentialAnalyserTraceProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DifferentialAnalyserTrace({ className = "" }: DifferentialAnalyserTraceProps) {
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
    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = true;
    let raf = 0;

    // -- token-derived ink, read once and re-derived on theme class change --
    let fg: Vec3 = [237, 237, 237];
    let bg: Vec3 = [10, 10, 10];
    let bd: Vec3 = [80, 80, 80];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      bd = parseColor(cs.getPropertyValue("--border")) ?? bd;
    };
    derive();

    let samples: Sample[] = [];
    let cumTail = 0; // running cumulative value, carried across ticks

    let pointerX: number | null = null;

    const layout = () => {
      const minDim = Math.min(w, h);
      const discRadius = minDim * 0.4; // diameter = 0.8 * minDim
      const discCx = minDim / 2;
      const discCy = h / 2;
      const wheelRadius = discRadius * 0.09;
      const discAreaW = minDim;
      const tracePanelX = discAreaW;
      const tracePanelW = Math.max(0, w - discAreaW);
      return { discRadius, discCx, discCy, wheelRadius, discAreaW, tracePanelX, tracePanelW };
    };

    const draw = (t: number) => {
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { discRadius, discCx, discCy, wheelRadius, discAreaW, tracePanelX, tracePanelW } = layout();
      const rf = radiusFraction(t);

      // -- disc: filled with the page's own background so it reads as a
      // porthole through whatever surface this sits on, rim in foreground --
      ctx.beginPath();
      ctx.arc(discCx, discCy, discRadius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(bg, 1);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(fg, 1);
      ctx.stroke();

      // -- disc-face spokes: the single fast, real-rate, continuous-rotation
      // cue (0.5 rev/s). Low alpha so it never dominates the eye. ----------
      const discAngle = t * DISC_REV_PER_SEC * Math.PI * 2;
      ctx.strokeStyle = rgba(fg, 0.12);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = discAngle + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(discCx, discCy);
        ctx.lineTo(discCx + Math.cos(a) * discRadius, discCy + Math.sin(a) * discRadius);
        ctx.stroke();
      }

      // -- fixed carriage arm: the wheel's track stays put in the lab frame
      // while the disc spins beneath it ------------------------------------
      ctx.strokeStyle = rgba(fg, 0.15);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(discCx - discRadius, discCy);
      ctx.lineTo(discCx + discRadius, discCy);
      ctx.stroke();

      // -- wheel: position along the arm at radiusFraction * discRadius.
      // Own spin = friction contact physics (v_contact = v_wheel-rim):
      // wheelRevPerSec = discRevPerSec * radiusFraction * (discRadius /
      // wheelRadius), capped visually so an extreme excursion never strobes.
      const wheelX = discCx + rf * discRadius;
      const wheelSpinRealRev = DISC_REV_PER_SEC * rf * (discRadius / wheelRadius);
      const wheelSpinRev = Math.min(WHEEL_SPIN_CAP_REV, wheelSpinRealRev);
      const wheelAngle = t * wheelSpinRev * Math.PI * 2;

      ctx.beginPath();
      ctx.arc(wheelX, discCy, wheelRadius, 0, Math.PI * 2);
      ctx.fillStyle = rgba(fg, 0.7);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(fg, 1);
      ctx.stroke();
      // spin tick, background-ink so it reads against the wheel's own fill
      ctx.strokeStyle = rgba(bg, 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wheelX, discCy);
      ctx.lineTo(wheelX + Math.cos(wheelAngle) * wheelRadius * 0.85, discCy + Math.sin(wheelAngle) * wheelRadius * 0.85);
      ctx.stroke();

      // -- divider --
      if (tracePanelW > 0) {
        ctx.strokeStyle = rgba(bd, 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const dx = Math.round(discAreaW) + 0.5;
        ctx.moveTo(dx, 0);
        ctx.lineTo(dx, h);
        ctx.stroke();

        // -- trace panel wash --
        ctx.fillStyle = rgba(fg, 0.04);
        ctx.fillRect(tracePanelX, 0, tracePanelW, h);

        // -- trace: samples within the visible 12s window, AC-coupled by
        // subtracting the window's own mean, autoscaled to 80% of height --
        const winStart = t - HISTORY_SEC;
        let sum = 0;
        let n = 0;
        let mn = Infinity;
        let mx = -Infinity;
        for (const s of samples) {
          if (s.t < winStart) continue;
          sum += s.cum;
          n++;
          if (s.cum < mn) mn = s.cum;
          if (s.cum > mx) mx = s.cum;
        }
        if (n > 1) {
          const mean = sum / n;
          const dev = Math.max(1e-6, Math.max(mx - mean, mean - mn));
          const padY = h * 0.1;
          const plotH = (h - padY * 2) * 0.8;
          const centerY = h / 2;

          ctx.beginPath();
          let started = false;
          for (const s of samples) {
            if (s.t < winStart) continue;
            const x = tracePanelX + tracePanelW - (t - s.t) * SCROLL_PX_PER_SEC;
            if (x < tracePanelX - 4) continue;
            const y = centerY - ((s.cum - mean) / dev) * (plotH / 2);
            if (!started) {
              ctx.moveTo(x, y);
              started = true;
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.strokeStyle = rgba(fg, 0.85);
          ctx.lineWidth = 1.5;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          ctx.stroke();
        }

        // -- optional hover guideline: luminance-only, no accent, no value --
        if (pointerX !== null && pointerX >= tracePanelX && pointerX <= tracePanelX + tracePanelW) {
          ctx.strokeStyle = rgba(fg, 0.3);
          ctx.lineWidth = 1;
          ctx.beginPath();
          const gx = Math.round(pointerX) + 0.5;
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
      }
    };

    const trimHistory = (nowT: number) => {
      const cutoff = nowT - HISTORY_SEC - 1;
      let i = 0;
      while (i < samples.length && (samples[i]?.t ?? 0) < cutoff) i++;
      if (i > 0) samples.splice(0, i);
    };

    let lastSampleT = -1;

    const loop = () => {
      raf = 0;
      if (!visible || disposed) return;
      const now = performance.now() / 1000;
      if (lastSampleT < 0) lastSampleT = now;
      cumTail = integrate(samples, lastSampleT, now, cumTail);
      lastSampleT = now;
      trimHistory(now);
      draw(now);
      raf = requestAnimationFrame(loop);
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
        draw(STATIC_PHASE);
      } else if (raf === 0 && visible) {
        raf = requestAnimationFrame(loop);
      }
    };

    if (reduced) {
      // simulate the 12.5s of history that would precede STATIC_PHASE, then
      // draw exactly one frame — no clock, no rAF, ever.
      samples = [];
      integrate(samples, STATIC_PHASE - HISTORY_SEC - 0.5, STATIC_PHASE, 0);
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      if (reduced) draw(STATIC_PHASE);
    };
    const onPointerLeave = () => {
      pointerX = null;
      if (reduced) draw(STATIC_PHASE);
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && raf === 0) {
        lastSampleT = performance.now() / 1000;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      draw(reduced ? STATIC_PHASE : performance.now() / 1000);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (!disposed) resize();
    });

    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`relative h-full w-full overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
