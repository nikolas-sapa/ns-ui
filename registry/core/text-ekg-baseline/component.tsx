"use client";

import { forwardRef, useImperativeHandle, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CardioBaseline — the text baseline is an EKG trace. Letters sit on a
// flatline, a sweep dot travels it, and each beat injects a QRS-T waveform at
// the left edge that propagates right at 900 px/s, throwing every glyph up
// the wave with slope-matched rotation before an underdamped spring settles
// it flat. Beats come from the bpm timer or imperatively via ref.beat().
// One direct-DOM rAF loop writes spans + polyline + dot; it sleeps once the
// wave exits and every glyph residual is < 0.1px.
// ---------------------------------------------------------------------------

const WAVE_SPEED = 900; // px/s — QRS propagation along the baseline
const DOT_SPEED = 320; // px/s — sweep dot, wraps at the right edge
const SAMPLE_PX = 6; // polyline sampling interval
const SPRING_K = 140; // s^-2
const SPRING_C = 2 * 0.45 * Math.sqrt(SPRING_K); // zeta = 0.45 → two wobbles

// piecewise QRS-T kernel: half-sine segments, amplitudes in px (+ = down)
const QRS_T = [
  { amp: 6, dur: 0.04 }, // Q — small dip
  { amp: -46, dur: 0.07 }, // R — the spike
  { amp: 10, dur: 0.05 }, // S — recovery dip
  { amp: -8, dur: 0.18 }, // T — slow repolarization bump
] as const;
const KERNEL_DUR = 0.34; // Σ durations, seconds

function kernel(tau: number): number {
  if (tau <= 0 || tau >= KERNEL_DUR) return 0;
  let t = tau;
  for (let i = 0; i < QRS_T.length; i++) {
    const seg = QRS_T[i];
    if (!seg) break;
    if (t < seg.dur) return seg.amp * Math.sin(Math.PI * (t / seg.dur));
    t -= seg.dur;
  }
  return 0;
}

export interface CardioBaselineHandle {
  /** fire one beat immediately — event-driven use (deploys, messages) */
  beat: () => void;
}

export const CardioBaseline = forwardRef<
  CardioBaselineHandle,
  {
    /** the text riding the trace */
    children?: string;
    /** beats per minute from the internal timer; 0 = imperative-only */
    bpm?: number;
    className?: string;
  }
>(function CardioBaseline(
  { children = "SYSTEMS NOMINAL", bpm = 50, className = "" },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<SVGPolylineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const glyphEls = useRef<(HTMLSpanElement | null)[]>([]);
  const beatRef = useRef<(() => void) | null>(null);
  const reducedRef = useRef(false);

  const chars = Array.from(children);

  useImperativeHandle(ref, () => ({ beat: () => beatRef.current?.() }), []);

  useEffect(() => {
    const root = rootRef.current;
    const marker = markerRef.current;
    const line = lineRef.current;
    const dot = dotRef.current;
    if (!root || !marker || !line || !dot) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    reducedRef.current = reduced;

    const n = chars.length;
    const els = glyphEls.current.slice(0, n);
    const isSpace = chars.map((c) => c.trim() === "");

    // hot-path state — locals only, the rAF loop is the sole DOM writer
    let raf = 0;
    let last = 0;
    let dotX = 0;
    let width = 0;
    let baseY = 0;
    let disposed = false;
    const centers = new Float64Array(n);
    const y = new Float64Array(n);
    const vy = new Float64Array(n);
    const rot = new Float64Array(n);
    const live = new Uint8Array(n); // 1 = span currently has a transform
    const waves: number[] = []; // beat origin times, seconds

    const measure = () => {
      width = root.clientWidth;
      // zero-height inline-block marker: its top edge sits on the baseline
      baseY = marker.offsetTop;
      for (let i = 0; i < n; i++) {
        const el = els[i];
        centers[i] = el ? el.offsetLeft + el.offsetWidth / 2 : 0;
      }
    };

    const drawFlat = () => {
      line.setAttribute("points", `0,${baseY} ${width},${baseY}`);
      dot.setAttribute("cx", dotX.toFixed(2));
      dot.setAttribute("cy", String(baseY));
    };

    if (reduced) {
      // static flatline + typeset text — no dot, no timers, no listeners
      dot.style.display = "none";
      measure();
      drawFlat();
      document.fonts.ready.then(() => {
        if (disposed) return;
        measure();
        drawFlat();
      });
      return () => {
        disposed = true;
      };
    }

    // summed wave height under x at time t (+ = down, matches translateY)
    const wave = (x: number, t: number) => {
      let v = 0;
      for (let i = 0; i < waves.length; i++) {
        v += kernel(t - (waves[i] ?? 0) - x / WAVE_SPEED);
      }
      return v;
    };

    const step = (now: number) => {
      const t = now / 1000;
      const dt =
        last === 0 ? 1 / 60 : Math.min(0.05, Math.max(0.001, t - last));
      last = t;
      if (width > 0) dotX = (dotX + DOT_SPEED * dt) % width;

      // prune waves whose trailing edge has cleared the right edge
      const exit = width / WAVE_SPEED + KERNEL_DUR;
      for (let i = waves.length - 1; i >= 0; i--) {
        if (t - (waves[i] ?? 0) > exit) waves.splice(i, 1);
      }

      let settled = waves.length === 0;
      for (let i = 0; i < n; i++) {
        const el = els[i];
        if (!el || isSpace[i]) continue;
        const x = centers[i] ?? 0;
        let yi = y[i] ?? 0;
        let vi = vy[i] ?? 0;
        let ri = rot[i] ?? 0;

        // is any kernel currently passing under this glyph center?
        let driven = false;
        for (let w = 0; w < waves.length; w++) {
          const tau = t - (waves[w] ?? 0) - x / WAVE_SPEED;
          if (tau > 0 && tau < KERNEL_DUR) {
            driven = true;
            break;
          }
        }

        if (driven) {
          // position-driven by the wave; velocity carried into the release
          const wv = wave(x, t);
          vi = (wv - yi) / dt;
          yi = wv;
          // slope-matched rotation, clamped ±9°
          const slope = (wave(x + 4, t) - wave(x - 4, t)) / 8;
          ri = Math.max(-9, Math.min(9, (Math.atan(slope) * 180) / Math.PI));
          settled = false;
        } else if (yi !== 0 || vi !== 0 || ri !== 0) {
          // ring-down: underdamped spring k=140 s^-2, zeta=0.45
          vi += (-SPRING_K * yi - SPRING_C * vi) * dt;
          yi += vi * dt;
          ri += -ri * Math.min(1, dt * 14);
          if (Math.abs(yi) < 0.1 && Math.abs(vi) < 1 && Math.abs(ri) < 0.05) {
            yi = 0;
            vi = 0;
            ri = 0;
          } else {
            settled = false;
          }
        }

        y[i] = yi;
        vy[i] = vi;
        rot[i] = ri;
        if (yi === 0 && vi === 0 && ri === 0) {
          if (live[i]) {
            el.style.transform = "";
            live[i] = 0;
          }
        } else {
          el.style.transform = `translateY(${yi.toFixed(2)}px) rotate(${ri.toFixed(2)}deg)`;
          live[i] = 1;
        }
      }

      // polyline (every 6px) + dot updated in the same frame
      if (waves.length === 0) {
        line.setAttribute("points", `0,${baseY} ${width},${baseY}`);
        dot.setAttribute("cy", String(baseY));
      } else {
        let pts = "";
        for (let x = 0; x < width; x += SAMPLE_PX) {
          pts += `${x},${(baseY + wave(x, t)).toFixed(2)} `;
        }
        pts += `${width},${(baseY + wave(width, t)).toFixed(2)}`;
        line.setAttribute("points", pts);
        dot.setAttribute("cy", (baseY + wave(dotX, t)).toFixed(2));
      }
      dot.setAttribute("cx", dotX.toFixed(2));

      if (settled) {
        raf = 0;
        last = 0;
        return; // sleep — the bpm timer or beat() wakes the loop
      }
      raf = requestAnimationFrame(step);
    };

    const wake = () => {
      if (raf === 0) raf = requestAnimationFrame(step);
    };
    beatRef.current = () => {
      waves.push(performance.now() / 1000);
      wake();
    };

    measure();
    drawFlat();
    document.fonts.ready.then(() => {
      if (disposed) return;
      measure();
      if (raf === 0) drawFlat();
    });

    const ro = new ResizeObserver(() => {
      measure();
      if (raf === 0) drawFlat();
    });
    ro.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      beatRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // bpm timer — separate effect so rate changes don't reset glyph state.
  // Resting rhythm isn't metronomic: each interval jitters ±8% around the
  // nominal period (mild sinus-arrhythmia feel) via a self-rescheduling
  // timeout rather than a fixed setInterval.
  useEffect(() => {
    if (bpm <= 0 || reducedRef.current) return;
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const period = 60000 / bpm;
      const jitter = 1 + (Math.random() * 2 - 1) * 0.08;
      id = setTimeout(() => {
        beatRef.current?.();
        schedule();
      }, period * jitter);
    };
    schedule();
    return () => clearTimeout(id);
  }, [bpm]);

  return (
    <div
      ref={rootRef}
      aria-label={children}
      className={`relative block whitespace-nowrap ${className}`}
    >
      <span ref={markerRef} aria-hidden className="inline-block w-0" />
      {chars.map((c, i) => (
        <span
          key={i}
          ref={(el) => {
            glyphEls.current[i] = el;
          }}
          aria-hidden
          className="inline-block will-change-transform"
          style={{ whiteSpace: "pre" }}
        >
          {c}
        </span>
      ))}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        <polyline
          ref={lineRef}
          fill="none"
          style={{ stroke: "var(--muted)" }}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle ref={dotRef} r="2" style={{ fill: "var(--foreground)" }} />
      </svg>
    </div>
  );
});
