"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// SlackRail — classic tabs whose active-indicator is a single SVG path drawn
// as a slack cable instead of a rigid underline bar. At rest it is a taut 2px
// line under the active tab. On selection change both endpoints spring
// toward the new tab's edges (mass scaled by jump distance, so long jumps
// accelerate slower and settle with a touch more overshoot — "feel heavier")
// while the path's control point drops into a quadratic sag proportional to
// how far the endpoints still have left to travel, flattening back to a
// straight line as they arrive with a small underdamped snap. Hovering a
// non-active tab tugs whichever endpoint is spatially nearest it 3px in that
// direction, previewing where the cable would go. Full WAI-ARIA tabs pattern
// (roving tabindex, automatic activation on Left/Right/Home/End); the cable
// itself is aria-hidden and purely decorative. No canvas — DOM + SVG + CSS.
// ---------------------------------------------------------------------------

export interface SlackRailItem {
  value: string;
  label: string;
  content: ReactNode;
}

export interface SlackRailProps {
  /** the tabs, in order */
  items: SlackRailItem[];
  /** controlled selected value; omit for uncontrolled */
  value?: string;
  /** uncontrolled initial selected value */
  defaultValue?: string;
  /** called with the new value when a different tab is selected */
  onValueChange?: (value: string) => void;
  /** accessible name for the tab list */
  "aria-label": string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

const BASELINE_Y = 7; // rail SVG viewport y for the resting line
const RAIL_H = 14; // rail SVG viewport height (room for the sag to drop into)
const STROKE_W = 2;
const SAG_DIVISOR = 8;
const SAG_MAX = 6;
const TUG_PX = 3;
const SETTLE_EPS = 0.04;
const FORCE_SETTLE_MS = 900;
const SPRING_K = 220; // stiffness, s^-2
const SPRING_C = 26.4; // damping — combined with mass this gives near-critical
// damping on short hops and a visibly underdamped small overshoot on long
// ones, since mass grows with travel distance while c/k stay fixed.
const MASS_PER_PX = 1 / 260;
const TUG_TAU = 0.09; // exponential ease-toward time constant, seconds

interface Endpoint {
  x: number;
  v: number;
  target: number;
}

export function SlackRail({
  items,
  value,
  defaultValue,
  onValueChange,
  className,
  "aria-label": ariaLabel,
  ...rest
}: SlackRailProps) {
  const baseId = useId();
  const reduced = useReducedMotion();

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    () => value ?? defaultValue ?? items[0]?.value,
  );
  const activeValue = isControlled ? (value as string) : internalValue;
  const activeIndex = Math.max(
    0,
    items.findIndex((it) => it.value === activeValue),
  );

  const select = useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const tablistRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const left = useRef<Endpoint>({ x: 0, v: 0, target: 0 });
  const right = useRef<Endpoint>({ x: 0, v: 0, target: 0 });
  const travelDistance = useRef(0);
  const transitionStart = useRef(0);
  const tugLeft = useRef(0);
  const tugRight = useRef(0);
  const tugTargetLeft = useRef(0);
  const tugTargetRight = useRef(0);
  const laidOut = useRef(false);

  const rafId = useRef<number | null>(null);
  const lastTick = useRef(0);

  const pathRef = useRef<SVGPathElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [fadeVisible, setFadeVisible] = useState(true);

  const measure = useCallback((index: number) => {
    const list = tablistRef.current;
    const btn = tabRefs.current[index];
    if (!list || !btn) return null;
    const listRect = list.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    return {
      left: btnRect.left - listRect.left,
      right: btnRect.right - listRect.left,
    };
  }, []);

  const applyPath = useCallback(() => {
    const p = pathRef.current;
    if (!p) return;
    const finalLeft = left.current.x + tugLeft.current;
    const finalRight = right.current.x + tugRight.current;
    const totalTravel = travelDistance.current;
    const remainL =
      totalTravel > 0.5
        ? clamp(Math.abs(left.current.target - left.current.x) / totalTravel, 0, 1)
        : 0;
    const remainR =
      totalTravel > 0.5
        ? clamp(Math.abs(right.current.target - right.current.x) / totalTravel, 0, 1)
        : 0;
    const sagFrac = Math.max(remainL, remainR);
    const sagMax = Math.min(totalTravel / SAG_DIVISOR, SAG_MAX);
    const sag = sagMax * sagFrac;
    const controlX = (finalLeft + finalRight) / 2;
    const controlY = BASELINE_Y + sag;
    p.setAttribute(
      "d",
      `M ${finalLeft} ${BASELINE_Y} Q ${controlX} ${controlY} ${finalRight} ${BASELINE_Y}`,
    );
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const dt = clamp((now - lastTick.current) / 1000, 0, 0.05);
    lastTick.current = now;

    const mass = 1 + travelDistance.current * MASS_PER_PX;

    let stillMoving = false;
    for (const ep of [left.current, right.current]) {
      const a = (SPRING_K * (ep.target - ep.x) - SPRING_C * ep.v) / mass;
      ep.v += a * dt;
      ep.x += ep.v * dt;
      if (Math.abs(ep.target - ep.x) > SETTLE_EPS || Math.abs(ep.v) > SETTLE_EPS) {
        stillMoving = true;
      }
    }

    if (now - transitionStart.current > FORCE_SETTLE_MS) {
      left.current.x = left.current.target;
      left.current.v = 0;
      right.current.x = right.current.target;
      right.current.v = 0;
      stillMoving = false;
    }

    let tugMoving = false;
    const easeTo = (cur: number, target: number) => {
      const next = cur + (target - cur) * (1 - Math.exp(-dt / TUG_TAU));
      if (Math.abs(target - next) > 0.02) tugMoving = true;
      return next;
    };
    tugLeft.current = easeTo(tugLeft.current, tugTargetLeft.current);
    tugRight.current = easeTo(tugRight.current, tugTargetRight.current);

    applyPath();

    if (stillMoving || tugMoving) {
      rafId.current = requestAnimationFrame(tick);
    } else {
      rafId.current = null;
    }
  }, [applyPath]);

