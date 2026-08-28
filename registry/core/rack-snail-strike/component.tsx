"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RackSnailStrike — a live-count stat tile built on the rack-and-snail
// striking mechanism (English/French striking clocks): a stepped spiral cam
// (the "snail," one radius per hour 1-12) sets how far a toothed rack drops
// before it's stopped, then a gathering pallet walks the rack back up one
// tooth at a time, firing one hammer blow per tooth. The count is physically
// encoded as a distance and only READ OUT as a sequence of discrete strikes
// — no counting logic, just geometry.
//
// NOTE on the source spec's numbers: the brief's prose describes fall
// distance as proportional to (13 - stepValue) ("less to strike falls
// farther"). That contradicts its own gathering rule ("stepValue times per
// cycle" — the tooth count climbed back MUST equal the fall depth, since
// every climbed tooth fires one strike). Implemented here as fall depth
// directly proportional to stepValue (MORE strikes = rack fell FARTHER),
// which is both internally consistent with the fixed gather-count and
// matches the real historical mechanism (12 o'clock's cam radius is
// smallest, letting the rack fall the deepest of the year). Flagged for
// spec review.
//
// Cam: SVG stepped-spiral path, 12 constant radii, rotates under a fixed
// follower pin so the selected step's radius sits under it. Rack: a DOM row
// of tooth-shaped divs, the row's own translateY encodes fall depth. Hammer
// + bell: SVG, --foreground only (the climactic moment); cam + rack teeth
// stay --ns-muted (structural). Pure CSS custom-property colour (var(...)),
// no getComputedStyle read needed — SVG/DOM attributes referencing var()
// repaint for free on a theme class flip, same convention as checkbox-
// tally-notch. Zero deps, all timing via cleared setTimeout chains.
// ---------------------------------------------------------------------------

const SEQUENCE = [3, 7, 1, 12, 5, 9] as const; // non-monotonic on purpose
const CAM_STEPS = 12;
const CAM_ROTATE_MS = 300;
const FALL_MS = 400;
const LIFT_MS = 550; // 60% of hammer travel, ease-out
const STRIKE_FALL_MS = 150; // remaining 40%, overshoot bounce
const STRIKE_INTERVAL_MS = 850;
const STRIKE_PAUSE_MS = Math.max(0, STRIKE_INTERVAL_MS - LIFT_MS - STRIKE_FALL_MS);
const FLASH_MS = 150;
const REST_MIN_MS = 600;
const REST_MAX_MS = 1400;

const CAM_CX = 30;
const CAM_CY = 50;
const CAM_MIN_R = 11;
const CAM_MAX_R = 27;

const TOOTH_PX = 8; // fixed pitch — one tooth IS one strike, never rescaled
const TRACK_PX = TOOTH_PX * CAM_STEPS; // 96, matches the h-24 track

function restForStep(v: number): number {
  const t = (v - 1) / 11;
  return REST_MAX_MS - t * (REST_MAX_MS - REST_MIN_MS);
}

function camRadius(v: number): number {
  const t = (v - 1) / 11;
  return CAM_MAX_R - t * (CAM_MAX_R - CAM_MIN_R); // more strikes -> smaller radius
}

// Stepped spiral built once — constant geometry, no per-render trig.
function buildSnailPath(): string {
  const parts: string[] = [];
  for (let i = 0; i < CAM_STEPS; i++) {
    const v = i + 1;
    const r = camRadius(v);
    const a0 = (i * 30 - 90) * (Math.PI / 180);
    const a1 = ((i + 1) * 30 - 90) * (Math.PI / 180);
    const x0 = CAM_CX + Math.cos(a0) * r;
    const y0 = CAM_CY + Math.sin(a0) * r;
    const x1 = CAM_CX + Math.cos(a1) * r;
    const y1 = CAM_CY + Math.sin(a1) * r;
    if (i === 0) parts.push(`M ${x0.toFixed(2)} ${y0.toFixed(2)}`);
    else {
      // radial cliff from the previous step's radius up to this one
      const prevR = camRadius(v - 1);
      const cx0 = CAM_CX + Math.cos(a0) * prevR;
      const cy0 = CAM_CY + Math.sin(a0) * prevR;
      parts.push(`L ${cx0.toFixed(2)} ${cy0.toFixed(2)} L ${x0.toFixed(2)} ${y0.toFixed(2)}`);
    }
    parts.push(`A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`);
  }
  // closing cliff: step 12's radius back down to step 1's, the mechanism's
  // characteristic abrupt reset
  const rLast = camRadius(CAM_STEPS);
  const rFirst = camRadius(1);
  const aClose = (-90) * (Math.PI / 180);
  const xCliffOuter = CAM_CX + Math.cos(aClose) * rLast;
  const yCliffOuter = CAM_CY + Math.sin(aClose) * rLast;
  const xCliffInner = CAM_CX + Math.cos(aClose) * rFirst;
  const yCliffInner = CAM_CY + Math.sin(aClose) * rFirst;
  parts.push(`L ${xCliffOuter.toFixed(2)} ${yCliffOuter.toFixed(2)} L ${xCliffInner.toFixed(2)} ${yCliffInner.toFixed(2)} Z`);
  return parts.join(" ");
}

