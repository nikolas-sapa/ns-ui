"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// BreakerSnap — a switch built like an electrical breaker, not an iOS flick.
// The lever (an SVG paddle, -30..+30deg around a base pivot) is dragged
// horizontally; a critically-damped spring chases the pointer's angle with
// visible lag ("resistance") for the first 60% of the home->opposite travel
// (which includes crossing the vertical dead point at 0deg). Past that mark
// the mechanism locks: the commit fires immediately and the spring finishes
// the throw on its own, regardless of further pointer input, closing with an
// explicit one-frame overshoot and a 2px translateY thunk on the housing.
// Release before the 60% mark and nothing has committed — the spring just
// relaxes back to the rest it started from. There is no stable middle.
// Space/Enter (and a plain tap/click, i.e. a press with no real drag
// distance) commit instantly, skipping the resistance phase entirely — that
// phase is a pointer-commitment device, not an accessibility gate.
//
// BreakerSnap also renders the <fieldset> it governs: on commit the fieldset
// flips `data-powered` and a real `disabled` attribute in one 60ms linear
// cut (not an eased fade), and — only when closing — a tiny two-stroke SVG
// spark flashes at the contact. An aria-live region announces the resulting
// state and how many downstream controls it just enabled or disabled.
// Tokens only: --background --foreground --muted --border --accent.
// ---------------------------------------------------------------------------

const ANGLE_MAX = 30; // deg, symmetric travel either side of the vertical dead point
const LOCK_PROGRESS = 0.6; // fraction of home->opposite travel that locks an autonomous snap
const PX_PER_DEG = 2.4; // px of horizontal drag per degree of pointer-derived angle
const TAP_PX = 4; // pointer travel under this counts as a tap, not a drag
const SPRING_K = 900; // s^-2, critically-damped chase (both the resisted lag and the autonomous run)
const SPRING_ZETA = 1;
const OVERSHOOT_DEG = 3; // explicit one-frame overshoot past the resting angle on commit
const CONTROLS_SELECTOR =
  "input, select, textarea, button, [role=switch], [role=checkbox], [role=radio], [role=slider]";

const HOUSING_W = 44;
const HOUSING_H = 64;
const PIVOT_X = 22;
const PIVOT_Y = 50;
const PADDLE_LEN = 26;
const PADDLE_W = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Phase = "idle" | "chase" | "overshoot" | "settle";

export interface BreakerSnapProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** accessible name for the lever, and what the live announcement calls the governed system */
  label: string;
  /** dependent controls this breaker powers — wrapped in a real <fieldset disabled> */
  children?: React.ReactNode;
  className?: string;
}

