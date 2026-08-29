"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// RotorWindowBank — a full-bleed ambient hero backdrop modeled on the rotor
// stepping mechanism of an electromechanical rotor cipher machine
// (Enigma-family), not the electrical scrambling it fed. Three letter-wheel
// windows sit side by side; a pawl advances the right wheel one position on
// a fixed tick, and when the right wheel completes a full revolution it
// kicks the middle wheel forward. The middle wheel carries the historical
// "double-step" anomaly: if the middle wheel is itself sitting on one of its
// own notch positions at the instant it would be kicked, it steps TWICE that
// beat and also drags the left wheel forward with it — the mechanical quirk
// that gave the real machine a period of 26x25x26 instead of a clean 26^3.
//
// COMPRESSED, NOT LITERAL. The real ring is 26 positions; a double-step on a
// single-notch 26-ring machine recurs roughly once every 676 ticks (~11
// minutes at 1 tick/s) — invisible at showpiece timescales. This component
// compresses the ring to RING=9 positions and gives the middle wheel TWO
// notches (0 and 4, an uneven split) so the double-step — the entire reason
// this mechanism is interesting to look at — recurs roughly every 50-65s
// instead. Ring size and notch count are a stated departure from the
// historical 26-position, single-notch rotor, not a fidelity claim.
//
// Positions are driven by a small event-queue simulation, not CSS
// `animation: infinite`: the right wheel's position is a pure function of
// elapsed sim time (deterministic, replayable), while the middle and left
// wheels only move in response to discrete "kick" events computed
// incrementally as the right wheel's tick counter crosses each multiple of
// RING. This lets the double-step choreography (two 220ms steps with a 90ms
// hold between them, then a delayed left-wheel kick) be scheduled exactly
// once per event rather than re-derived from scratch every frame.
//
// Direct-DOM rAF: no React state on the hot path. Every wheel's three
// visible glyph rows are plain refs; transform/opacity are written straight
// to style each frame. Colour comes entirely from Tailwind classes bound to
// the --background/--foreground/--border tokens (currentColor + opacity),
// so theme flips repaint for free with zero JS token reads — there is
// nothing here that touches canvas or a shader, so no getComputedStyle pass
// is needed at all.
// ---------------------------------------------------------------------------

export interface RotorWindowBankProps {
  className?: string;
  style?: React.CSSProperties;
}

const RING = 9; // compressed from the historical 26-position ring
const GLYPHS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
const MIDDLE_NOTCHES = [0, 4]; // two notches (vs. the historical single notch)
const TICK_MS = 1400; // right wheel: 1 tick / 1.4s
const STEP_MS = 220; // single-wheel step transition
const HOLD_MS = 90; // hold between a double-step's two moves

// The frozen reduced-motion frame: right wheel at position 4, middle wheel
// one tick past a notch, left wheel one position advanced — the frame that
// shows all three wheels having just moved relative to each other, not the
// default single-wheel idle state.
const STATIC_RIGHT = 4;
const STATIC_MIDDLE = 1;
const STATIC_LEFT = 1;

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

interface QueueEvent {
  atMs: number;
  fromPos: number;
  toPos: number;
}

/** Advance a settled-position + pending-transition queue and return the
 * current continuous position (integer part = ring position, fractional
 * part = in-flight transition progress). Committing an event pops it and
 * updates settledPos in place; a queue can hold at most two entries (the
 * two halves of a double-step) so this never grows unbounded. */
function stepQueue(
  queue: QueueEvent[],
  settledPos: { current: number },
  simMs: number
): number {
  while (queue.length && queue[0].atMs + STEP_MS <= simMs) {
    settledPos.current = queue[0].toPos;
    queue.shift();
  }
  if (queue.length && queue[0].atMs <= simMs) {
    const ev = queue[0];
    const frac = easeOutCubic((simMs - ev.atMs) / STEP_MS);
    return ev.fromPos + (ev.toPos - ev.fromPos) * frac;
  }
  return settledPos.current;
}

/** Row centring weight for a row at relative index r (0,1,2 = base-1,base,
 * base+1) given continuous position frac (0..1 into the current step). */
function centerness(r: number, frac: number): number {
  return Math.max(0, 1 - Math.abs(1 + frac - r));
}

interface WheelRows {
  rows: HTMLDivElement[]; // exactly 3, relative index -1, 0, +1
}

// Window is 1.6 row-heights tall so the neighbour above/below the centred
// glyph peeks in at its edges (the "next glyph creeping into frame" cue).
// Row r's own height equals one row-height, so translateY in % of its own
// box is resolution-independent — no px math needed in JS.
function paintWheel(wheel: WheelRows | null, continuousPos: number) {
  if (!wheel) return;
  const base = Math.floor(continuousPos);
  const frac = continuousPos - base;
  for (let r = 0; r < 3; r++) {
    const el = wheel.rows[r];
    if (!el) continue;
    const ringIndex = (((base - 1 + r) % RING) + RING) % RING;
    const glyph = GLYPHS[ringIndex];
    if (el.textContent !== glyph) el.textContent = glyph;
    const w = centerness(r, frac);
    el.style.opacity = String(0.35 + 0.55 * w);
    el.style.transform = `translateY(${(r - 0.7 - frac) * 100}%)`;
  }
}

