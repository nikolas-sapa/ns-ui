"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PipeStandTrip — "tripping pipe" on a drilling rig: the elevator descends
// empty to the rotary table, hoists a full stand (three joints, made up)
// clear of the hole, swings it to the fingerboard, racks it, and returns for
// the next one — repeated until the whole string is out, then reversed
// (tripping in) and the cycle loops forever.
//
// Geometry lives entirely in a fixed SVG viewBox; preserveAspectRatio="xMidYMid
// meet" does the "derive from the container's smaller dimension" work for
// free — a narrow card gets the whole derrick scaled down, never cropped.
// Every stroke/fill is a literal CSS custom property via the `var(--token)`
// SVG attribute form, so there is nothing to read in JS and nothing to
// desync from a theme flip: --border for the static rig structure
// (legs, braces, floor, fingerboard/rail hairlines, empty-slot outlines),
// --ns-muted for a racked stand sitting in the fingerboard, --foreground for
// the elevator block and whatever stand it is currently carrying.
//
// Motion is five chained CSS transitions per stand (a single <g> ref moved
// with style.transform + style.transition, no per-frame rAF, no React state
// on the hot path) run back-to-back by a setTimeout chain: down-stroke
// (700ms, ease-in — gravity-assisted lowering to the rotary table) ->
// hoist-up (500ms, ease-out — block brake sets) -> swing-to-rack (200ms
// lateral) -> rack-seat (300ms, a spring/back-out curve that overshoots and
// settles — the "15px" overshoot from the spec, expressed as viewBox units
// so it scales with the card) -> return-down (700ms, ease-in-out, empty,
// back to the rail). That is 2400ms/stand. Tripping in reverses the same
// five waypoints in reverse order with custody flipped (swing-in -> unseat
// -> swing-out -> lower-stand -> rise-empty), unracking the MOST recently
// racked slot first (LIFO — mechanically the last stand racked is the first
// one run back in), so the two directions share one geometry table.
//
// `racked` (0..12) is the single source of truth: it drives the fingerboard
// fill (slot i is filled iff i < racked) AND the depth counter (displayed =
// 12 - racked) AND is only ever mutated at the exact instant custody of a
// stand changes hands (rack-seat's end for tripping out, unseat's start for
// tripping in) — counter and fingerboard can never visibly desync because
// they are read from the same integer, not two independently-advanced ones.
// racked === 12 is the "OUT" hold (1.8s), after which direction flips and
// tripping-in begins immediately from the same racked value (12, i.e. the
// fingerboard is still full) rather than a discontinuous jump.
// ---------------------------------------------------------------------------

interface Pt {
  x: number;
  y: number;
}

const VB_W = 120;
const VB_H = 150;

const LEG_L = 22;
const LEG_R = 98;
const FB_BAR_Y = 14; // fingerboard bar
const SLOT_Y = 20; // racked-stand rest height
const SLOT_W = 3.4;
const SLOT_H = 6.5;
const SLOT_COUNT = 12;
const SLOT_MARGIN_X = 34; // gap kept inside the legs before the first/last slot
const RAIL_X = (LEG_L + LEG_R) / 2; // 60 — where the elevator travels empty
const HOOK_Y = 26; // elevator's "ready" height just under the fingerboard
const FLOOR_Y = 136; // rotary table height
const FLOOR_LINE_Y = 141;

const BRACE_YS = [46, 70, 94, 118];

const EL_W = 11; // elevator block
const EL_H = 5.6;
const STAND_H = 15; // carried-stand rod, extends up from the block
const STAND_W = 1.8;

const CYCLE_MS = 2400; // 700+500+200+300+700, documented in the spec
const HOLD_MS = 1800; // "OUT" pause before tripping-in begins

const EASE_IN = "cubic-bezier(0.55, 0, 1, 0.45)"; // gravity-assisted lowering
const EASE_OUT = "cubic-bezier(0, 0.55, 0.45, 1)"; // block brake sets
const EASE_INOUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const EASE_LATERAL = "cubic-bezier(0.45, 0, 0.55, 1)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // rack-seat / unseat overshoot

function slotX(i: number): number {
  const span = LEG_R - LEG_L - SLOT_MARGIN_X * 2;
  return LEG_L + SLOT_MARGIN_X + (span * i) / (SLOT_COUNT - 1);
}

const A: Pt = { x: RAIL_X, y: HOOK_Y }; // rail, ready
const B: Pt = { x: RAIL_X, y: FLOOR_Y }; // rail, at rotary table
const D = (i: number): Pt => ({ x: slotX(i), y: HOOK_Y }); // lateral, aligned with slot
const E = (i: number): Pt => ({ x: slotX(i), y: SLOT_Y }); // seated in the fingerboard