  const wake = useCallback(() => {
    if (rafId.current == null) {
      lastTick.current = performance.now();
      rafId.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  // Lay out / retarget the rail whenever the active tab or the tab layout
  // (resize, font load) changes.
  useLayoutEffect(() => {
    const pos = measure(activeIndex);
    if (!pos) return;

    if (!laidOut.current) {
      // First layout: snap in place, no travel, no sag.
      left.current = { x: pos.left, v: 0, target: pos.left };
      right.current = { x: pos.right, v: 0, target: pos.right };
      travelDistance.current = 0;
      laidOut.current = true;
      applyPath();
      return;
    }

    const oldCenter = (left.current.x + right.current.x) / 2;
    const newCenter = (pos.left + pos.right) / 2;
    travelDistance.current = Math.abs(newCenter - oldCenter);
    left.current.target = pos.left;
    right.current.target = pos.right;
    transitionStart.current = performance.now();

    if (reduced) {
      left.current = { x: pos.left, v: 0, target: pos.left };
      right.current = { x: pos.right, v: 0, target: pos.right };
      travelDistance.current = 0;
      applyPath();
      setFadeVisible(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setFadeVisible(true)));
      return;
    }

    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, reduced]);

  // Re-measure on container resize (font load, responsive width changes) and
  // keep the SVG's viewBox in lockstep with the tablist's actual pixel width
  // so path coordinates (measured in real px) map 1:1 onto the rendered rail.
  const [railWidthPx, setRailWidthPx] = useState(0);
  useEffect(() => {
    const list = tablistRef.current;
    if (!list) return;
    const resnap = () => {
      setRailWidthPx(list.getBoundingClientRect().width);
      const pos = measure(activeIndex);
      if (!pos) return;
      left.current = { x: pos.left, v: 0, target: pos.left };
      right.current = { x: pos.right, v: 0, target: pos.right };
      travelDistance.current = 0;
      applyPath();
    };
    resnap();
    const ro = new ResizeObserver(resnap);
    ro.observe(list);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Hover tug: nudge whichever endpoint is spatially nearest the hovered,
  // non-active tab 3px toward it.
  useEffect(() => {
    if (reduced) return;
    if (hoverIndex === null || hoverIndex === activeIndex) {
      tugTargetLeft.current = 0;
      tugTargetRight.current = 0;
      wake();
      return;
    }
    const pos = measure(hoverIndex);
    if (!pos) return;
    const hoverCenter = (pos.left + pos.right) / 2;
    const distL = Math.abs(hoverCenter - left.current.x);
    const distR = Math.abs(hoverCenter - right.current.x);
    if (distL <= distR) {
      tugTargetLeft.current = Math.sign(hoverCenter - left.current.x) * TUG_PX;
      tugTargetRight.current = 0;
    } else {
      tugTargetRight.current = Math.sign(hoverCenter - right.current.x) * TUG_PX;
      tugTargetLeft.current = 0;
    }
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverIndex, reduced]);

  const focusTab = (index: number) => {
    tabRefs.current[index]?.focus();
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const count = items.length;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
        next = (activeIndex + 1) % count;
        break;
      case "ArrowLeft":
        next = (activeIndex - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    focusTab(next);
    select(items[next].value);
  };

  return (
    <div className={className} {...rest}>
      <div
        ref={tablistRef}
        role="tablist"
        aria-label={ariaLabel}
        className="relative flex gap-1"
      >
        {items.map((item, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => select(item.value)}
              onKeyDown={onTabKeyDown}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() =>
                setHoverIndex((cur) => (cur === i ? null : cur))
              }
              className={`rounded-sm px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                isActive
                  ? "font-medium text-foreground"
                  : "text-ns-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <svg
          aria-hidden
          focusable="false"
          viewBox={`0 0 ${Math.max(railWidthPx, 1)} ${RAIL_H}`}
          preserveAspectRatio="none"
          width={railWidthPx}
          height={RAIL_H}
          className="pointer-events-none absolute left-0 top-full mt-1 overflow-visible"
          style={
            reduced
              ? { opacity: fadeVisible ? 1 : 0, transition: "opacity 120ms ease-out" }
              : undefined
          }
        >
          <path
            ref={pathRef}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
      {items.map((item, i) => (
        <div
          key={item.value}
          role="tabpanel"
          id={`${baseId}-panel-${item.value}`}
          aria-labelledby={`${baseId}-tab-${item.value}`}
          tabIndex={0}
          hidden={i !== activeIndex}
          className="pt-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
