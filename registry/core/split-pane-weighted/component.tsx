"use client";

import { useLayoutEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SashWeight — a split-pane divider that behaves like a counterweighted
// window sash rather than a bare drag handle. Two phases of one spring
// simulation share a single rAF loop:
//
//   1. DRAGGING: while the pointer is down, the divider does not snap to the
//      pointer 1:1 — the live position chases the pointer through an
//      overdamped spring (k=90 s^-2, zeta=1.15). That lag IS the weight: a
//      fast flick visibly trails before catching up, a slow drag tracks it
//      almost exactly. The spring's own velocity at any instant is therefore
//      already the divider's real velocity — no separate pointer-velocity
//      sampling is needed.
//   2. SETTLING: on release, that carried velocity feeds directly into a
//      critically-damped spring (k=170 s^-2, zeta=1, no overshoot) aimed at
//      the nearest detent — but only if the release was fast (>=55%/s) or
//      already close to a detent (<=6%). Released slow and far from a stop,
//      the sash simply stays where it was let go; not every release is
//      supposed to land on a rail.
//
// Only the two panes are ever written to imperatively (flex-basis on the
// start pane; the end pane fills the remainder via flex:1, so it "resizes"
// without a second write) plus the divider's own ARIA value attributes —
// nothing else in the tree is touched by the animation loop, and no React
// state re-render drives a single frame of it.
//
// A11y: the divider is a real, focusable role="separator" (not a plain
// draggable div) with aria-orientation and aria-valuenow/min/max as a
// percentage, so a screen reader reports it as a moveable boundary, not a
// static rule. Arrow keys move 1% (instant, no spring — a discrete nudge
// doesn't need inertia); Shift+Arrow jumps to the next detent in that
// direction via the same settle spring the pointer path uses; Enter toggles
// between 50/50 and wherever the sash last sat off-center. prefers-reduced-
// motion strips both spring phases: dragging tracks the pointer exactly,
// and a release only ever snaps instantly (no coast) when it lands inside
// the same detent-proximity zone.
// ---------------------------------------------------------------------------

const HIT = 8; // px width/height of the divider's pointer hit area
const DRAG_K = 90; // s^-2 — spring the live position chases the pointer with
const DRAG_ZETA = 1.15; // overdamped: trails a fast pointer, never oscillates
const SETTLE_K = 170; // s^-2 — release spring toward the nearest detent
const SETTLE_ZETA = 1; // critically damped: closes in without overshoot
const SNAP_ZONE = 6; // percent — release within this of a detent always settles
const VEL_THRESHOLD = 55; // percent/s — release faster than this always coasts+settles
const EPS_POS = 0.05; // percent
const EPS_VEL = 0.4; // percent/s
const CENTER_EPS = 0.6; // percent — how close to 50 counts as "already centered"

type Orientation = "vertical" | "horizontal";
type Phase = "idle" | "dragging" | "settling";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface SashWeightProps {
  /** "vertical" = a vertical divider splitting left/right panes (default). "horizontal" = a horizontal divider splitting top/bottom panes. */
  orientation?: Orientation;
  /** the leading (left / top) pane's content */
  start: React.ReactNode;
  /** the trailing (right / bottom) pane's content */
  end: React.ReactNode;
  /** controlled: the start pane's share of the container, as a percentage */
  value?: number;
  defaultValue?: number;
  onValueChange?: (percent: number) => void;
  /** percentage clamp for the divider's travel */
  min?: number;
  max?: number;
  /** percentages the divider settles toward on a decisive release, Shift+Arrow, or Enter/double-click's 50/50 fallback */
  detents?: number[];
  /** accessible name for the divider */
  ariaLabel?: string;
  className?: string;
}

export function SashWeight({
  orientation = "vertical",
  start,
  end,
  value,
  defaultValue = 50,
  onValueChange,
  min = 10,
  max = 90,
  detents = [25, 50, 75],
  ariaLabel = "Resize panes",
  className = "",
}: SashWeightProps) {
  const isControlled = value !== undefined;
  const [posState, setPosState] = useState(() => clamp(defaultValue, min, max));
  const pos = isControlled ? clamp(value, min, max) : posState;

  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startPaneRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  const minRef = useRef(min);
  minRef.current = min;
  const maxRef = useRef(max);
  maxRef.current = max;
  const detentsRef = useRef(detents);
  detentsRef.current = detents;
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;

  const posRef = useRef(pos); // last committed value
  posRef.current = pos;
  const liveRef = useRef(pos); // current animated / dragged value
  const velRef = useRef(0);
  const dragTargetRef = useRef(pos);
  const settleTargetRef = useRef(pos);
  const phaseRef = useRef<Phase>("idle");
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const reducedRef = useRef(false);
  const lastOffCenterRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const writeDOM = (p: number) => {
    if (startPaneRef.current) startPaneRef.current.style.flexBasis = `${p}%`;
    const rounded = Math.round(p);
    const el = dividerRef.current;
    if (el) {
      el.setAttribute("aria-valuenow", String(rounded));
      el.setAttribute("aria-valuetext", `${rounded}% / ${100 - rounded}%`);
    }
  };

  // keep the DOM in sync with the committed value whenever nothing is
  // actively animating it (initial mount, and controlled updates from outside)
  useLayoutEffect(() => {
    if (phaseRef.current === "idle") {
      liveRef.current = pos;
      writeDOM(pos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const commit = (p: number) => {
    const rounded = Number(p.toFixed(2));
    posRef.current = rounded;
    if (!isControlled) setPosState(rounded);
    onValueChange?.(rounded);
  };

  const nearestDetent = (p: number) => {
    const list = detentsRef.current;
    if (list.length === 0) return p;
    return list.reduce((best, d) => (Math.abs(d - p) < Math.abs(best - p) ? d : best), list[0]);
  };

  const cancelRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  const tick = (now: number) => {
    const dt = Math.min(0.032, Math.max(0, (now - lastRef.current) / 1000));
    lastRef.current = now;
    const lo = minRef.current;
    const hi = maxRef.current;

    if (phaseRef.current === "dragging") {
      const c = 2 * Math.sqrt(DRAG_K) * DRAG_ZETA;
      const target = dragTargetRef.current;
      const accel = -DRAG_K * (liveRef.current - target) - c * velRef.current;
      velRef.current += accel * dt;
      liveRef.current = clamp(liveRef.current + velRef.current * dt, lo, hi);
      writeDOM(liveRef.current);
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    if (phaseRef.current === "settling") {
      const c = 2 * Math.sqrt(SETTLE_K) * SETTLE_ZETA;
      const target = settleTargetRef.current;
      const accel = -SETTLE_K * (liveRef.current - target) - c * velRef.current;
      velRef.current += accel * dt;
      liveRef.current = clamp(liveRef.current + velRef.current * dt, lo, hi);
      writeDOM(liveRef.current);
      if (Math.abs(liveRef.current - target) < EPS_POS && Math.abs(velRef.current) < EPS_VEL) {
        liveRef.current = target;
        velRef.current = 0;
        writeDOM(target);
        commit(target);
        phaseRef.current = "idle";
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
  };

  const ensureRaf = () => {
    if (!rafRef.current) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const startSettle = (target: number, initialVel: number) => {
    settleTargetRef.current = clamp(target, minRef.current, maxRef.current);
    velRef.current = initialVel;
    phaseRef.current = "settling";
    ensureRaf();
  };

  const pointerToPercent = (e: { clientX: number; clientY: number }) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const frac =
      orientationRef.current === "vertical"
        ? (e.clientX - rect.left) / Math.max(1, rect.width)
        : (e.clientY - rect.top) / Math.max(1, rect.height);
    return clamp(frac * 100, minRef.current, maxRef.current);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dividerRef.current?.setPointerCapture(e.pointerId);
    cancelRaf();
    setDragging(true);
    liveRef.current = posRef.current;
    velRef.current = 0;
    dragTargetRef.current = pointerToPercent(e);
    phaseRef.current = "dragging";
    // under reduced motion, onPointerMove writes the position directly and
    // no spring ever runs, so no rAF loop is needed for the drag phase
    if (!reducedRef.current) ensureRaf();
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "dragging") return;
    if (reducedRef.current) {
      liveRef.current = pointerToPercent(e);
      writeDOM(liveRef.current);
      return;
    }
    dragTargetRef.current = pointerToPercent(e);
  };

  const releaseDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== "dragging") return;
    try {
      dividerRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    setDragging(false);
    const current = liveRef.current;
    const nearest = nearestDetent(current);
    const dist = Math.abs(current - nearest);

    if (reducedRef.current) {
      const final = dist <= SNAP_ZONE ? nearest : current;
      liveRef.current = final;
      velRef.current = 0;
      phaseRef.current = "idle";
      writeDOM(final);
      commit(final);
      cancelRaf();
      return;
    }

    const speed = Math.abs(velRef.current);
    if (dist <= SNAP_ZONE || speed >= VEL_THRESHOLD) {
      startSettle(nearest, velRef.current);
    } else {
      phaseRef.current = "idle";
      cancelRaf();
      commit(current);
    }
  };

  const goTo = (target: number) => {
    const clamped = clamp(target, minRef.current, maxRef.current);
    cancelRaf();
    if (reducedRef.current) {
      liveRef.current = clamped;
      phaseRef.current = "idle";
      writeDOM(clamped);
      commit(clamped);
    } else {
      liveRef.current = posRef.current;
      startSettle(clamped, 0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const vertical = orientationRef.current === "vertical";
    const decKey = vertical ? "ArrowLeft" : "ArrowUp";
    const incKey = vertical ? "ArrowRight" : "ArrowDown";

    if (e.key === decKey || e.key === incKey) {
      e.preventDefault();
      const dir = e.key === incKey ? 1 : -1;
      if (e.shiftKey) {
        const sorted = [...detentsRef.current].sort((a, b) => a - b);
        const current = posRef.current;
        const target =
          dir > 0
            ? (sorted.find((d) => d > current + 0.01) ?? maxRef.current)
            : ([...sorted].reverse().find((d) => d < current - 0.01) ?? minRef.current);
        goTo(target);
      } else {
        cancelRaf();
        phaseRef.current = "idle";
        const target = clamp(posRef.current + dir, minRef.current, maxRef.current);
        liveRef.current = target;
        writeDOM(target);
        commit(target);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const current = posRef.current;
      const centered = Math.abs(current - 50) < CENTER_EPS;
      if (centered && lastOffCenterRef.current != null) {
        goTo(lastOffCenterRef.current);
      } else {
        lastOffCenterRef.current = current;
        goTo(50);
      }
    }
  };

  const onDoubleClick = () => {
    if (phaseRef.current === "dragging") return;
    const current = posRef.current;
    if (Math.abs(current - 50) >= CENTER_EPS) lastOffCenterRef.current = current;
    goTo(50);
  };

  const vertical = orientation === "vertical";
  const engaged = dragging || focused;
  const visibleDetents = detents.filter((d) => d >= min && d <= max);

  const dividerBarColor = dragging
    ? "var(--foreground)"
    : hovering || focused
      ? "color-mix(in srgb, var(--border) 35%, var(--foreground) 65%)"
      : "var(--border)";

  return (
    <div
      ref={containerRef}
      data-sash-weight-track
      className={`relative flex h-full w-full ${vertical ? "flex-row" : "flex-col"} ${className}`}
    >
      {/* faint rail marks at each reachable detent — self-explaining before first touch */}
      {visibleDetents.map((d) => (
        <span
          key={d}
          aria-hidden
          className="pointer-events-none absolute bg-muted"
          style={
            vertical
              ? { left: `${d}%`, top: 0, width: 1, height: 8, opacity: 0.45, transform: "translateX(-50%)" }
              : { top: `${d}%`, left: 0, height: 1, width: 8, opacity: 0.45, transform: "translateY(-50%)" }
          }
        />
      ))}

      <div ref={startPaneRef} className="min-h-0 min-w-0 shrink-0 grow-0 overflow-auto" style={{ flexBasis: `${pos}%` }}>
        {start}
      </div>

      <div
        ref={dividerRef}
        role="separator"
        aria-orientation={vertical ? "vertical" : "horizontal"}
        aria-label={ariaLabel}
        aria-valuenow={Math.round(pos)}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={`${Math.round(pos)}% / ${100 - Math.round(pos)}%`}
        tabIndex={0}
        className={`relative z-10 shrink-0 grow-0 touch-none select-none outline-none focus-visible:z-20 ${
          vertical ? "cursor-col-resize" : "cursor-row-resize"
        }`}
        style={{ width: vertical ? HIT : "100%", height: vertical ? "100%" : HIT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releaseDrag}
        onPointerCancel={releaseDrag}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onFocus={(e) => {
          if (e.target.matches(":focus-visible")) setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        onDoubleClick={onDoubleClick}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute rounded-full transition-[background-color,width,height] duration-150 ease-out motion-reduce:transition-none"
          style={
            vertical
              ? {
                  left: "50%",
                  top: 0,
                  bottom: 0,
                  width: dragging ? 2 : 1,
                  transform: "translateX(-50%)",
                  backgroundColor: dividerBarColor,
                }
              : {
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: dragging ? 2 : 1,
                  transform: "translateY(-50%)",
                  backgroundColor: dividerBarColor,
                }
          }
        />
        {engaged && (
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-full ring-2 ring-accent"
            style={
              vertical
                ? { left: "50%", top: "50%", width: HIT, height: 40, transform: "translate(-50%, -50%)" }
                : { top: "50%", left: "50%", height: HIT, width: 40, transform: "translate(-50%, -50%)" }
            }
          />
        )}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{end}</div>
    </div>
  );
}