interface Phase {
  ms: number;
  ease: string;
  from: (i: number) => Pt;
  to: (i: number) => Pt;
  /** custody flips to "carrying" the instant this phase begins */
  carryAtStart?: boolean;
  /** custody flips to "empty" the instant this phase ends */
  releaseAtEnd?: boolean;
  /** racked-count mutation to run right when this phase begins */
  onStart?: (setRacked: (fn: (r: number) => number) => void) => void;
  /** racked-count mutation to run right when this phase ends */
  onEnd?: (setRacked: (fn: (r: number) => number) => void) => void;
}

// tripping OUT: elevator descends empty, hoists a stand clear, racks it.
const OUT_PHASES: Phase[] = [
  { ms: 700, ease: EASE_IN, from: () => A, to: () => B }, // down-stroke
  { ms: 500, ease: EASE_OUT, from: () => B, to: () => A, carryAtStart: true }, // hoist-up
  { ms: 200, ease: EASE_LATERAL, from: () => A, to: (i) => D(i) }, // swing-to-rack
  {
    ms: 300,
    ease: SPRING,
    from: (i) => D(i),
    to: (i) => E(i),
    releaseAtEnd: true,
    onEnd: (setRacked) => setRacked((r) => Math.min(SLOT_COUNT, r + 1)),
  }, // rack-seat
  { ms: 700, ease: EASE_INOUT, from: (i) => E(i), to: () => A }, // return-down
];

// tripping IN: same five waypoints, reversed order, custody reversed. Slots
// unrack most-recently-racked-first (LIFO).
const IN_PHASES: Phase[] = [
  { ms: 700, ease: EASE_INOUT, from: () => A, to: (i) => E(i) }, // swing-in
  {
    ms: 300,
    ease: SPRING,
    from: (i) => E(i),
    to: (i) => D(i),
    carryAtStart: true,
    onStart: (setRacked) => setRacked((r) => Math.max(0, r - 1)),
  }, // unseat
  { ms: 200, ease: EASE_LATERAL, from: (i) => D(i), to: () => A }, // swing-out
  { ms: 500, ease: EASE_IN, from: () => A, to: () => B, releaseAtEnd: true }, // lower-stand
  { ms: 700, ease: EASE_OUT, from: () => B, to: () => A }, // rise-empty
];

// -- reduced-motion / initial static frame: a fully-seated rack-seat, elevator
// still adjacent, mid-settle — the frame that shows hoist/stand/fingerboard
// relationship most clearly (chosen over any empty-elevator travel frame).
const REDUCED_RACKED = 5;
const REDUCED_SLOT = REDUCED_RACKED - 1;

