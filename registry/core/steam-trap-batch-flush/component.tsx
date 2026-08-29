"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// SteamTrapBatchFlush — an inline sync-status glyph modelled on a
// float-and-thermostatic steam trap: condensate (locally-buffered pending
// events) collects in a small chamber until a float trips a discharge valve
// open, the chamber blows down fast, and it starts refilling immediately.
// The read is entirely motion + fill level, no colour swap, no icon change.
//
// Real numbers from the spec: fill takes 3.2s to go from empty (0%) to the
// trip line (88% of chamber height) — that sets a constant fill rate of
// 0.88/3.2 = 0.275 fraction/s, applied continuously whenever the chamber is
// filling, including the post-blowdown refill that resumes from 6% rather
// than 0%. Blowdown itself is 340ms, fraction falling 88% -> 6% on an
// eased-out curve (fast, front-loaded — the real mechanical blowdown is far
// quicker than the fill it releases). The float rides the top of the fill
// and overshoots 2 (viewBox) units below the falling fill line during
// blowdown before settling back onto the new level over a short damped
// window — the mechanical snap-back read that separates this from a plain
// sawtooth reset.
//
// Because refill resumes from 6% (not 0%) at the same constant rate, the
// steady-state loop is genuinely periodic: fill 6% -> 88% takes
// (0.88-0.06)/0.275 ~= 2.98s, plus the 340ms blowdown, for a full cycle of
// ~3.32s — close to the spec's "~3.6s", the difference being that a
// constant, spec-derived fill rate is preserved exactly rather than padding
// the cycle to hit the round number.
// ---------------------------------------------------------------------------

const TRIP_FRACTION = 0.88;
const LOW_FRACTION = 0.06;
const FILL_DURATION_MS = 3200; // empty (0) -> trip (0.88), sets the rate
const FILL_RATE = TRIP_FRACTION / (FILL_DURATION_MS / 1000); // fraction / s
const BLOWDOWN_MS = 340;
const OVERSHOOT_UNITS = 2; // viewBox units the float dips past the settled line
const OVERSHOOT_SETTLE_MS = 180;

// chamber geometry, 24x24 viewBox
const CHAMBER = { x: 5, y: 3, w: 14, h: 18, rx: 2 };
const FILL_X = 6;
const FILL_W = 12;
const FILL_BOTTOM = 20; // chamber inner floor
const FILL_TOP_MAX = 4; // chamber inner ceiling (fraction = 1)
const FILL_SPAN = FILL_BOTTOM - FILL_TOP_MAX; // 16 units of usable height
const FLOAT_CX = FILL_X + FILL_W / 2;
const FLOAT_R = 1.4;
const STROKE_WIDTH = 1.25; // physical px via non-scaling-stroke, floors > 1px