export function BreakerSnap({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  label,
  children,
  className = "",
}: BreakerSnapProps) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState(defaultChecked);
  const isChecked = isControlled ? checked : internal;
  const checkedRef = useRef(isChecked);
  checkedRef.current = isChecked;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  const [angle, setAngle] = useState(defaultChecked ? ANGLE_MAX : -ANGLE_MAX);
  const [thunkKey, setThunkKey] = useState(0);
  const [arcKey, setArcKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // hot-path refs mutated by the rAF loop and pointer handlers
  const angleRef = useRef(angle);
  const velRef = useRef(0);
  const targetRef = useRef(angle);
  const phaseRef = useRef<Phase>("idle");
  const lockedRef = useRef(false);
  const homeRef = useRef(angle);
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const maxDistRef = useRef(0);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const commit = (next: boolean) => {
    checkedRef.current = next;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
    const n = fieldsetRef.current?.querySelectorAll(CONTROLS_SELECTOR).length ?? 0;
    setAnnouncement(
      `${label} ${next ? "on" : "off"} — ${n} control${n === 1 ? "" : "s"} ${
        next ? "enabled" : "disabled"
      }`
    );
  };

  const wake = () => {
    if (!rafRef.current) {
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const tick = (now: number) => {
    rafRef.current = 0;
    const dt = lastTsRef.current ? Math.min(0.033, (now - lastTsRef.current) / 1000) : 1 / 60;
    lastTsRef.current = now;
    let active = false;

    if (phaseRef.current === "chase") {
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      velRef.current += (-SPRING_K * (angleRef.current - targetRef.current) - c * velRef.current) * dt;
      angleRef.current += velRef.current * dt;
      const err = Math.abs(angleRef.current - targetRef.current);
      if (lockedRef.current && err < 2.5) {
        phaseRef.current = "overshoot";
        active = true;
      } else if (!lockedRef.current && err < 0.05 && Math.abs(velRef.current) < 0.4) {
        angleRef.current = targetRef.current;
        velRef.current = 0;
        phaseRef.current = "idle";
      } else {
        active = true;
      }
      setAngle(angleRef.current);
    } else if (phaseRef.current === "overshoot") {
      angleRef.current = targetRef.current + Math.sign(targetRef.current) * OVERSHOOT_DEG;
      velRef.current = 0;
      setAngle(angleRef.current);
      setThunkKey((k) => k + 1);
      if (targetRef.current > 0) setArcKey((k) => k + 1);
      phaseRef.current = "settle";
      active = true;
    } else if (phaseRef.current === "settle") {
      angleRef.current = targetRef.current;
      velRef.current = 0;
      setAngle(angleRef.current);
      phaseRef.current = "idle";
      lockedRef.current = false;
    }

    if (active) rafRef.current = requestAnimationFrame(tick);
  };

  const chaseTo = (target: number, locked: boolean) => {
    targetRef.current = target;
    lockedRef.current = locked;
    if (reducedRef.current) {
      angleRef.current = target;
      velRef.current = 0;
      phaseRef.current = "idle";
      setAngle(target);
      return;
    }
    phaseRef.current = "chase";
    wake();
  };

  const instantCommit = () => {
    if (disabledRef.current) return;
    const next = !checkedRef.current;
    commit(next);
    chaseTo(next ? ANGLE_MAX : -ANGLE_MAX, true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    const el = e.currentTarget;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // synthetic drivers may replay a pointerId no live pointer owns
    }
    pointerIdRef.current = e.pointerId;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    maxDistRef.current = 0;
    homeRef.current = checkedRef.current ? ANGLE_MAX : -ANGLE_MAX;
    lockedRef.current = false;
    phaseRef.current = "idle";
    velRef.current = 0;
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || e.pointerId !== pointerIdRef.current || disabledRef.current) return;
    const dx = e.clientX - startXRef.current;
    maxDistRef.current = Math.max(maxDistRef.current, Math.abs(dx));
    if (lockedRef.current) return; // already snapping on its own — pointer no longer steers it
    const home = homeRef.current;
    const opposite = -home;
    const pointerAngle = clamp(home + dx / PX_PER_DEG, -ANGLE_MAX, ANGLE_MAX);
    const span = opposite - home;
    const progress = span !== 0 ? (pointerAngle - home) / span : 0;
    if (progress >= LOCK_PROGRESS) {
      commit(opposite > 0);
      chaseTo(opposite, true);
    } else {
      chaseTo(pointerAngle, false);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || (pointerIdRef.current !== null && e.pointerId !== pointerIdRef.current)) {
      return;
    }
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // no-op — capture may already be gone
    }
    pointerIdRef.current = null;
    if (disabledRef.current || lockedRef.current) return; // locked: already committed, spring finishes itself
    if (maxDistRef.current < TAP_PX) {
      instantCommit(); // a tap/click — no travel to resist against
    } else {
      chaseTo(homeRef.current, false); // released before the dead point — springs home
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
      e.preventDefault();
      instantCommit();
    }
  };

  const paddleX = PIVOT_X - PADDLE_W / 2;
  const paddleY = PIVOT_Y - PADDLE_LEN;
  const contactOffX = 9;
  const contactOnX = 35;
  const contactY = 27;

  return (
    <div className={`inline-flex items-start gap-4 ${className}`}>
      <div
        role="switch"
        aria-checked={isChecked}
        aria-label={label}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        data-breaker-switch=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={`relative shrink-0 touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          disabled ? "cursor-not-allowed opacity-45" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{ width: HOUSING_W, height: HOUSING_H }}
      >
        <div key={thunkKey} className={thunkKey > 0 ? "ns-bs-thunk-wrap" : undefined}>
          <svg
            viewBox={`0 0 ${HOUSING_W} ${HOUSING_H}`}
            width={HOUSING_W}
            height={HOUSING_H}
            aria-hidden
            focusable="false"
          >
            <rect
              x={1}
              y={1}
              width={HOUSING_W - 2}
              height={HOUSING_H - 2}
              rx={6}
              fill="var(--surface)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <rect
              x={8}
              y={6}
              width={HOUSING_W - 16}
              height={HOUSING_H - 16}
              rx={6}
              fill="var(--background)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <circle cx={contactOffX} cy={contactY} r={2} fill="var(--border)" />
            <circle cx={contactOnX} cy={contactY} r={2} fill={isChecked ? "var(--accent)" : "var(--border)"} />
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px` }}>
              <rect
                x={paddleX}
                y={paddleY}
                width={PADDLE_W}
                height={PADDLE_LEN}
                rx={PADDLE_W / 2}
                fill="var(--foreground)"
              />
              <line
                x1={paddleX + 2}
                y1={paddleY + 6}
                x2={paddleX + PADDLE_W - 2}
                y2={paddleY + 6}
                stroke="var(--background)"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              <line
                x1={paddleX + 2}
                y1={paddleY + 10}
                x2={paddleX + PADDLE_W - 2}
                y2={paddleY + 10}
                stroke="var(--background)"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            </g>
            <circle cx={PIVOT_X} cy={PIVOT_Y} r={2.5} fill="var(--border)" />
            {arcKey > 0 && (
              <g key={arcKey} aria-hidden>
                <path
                  d={`M${contactOnX - 4},${contactY - 5} L${contactOnX + 4},${contactY + 5}`}
                  className="ns-bs-arc ns-bs-arc-a"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d={`M${contactOnX + 4},${contactY - 5} L${contactOnX - 4},${contactY + 5}`}
                  className="ns-bs-arc ns-bs-arc-b"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            data-breaker-led=""
            data-powered={isChecked ? "true" : "false"}
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-border transition-colors duration-[60ms] ease-linear data-[powered=true]:bg-accent motion-reduce:transition-none"
          />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {isChecked ? "energized" : "de-energized"}
          </span>
        </div>

        <fieldset
          ref={fieldsetRef}
          disabled={!isChecked}
          data-powered={isChecked ? "true" : "false"}
          className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0 text-foreground transition-colors duration-[60ms] ease-linear data-[powered=false]:text-muted motion-reduce:transition-none"
        >
          {children}
        </fieldset>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <style>{`
        @keyframes ns-bs-thunk {
          0% { transform: translateY(0); }
          35% { transform: translateY(2px); }
          100% { transform: translateY(0); }
        }
        .ns-bs-thunk-wrap {
          animation: ns-bs-thunk 130ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes ns-bs-arc-flash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
        .ns-bs-arc {
          opacity: 0;
          animation: ns-bs-arc-flash 90ms ease-out forwards;
        }
        .ns-bs-arc-b {
          animation-delay: 40ms;
        }
      `}</style>
    </div>
  );
}
