"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// PawlLift — a bounded numeric spinbutton rendered as a ratchet-and-pawl with
// DIRECTION-DEPENDENT friction. Incrementing is the ratchet's free direction:
// one press advances the toothed rack one detent (ease-out-expo translateX)
// and the pawl gives a quick 80ms kick-and-reseat as it rides over the new
// tooth. Decrementing runs against the ratchet: holding the decrement control
// rotates the pawl 35deg clear over 250ms before anything moves; only once
// armed does the rack start stepping backward, at 6 steps/s for as long as
// the hold continues; releasing snaps the pawl home on a spring curve. The
// 250ms arm delay is a POINTER-ONLY affordance — keyboard ArrowDown always
// steps immediately, matching ArrowUp, so keyboard users are never slower.
// Rack/pawl motion is direct-DOM (imperative ref styles), no React state on
// the animation hot path; prefers-reduced-motion drops the tween/kick/snap
// entirely but keeps the arm timing and every step instant. Pure DOM + SVG +
// CSS, tokens only, no canvas.
// ---------------------------------------------------------------------------

const TOOTH = 20; // px per detent, in the rack SVG's own coordinate units
const VB_W = 240;
const VB_H = 44;
const RAIL_Y = 30;
const TOOTH_H = 10;
const PAWL_X = 62;
const PAWL_TIP_Y = RAIL_Y - TOOTH_H; // pawl tip rests at the tooth peak line

const RACK_MS = 160;
const RACK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const ARM_MS = 250; // pointer-only hold-to-arm threshold
const ARM_DEG = 35;
const REPEAT_MS = 1000 / 6; // held-repeat rate once armed
const SNAP_MS = 260;
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // one-shot overshoot
const KICK_DEG = 14;
const KICK_UP_MS = 34;
const KICK_DOWN_MS = 46; // up + down ~= 80ms total

// repeating sawtooth path for the rack, generated once — a couple of buffer
// teeth beyond each edge so a one-tooth wrap-snap never reveals a gap
function buildTeethPath() {
  const startI = -2;
  const endI = Math.ceil(VB_W / TOOTH) + 2;
  let d = "";
  for (let i = startI; i <= endI; i++) {
    const x0 = i * TOOTH;
    const peakX = x0 + TOOTH * 0.32;
    const x1 = x0 + TOOTH;
    if (d === "") d += `M ${x0} ${RAIL_Y} `;
    d += `L ${peakX} ${RAIL_Y - TOOTH_H} L ${x1} ${RAIL_Y} `;
  }
  return d;
}
const TEETH_PATH = buildTeethPath();

const btnBase =
  "flex h-11 w-11 shrink-0 select-none items-center justify-center rounded-sm border border-border bg-background text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
const btnLive =
  "cursor-pointer hover:border-foreground/30 hover:bg-foreground/[0.06] active:bg-foreground/[0.1] data-[hover=true]:border-foreground/30 data-[hover=true]:bg-foreground/[0.06] data-[press=true]:bg-foreground/[0.1]";
const btnDead = "cursor-default opacity-40";

export interface PawlLiftProps {
  /** controlled value; omit for uncontrolled */
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** accessible name for the spinbutton, and the on-screen caption */
  label?: string;
  /** unit suffix rendered beside the value, e.g. "seats" */
  unit?: string;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export function PawlLift({
  value,
  defaultValue = 1,
  min = 0,
  max = 99,
  step = 1,
  label = "Quantity",
  unit,
  onValueChange,
  disabled = false,
  className = "",
}: PawlLiftProps) {
  const decimals = (() => {
    const frac = String(step).split(".")[1];
    return frac ? frac.length : 0;
  })();
  const clampRound = (v: number) =>
    Number(Math.min(max, Math.max(min, v)).toFixed(decimals));

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clampRound(defaultValue));
  const current = isControlled ? clampRound(value) : internal;

  const valueRef = useRef(current);
  valueRef.current = current;
  const boundsRef = useRef({ min, max });
  boundsRef.current = { min, max };
  const stepRef = useRef(step);
  stepRef.current = step;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const reducedRef = useRef(false);