const SNAIL_PATH = buildSnailPath();

// rotate the cam group so the selected step's arc midpoint sits under the
// fixed follower pin at the top (-90deg)
function camRotationDeg(index: number): number {
  const midpoint = index * 30 + 15;
  return -90 - midpoint;
}

type HammerState = "rest" | "lift" | "fall";

interface FreezeFrame {
  stepIndex: number;
  climbed: number;
  hammer: HammerState;
}

// reduced-motion freeze: the "7" step, half-climbed (3 of 7 teeth
// gathered), hammer resting against the bell having just struck — shows
// cam step, rack depth, AND hammer-at-bell in the one frame.
const FREEZE: FreezeFrame = { stepIndex: 6, climbed: 3, hammer: "rest" };

export interface RackSnailStrikeProps {
  /**
   * A real, externally-owned live count (e.g. "new tickets this hour").
   * When provided, the built-in idle demo sequence is disabled entirely —
   * the mechanism only reacts to an explicit change of this value (one
   * fall-and-gather run per change) and never polls a clock.
   */
  count?: number;
  /** mono label under the stat figure */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RackSnailStrike({ count, label = "struck this hour", className = "" }: RackSnailStrikeProps) {
  const reducedRef = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const reduced = reducedRef.current;

  const [stepIndex, setStepIndex] = useState(reduced ? FREEZE.stepIndex : SEQUENCE[0] - 1);
  const [fallen, setFallen] = useState(reduced); // true once the rack has dropped (freeze starts fallen)
  const [climbed, setClimbed] = useState(reduced ? FREEZE.climbed : 0);
  const [hammer, setHammer] = useState<HammerState>(reduced ? FREEZE.hammer : "rest");
  const [flash, setFlash] = useState(false);

  const seqPosRef = useRef(0);
  const lastAppliedCountRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduced) return; // static freeze frame only, no timers at all

    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };
    let disposed = false;

    const runStrike = (stepValue: number, strikesDone: number) => {
      if (disposed) return;
      setHammer("lift");
      after(LIFT_MS, () => {
        if (disposed) return;
        setHammer("fall");
        after(STRIKE_FALL_MS, () => {
          if (disposed) return;
          const next = strikesDone + 1;
          setClimbed(next);
          setFlash(true);
          after(FLASH_MS, () => !disposed && setFlash(false));
          if (next >= stepValue) {
            setHammer("rest");
            after(STRIKE_PAUSE_MS + restForStep(stepValue), () => runCycle());
          } else {
            after(STRIKE_PAUSE_MS, () => runStrike(stepValue, next));
          }
        });
      });
    };

    const runCycle = () => {
      if (disposed) return;
      const stepValue = SEQUENCE[seqPosRef.current % SEQUENCE.length]!;
      seqPosRef.current += 1;
      setStepIndex(stepValue - 1);
      setClimbed(0);
      setFallen(false);
      after(CAM_ROTATE_MS, () => {
        if (disposed) return;
        setFallen(true);
        after(FALL_MS, () => {
          if (disposed) return;
          runStrike(stepValue, 0);
        });
      });
    };

    if (count === undefined) {
      runCycle();
    }

    return () => {
      disposed = true;
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, count === undefined]);

  // controlled mode: react only to an explicit change of `count`, never a poll
  useEffect(() => {
    if (reduced || count === undefined) return;
    if (lastAppliedCountRef.current === count) return;
    const first = lastAppliedCountRef.current === undefined;
    lastAppliedCountRef.current = count;
    if (first) return; // don't animate the initial mount value

    const timers: number[] = [];
    const after = (ms: number, fn: () => void) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };
    let disposed = false;
    const stepValue = Math.max(1, Math.min(CAM_STEPS, Math.round(count)));

    const runStrike = (strikesDone: number) => {
      if (disposed) return;
      setHammer("lift");
      after(LIFT_MS, () => {
        if (disposed) return;
        setHammer("fall");
        after(STRIKE_FALL_MS, () => {
          if (disposed) return;
          const next = strikesDone + 1;
          setClimbed(next);
          setFlash(true);
          after(FLASH_MS, () => !disposed && setFlash(false));
          if (next >= stepValue) {
            setHammer("rest");
          } else {
            after(STRIKE_PAUSE_MS, () => runStrike(next));
          }
        });
      });
    };

    setStepIndex(stepValue - 1);
    setClimbed(0);
    setFallen(false);
    after(CAM_ROTATE_MS, () => {
      if (disposed) return;
      setFallen(true);
      after(FALL_MS, () => runStrike(0));
    });

    return () => {
      disposed = true;
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, reduced]);

  const stepValue = stepIndex + 1;
  // fixed pitch, one tooth per strike: exposed = strikes not yet gathered.
  // depth is therefore always exactly legible as a tooth COUNT, not a
  // continuous fraction — a 12 visibly exposes all 12 teeth, a 1 exposes
  // exactly one.
  const exposedTeeth = fallen ? Math.max(0, stepValue - climbed) : 0;
  const rackTranslatePx = -TRACK_PX + exposedTeeth * TOOTH_PX;
  const justFell = climbed === 0;
  const rackTransitionMs = justFell ? FALL_MS : STRIKE_FALL_MS;
  const rackEasing = justFell ? "cubic-bezier(0.55, 0, 1, 0.45)" : "cubic-bezier(0.3, 1.6, 0.4, 1)";

  // rest/fall both target rotation 0 (hammer against the bell); lift cocks
  // it away. The overshoot-bounce look comes entirely from the bezier
  // curve overshooting past 0 on the fall leg, not from a separate offset.
  const hammerRot = hammer === "lift" ? -34 : 0;
  const hammerDurationMs = hammer === "lift" ? LIFT_MS : STRIKE_FALL_MS;
  const hammerEasing = hammer === "lift" ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.3, 1.6, 0.4, 1)";

  return (
    <div
      className={`w-full max-w-sm rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-ns-muted">Strike count</p>
      <div className="flex items-center gap-3">
        <svg
          aria-hidden="true"
          viewBox="0 0 60 100"
          className="h-24 w-[30%] shrink-0"
          style={{ overflow: "visible" }}
        >
          {/* fixed follower pin, does not move */}
          <path d="M 30 15 L 33.5 22 L 26.5 22 Z" fill="var(--ns-muted)" opacity={0.7} />
          <g
            style={{
              transformOrigin: `${CAM_CX} ${CAM_CY}`,
              transform: `rotate(${camRotationDeg(stepIndex)}deg)`,
              transition: `transform ${CAM_ROTATE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          >
            <path d={SNAIL_PATH} fill="none" stroke="var(--ns-muted)" strokeWidth={1.4} strokeLinejoin="round" />
          </g>
        </svg>

        <div className="relative h-24 w-[22%] shrink-0 overflow-hidden" aria-hidden="true">
          {/* gathering line: fixed reference, the pallet the rack falls past */}
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: "var(--ns-muted)", opacity: 0.35 }} />
          <div
            className="absolute inset-x-0 top-0 flex flex-col"
            style={{
              transform: `translateY(${rackTranslatePx}px)`,
              transition: `transform ${rackTransitionMs}ms ${rackEasing}`,
            }}
          >
            {Array.from({ length: CAM_STEPS }).map((_, i) => (
              <span
                key={i}
                className="block w-full"
                style={{
                  height: TOOTH_PX,
                  background: "var(--ns-muted)",
                  opacity: 0.6,
                  clipPath: "polygon(15% 0, 85% 0, 100% 100%, 0 100%)",
                }}
              />
            ))}
          </div>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 40 60"
          className="h-24 w-[24%] shrink-0"
          style={{ overflow: "visible" }}
        >
          {/* bell */}
          <path
            d="M 20 6 C 12 6 8 13 8 20 L 6 27 L 34 27 L 32 20 C 32 13 28 6 20 6 Z"
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1.3}
          />
          <line x1={14} y1={27} x2={26} y2={27} stroke="var(--foreground)" strokeWidth={1.3} />
          {/* hammer: pivots at bottom-right, head travels toward the bell */}
          <g
            style={{
              transformOrigin: "34 50",
              transform: `rotate(${hammerRot}deg)`,
              transition: `transform ${hammerDurationMs}ms ${hammerEasing}`,
            }}
          >
            <line x1={34} y1={50} x2={22} y2={30} stroke="var(--foreground)" strokeWidth={1.6} strokeLinecap="round" />
            <circle cx={22} cy={30} r={3.2} fill="var(--foreground)" />
          </g>
        </svg>

        <div className="ml-1 flex min-w-0 flex-1 flex-col items-start">
          <span
            className="font-mono text-3xl tabular-nums text-foreground"
            style={{
              filter: flash ? "brightness(1.7)" : "brightness(1)",
              transition: `filter ${FLASH_MS}ms ease-out`,
            }}
          >
            {climbed}
          </span>
          <span className="mt-1 truncate font-mono text-[10px] uppercase tracking-widest text-ns-muted">
            {label}
          </span>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {climbed} {label}
      </span>
    </div>
  );
}
