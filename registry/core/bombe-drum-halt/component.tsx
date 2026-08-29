"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BombeDrumHalt — a search/lookup loading indicator built as the Bombe's
// drum-and-stop search cycle: banks of rotating drums spin continuously
// through a hypothesis space; a sensing relay bank tests each position as
// the drums pass it, and when a candidate briefly satisfies the test the
// whole bank locks dead for a beat (a diagonal-board-style check running
// against it) before releasing and resuming — almost every stop a false
// positive. Sourced from the drum-and-stop search cycle itself, not the
// electrical/plugboard logic the real machine tested.
//
// Four vertical drum columns, each an overflow:hidden window over a
// repeating tick-mark strip. The strip is NOT a uniform 1-tick gradient —
// a uniform pattern repeats every single tick, which makes a drum's visible
// state alias back to itself dozens of times a second and leaves t0/2.5s/5s
// screenshots indistinguishable whenever no halt happens to be mid-flight.
// Instead each drum's strip is one 26-position revolution (one per rotor
// letter, historically the right count for a Bombe drum): every 5th
// position is a heavier tick and position 0 is a distinct brighter datum
// mark, so a screenshot of a drum's resting phase is legible and never
// repeats for ~2s of continuous scan.
//
// All four columns share ONE driving clock (a single rAF loop tracking one
// `phase` state machine: scan -> decel -> hold -> reaccel -> scan) rather
// than four independent CSS animation timelines, specifically so a halt can
// pause that clock precisely instead of fighting four separately-running
// loops back into sync. Each drum's on-screen offset is (accumulated
// scroll px) mod (one full 26-tick revolution); the per-drum phase stagger
// (drum N reads N*0.6s "ahead") is nothing more than a different starting
// offset on that same shared clock, so the drums never need independent
// timers to stay out of lock-step.
//
// A halt is scheduled 4-6s out (re-rolled after every resume, never a fixed
// metronome). Decel eases speed 1 -> 0 over 180ms while the sensing bar
// brightens from its idle 20% opacity toward peak; hold hangs at zero
// velocity for 900ms at 90% bar opacity (the "check running" beat); reaccel
// eases 0 -> 1 back over 220ms as the bar dims back to idle. On 15% of
// resumes a single randomly-chosen drum gets a 40%-opacity outline ring at
// the sensing line (where its current tick mark sits under test) for one
// extra 600ms after motion resumes — a rarer "this one got a second look"
// variant that still resolves and never latches.
//
// prefers-reduced-motion renders the single most-structured frame directly
// (no rAF loop at all): drums stopped at their phase-staggered rest
// offsets, sensing bar at peak 90% opacity — the mid-hold instant, not a
// mid-scroll blur.
// ---------------------------------------------------------------------------

// Rendered scan speed is a decoupled rate, not the historical one: the real
// Bombe tested on the order of hundreds of rotor-hypotheses/s, far above
// anything that reads as motion (rather than noise/strobe) on a 60Hz
// screen. 180px/s here is a visually smooth continuous scroll — roughly 13
// tick-marks/s at the default tick spacing — chosen the same way round-9's
// rate-decoupling rule chose a slow sweep over a literal 180marks/s
// (2520px/s), which would alias against 60Hz paint exactly like the strobe
// bug that rule was written for.
const SCROLL_SPEED_PX_S = 180;
const STRIP_TICKS = 26; // one revolution = 26 rotor-letter positions
const DRUM_COUNT = 4;
const PHASE_STEP_S = 0.6; // drum N starts N*0.6s "ahead" of drum 0
const HALT_MIN_S = 4;
const HALT_MAX_S = 6;
const DECEL_MS = 180;
const HOLD_MS = 900;
const REACCEL_MS = 220;
const RING_CHANCE = 0.15;
const RING_MS = 600;
const SENSING_BAR_Y_RATIO = 0.42; // fixed height across drums, fraction of drum height
const BAR_IDLE_OPACITY = 0.2;
const BAR_PEAK_OPACITY = 0.9;

type Phase = "scan" | "decel" | "hold" | "reaccel";

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface Tick {
  top: number;
  height: number;
  opacity: number;
}