function fractionToY(fraction: number): number {
  return FILL_BOTTOM - fraction * FILL_SPAN;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export interface SteamTrapBatchFlushProps {
  /** glyph size in px, meant to sit inline beside a text label. legible 24-64. */
  size?: number;
  /** accessible label for the static role="img" description */
  label?: string;
  /**
   * renders as a focusable button that forces an early blowdown on press —
   * omit for the pure ambient/status read (default). The forced blowdown
   * reuses the exact same 340ms eased-out curve and never changes the trip
   * threshold; it just starts blowdown from whatever fraction the chamber
   * is currently at instead of waiting for the 88% trip.
   */
  interactive?: boolean;
  /** called once a forced or natural blowdown starts, only when interactive */
  onFlush?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SteamTrapBatchFlush({
  size = 24,
  label = "Syncing",
  interactive = false,
  onFlush,
  className = "",
}: SteamTrapBatchFlushProps) {
  const clipId = useId();
  const fillRef = useRef<SVGRectElement>(null);
  const floatRef = useRef<SVGCircleElement>(null);
  const rootRef = useRef<HTMLSpanElement | HTMLButtonElement>(null);
  const forceFlushRef = useRef<() => void>(() => {});

  useEffect(() => {
    const fillEl = fillRef.current;
    const floatEl = floatRef.current;
    const root = rootRef.current;
    if (!fillEl || !floatEl || !root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const applyFrame = (fraction: number, overshoot: number) => {
      const y = fractionToY(fraction);
      fillEl.setAttribute("y", y.toFixed(2));
      fillEl.setAttribute("height", Math.max(0, FILL_BOTTOM - y).toFixed(2));
      floatEl.setAttribute("cy", (y + overshoot).toFixed(2));
    };

    if (reduced) {
      // TRIP_POINT freeze frame: fill at 88%, float at its highest point,
      // the instant before blowdown — the most information-dense frame,
      // showing the full chamber, the trip threshold and the float at once.
      applyFrame(TRIP_FRACTION, 0);
      return;
    }

    let disposed = false;
    let visible = true;
    let raf = 0;

    type Phase = "filling" | "blowdown";
    let phase: Phase = "filling";
    let fraction = LOW_FRACTION + Math.random() * (TRIP_FRACTION - LOW_FRACTION);
    let blowdownStart = 0;
    let blowdownFrom = TRIP_FRACTION;
    let settleStart = -Infinity;
    let settleFrom = 0;
    let last = 0;

    const startBlowdown = (now: number, from: number) => {
      phase = "blowdown";
      blowdownStart = now;
      blowdownFrom = from;
      onFlush?.();
    };

    forceFlushRef.current = () => {
      if (phase !== "filling") return;
      startBlowdown(performance.now(), fraction);
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last) / 1000;
      last = now;

      let overshoot = 0;

      if (phase === "filling") {
        fraction = Math.min(TRIP_FRACTION, fraction + FILL_RATE * dt);
        if (fraction >= TRIP_FRACTION) startBlowdown(now, TRIP_FRACTION);
      } else {
        const t = clamp01((now - blowdownStart) / BLOWDOWN_MS);
        const eased = easeOutCubic(t);
        fraction = blowdownFrom + (LOW_FRACTION - blowdownFrom) * eased;
        overshoot = OVERSHOOT_UNITS * eased;
        if (t >= 1) {
          phase = "filling";
          settleStart = now;
          settleFrom = OVERSHOOT_UNITS;
        }
      }

      if (now - settleStart < OVERSHOOT_SETTLE_MS) {
        const st = clamp01((now - settleStart) / OVERSHOOT_SETTLE_MS);
        overshoot = settleFrom * (1 - easeOutCubic(st));
      }

      applyFrame(fraction, overshoot);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(root);

    return () => {
      disposed = true;
      void disposed;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      forceFlushRef.current = () => {};
    };
  }, [onFlush]);

  const glyph = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={CHAMBER.x}
            y={CHAMBER.y}
            width={CHAMBER.w}
            height={CHAMBER.h}
            rx={CHAMBER.rx}
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect
          ref={fillRef}
          x={FILL_X}
          y={FILL_BOTTOM}
          width={FILL_W}
          height={0}
          style={{ fill: "var(--foreground)", opacity: 0.7 }}
        />
      </g>

      <rect
        x={CHAMBER.x}
        y={CHAMBER.y}
        width={CHAMBER.w}
        height={CHAMBER.h}
        rx={CHAMBER.rx}
        fill="none"
        stroke="var(--ns-muted)"
        strokeWidth={STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />

      <circle
        ref={floatRef}
        cx={FLOAT_CX}
        cy={fractionToY(TRIP_FRACTION)}
        r={FLOAT_R}
        style={{ fill: "var(--foreground)" }}
      />
    </svg>
  );

  if (interactive) {
    return (
      <button
        ref={rootRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={() => forceFlushRef.current()}
        aria-label={label}
        className={`inline-flex shrink-0 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${className}`}
        style={{ width: size, height: size }}
      >
        {glyph}
      </button>
    );
  }

  return (
    <span
      ref={rootRef as React.RefObject<HTMLSpanElement>}
      role="img"
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {glyph}
    </span>
  );
}