export interface PipeStandTripProps {
  /** mono label above the derrick */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function PipeStandTrip({ label = "PIPE STAND TRIP", className = "" }: PipeStandTripProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const standRef = useRef<SVGRectElement>(null);

  // t0: mid-cycle, elevator partway up the derrick carrying a stand, 5 of 12
  // slots already racked (the spec's own worked example, "7 STANDS").
  const [racked, setRackedState] = useState(REDUCED_RACKED);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [holding, setHolding] = useState(false);

  const rackedRef = useRef(racked);
  const setRacked = (fn: (r: number) => number) => {
    rackedRef.current = fn(rackedRef.current);
    setRackedState(rackedRef.current);
  };

  useEffect(() => {
    const root = rootRef.current;
    const group = groupRef.current;
    const stand = standRef.current;
    if (!root || !group || !stand) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const place = (p: Pt, ms: number, ease: string) => {
      group.style.transition = reduced || ms === 0 ? "none" : `transform ${ms}ms ${ease}`;
      group.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    const setCarrying = (carrying: boolean) => {
      stand.style.transition = reduced ? "none" : "opacity 120ms linear";
      stand.style.opacity = carrying ? "1" : "0";
    };

    if (reduced) {
      // one deterministic, fully static frame — no timers ever scheduled.
      place(E(REDUCED_SLOT), 0, "none");
      setCarrying(false);
      setRacked(() => REDUCED_RACKED);
      setDirection("out");
      setHolding(false);
      return;
    }

    let disposed = false;
    let paused = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirRef: "out" | "in" = "out";
    let standIndex = 0;
    let phaseIdx = 0;
    let pendingWake: (() => void) | null = null;

    const currentPhases = () => (dirRef === "out" ? OUT_PHASES : IN_PHASES);

    const runPhase = () => {
      if (disposed) return;
      if (paused) {
        pendingWake = runPhase;
        return;
      }
      const phases = currentPhases();
      const phase = phases[phaseIdx];
      if (!phase) return;
      if (phase.onStart) phase.onStart(setRacked);
      if (phase.carryAtStart) setCarrying(true);
      place(phase.to(standIndex), phase.ms, phase.ease);
      timer = setTimeout(() => {
        timer = null;
        if (disposed) return;
        if (phase.releaseAtEnd) setCarrying(false);
        if (phase.onEnd) phase.onEnd(setRacked);
        phaseIdx += 1;
        if (phaseIdx < phases.length) {
          runPhase();
          return;
        }
        // stand-cycle complete
        phaseIdx = 0;
        if (dirRef === "out" && rackedRef.current >= SLOT_COUNT) {
          setHolding(true);
          timer = setTimeout(() => {
            timer = null;
            if (disposed) return;
            setHolding(false);
            dirRef = "in";
            setDirection("in");
            standIndex = rackedRef.current - 1;
            runPhase();
          }, HOLD_MS);
          return;
        }
        if (dirRef === "in" && rackedRef.current <= 0) {
          dirRef = "out";
          setDirection("out");
        }
        standIndex = dirRef === "out" ? rackedRef.current : rackedRef.current - 1;
        runPhase();
      }, phase.ms);
    };

    // start at t0: mid hoist-up, carrying, 5 racked already.
    standIndex = rackedRef.current;
    phaseIdx = 1; // hoist-up
    place(B, 0, "none");
    setCarrying(true);
    timer = setTimeout(runPhase, 30);

    const pause = () => {
      if (paused) return;
      paused = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    const resume = () => {
      if (!paused) return;
      paused = false;
      const wake = pendingWake;
      pendingWake = null;
      if (wake) wake();
    };

    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) resume();
      else pause();
    });
    io.observe(root);

    const onVisibility = () => {
      if (document.hidden) pause();
      else resume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseLabel = holding ? "OUT" : direction === "out" ? "TRIPPING OUT" : "TRIPPING IN";
  const remaining = SLOT_COUNT - racked;
  const counterLabel = holding
    ? "OUT"
    : `${remaining} STAND${remaining === 1 ? "" : "S"}`;

  return (
    <div
      ref={rootRef}
      className={`flex h-full min-h-[220px] w-full flex-col overflow-hidden rounded-md border border-border bg-surface ${className}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted">{label}</span>
        <span className="font-mono text-[10px] tracking-[0.15em] text-ns-muted">{phaseLabel}</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          {/* rig structure — static, --border, subordinate to the mechanism */}
          <g stroke="var(--border)" strokeOpacity={0.85} fill="none">
            <line x1={LEG_L} y1={FB_BAR_Y} x2={LEG_L} y2={FLOOR_LINE_Y} strokeWidth={1} />
            <line x1={LEG_R} y1={FB_BAR_Y} x2={LEG_R} y2={FLOOR_LINE_Y} strokeWidth={1} />
            <line x1={LEG_L - 5} y1={FLOOR_LINE_Y} x2={LEG_R + 5} y2={FLOOR_LINE_Y} strokeWidth={1.2} />
            <line x1={LEG_L - 2} y1={FB_BAR_Y} x2={LEG_R + 2} y2={FB_BAR_Y} strokeWidth={1.2} />
            <line x1={RAIL_X} y1={HOOK_Y - 4} x2={RAIL_X} y2={FLOOR_Y} strokeWidth={0.7} strokeOpacity={0.5} />
            {BRACE_YS.map((y) => (
              <line key={y} x1={LEG_L} y1={y} x2={LEG_R} y2={y} strokeWidth={0.6} strokeOpacity={0.55} />
            ))}
            {BRACE_YS.slice(0, -1).map((y, idx) => {
              const y2 = BRACE_YS[idx + 1];
              return (
                <g key={y}>
                  <line x1={LEG_L} y1={y} x2={LEG_R} y2={y2} strokeWidth={0.4} strokeOpacity={0.35} />
                  <line x1={LEG_R} y1={y} x2={LEG_L} y2={y2} strokeWidth={0.4} strokeOpacity={0.35} />
                </g>
              );
            })}
          </g>

          {/* fingerboard slots — empty outline in --border, racked fill in --ns-muted */}
          {Array.from({ length: SLOT_COUNT }, (_, i) => {
            const x = slotX(i);
            const filled = i < racked;
            return (
              <rect
                key={i}
                x={x - SLOT_W / 2}
                y={SLOT_Y - SLOT_H / 2}
                width={SLOT_W}
                height={SLOT_H}
                rx={0.5}
                fill={filled ? "var(--ns-muted)" : "none"}
                fillOpacity={filled ? 0.9 : 1}
                stroke="var(--border)"
                strokeOpacity={0.85}
                strokeWidth={0.7}
              />
            );
          })}

          {/* elevator + carried stand — --foreground, the only moving parts */}
          <g ref={groupRef} style={{ willChange: "transform" }}>
            <rect
              ref={standRef}
              x={-STAND_W / 2}
              y={-(EL_H / 2) - STAND_H}
              width={STAND_W}
              height={STAND_H}
              fill="var(--foreground)"
              opacity={0}
            />
            <rect
              x={-EL_W / 2}
              y={-EL_H / 2}
              width={EL_W}
              height={EL_H}
              rx={0.8}
              fill="var(--foreground)"
            />
          </g>
        </svg>
      </div>

      <div className="flex items-center justify-center border-t border-border px-3 py-2">
        <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {counterLabel}
        </span>
      </div>
    </div>
  );
}