/** Builds `repeats` back-to-back 26-position revolutions of tick marks —
 * a datum mark every 26th position, a heavier mark every 5th, a plain tick
 * otherwise — so the drum window always has enough rendered strip above
 * and below the visible offset range to cover a full modulo sweep. */
function buildTicks(tickPeriod: number, repeats: number): Tick[] {
  const ticks: Tick[] = [];
  const total = STRIP_TICKS * repeats;
  for (let i = 0; i < total; i++) {
    const pos = i % STRIP_TICKS;
    const isDatum = pos === 0;
    const isHeavy = pos % 5 === 0;
    ticks.push({
      top: i * tickPeriod,
      height: isDatum ? tickPeriod * 0.32 : isHeavy ? tickPeriod * 0.22 : tickPeriod * 0.14,
      opacity: isDatum ? 0.9 : isHeavy ? 0.68 : 0.45,
    });
  }
  return ticks;
}

export interface BombeDrumHaltProps {
  /** accessible label for the ambient search/loading status */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function BombeDrumHalt({ label = "Searching", className = "" }: BombeDrumHaltProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drumRefs = useRef<(HTMLDivElement | null)[]>([]);
  const ringRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const [smaller, setSmaller] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSmaller(Math.min(width, height));
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // Geometry derives from the container's smaller dimension so the
  // component reads at card scale regardless of aspect ratio.
  const drumWidth = smaller > 0 ? smaller / 9 : 0;
  const drumHeight = smaller > 0 ? smaller * 0.85 : 0;
  const tickPeriod = drumHeight > 0 ? Math.max(4, drumHeight / 45) : 4;
  const stripLength = STRIP_TICKS * tickPeriod;
  const repeats = drumHeight > 0 ? Math.max(3, Math.ceil((drumHeight + stripLength) / stripLength) + 1) : 3;
  const ticks = useMemo(
    () => (drumHeight > 0 ? buildTicks(tickPeriod, repeats) : []),
    [tickPeriod, repeats, drumHeight]
  );

  useEffect(() => {
    if (drumWidth <= 0 || drumHeight <= 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // accumulated scroll offset per drum, px, seeded by the phase stagger
    const positions = Array.from(
      { length: DRUM_COUNT },
      (_, i) => i * PHASE_STEP_S * SCROLL_SPEED_PX_S
    );

    const applyDrumTransform = (i: number) => {
      const el = drumRefs.current[i];
      if (!el) return;
      const offset = ((positions[i] ?? 0) % stripLength + stripLength) % stripLength;
      el.style.transform = `translateY(${-offset}px)`;
    };

    const setBarOpacity = (v: number) => {
      const el = barRef.current;
      if (el) el.style.opacity = String(v);
    };

    const setRing = (drum: number, opacity: number) => {
      ringRefs.current.forEach((el, i) => {
        if (el) el.style.opacity = i === drum ? String(opacity) : "0";
      });
    };

    if (reduced) {
      // freeze on the mid-hold instant: drums stopped, bar at peak brightness
      positions.forEach((_, i) => applyDrumTransform(i));
      setBarOpacity(BAR_PEAK_OPACITY);
      setRing(-1, 0);
      return;
    }

    let raf = 0;
    let visible = true;
    let last = 0;
    let phase: Phase = "scan";
    let phaseStart = 0;
    let nextHaltAt = 0;
    let ringDrum = -1;
    let ringUntil = 0;

    const scheduleNextHalt = (now: number) => {
      nextHaltAt = now + (HALT_MIN_S + Math.random() * (HALT_MAX_S - HALT_MIN_S)) * 1000;
    };

    const advance = (dt: number, speedFactor: number) => {
      const delta = (SCROLL_SPEED_PX_S * speedFactor * dt) / 1000;
      for (let i = 0; i < positions.length; i++) {
        positions[i] = (positions[i] ?? 0) + delta;
      }
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;

      if (phase === "scan") {
        if (nextHaltAt === 0) scheduleNextHalt(now);
        advance(dt, 1);
        if (ringDrum >= 0 && now >= ringUntil) {
          setRing(-1, 0);
          ringDrum = -1;
        }
        if (now >= nextHaltAt) {
          phase = "decel";
          phaseStart = now;
        }
      } else if (phase === "decel") {
        const t = Math.min(1, (now - phaseStart) / DECEL_MS);
        advance(dt, 1 - easeInOutCubic(t));
        setBarOpacity(BAR_IDLE_OPACITY + (BAR_PEAK_OPACITY - BAR_IDLE_OPACITY) * t);
        if (t >= 1) {
          phase = "hold";
          phaseStart = now;
        }
      } else if (phase === "hold") {
        const t = Math.min(1, (now - phaseStart) / HOLD_MS);
        setBarOpacity(BAR_PEAK_OPACITY);
        if (t >= 1) {
          phase = "reaccel";
          phaseStart = now;
        }
      } else if (phase === "reaccel") {
        const t = Math.min(1, (now - phaseStart) / REACCEL_MS);
        advance(dt, easeInOutCubic(t));
        setBarOpacity(BAR_PEAK_OPACITY - (BAR_PEAK_OPACITY - BAR_IDLE_OPACITY) * t);
        if (t >= 1) {
          phase = "scan";
          scheduleNextHalt(now);
          // false-positive resolve: 15% of halts leave a "second look" ring
          if (Math.random() < RING_CHANCE) {
            ringDrum = Math.floor(Math.random() * DRUM_COUNT);
            ringUntil = now + RING_MS;
            setRing(ringDrum, 0.4);
          }
        }
      }

      for (let i = 0; i < DRUM_COUNT; i++) applyDrumTransform(i);
    };

    raf = requestAnimationFrame(tick);

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible) {
        last = 0; // resync elapsed-time base on resume
        // A halt frozen mid-flight while offscreen has a stale phaseStart;
        // rather than resolve decel/hold/reaccel in one jumped frame,
        // treat the away period as invalidating it and resume scanning.
        if (phase !== "scan") {
          phase = "scan";
          setBarOpacity(BAR_IDLE_OPACITY);
          setRing(-1, 0);
          ringDrum = -1;
        }
        scheduleNextHalt(performance.now());
      }
    });
    if (rootRef.current) io.observe(rootRef.current);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [drumWidth, drumHeight, stripLength]);