  const teethRef = useRef<SVGGElement>(null);
  const pawlRef = useRef<SVGGElement>(null);
  const railOffsetRef = useRef(0);
  const armTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [decHover, setDecHover] = useState(false);
  const [decPress, setDecPress] = useState(false);
  const [incHover, setIncHover] = useState(false);
  const [incPress, setIncPress] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reducedRef.current = mq.matches;
    };
    onMq();
    mq.addEventListener("change", onMq);
    return () => mq.removeEventListener("change", onMq);
  }, []);

  useEffect(
    () => () => {
      if (armTimeoutRef.current) clearTimeout(armTimeoutRef.current);
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
      if (kickTimeoutRef.current) clearTimeout(kickTimeoutRef.current);
    },
    []
  );

  // ---- rack visual: direct-DOM translateX, wraps modulo one tooth width so
  // the cumulative offset never runs away across many steps -----------------
  const stepRack = (dir: number) => {
    const g = teethRef.current;
    if (!g) return;
    const reduced = reducedRef.current;
    const next = railOffsetRef.current + dir * TOOTH;
    g.style.transition = reduced ? "none" : `transform ${RACK_MS}ms ${RACK_EASE}`;
    g.style.transform = `translateX(${next}px)`;
    railOffsetRef.current = next;
    const wrap = () => {
      const g2 = teethRef.current;
      if (!g2) return;
      if (Math.abs(railOffsetRef.current) >= TOOTH) {
        const wrapped = railOffsetRef.current - Math.sign(railOffsetRef.current) * TOOTH;
        g2.style.transition = "none";
        g2.style.transform = `translateX(${wrapped}px)`;
        railOffsetRef.current = wrapped;
      }
    };
    if (reduced) wrap();
    else setTimeout(wrap, RACK_MS + 30);
  };

  // ---- pawl visual: direct-DOM rotate, one function used for the arm sweep,
  // the release spring, and both halves of the increment kick --------------
  const setPawlAngle = (angle: number, ms: number, ease: string) => {
    const g = pawlRef.current;
    if (!g) return;
    const reduced = reducedRef.current;
    g.style.transition = reduced ? "none" : `transform ${ms}ms ${ease}`;
    g.style.transform = angle ? `rotate(${angle}deg)` : "";
  };

  const playKick = () => {
    if (reducedRef.current) return; // reduced motion: no kick, step is already instant
    if (kickTimeoutRef.current) clearTimeout(kickTimeoutRef.current);
    setPawlAngle(KICK_DEG, KICK_UP_MS, RACK_EASE);
    kickTimeoutRef.current = setTimeout(() => {
      setPawlAngle(0, KICK_DOWN_MS, RACK_EASE);
      kickTimeoutRef.current = null;
    }, KICK_UP_MS);
  };

  // ---- value commit: shared by every path (click, keys, held repeat) ------
  const commitValue = (next: number) => {
    if (!isControlled) setInternal(next);
    if (next !== valueRef.current) onValueChange?.(next);
    valueRef.current = next;
  };

  // clamped step: returns false (no-op) at a bound so the rack never
  // animates a detent that didn't actually change the value
  const stepCore = (dir: number, withKick: boolean) => {
    if (disabledRef.current) return false;
    const next = clampRound(valueRef.current + stepRef.current * dir);
    if (next === valueRef.current) return false;
    commitValue(next);
    stepRack(dir);
    if (withKick) playKick();
    return true;
  };

  const clearDecTimers = () => {
    if (armTimeoutRef.current) {
      clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  const startDecHold = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); // keep focus where it was, no text selection
    if (disabledRef.current) return;
    clearDecTimers();
    setDecPress(true);
    setPawlAngle(ARM_DEG, ARM_MS, "linear");
    armTimeoutRef.current = setTimeout(() => {
      armTimeoutRef.current = null;
      stepCore(-1, false); // pawl is already lifted clear — no kick
      repeatIntervalRef.current = setInterval(() => {
        if (valueRef.current <= boundsRef.current.min) {
          clearDecTimers();
          return;
        }
        stepCore(-1, false);
      }, REPEAT_MS);
    }, ARM_MS);
  };

  const endDecHold = () => {
    clearDecTimers();
    setDecPress(false);
    setPawlAngle(0, SNAP_MS, SPRING_EASE);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      stepCore(1, true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      // pointer-only friction never applies here — keyboard steps immediately,
      // at whatever cadence the OS's own key-repeat delivers keydown events
      stepCore(-1, true);
    }
  };

  const atMin = current <= min;
  const atMax = current >= max;

  return (
    <div
      className={`rounded-md border border-border bg-surface p-4 ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <span className="font-mono text-[10px] text-muted">
          {min}&ndash;{max}
        </span>
      </div>

      <div
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={current}
        aria-valuetext={unit ? `${current} ${unit}` : String(current)}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className="mb-3 w-full select-none rounded-sm text-center font-mono text-4xl font-semibold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {current}
        {unit ? <span className="ml-1.5 text-base font-normal text-muted">{unit}</span> : null}
      </div>

      <div className="relative h-11 w-full overflow-hidden rounded-sm border border-border bg-background">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          className="block h-full w-full"
          aria-hidden="true"
          focusable="false"
        >
          <line
            x1={0}
            y1={RAIL_Y + 3}
            x2={VB_W}
            y2={RAIL_Y + 3}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <g ref={teethRef} style={{ willChange: "transform" }}>
            <path
              d={TEETH_PATH}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
          <g
            ref={pawlRef}
            style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
          >
            <polygon
              points={`${PAWL_X},${PAWL_TIP_Y} ${PAWL_X - 5},${PAWL_TIP_Y - 14} ${PAWL_X + 5},${PAWL_TIP_Y - 14}`}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          aria-disabled={disabled || atMin || undefined}
          onPointerDown={startDecHold}
          onPointerUp={endDecHold}
          onPointerCancel={endDecHold}
          onPointerEnter={() => setDecHover(true)}
          onPointerLeave={() => {
            setDecHover(false);
            endDecHold();
          }}
          onBlur={endDecHold}
          data-hover={decHover}
          data-press={decPress}
          className={`${btnBase} ${disabled || atMin ? btnDead : btnLive}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        <div className="flex-1" />

        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          aria-disabled={disabled || atMax || undefined}
          onPointerEnter={() => setIncHover(true)}
          onPointerLeave={() => {
            setIncHover(false);
            setIncPress(false);
          }}
          onPointerDown={() => setIncPress(true)}
          onPointerUp={() => setIncPress(false)}
          onPointerCancel={() => setIncPress(false)}
          onClick={() => {
            if (disabled || atMax) return;
            stepCore(1, true);
          }}
          data-hover={incHover}
          data-press={incPress}
          className={`${btnBase} ${disabled || atMax ? btnDead : btnLive}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path
              d="M7 2.5v9M2.5 7h9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
