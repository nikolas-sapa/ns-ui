"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

// ---------------------------------------------------------------------------
// PassingLoop — a traffic-shift rollout controller drawn as a funicular: two
// cars riding ONE cable over a summit pulley. Everything on screen derives
// from a single governing scalar, cable position `s` in [0,1]: the new
// version's share IS s, the old version's share IS 1-s (computed as the
// complement of the same rounded integer, never rounded independently), car
// positions are pointAt(s) / pointAt(1-s) on the same incline, and the
// counterweight tilt is (s-0.5) alone. Two independent progress bars simply
// cannot exist here — there is nowhere in the geometry for a second number
// to live, which is the point: an impossible state (60% new AND 70% old)
// cannot be drawn.
//
// The mid-track passing loop pins s at 0.5 until the canary is confirmed —
// the confirm button swings a set of points with a ~200ms mechanical spring
// throw; attempting to drag or step past the loop before that bounces both
// cars off with a 4px overshoot along the cable, then settles back. Rollback
// releases the winch brake and lets s fall back to 0 under a damped
// oscillator (zeta 0.85) rather than teleporting or free-falling — heavy
// enough that it never slams the lower stop, light enough that it never
// reads as reluctant. Reduced motion keeps every position change but strips
// the continuous glide: rollback lands in a few discrete jumps instead of a
// smooth integration, counters stay correct at every one of them.
//
// Pure DOM + SVG + CSS. Every ink is a token; --ns-accent is reserved for
// the canary-confirm and rollback buttons' own focus rings — nowhere else.
// ---------------------------------------------------------------------------

export interface PassingLoopProps {
  /** label for the version climbing toward s=1, e.g. "v2.4.1" */
  newVersion?: string;
  /** label for the version descending toward s=0, e.g. "v2.4.0" */
  oldVersion?: string;
  /** total live requests/interval split by s and its complement */
  totalRequests?: number;
  /** initial cable position, 0..1 (uncontrolled) */
  defaultValue?: number;
  /** fires with the committed cable position on every change */
  onValueChange?: (s: number) => void;
  /** fires once the canary confirm swings the points open */
  onCanaryConfirm?: () => void;
  /** fires once, the instant a rollback begins */
  onRollback?: (fromShare: number) => void;
  ariaLabel?: string;
  className?: string;
}

const VIEW_W = 440;
const VIEW_H = 200;
const STATION_BOTTOM = { x: 58, y: 172 };
const STATION_TOP = { x: 382, y: 32 };
const LOOP_S = 0.5;
const LOOP_HALF = 0.075;
const LOOP_OFFSET = 10; // px bulge of the passing loop's two rails
const BOUNCE_PX = 4;
const STEP = 0.05;
const OMEGA = 4.2; // rad/s-ish, damped-oscillator natural frequency
const ZETA = 0.85; // band-brake damping ratio — the whole point of the spec
const REDUCED_STEP_MS = 190;
const POINTS_MS = 200;
const SPRING_EASE = "cubic-bezier(0.34,1.56,0.64,1)"; // overshoot + settle
const GLIDE_MS = 280;
const GLIDE_EASE = "cubic-bezier(0.16,1,0.3,1)"; // ease-out-expo

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** point on the single incline at fraction t (0 = base station, 1 = summit) */
function pointAt(t: number) {
  return {
    x: STATION_BOTTOM.x + (STATION_TOP.x - STATION_BOTTOM.x) * t,
    y: STATION_BOTTOM.y + (STATION_TOP.y - STATION_BOTTOM.y) * t,
  };
}

const TRACK_DX = STATION_TOP.x - STATION_BOTTOM.x;
const TRACK_DY = STATION_TOP.y - STATION_BOTTOM.y;
const TRACK_LEN = Math.hypot(TRACK_DX, TRACK_DY);
const UNIT = { x: TRACK_DX / TRACK_LEN, y: TRACK_DY / TRACK_LEN };
const PERP = { x: -UNIT.y, y: UNIT.x };
const TRACK_ANGLE_DEG = (Math.atan2(UNIT.y, UNIT.x) * 180) / Math.PI;