export function RotorWindowBank({ className = "", style }: RotorWindowBankProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const stripRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const rightRows = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const middleRows = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const leftRows = useRef<(HTMLDivElement | null)[]>([null, null, null]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let running = false;
    let raf = 0;
    let lastMs = 0;
    // Random phase offset so a fresh mount never lands on a clean idle
    // state — the loop is already "mid-machine" from the first frame.
    let simMs = Math.random() * TICK_MS;

    const middleQueue: QueueEvent[] = [];
    const leftQueue: QueueEvent[] = [];
    const middleSettled = { current: 0 };
    const leftSettled = { current: 0 };
    let middleStepsCum = 0;
    let leftStepsCum = 0;
    let kicksProcessed = 0;
    let lastTickIndex = -1;

    const processKicks = (tickIndex: number) => {
      const kicksNow = Math.floor(tickIndex / RING);
      while (kicksProcessed < kicksNow) {
        kicksProcessed++;
        const kickTickIndex = kicksProcessed * RING;
        const kickAtMs = kickTickIndex * TICK_MS;
        const beforePos = middleStepsCum % RING;
        const isDouble = MIDDLE_NOTCHES.includes(beforePos);

        middleQueue.push({ atMs: kickAtMs, fromPos: middleStepsCum, toPos: middleStepsCum + 1 });
        middleStepsCum += 1;

        if (isDouble) {
          const secondAt = kickAtMs + STEP_MS + HOLD_MS;
          middleQueue.push({ atMs: secondAt, fromPos: middleStepsCum, toPos: middleStepsCum + 1 });
          middleStepsCum += 1;

          const leftAt = secondAt + STEP_MS; // after the middle wheel's second step lands
          leftQueue.push({ atMs: leftAt, fromPos: leftStepsCum, toPos: leftStepsCum + 1 });
          leftStepsCum += 1;
        }
      }
    };

    const draw = (ms: number) => {
      const tickIndex = Math.floor(ms / TICK_MS);
      if (tickIndex !== lastTickIndex) {
        processKicks(tickIndex);
        lastTickIndex = tickIndex;
      }
      const tLocal = ms - tickIndex * TICK_MS;
      const rightPos =
        tLocal < STEP_MS
          ? tickIndex - 1 + easeOutCubic(tLocal / STEP_MS)
          : tickIndex;
      const middlePos = stepQueue(middleQueue, middleSettled, ms);
      const leftPos = stepQueue(leftQueue, leftSettled, ms);

      paintWheel({ rows: rightRows.current as HTMLDivElement[] }, rightPos);
      paintWheel({ rows: middleRows.current as HTMLDivElement[] }, middlePos);
      paintWheel({ rows: leftRows.current as HTMLDivElement[] }, leftPos);
    };

    const drawStatic = () => {
      paintWheel({ rows: leftRows.current as HTMLDivElement[] }, STATIC_LEFT);
      paintWheel({ rows: middleRows.current as HTMLDivElement[] }, STATIC_MIDDLE);
      paintWheel({ rows: rightRows.current as HTMLDivElement[] }, STATIC_RIGHT);
    };

    let staticMode = false;

    const loopFrame = (now: number) => {
      if (!running) return;
      if (!lastMs) lastMs = now;
      const dt = Math.min(100, now - lastMs); // clamp so a tab-switch gap can't leap the sim
      lastMs = now;
      simMs += dt;
      draw(simMs);
      raf = requestAnimationFrame(loopFrame);
    };

    const wake = () => {
      if (running || disposed || staticMode) return;
      running = true;
      lastMs = 0;
      raf = requestAnimationFrame(loopFrame);
    };
    const sleep = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    // Paint synchronously before anything async (rAF, observers) can run so
    // there is never a blank first frame while waiting on the loop to wake.
    draw(simMs);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMode = () => {
      if (mq.matches) {
        staticMode = true;
        sleep();
        drawStatic();
      } else {
        staticMode = false;
        wake();
      }
    };
    const onMq = () => applyMode();
    mq.addEventListener("change", onMq);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    // Geometry derives from the container's smaller dimension so this reads
    // correctly at card scale, not only full-bleed.
    const applySize = () => {
      const rect = wrap.getBoundingClientRect();
      const base = Math.max(1, Math.min(rect.width, rect.height));
      const rowH = base / 5;
      wrap.style.setProperty("--rotor-row-h", `${rowH}px`);
    };
    const ro = new ResizeObserver(applySize);
    ro.observe(wrap);
    applySize();

    applyMode();

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const wheel = (rowsRef: React.MutableRefObject<(HTMLDivElement | null)[]>, key: string) => (
    <div
      className="relative overflow-hidden"
      style={{ width: "calc(var(--rotor-row-h) * 0.9)", height: "calc(var(--rotor-row-h) * 1.6)" }}
    >
      {[0, 1, 2].map((r) => (
        <div
          key={`${key}-${r}`}
          ref={(el) => {
            rowsRef.current[r] = el;
          }}
          className="absolute inset-x-0 top-0 flex items-center justify-center font-mono text-foreground"
          style={{
            height: "var(--rotor-row-h)",
            fontSize: "calc(var(--rotor-row-h) * 0.55)",
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      data-rotor-window-bank={uid}
      aria-hidden="true"
      className={`relative flex h-full w-full items-center justify-center gap-[calc(var(--rotor-row-h)*0.35)] overflow-hidden bg-background ${className}`}
      style={{ ...style, ["--rotor-row-h" as string]: "48px" }}
    >
      <div className="flex items-stretch divide-x divide-border border border-border">
        <div className="p-[calc(var(--rotor-row-h)*0.25)]">{wheel(leftRows, "left")}</div>
        <div className="p-[calc(var(--rotor-row-h)*0.25)]">{wheel(middleRows, "middle")}</div>
        <div className="p-[calc(var(--rotor-row-h)*0.25)]">{wheel(rightRows, "right")}</div>
      </div>
    </div>
  );
}

RotorWindowBank.displayName = "RotorWindowBank";