  const drums = useMemo(() => Array.from({ length: DRUM_COUNT }, (_, i) => i), []);
  const ringInset = Math.max(1, drumWidth * 0.1);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label={label}
      className={`relative flex h-full w-full min-h-[120px] items-center justify-center ${className}`}
    >
      <div className="relative flex items-stretch" style={{ gap: drumWidth * 0.35 }}>
        {drums.map((i) => (
          <div
            key={i}
            className="relative overflow-hidden"
            style={{
              width: drumWidth,
              height: drumHeight,
              borderLeft: i === 0 ? "none" : "1px solid var(--border)",
            }}
          >
            <div
              ref={(el) => {
                drumRefs.current[i] = el;
              }}
              className="absolute inset-x-0 top-0 will-change-transform"
              style={{ height: repeats * stripLength }}
            >
              {ticks.map((t, idx) => (
                <div
                  key={idx}
                  className="absolute inset-x-0"
                  style={{
                    top: t.top,
                    height: t.height,
                    background: "var(--foreground)",
                    opacity: t.opacity,
                  }}
                />
              ))}
            </div>
            <div
              ref={(el) => {
                ringRefs.current[i] = el;
              }}
              className="pointer-events-none absolute"
              style={{
                left: ringInset,
                right: ringInset,
                top: drumHeight * SENSING_BAR_Y_RATIO - tickPeriod / 2,
                height: tickPeriod,
                border: "1px solid var(--foreground)",
                borderRadius: 1,
                opacity: 0,
                transition: "opacity 200ms ease",
              }}
            />
          </div>
        ))}
        <div
          ref={barRef}
          className="pointer-events-none absolute left-0 right-0"
          style={{
            top: drumHeight * SENSING_BAR_Y_RATIO,
            height: 1,
            background: "var(--foreground)",
            opacity: BAR_IDLE_OPACITY,
          }}
        />
      </div>
    </div>
  );
}