export function PassingLoop({
  newVersion = "v2.4.1",
  oldVersion = "v2.4.0",
  totalRequests = 24000,
  defaultValue = 0.5,
  onValueChange,
  onCanaryConfirm,
  onRollback,
  ariaLabel = "Rollout traffic control",
  className = "",
}: PassingLoopProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  const [s, setSState] = useState(() => clamp(defaultValue, 0, 1));
  const sRef = useRef(s);
  const [canaryConfirmed, setCanaryConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [bounceNonce, setBounceNonce] = useState(0);
  const [politeMsg, setPoliteMsg] = useState("");
  const [assertiveMsg, setAssertiveMsg] = useState("");

  const wrapperRef = useRef<HTMLDivElement>(null);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef(0);
  const draggingRef = useRef(false);
  const lastBounceRef = useRef(0);

  useEffect(
    () => () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      window.clearInterval(intervalRef.current);
    },
    []
  );

  function commitS(next: number) {
    const bounded = clamp(next, 0, 1);
    sRef.current = bounded;
    setSState(bounded);
    onValueChange?.(bounded);
  }

  function attemptSet(requested: number) {
    const cap = canaryConfirmed ? 1 : LOOP_S;
    const clamped = clamp(requested, 0, 1);
    const bounded = Math.min(clamped, cap);
    if (clamped > cap + 1e-6 && !reduced) {
      // one overshoot-and-settle per attempt, never a buzz — a held drag or
      // a key held down fires attemptSet many times a second, but the 220ms
      // keyframe below must be allowed to finish before it can restart
      const now = performance.now();
      if (now - lastBounceRef.current > 240) {
        lastBounceRef.current = now;
        setBounceNonce((n) => n + 1);
      }
    }
    commitS(bounded);
  }

  function updateFromPointer(clientX: number) {
    const el = wrapperRef.current;
    if (!el || el.clientWidth <= 0) return;
    const rect = el.getBoundingClientRect();
    const t = (clientX - rect.left) / rect.width;
    attemptSet(clamp(t, 0, 1));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (rollingBack) return;
    const el = wrapperRef.current;
    el?.setPointerCapture(e.pointerId);
    el?.focus({ preventScroll: true });
    draggingRef.current = true;
    setDragging(true);
    updateFromPointer(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    updateFromPointer(e.clientX);
  }
  function endDrag() {
    draggingRef.current = false;
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (rollingBack) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        attemptSet(sRef.current + STEP);
        return;
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        attemptSet(sRef.current - STEP);
        return;
      case "Home":
        e.preventDefault();
        attemptSet(0);
        return;
      case "End":
        e.preventDefault();
        attemptSet(canaryConfirmed ? 1 : LOOP_S);
        return;
      case "Enter":
        if (Math.abs(sRef.current - LOOP_S) < 1e-6 && !canaryConfirmed) {
          e.preventDefault();
          handleConfirm();
        }
        return;
      default:
        return;
    }
  }

  function handleConfirm() {
    if (canaryConfirmed) return; // idempotent — an earlier press already threw the points
    setCanaryConfirmed(true);
    setPoliteMsg(`Canary confirmed. Points open — rollout can continue past the loop.`);
    onCanaryConfirm?.();
  }

  function finishRollback() {
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    window.clearInterval(intervalRef.current);
    rafRef.current = undefined;
    intervalRef.current = undefined;
    velocityRef.current = 0;
    commitS(0);
    setRollingBack(false);
    setCanaryConfirmed(false);
    setAssertiveMsg(`Rolled back. 0% on ${newVersion}, 100% on ${oldVersion}.`);
  }

  function physicsStep(now: number) {
    const dt = Math.min(0.032, (now - lastTimeRef.current) / 1000 || 0.016);
    lastTimeRef.current = now;
    const accel = -(OMEGA * OMEGA) * sRef.current - 2 * ZETA * OMEGA * velocityRef.current;
    velocityRef.current += accel * dt;
    let next = sRef.current + velocityRef.current * dt;
    if (next <= 0.0015 && Math.abs(velocityRef.current) < 0.012) {
      finishRollback();
      return;
    }
    if (next < 0) next = 0; // hard lower stop — already slow here, no bounce needed
    sRef.current = next;
    setSState(next);
    rafRef.current = requestAnimationFrame(physicsStep);
  }

  function handleRollback() {
    if (rollingBack) return; // real button, but a fall already in progress is a no-op replay
    if (sRef.current <= 0 && !canaryConfirmed) return; // already fully settled at old
    draggingRef.current = false;
    setDragging(false);
    setRollingBack(true);
    velocityRef.current = 0;
    setAssertiveMsg(
      `Rolling back, ${Math.round(sRef.current * 100)}% on new version and falling.`
    );
    onRollback?.(sRef.current);

    if (reduced) {
      intervalRef.current = window.setInterval(() => {
        const next = sRef.current < 0.02 ? 0 : sRef.current * 0.4;
        if (next <= 0) {
          finishRollback();
          return;
        }
        sRef.current = next;
        setSState(next);
      }, REDUCED_STEP_MS);
    } else {
      lastTimeRef.current = performance.now();
      rafRef.current = requestAnimationFrame(physicsStep);
    }
  }

  // -- everything below derives from s alone --
  const newPct = Math.round(s * 100);
  const oldPct = 100 - newPct; // complement of the SAME rounded number — never independently rounded
  const newCount = Math.round(totalRequests * s);
  const oldCount = totalRequests - newCount; // same complement guarantee

  // a bezier's midpoint sits halfway to its control point, so a car riding
  // the rail at t needs half the rail's own control-point offset, tapering
  // to 0 outside the loop span — this is what actually keeps the two cars
  // visibly apart on separate rails while they cross, rather than drawing a
  // loop that never carries anything.
  function railOffset(t: number) {
    const d = Math.abs(t - LOOP_S);
    return d >= LOOP_HALF ? 0 : (LOOP_OFFSET / 2) * (1 - d / LOOP_HALF);
  }
  const newBase = pointAt(s);
  const oldBase = pointAt(1 - s);
  const newRail = railOffset(s);
  const oldRail = railOffset(1 - s);
  const newPos = { x: newBase.x + PERP.x * newRail, y: newBase.y + PERP.y * newRail };
  const oldPos = { x: oldBase.x - PERP.x * oldRail, y: oldBase.y - PERP.y * oldRail };
  const loopStart = pointAt(LOOP_S - LOOP_HALF);
  const loopEnd = pointAt(LOOP_S + LOOP_HALF);
  const loopMid = pointAt(LOOP_S);
  const railACtl = { x: loopMid.x + PERP.x * LOOP_OFFSET, y: loopMid.y + PERP.y * LOOP_OFFSET };
  const railBCtl = { x: loopMid.x - PERP.x * LOOP_OFFSET, y: loopMid.y - PERP.y * LOOP_OFFSET };
  const railAD = `M ${loopStart.x} ${loopStart.y} Q ${railACtl.x} ${railACtl.y} ${loopEnd.x} ${loopEnd.y}`;
  const railBD = `M ${loopStart.x} ${loopStart.y} Q ${railBCtl.x} ${railBCtl.y} ${loopEnd.x} ${loopEnd.y}`;

  const pointsAngle = TRACK_ANGLE_DEG + (canaryConfirmed ? 0 : 90);
  const tiltDeg = (s - 0.5) * 24;
  const pivot = { x: STATION_BOTTOM.x, y: STATION_BOTTOM.y + 16 };

  const carTransition =
    reduced || dragging || rollingBack ? "none" : `transform ${GLIDE_MS}ms ${GLIDE_EASE}`;

  const describeId = `${uid}-desc`;
  const valueText = `${newPct}% on ${newVersion}, ${oldPct}% on ${oldVersion}`;
  const statusText = rollingBack
    ? "rolling back"
    : canaryConfirmed
      ? "past the loop"
      : Math.abs(s - LOOP_S) < 1e-6
        ? "parked at the loop, canary pending"
        : "climbing to the loop";

  return (
    <div
      className={`w-full max-w-md font-sans ${className}`}
      data-loop-state={canaryConfirmed ? "open" : "closed"}
    >
      <style>{`
@keyframes ns-pl-bounce {
  0% { transform: translate(0px,0px); }
  45% { transform: translate(var(--bx,0px),var(--by,0px)); }
  100% { transform: translate(0px,0px); }
}
.ns-pl-bounce { animation: ns-pl-bounce 220ms cubic-bezier(0.33,0,0.15,1); }
@media (prefers-reduced-motion: reduce) {
  .ns-pl-bounce { animation: none !important; }
}
`}</style>

      <div
        ref={wrapperRef}
        role="slider"
        tabIndex={rollingBack ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={newPct}
        aria-valuetext={valueText}
        aria-describedby={describeId}
        aria-disabled={rollingBack || undefined}
        data-passing-loop-slider
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        className="relative w-full touch-none select-none rounded-md border border-border bg-background transition-colors hover:border-foreground outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, cursor: rollingBack ? "default" : "ew-resize" }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* permanent conduit either side of the passing loop */}
          <line
            x1={STATION_BOTTOM.x}
            y1={STATION_BOTTOM.y}
            x2={loopStart.x}
            y2={loopStart.y}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          <line
            x1={loopEnd.x}
            y1={loopEnd.y}
            x2={STATION_TOP.x}
            y2={STATION_TOP.y}
            stroke="var(--border)"
            strokeWidth={1.5}
          />

          {/* passing loop — the single track becomes two rails and rejoins */}
          <path d={railAD} fill="none" stroke="var(--border)" strokeWidth={1.5} />
          <path d={railBD} fill="none" stroke="var(--border)" strokeWidth={1.5} />

          {/* points — a blade that swings flush with the cable once confirmed */}
          <line
            x1={loopMid.x - 8}
            y1={loopMid.y}
            x2={loopMid.x + 8}
            y2={loopMid.y}
            stroke="var(--foreground)"
            strokeWidth={2}
            transform={`rotate(${pointsAngle} ${loopMid.x} ${loopMid.y})`}
            style={{ transition: reduced ? "none" : `transform ${POINTS_MS}ms ${SPRING_EASE}` }}
          />

          {/* summit pulley */}
          <circle cx={STATION_TOP.x} cy={STATION_TOP.y} r={9} fill="none" stroke="var(--border)" strokeWidth={1.5} />
          <circle cx={STATION_TOP.x} cy={STATION_TOP.y} r={2} fill="var(--border)" />

          {/* winch drum */}
          <rect x={STATION_BOTTOM.x - 10} y={STATION_BOTTOM.y - 6} width={20} height={12} rx={2} fill="none" stroke="var(--border)" strokeWidth={1.5} />

          {/* counterweight tilt, derived from s alone */}
          <line
            x1={pivot.x - 15}
            y1={pivot.y}
            x2={pivot.x + 15}
            y2={pivot.y}
            stroke="var(--ns-muted)"
            strokeWidth={1.5}
            transform={`rotate(${tiltDeg} ${pivot.x} ${pivot.y})`}
            style={{ transition: reduced ? "none" : `transform ${GLIDE_MS}ms ${GLIDE_EASE}` }}
          />

          {/* old car — hollow, descends toward the base station */}
          <g
            style={{ transform: `translate(${oldPos.x}px, ${oldPos.y}px)`, transition: carTransition }}
          >
            <g
              key={`old-${bounceNonce}`}
              className={!reduced && bounceNonce > 0 ? "ns-pl-bounce" : undefined}
              style={
                {
                  "--bx": `${-UNIT.x * BOUNCE_PX}px`,
                  "--by": `${-UNIT.y * BOUNCE_PX}px`,
                } as CSSProperties
              }
            >
              <rect x={-7} y={-6} width={14} height={12} rx={3} fill="var(--background)" stroke="var(--foreground)" strokeWidth={2} />
            </g>
          </g>

          {/* new car — solid, climbs toward the summit */}
          <g
            style={{ transform: `translate(${newPos.x}px, ${newPos.y}px)`, transition: carTransition }}
          >
            <g
              key={`new-${bounceNonce}`}
              className={!reduced && bounceNonce > 0 ? "ns-pl-bounce" : undefined}
              style={
                {
                  "--bx": `${UNIT.x * BOUNCE_PX}px`,
                  "--by": `${UNIT.y * BOUNCE_PX}px`,
                } as CSSProperties
              }
            >
              <rect x={-7} y={-6} width={14} height={12} rx={3} fill="var(--foreground)" />
            </g>
          </g>
        </svg>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px] text-ns-muted"
          style={{
            left: `${(oldPos.x / VIEW_W) * 100}%`,
            top: `${(oldPos.y / VIEW_H) * 100}%`,
            transform: "translate(-50%, 8px)",
          }}
        >
          {oldVersion} · {oldPct}% · {oldCount.toLocaleString()}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute whitespace-nowrap font-mono text-[10px] text-foreground"
          style={{
            left: `${(newPos.x / VIEW_W) * 100}%`,
            top: `${(newPos.y / VIEW_H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
        >
          {newVersion} · {newPct}% · {newCount.toLocaleString()}
        </span>
      </div>

      <span id={describeId} className="sr-only">
        {`Traffic split, ${statusText}. Arrow keys step 5 percent. Enter confirms canary while parked at the loop.`}
      </span>

      <div className="mt-3 flex items-center justify-between gap-3 font-mono text-xs text-foreground">
        <span>
          {newVersion} · {newCount.toLocaleString()} req
        </span>
        <span className="text-ns-muted">
          {oldVersion} · {oldCount.toLocaleString()} req
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <button
          type="button"
          data-loop-confirm
          onClick={handleConfirm}
          className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {canaryConfirmed ? "Canary confirmed" : "Confirm canary"}
        </button>
        <button
          type="button"
          data-loop-rollback
          onClick={handleRollback}
          className="rounded-[6px] border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Roll back
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {politeMsg}
      </p>
      <p aria-live="assertive" className="sr-only">
        {assertiveMsg}
      </p>
    </div>
  );
}
